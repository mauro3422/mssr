import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MSSR_CONSISTENCY_AUTHORITIES,
  MSSR_CONSISTENCY_BOUNDARIES,
  MSSR_CONSISTENCY_ROLES,
  MSSR_CONSISTENCY_OBSERVATION_STATES,
  type MssrConsistencyBoundary,
  type MssrConsistencyObservation,
} from "./consistency-projection.js";
import { evaluateMssrConsistencyDecisionSupport, type MssrConsistencyDecisionSupport } from "./consistency-recommendation.js";
import type { MssrContextDeliveryReceipt } from "./context-message-inbox.js";
import type { MssrContextEvidenceKind, MssrContextEvidenceReference, MssrContextMessage } from "./context-messages.js";
import type { MssrProducerObservation, ProducerSourceKind } from "./context-message-producers.js";

/**
 * C2e Situation Model.
 *
 * This layer does not decide project truth and does not parse arbitrary prose.
 * It normalizes bounded, explicit observations from project knowledge/runtime
 * into the existing C2c consistency contract, then lets C2d rank advisory
 * recovery. Hosts remain responsible for observation/delivery and humans or
 * agents remain responsible for executing any action.
 */
export const MSSR_SITUATION_EVIDENCE_CLASSES = ["observed", "declared", "inferred", "learned"] as const;
export type MssrSituationEvidenceClass = typeof MSSR_SITUATION_EVIDENCE_CLASSES[number];

export const MSSR_SITUATION_CATEGORIES = [
  "project-context",
  "project-memory",
  "project-state",
  "changelog",
  "architecture",
  "incident",
  "release",
  "runtime",
  "provider",
  "verification",
  "routing",
  "lifecycle",
  "maintenance",
  "other",
] as const;
export type MssrSituationCategory = typeof MSSR_SITUATION_CATEGORIES[number];

export const MSSR_SITUATION_NOTICE_CLASSES = ["consistency", "context-refresh", "release-integrity", "runtime-integrity"] as const;
export type MssrSituationNoticeClass = typeof MSSR_SITUATION_NOTICE_CLASSES[number];

const DEFAULT_CONFIDENCE: Record<MssrSituationEvidenceClass, number> = {
  observed: 1,
  declared: 0.9,
  inferred: 0.6,
  learned: 0.5,
};

export const mssrSituationObservationSchema = z.object({
  key: z.string().min(1).max(160),
  observer: z.string().min(1).max(240),
  role: z.enum(MSSR_CONSISTENCY_ROLES),
  authority: z.enum(MSSR_CONSISTENCY_AUTHORITIES),
  state: z.enum(MSSR_CONSISTENCY_OBSERVATION_STATES),
  value: z.string().min(1).max(240).optional(),
  revision: z.string().min(1).max(160).optional(),
  required: z.boolean().default(false),
  category: z.enum(MSSR_SITUATION_CATEGORIES),
  evidenceClass: z.enum(MSSR_SITUATION_EVIDENCE_CLASSES),
  confidence: z.number().min(0).max(1).optional(),
  sourceRef: z.string().min(1).max(240).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.state === "observed" && !value.value && !value.revision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Observed situation evidence requires value or revision." });
  }
  if (value.authority === "canonical" && (value.evidenceClass === "inferred" || value.evidenceClass === "learned")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inferred/learned evidence cannot be a canonical authority." });
  }
});

export type MssrSituationObservation = z.infer<typeof mssrSituationObservationSchema>;

export const mssrSituationModelInputSchema = z.object({
  boundary: z.enum(MSSR_CONSISTENCY_BOUNDARIES).default("ordinary"),
  observations: z.array(mssrSituationObservationSchema).max(128),
}).strict();

export type MssrSituationModelInput = z.input<typeof mssrSituationModelInputSchema>;

export type MssrSituationModelResult = {
  boundary: MssrConsistencyBoundary;
  observations: Array<MssrSituationObservation & { confidence: number }>;
  consistencyObservations: MssrConsistencyObservation[];
  decision: MssrConsistencyDecisionSupport;
  classification: {
    noticeClass: MssrSituationNoticeClass;
    primaryCategory: MssrSituationCategory;
    categories: MssrSituationCategory[];
    level: MssrConsistencyDecisionSupport["level"];
    priority: number;
    advisoryOnly: true;
  };
};

