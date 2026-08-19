import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MAX_ARCHITECTURE_IMPACT_REFS,
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
} from "./architecture-impact.js";
import {
  architectureImpactFileObservationSchema,
  architectureImpactRevisionSchema,
  normalizedArchitectureImpactEvidenceSchema,
  type ArchitectureImpactFileObservation,
  type NormalizedArchitectureImpactEvidence,
} from "./architecture-impact-observation.js";
import type { MssrOperationalNoticeLevel } from "./operational-notices.js";

export const MSSR_ARCHITECTURE_IMPACT_PROJECTION_SCHEMA_VERSION = 1 as const;
export const MSSR_ARCHITECTURE_IMPACT_STATUSES = ["aligned", "possible-impact", "unresolved"] as const;
export const MSSR_ARCHITECTURE_IMPACT_CHANGE_KINDS = ["revision", "availability"] as const;
export const MSSR_ARCHITECTURE_IMPACT_ROLES = ["authority", "impact"] as const;
export const MSSR_ARCHITECTURE_IMPACT_REASON_CODES = [
  "aligned",
  "architecture-authority-revision-changed",
  "architecture-authority-missing",
  "architecture-authority-unavailable",
  "declared-relationship-changed",
  "impact-availability-changed",
  "impact-revision-changed",
  "impact-source-unavailable",
] as const;

const fingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const comparableAvailableSchema = z.object({
  ref: architectureImpactExactRefSchema,
  availability: z.literal("available"),
  revision: architectureImpactRevisionSchema,
}).strict();

const comparableMissingSchema = z.object({
  ref: architectureImpactExactRefSchema,
  availability: z.literal("missing"),
}).strict();

export const architectureImpactComparableFileStateSchema = z.discriminatedUnion("availability", [
  comparableAvailableSchema,
  comparableMissingSchema,
]);

const baselineDeclaredSchema = z.object({
  authorityRef: architectureImpactExactRefSchema,
  contextRef: architectureImpactIdSchema.optional(),
  impactRefs: z.array(architectureImpactExactRefSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
}).strict();

export const architectureImpactReviewedBaselineSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_PROJECTION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  reviewClass: z.literal("reviewed"),
  declared: baselineDeclaredSchema,
  authority: comparableAvailableSchema,
  impacts: z.array(architectureImpactComparableFileStateSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
  declarationFingerprint: fingerprintSchema,
  sourceSetFingerprint: fingerprintSchema,
  baselineFingerprint: fingerprintSchema,
}).strict().superRefine((value, ctx) => {
  if (value.authority.ref !== value.declared.authorityRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reviewed architecture-impact baseline authority must match declared authorityRef.",
      path: ["authority", "ref"],
    });
  }
  if (value.impacts.length !== value.declared.impactRefs.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reviewed architecture-impact baseline must contain every declared impactRef exactly once.",
      path: ["impacts"],
    });
    return;
  }
  for (let index = 0; index < value.declared.impactRefs.length; index += 1) {
    if (value.impacts[index]?.ref !== value.declared.impactRefs[index]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reviewed architecture-impact baseline impacts must preserve declared manifest order.",
        path: ["impacts", index, "ref"],
      });
    }
  }
});

const changeSchema = z.object({
  role: z.enum(MSSR_ARCHITECTURE_IMPACT_ROLES),
  ref: architectureImpactExactRefSchema,
  kind: z.enum(MSSR_ARCHITECTURE_IMPACT_CHANGE_KINDS),
  baseline: architectureImpactComparableFileStateSchema,
  current: architectureImpactComparableFileStateSchema,
}).strict();

export const architectureImpactProjectionSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_PROJECTION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  status: z.enum(MSSR_ARCHITECTURE_IMPACT_STATUSES),
  level: z.enum(["ok", "review"]),
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  declarationFingerprint: fingerprintSchema,
  baselineFingerprint: fingerprintSchema,
  baselineAuthorityRevision: architectureImpactRevisionSchema,
  currentAuthorityRevision: architectureImpactRevisionSchema.nullable(),
  baselineSourceSetFingerprint: fingerprintSchema,
  currentSourceSetFingerprint: fingerprintSchema.nullable(),
  reasonCodes: z.array(z.enum(MSSR_ARCHITECTURE_IMPACT_REASON_CODES)).max(16),
  changes: z.array(changeSchema).max(MAX_ARCHITECTURE_IMPACT_REFS + 1),
  unresolvedRefs: z.array(architectureImpactFileObservationSchema).max(MAX_ARCHITECTURE_IMPACT_REFS + 1),
  evidenceComplete: z.boolean(),
  fingerprint: fingerprintSchema,
  notifyOnWatch: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict();

