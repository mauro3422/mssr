import { z } from "zod";
import {
  MSSR_CONSISTENCY_AUTHORITIES,
  MSSR_CONSISTENCY_OBSERVATION_STATES,
  type MssrConsistencyRole,
} from "./consistency-projection.js";
import {
  mssrSituationObservationSchema,
  type MssrSituationCategory,
  type MssrSituationEvidenceClass,
  type MssrSituationObservation,
} from "./situation-model.js";

/**
 * C2e-D explicit semantic claim producers.
 *
 * These inputs are already-structured facts supplied by a repository/host
 * contract. This module never reads or interprets arbitrary PROJECT_*, ADR,
 * changelog, runtime-log, test-log, prompt, or transcript prose.
 */
export const MSSR_SITUATION_CLAIM_KINDS = [
  "release-version",
  "state-value",
  "ownership",
  "decision-revision",
] as const;
export type MssrSituationClaimKind = typeof MSSR_SITUATION_CLAIM_KINDS[number];

export const MSSR_SITUATION_CLAIM_SOURCES = [
  "project-context",
  "project-memory",
  "project-state",
  "changelog",
  "architecture-decision",
  "source",
  "generated",
  "installed",
  "manifest",
  "git",
  "runtime",
  "test",
  "verification",
  "provider",
] as const;
export type MssrSituationClaimSource = typeof MSSR_SITUATION_CLAIM_SOURCES[number];

const boundedScalarSchema = z.string().min(1).max(160).refine(
  (value) => !/[\r\n]/.test(value),
  "Semantic claim values must be bounded single-line scalars, not prose blocks.",
);

export const mssrSituationSemanticClaimSchema = z.object({
  kind: z.enum(MSSR_SITUATION_CLAIM_KINDS),
  subject: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/),
  source: z.enum(MSSR_SITUATION_CLAIM_SOURCES),
  sourceRef: z.string().min(1).max(200).refine(
    (value) => !/[\r\n]/.test(value),
    "Semantic claim sourceRef must be a bounded single-line reference.",
  ),
  authority: z.enum(MSSR_CONSISTENCY_AUTHORITIES),
  state: z.enum(MSSR_CONSISTENCY_OBSERVATION_STATES).default("observed"),
  value: boundedScalarSchema.optional(),
  revision: boundedScalarSchema.optional(),
  required: z.boolean().default(false),
}).strict().superRefine((claim, ctx) => {
  if (claim.state !== "observed") {
    if (claim.value !== undefined || claim.revision !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unavailable/unknown semantic claims must not carry comparable value/revision payloads.",
      });
    }
    return;
  }

  if (claim.kind === "decision-revision") {
    if (!claim.revision) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decision-revision claims require revision." });
    }
    if (claim.value !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decision-revision claims use revision, not value." });
    }
    return;
  }

  if (!claim.value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${claim.kind} claims require value.` });
  }
  if (claim.revision !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${claim.kind} claims use value, not revision.` });
  }
});

export const mssrSituationSemanticClaimBatchSchema = z.array(mssrSituationSemanticClaimSchema).max(128);
export type MssrSituationSemanticClaim = z.infer<typeof mssrSituationSemanticClaimSchema>;

const SOURCE_RULES: Record<MssrSituationClaimSource, {
  role: MssrConsistencyRole;
  evidenceClass: Extract<MssrSituationEvidenceClass, "observed" | "declared">;
  category?: MssrSituationCategory;
}> = {
  "project-context": { role: "reference", evidenceClass: "declared", category: "project-context" },
  "project-memory": { role: "memory", evidenceClass: "declared", category: "project-memory" },
  "project-state": { role: "state", evidenceClass: "declared", category: "project-state" },
  changelog: { role: "reference", evidenceClass: "declared", category: "changelog" },
  "architecture-decision": { role: "reference", evidenceClass: "declared", category: "architecture" },
  source: { role: "source", evidenceClass: "observed" },
  generated: { role: "generated", evidenceClass: "observed" },
  installed: { role: "installed", evidenceClass: "observed" },
  manifest: { role: "source", evidenceClass: "observed" },
  git: { role: "source", evidenceClass: "observed", category: "release" },
  runtime: { role: "runtime", evidenceClass: "observed", category: "runtime" },
  test: { role: "reference", evidenceClass: "observed", category: "verification" },
  verification: { role: "reference", evidenceClass: "observed", category: "verification" },
  provider: { role: "other", evidenceClass: "observed", category: "provider" },
};

function categoryForClaim(kind: MssrSituationClaimKind, source: MssrSituationClaimSource): MssrSituationCategory {
  const fixed = SOURCE_RULES[source].category;
  if (fixed) return fixed;
  if (kind === "release-version") return "release";
  if (kind === "ownership" || kind === "decision-revision") return "architecture";
  return "other";
}

/** Stable cross-host semantic key. The subject is an explicit identifier, not extracted prose. */
export function mssrSituationSemanticClaimKey(
  claim: Pick<MssrSituationSemanticClaim, "kind" | "subject">,
): string {
  return `semantic.${claim.kind}:${claim.subject}`;
}

/**
 * Normalize explicit semantic producer facts into the existing Situation Model
 * vocabulary. C2c remains the consistency owner and C2d remains the recovery
 * recommendation owner.
 */
export function buildMssrSemanticClaimSituation(
  claims: readonly MssrSituationSemanticClaim[],
): MssrSituationObservation[] {
  const parsed = mssrSituationSemanticClaimBatchSchema.parse(claims);

  return parsed
    .map((claim) => {
      const sourceRule = SOURCE_RULES[claim.source];
      return mssrSituationObservationSchema.parse({
        key: mssrSituationSemanticClaimKey(claim),
        observer: `${claim.source}:${claim.sourceRef}`,
        role: sourceRule.role,
        authority: claim.authority,
        state: claim.state,
        ...(claim.value ? { value: claim.value } : {}),
        ...(claim.revision ? { revision: claim.revision } : {}),
        required: claim.required,
        category: categoryForClaim(claim.kind, claim.source),
        evidenceClass: sourceRule.evidenceClass,
        sourceRef: claim.sourceRef,
      });
    })
    .sort((left, right) => left.key.localeCompare(right.key) || left.observer.localeCompare(right.observer));
}
