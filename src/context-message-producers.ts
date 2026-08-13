import { z } from "zod";
import {
  MSSR_CONTEXT_EVIDENCE_KINDS,
  MSSR_CONTEXT_FRESHNESS,
  MSSR_CONTEXT_PROVENANCE,
  type MssrContextMessage,
  type MssrContextEvidenceReference,
  type MssrContextFreshness,
  mssrContextEvidenceReferenceSchema,
  mssrContextMessageSchema,
} from "./context-messages.js";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_SIGNALS,
  SKILL_STAGES,
} from "./skill-routing.js";

export const PRODUCER_SOURCE_KINDS = [
  "architecture-decision",
  "incident",
  "changelog",
  "project-context",
  "project-memory",
  "project-state",
  "git-receipt",
  "provider-receipt",
] as const;
export type ProducerSourceKind = typeof PRODUCER_SOURCE_KINDS[number];

export const mssrProducerObservationSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/),
  sourceKind: z.enum(PRODUCER_SOURCE_KINDS),
  ref: z.string().min(1).max(240),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  canonicalOwner: z.string().min(1).max(120),
  provenance: z.enum(MSSR_CONTEXT_PROVENANCE),
  availability: z.boolean(),
  authoritative: z.boolean().default(false),
  observedAt: z.string().datetime({ offset: true }).optional(),
  revision: z.string().min(1).max(160).optional(),
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
  severity: z.enum(["info", "attention", "warning"]).default("info"),
  advisoryActions: z.array(z.enum([
    "inspect-reference",
    "load-context",
    "replan",
    "verify-runtime",
    "record-decision",
    "record-incident",
    "refresh-provider",
    "resume-trace",
  ])).max(4).optional(),
  required: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  estimatedChars: z.number().int().min(40).max(2_000).default(320),
}).strict().superRefine((value, ctx) => {
  if (value.availability && !value.observedAt && !value.revision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Available observation requires observedAt or revision." });
  }
});

export const mssrProducerObservationBatchSchema = z.array(mssrProducerObservationSchema).max(32);

export type MssrProducerObservation = z.infer<typeof mssrProducerObservationSchema>;

type SourceMapping = {
  evidenceKind: typeof MSSR_CONTEXT_EVIDENCE_KINDS[number];
  messageKind: MssrContextMessage["kind"];
  defaultAdvisoryActions: readonly MssrContextMessage["advisoryActions"][number][];
};

const SOURCE_MAP: Record<ProducerSourceKind, SourceMapping> = {
  "architecture-decision": {
    evidenceKind: "architecture-decision",
    messageKind: "architecture-decision",
    defaultAdvisoryActions: ["inspect-reference", "record-decision"],
  },
  incident: {
    evidenceKind: "incident",
    messageKind: "related-incident",
    defaultAdvisoryActions: ["record-incident"],
  },
  changelog: {
    evidenceKind: "changelog",
    messageKind: "recent-changelog",
    defaultAdvisoryActions: ["load-context"],
  },
  "project-context": {
    evidenceKind: "project-context",
    messageKind: "context-request",
    defaultAdvisoryActions: ["load-context"],
  },
  "project-memory": {
    evidenceKind: "project-memory",
    messageKind: "context-request",
    defaultAdvisoryActions: ["load-context"],
  },
  "project-state": {
    evidenceKind: "project-state",
    messageKind: "context-request",
    defaultAdvisoryActions: ["load-context"],
  },
  "git-receipt": {
    evidenceKind: "publication",
    messageKind: "publication-receipt-stale",
    defaultAdvisoryActions: ["verify-runtime"],
  },
  "provider-receipt": {
    evidenceKind: "verification",
    messageKind: "provider-degraded",
    defaultAdvisoryActions: ["refresh-provider", "verify-runtime"],
  },
};

/**
 * Derives the freshness an observation projects onto evidence.  An unavailable
 * survey is `unavailable`.  A caller-supplied receipt only proves an
 * observation happened; without the contract marking the observation as
 * authoritative it cannot prove the evidence is current, so it degrades to
 * `unknown`.  Only an `authoritative` available observation is `fresh`.
 */
function inferFreshness(obs: MssrProducerObservation): MssrContextFreshness {
  if (!obs.availability) return "unavailable";
  if (!obs.authoritative) return "unknown";
  return "fresh";
}

/**
 * Builds a deterministic, schema-bounded dedupe key from the stable evidence
 * identity (`sourceKind:canonicalOwner:ref`) rather than from the caller's
 * message `id`, so the same logical evidence maps to one key across hosts.
 */
export function deterministicProducerDedupeKey(
  obs: Pick<MssrProducerObservation, "sourceKind" | "canonicalOwner" | "ref" | "id">,
): string {
  const raw = `${obs.sourceKind}:${obs.canonicalOwner}:${obs.ref}`.toLowerCase();
  const sanitized = raw
    .replace(/[^a-z0-9._:-]/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 120);
  if (sanitized.length >= 2) return sanitized;
  return `${obs.id}:entry`.slice(0, 120);
}

export function produceContextMessages(
  observations: readonly MssrProducerObservation[],
): MssrContextMessage[] {
  // The batch bound is a hard cap on the observation queue; the produced
  // message list is proportionally bounded at the same size.
  const validatedBatch = mssrProducerObservationBatchSchema.parse(observations);

  return validatedBatch.map((obs) => {
    const mapping = SOURCE_MAP[obs.sourceKind];
    const freshness = inferFreshness(obs);

    const evidence: MssrContextEvidenceReference[] = [];
    if (obs.observedAt || obs.revision) {
      evidence.push(
        mssrContextEvidenceReferenceSchema.parse({
          kind: mapping.evidenceKind,
          ref: obs.ref,
          summary: obs.summary,
          canonicalOwner: obs.canonicalOwner,
          provenance: obs.provenance,
          freshness,
          ...(obs.observedAt ? { observedAt: obs.observedAt } : {}),
          ...(obs.revision ? { revision: obs.revision } : {}),
        }),
      );
    }

    const advisoryActions = obs.advisoryActions ?? [...mapping.defaultAdvisoryActions];

    return mssrContextMessageSchema.parse({
      id: obs.id,
      dedupeKey: deterministicProducerDedupeKey(obs),
      kind: mapping.messageKind,
      severity: obs.severity,
      title: obs.title,
      summary: obs.summary,
      evidence,
      advisoryActions,
      stages: obs.stages,
      domains: obs.domains,
      actions: obs.actions,
      artifacts: obs.artifacts,
      needs: obs.needs,
      signals: obs.signals,
      required: obs.required,
      priority: obs.priority,
      estimatedChars: obs.estimatedChars,
    });
  });
}

export function produceSingleContextMessage(
  observation: MssrProducerObservation,
): MssrContextMessage {
  return produceContextMessages([observation])[0];
}