function withConfidence(observation: MssrSituationObservation): MssrSituationObservation & { confidence: number } {
  return { ...observation, confidence: observation.confidence ?? DEFAULT_CONFIDENCE[observation.evidenceClass] };
}

function asConsistencyObservation(observation: MssrSituationObservation): MssrConsistencyObservation {
  return {
    key: observation.key,
    observer: observation.observer,
    role: observation.role,
    authority: observation.authority,
    state: observation.state,
    ...(observation.value ? { value: observation.value } : {}),
    ...(observation.revision ? { revision: observation.revision } : {}),
    ...(observation.required ? { required: true } : {}),
  };
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function noticeClassFor(categories: readonly MssrSituationCategory[]): MssrSituationNoticeClass {
  if (categories.some((category) => category === "runtime" || category === "provider")) return "runtime-integrity";
  if (categories.some((category) => category === "release" || category === "changelog")) return "release-integrity";
  if (categories.some((category) => category === "project-context" || category === "project-memory" || category === "project-state" || category === "architecture")) return "context-refresh";
  return "consistency";
}

function priorityFor(result: MssrConsistencyDecisionSupport, observations: readonly MssrSituationObservation[]): number {
  const levelBase = { ok: 0, watch: 30, review: 65, error: 90 }[result.level];
  const requiredBoost = observations.some((item) => item.required) ? 5 : 0;
  const boundaryBoost = ["pre-execution", "pre-release", "post-restart", "outcome"].includes(result.boundary) ? 5 : 0;
  return Math.max(0, Math.min(100, levelBase + requiredBoost + boundaryBoost));
}

/**
 * Evaluate one bounded situation snapshot.  Reliability metadata is preserved
 * for explanation/calibration, but authority and hard consistency rules remain
 * the source of truth; confidence never promotes inferred/learned evidence to
 * canonical status.
 */
export function evaluateMssrSituationModel(input: MssrSituationModelInput): MssrSituationModelResult {
  const parsed = mssrSituationModelInputSchema.parse(input);
  const observations = parsed.observations.map(withConfidence);
  const consistencyObservations = observations.map(asConsistencyObservation);
  const decision = evaluateMssrConsistencyDecisionSupport({ boundary: parsed.boundary, observations: consistencyObservations });
  const mismatchKeys = new Set(decision.mismatches.map((item) => item.key));
  const relevant = mismatchKeys.size > 0 ? observations.filter((item) => mismatchKeys.has(item.key)) : observations;
  const categories = uniqueSorted(relevant.map((item) => item.category));
  const primaryCategory = categories[0] ?? "other";
  return {
    boundary: parsed.boundary,
    observations,
    consistencyObservations,
    decision,
    classification: {
      noticeClass: noticeClassFor(categories),
      primaryCategory,
      categories,
      level: decision.level,
      priority: priorityFor(decision, observations),
      advisoryOnly: true,
    },
  };
}

function categoryForEvidenceKind(kind: MssrContextEvidenceKind): MssrSituationCategory {
  switch (kind) {
    case "project-context": return "project-context";
    case "project-memory": return "project-memory";
    case "project-state": return "project-state";
    case "changelog": return "changelog";
    case "architecture-decision": return "architecture";
    case "incident": return "incident";
    case "verification": return "verification";
    case "publication": return "release";
    default: return "other";
  }
}

function categoryForSourceKind(kind: ProducerSourceKind): MssrSituationCategory {
  switch (kind) {
    case "project-context": return "project-context";
    case "project-memory": return "project-memory";
    case "project-state": return "project-state";
    case "changelog": return "changelog";
    case "architecture-decision": return "architecture";
    case "incident": return "incident";
    case "provider-receipt": return "provider";
    case "git-receipt": return "release";
  }
}

function roleForCategory(category: MssrSituationCategory, historical = false): MssrConsistencyObservation["role"] {
  if (category === "project-memory") return "memory";
  if (category === "project-state") return "state";
  if (historical) return "receipt";
  return "reference";
}

function revisionKey(owner: string, ref: string): string {
  const digest = createHash("sha256").update(owner).update("\0").update(ref).digest("hex").slice(0, 24);
  return `knowledge.revision:${digest}`;
}

/**
 * Convert current repository observations plus actually selected context
 * messages into revision claims. This is deliberately semantic-free: it can
 * prove that an agent is operating from revision X while the current owner is
 * revision Y without trying to interpret the prose body.
 */
export function buildMssrKnowledgeRevisionSituation(args: {
  repositoryObservations: readonly MssrProducerObservation[];
  selectedMessages?: readonly MssrContextMessage[];
  deliveryReceipts?: readonly MssrContextDeliveryReceipt[];
}): MssrSituationObservation[] {
  const result: MssrSituationObservation[] = [];

  for (const observation of args.repositoryObservations) {
    if (!observation.revision) continue;
    const category = categoryForSourceKind(observation.sourceKind);
    const key = revisionKey(observation.canonicalOwner, observation.ref);
    const canonicalProjectEvidence = observation.authoritative === true
      && observation.provenance === "project"
      && observation.sourceKind !== "git-receipt"
      && observation.sourceKind !== "provider-receipt";
    result.push(mssrSituationObservationSchema.parse({
      key,
      observer: observation.ref,
      role: roleForCategory(category, !canonicalProjectEvidence),
      authority: canonicalProjectEvidence ? "canonical" : "historical",
      state: observation.availability ? "observed" : "unavailable",
      revision: observation.revision,
      category,
      evidenceClass: canonicalProjectEvidence ? "observed" : "declared",
      sourceRef: observation.ref,
      required: observation.required,
    }));
  }

  type HistoricalCandidate = {
    evidence: MssrContextEvidenceReference;
    observer: string;
    required: boolean;
    selectedNow: boolean;
    selectedAtMs: number;
  };
  const historicalBySource = new Map<string, HistoricalCandidate>();
  const sourceIdentity = (evidence: MssrContextEvidenceReference) => `${evidence.canonicalOwner}\0${evidence.ref}`;

  // Durable receipts represent what a previous host/turn was actually delivered.
  // Keep only the newest receipt for each source so an older stale receipt cannot
  // survive after newer evidence for the same authority was delivered.
  for (const receipt of args.deliveryReceipts ?? []) {
    const selectedAtMs = Date.parse(receipt.lastSelectedAt);
    for (const evidence of receipt.sources) {
      if (!evidence.revision) continue;
      const identity = sourceIdentity(evidence);
      const existing = historicalBySource.get(identity);
      if (!existing || selectedAtMs > existing.selectedAtMs || (selectedAtMs === existing.selectedAtMs && receipt.messageId.localeCompare(existing.observer) > 0)) {
        historicalBySource.set(identity, {
          evidence,
          observer: `delivery:${receipt.messageId}:${evidence.ref}`,
          required: false,
          selectedNow: false,
          selectedAtMs,
        });
      }
    }
  }

  // Evidence selected in the current load supersedes every older receipt for the
  // same source. This is what lets a context-refresh notice resolve immediately
  // after an agent reloads the current authority instead of being poisoned by
  // historical receipts retained for audit/tombstone purposes.
  for (const message of args.selectedMessages ?? []) {
    for (const evidence of message.evidence) {
      if (!evidence.revision) continue;
      const identity = sourceIdentity(evidence);
      const existing = historicalBySource.get(identity);
      if (!existing?.selectedNow) {
        historicalBySource.set(identity, {
          evidence,
          observer: `context:${message.id}:${evidence.ref}`,
          required: message.required,
          selectedNow: true,
          selectedAtMs: Number.POSITIVE_INFINITY,
        });
      }
    }
  }

  for (const candidate of historicalBySource.values()) {
    const { evidence } = candidate;
    const category = categoryForEvidenceKind(evidence.kind);
    result.push(mssrSituationObservationSchema.parse({
      key: revisionKey(evidence.canonicalOwner, evidence.ref),
      observer: candidate.observer.slice(0, 240),
      role: roleForCategory(category, true),
      authority: "historical",
      state: evidence.freshness === "unavailable" ? "unavailable" : "observed",
      revision: evidence.revision,
      category,
      evidenceClass: "declared",
      sourceRef: evidence.ref,
      required: candidate.required,
    }));
  }

  const deduplicated = new Map<string, MssrSituationObservation>();
  for (const observation of result) {
    const identity = `${observation.key}|${observation.observer}|${observation.revision ?? ""}|${observation.value ?? ""}`;
    deduplicated.set(identity, observation);
  }
  return [...deduplicated.values()].sort((left, right) => left.key.localeCompare(right.key) || left.observer.localeCompare(right.observer));
}