export type ArchitectureImpactComparableFileState = z.infer<typeof architectureImpactComparableFileStateSchema>;
export type ArchitectureImpactReviewedBaseline = z.infer<typeof architectureImpactReviewedBaselineSchema>;
export type ArchitectureImpactProjectionStatus = typeof MSSR_ARCHITECTURE_IMPACT_STATUSES[number];
export type ArchitectureImpactProjection = z.infer<typeof architectureImpactProjectionSchema>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function semanticHash(label: string, parts: readonly string[]): string {
  const identity = [label, ...parts].map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${sha256(identity)}`;
}

function declaredParts(evidence: NormalizedArchitectureImpactEvidence): string[] {
  return [
    evidence.architectureId,
    evidence.declared.authorityRef,
    evidence.declared.contextRef ?? "no-context-ref",
    ...evidence.declared.impactRefs,
  ];
}

export function buildArchitectureImpactDeclarationFingerprint(
  evidenceInput: NormalizedArchitectureImpactEvidence,
): string {
  const evidence = normalizedArchitectureImpactEvidenceSchema.parse(evidenceInput);
  return semanticHash("architecture-impact-declaration-v1", declaredParts(evidence));
}

function comparableState(observation: ArchitectureImpactFileObservation): ArchitectureImpactComparableFileState | null {
  if (observation.availability === "unavailable") return null;
  return architectureImpactComparableFileStateSchema.parse(observation);
}

function sourceStatePart(observation: ArchitectureImpactComparableFileState): string {
  return observation.availability === "available"
    ? `${observation.ref}|available|${observation.revision}`
    : `${observation.ref}|missing`;
}

function buildSourceSetFingerprint(
  architectureId: string,
  impacts: readonly ArchitectureImpactComparableFileState[],
): string {
  return semanticHash("architecture-impact-source-set-v1", [
    architectureId,
    ...impacts.map(sourceStatePart),
  ]);
}

function buildBaselineFingerprint(input: Readonly<{
  architectureId: string;
  declarationFingerprint: string;
  authorityRevision: string;
  sourceSetFingerprint: string;
}>): string {
  return semanticHash("architecture-impact-reviewed-baseline-v1", [
    input.architectureId,
    input.declarationFingerprint,
    input.authorityRevision,
    input.sourceSetFingerprint,
  ]);
}

/**
 * Build a portable reviewed baseline only when the caller explicitly confirms
 * that the fully comparable C2f-B evidence was reviewed. This function performs
 * no persistence; C2f-E owns host-local reviewed-current receipts.
 */
export function createArchitectureImpactReviewedBaseline(
  evidenceInput: NormalizedArchitectureImpactEvidence,
  review: Readonly<{ reviewed: true }>,
): ArchitectureImpactReviewedBaseline {
  if (review.reviewed !== true) throw new Error("Architecture-impact baseline creation requires explicit reviewed=true confirmation.");
  const evidence = normalizedArchitectureImpactEvidenceSchema.parse(evidenceInput);

  if (evidence.observed.authority.availability !== "available") {
    throw new Error("Architecture-impact reviewed baseline requires an available canonical architecture authority.");
  }

  const impacts = evidence.observed.impacts.map((item) => comparableState(item));
  const unavailable = evidence.observed.impacts.filter((item) => item.availability === "unavailable");
  if (unavailable.length > 0 || impacts.some((item) => item === null)) {
    throw new Error(
      `Architecture-impact reviewed baseline requires comparable impact evidence; unavailable refs: ${unavailable.map((item) => item.ref).join(", ")}`,
    );
  }

  const comparableImpacts = impacts as ArchitectureImpactComparableFileState[];
  const declarationFingerprint = buildArchitectureImpactDeclarationFingerprint(evidence);
  const sourceSetFingerprint = buildSourceSetFingerprint(evidence.architectureId, comparableImpacts);
  const baselineFingerprint = buildBaselineFingerprint({
    architectureId: evidence.architectureId,
    declarationFingerprint,
    authorityRevision: evidence.observed.authority.revision,
    sourceSetFingerprint,
  });

  return architectureImpactReviewedBaselineSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_IMPACT_PROJECTION_SCHEMA_VERSION,
    architectureId: evidence.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    reviewClass: "reviewed",
    declared: evidence.declared,
    authority: evidence.observed.authority,
    impacts: comparableImpacts,
    declarationFingerprint,
    sourceSetFingerprint,
    baselineFingerprint,
  });
}

function validateBaselineIntegrity(baselineInput: ArchitectureImpactReviewedBaseline): ArchitectureImpactReviewedBaseline {
  const baseline = architectureImpactReviewedBaselineSchema.parse(baselineInput);
  const declarationFingerprint = semanticHash("architecture-impact-declaration-v1", [
    baseline.architectureId,
    baseline.declared.authorityRef,
    baseline.declared.contextRef ?? "no-context-ref",
    ...baseline.declared.impactRefs,
  ]);
  const sourceSetFingerprint = buildSourceSetFingerprint(baseline.architectureId, baseline.impacts);
  const baselineFingerprint = buildBaselineFingerprint({
    architectureId: baseline.architectureId,
    declarationFingerprint,
    authorityRevision: baseline.authority.revision,
    sourceSetFingerprint,
  });

  if (baseline.declarationFingerprint !== declarationFingerprint
    || baseline.sourceSetFingerprint !== sourceSetFingerprint
    || baseline.baselineFingerprint !== baselineFingerprint) {
    throw new Error("Architecture-impact reviewed baseline fingerprint integrity check failed.");
  }
  return baseline;
}

export function validateArchitectureImpactReviewedBaseline(
  baselineInput: ArchitectureImpactReviewedBaseline,
): ArchitectureImpactReviewedBaseline {
  return validateBaselineIntegrity(baselineInput);
}

function comparableChange(
  role: "authority" | "impact",
  baseline: ArchitectureImpactComparableFileState,
  current: ArchitectureImpactComparableFileState,
): z.infer<typeof changeSchema> | null {
  if (baseline.availability !== current.availability) {
    return changeSchema.parse({ role, ref: current.ref, kind: "availability", baseline, current });
  }
  if (baseline.availability === "available" && current.availability === "available" && baseline.revision !== current.revision) {
    return changeSchema.parse({ role, ref: current.ref, kind: "revision", baseline, current });
  }
  return null;
}

function projectionFingerprint(input: Readonly<{
  architectureId: string;
  status: ArchitectureImpactProjectionStatus;
  declarationFingerprint: string;
  baselineFingerprint: string;
  currentAuthorityRevision: string | null;
  currentSourceSetFingerprint: string | null;
  reasonCodes: readonly string[];
  changes: readonly z.infer<typeof changeSchema>[];
  unresolvedRefs: readonly ArchitectureImpactFileObservation[];
}>): string {
  return semanticHash("architecture-impact-projection-v1", [
    input.architectureId,
    input.status,
    input.declarationFingerprint,
    input.baselineFingerprint,
    input.currentAuthorityRevision ?? "no-authority-revision",
    input.currentSourceSetFingerprint ?? "no-source-set-fingerprint",
    ...input.reasonCodes,
    ...input.changes.map((item) => [
      item.role,
      item.ref,
      item.kind,
      sourceStatePart(item.baseline),
      sourceStatePart(item.current),
    ].join("|")),
    ...input.unresolvedRefs.map((item) => item.availability === "unavailable"
      ? `${item.ref}|unavailable|${item.reasonCode ?? "no-reason"}`
      : `${item.ref}|${item.availability}`),
  ]);
}

/**
 * C2f-C pure projection. A changed declared source or architecture authority
 * means review-worthy possible impact, never proof that architecture changed.
 * Missing/failed comparison evidence becomes unresolved rather than aligned.
 * This function emits no Operational Notice and persists no receipt.
 */
export function evaluateArchitectureImpactProjection(input: Readonly<{
  baseline: ArchitectureImpactReviewedBaseline;
  current: NormalizedArchitectureImpactEvidence;
}>): ArchitectureImpactProjection {
  const baseline = validateBaselineIntegrity(input.baseline);
  const current = normalizedArchitectureImpactEvidenceSchema.parse(input.current);
  if (baseline.architectureId !== current.architectureId) {
    throw new Error(`Architecture-impact baseline architectureId mismatch: expected ${baseline.architectureId}, received ${current.architectureId}`);
  }

  const declarationFingerprint = buildArchitectureImpactDeclarationFingerprint(current);
  const reasons = new Set<typeof MSSR_ARCHITECTURE_IMPACT_REASON_CODES[number]>();
  const changes: z.infer<typeof changeSchema>[] = [];
  const unresolvedRefs: ArchitectureImpactFileObservation[] = [];

  const currentAuthorityRevision = current.observed.authority.availability === "available"
    ? current.observed.authority.revision
    : null;

  const comparableImpacts = current.observed.impacts.map((item) => comparableState(item));
  const impactEvidenceComplete = comparableImpacts.every((item) => item !== null);
  const currentSourceSetFingerprint = impactEvidenceComplete
    ? buildSourceSetFingerprint(current.architectureId, comparableImpacts as ArchitectureImpactComparableFileState[])
    : null;

  let status: ArchitectureImpactProjectionStatus;
  let evidenceComplete = true;

  if (declarationFingerprint !== baseline.declarationFingerprint) {
    status = "unresolved";
    evidenceComplete = false;
    reasons.add("declared-relationship-changed");
  } else if (current.observed.authority.availability !== "available") {
    status = "unresolved";
    evidenceComplete = false;
    unresolvedRefs.push(current.observed.authority);
    reasons.add(current.observed.authority.availability === "missing"
      ? "architecture-authority-missing"
      : "architecture-authority-unavailable");
  } else if (!impactEvidenceComplete) {
    status = "unresolved";
    evidenceComplete = false;
    for (const item of current.observed.impacts) {
      if (item.availability === "unavailable") unresolvedRefs.push(item);
    }
    reasons.add("impact-source-unavailable");
  } else {
    const authorityChange = comparableChange("authority", baseline.authority, current.observed.authority);
    if (authorityChange) {
      changes.push(authorityChange);
      reasons.add("architecture-authority-revision-changed");
    }

    for (let index = 0; index < baseline.impacts.length; index += 1) {
      const change = comparableChange(
        "impact",
        baseline.impacts[index],
        (comparableImpacts as ArchitectureImpactComparableFileState[])[index],
      );
      if (!change) continue;
      changes.push(change);
      reasons.add(change.kind === "revision" ? "impact-revision-changed" : "impact-availability-changed");
    }

    if (changes.length > 0
      || currentSourceSetFingerprint !== baseline.sourceSetFingerprint
      || current.observed.authority.revision !== baseline.authority.revision) {
      status = "possible-impact";
    } else {
      status = "aligned";
      reasons.add("aligned");
    }
  }

  const reasonCodes = [...reasons].sort();
  const level: MssrOperationalNoticeLevel = status === "aligned" ? "ok" : "review";
  const fingerprint = projectionFingerprint({
    architectureId: current.architectureId,
    status,
    declarationFingerprint,
    baselineFingerprint: baseline.baselineFingerprint,
    currentAuthorityRevision,
    currentSourceSetFingerprint,
    reasonCodes,
    changes,
    unresolvedRefs,
  });

  return architectureImpactProjectionSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_IMPACT_PROJECTION_SCHEMA_VERSION,
    architectureId: current.architectureId,
    status,
    level,
    relationshipClass: "declared",
    evidenceClass: "observed",
    declarationFingerprint,
    baselineFingerprint: baseline.baselineFingerprint,
    baselineAuthorityRevision: baseline.authority.revision,
    currentAuthorityRevision,
    baselineSourceSetFingerprint: baseline.sourceSetFingerprint,
    currentSourceSetFingerprint,
    reasonCodes,
    changes,
    unresolvedRefs,
    evidenceComplete,
    fingerprint,
    notifyOnWatch: false,
    advisoryOnly: true,
  });
}
