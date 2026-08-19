import { createHash } from "node:crypto";
import { z } from "zod";
import {
  architectureImpactProjectionSchema,
  type ArchitectureImpactProjection,
} from "./architecture-impact-projection.js";

export const MSSR_ARCHITECTURE_REVIEWED_CURRENT_SCHEMA_VERSION = 1 as const;

const architectureIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const fingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const revisionSchema = z.string().min(1).max(160).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Revision must be a bounded single-line value.",
);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const architectureReviewedCurrentReceiptSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_REVIEWED_CURRENT_SCHEMA_VERSION),
  architectureId: architectureIdSchema,
  relationshipClass: z.literal("declared"),
  reviewClass: z.literal("reviewed-current"),
  declarationFingerprint: fingerprintSchema,
  reviewedBaselineFingerprint: fingerprintSchema,
  reviewedAuthorityRevision: revisionSchema,
  reviewedSourceSetFingerprint: fingerprintSchema,
  reviewedProjectionFingerprint: fingerprintSchema,
  reviewedAt: isoTimestampSchema,
  receiptFingerprint: fingerprintSchema,
  metadataOnly: z.literal(true),
  advisoryOnly: z.literal(true),
}).strict();

export const architectureReviewedCurrentEvaluationSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_REVIEWED_CURRENT_SCHEMA_VERSION),
  architectureId: architectureIdSchema,
  state: z.enum(["not-applicable", "review-required", "reviewed-current", "receipt-invalidated"]),
  level: z.enum(["ok", "review"]),
  suppressRepeatedReview: z.boolean(),
  reasonCodes: z.array(z.enum([
    "architecture-aligned",
    "review-receipt-missing",
    "review-evidence-incomplete",
    "receipt-architecture-mismatch",
    "declaration-fingerprint-changed",
    "reviewed-baseline-changed",
    "authority-revision-changed",
    "source-set-fingerprint-changed",
    "projection-fingerprint-changed",
    "receipt-fingerprint-invalid",
    "reviewed-current-match",
  ])).min(1).max(8),
  receiptValid: z.boolean(),
  canonicalRewriteAllowed: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict().superRefine((value, ctx) => {
  const expectedSuppression = value.state === "reviewed-current";
  const expectedLevel = value.state === "review-required" || value.state === "receipt-invalidated" ? "review" : "ok";
  if (value.suppressRepeatedReview !== expectedSuppression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Only reviewed-current may suppress repeated review.", path: ["suppressRepeatedReview"] });
  }
  if (value.level !== expectedLevel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Level must be ${expectedLevel} for ${value.state}.`, path: ["level"] });
  }
  if (value.receiptValid !== expectedSuppression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Receipt is valid only for an exact reviewed-current match.", path: ["receiptValid"] });
  }
});

export type ArchitectureReviewedCurrentReceipt = z.infer<typeof architectureReviewedCurrentReceiptSchema>;
export type ArchitectureReviewedCurrentEvaluation = z.infer<typeof architectureReviewedCurrentEvaluationSchema>;

function semanticFingerprint(parts: readonly string[]): string {
  const body = parts.map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

function receiptFingerprint(input: Omit<ArchitectureReviewedCurrentReceipt, "receiptFingerprint">): string {
  return semanticFingerprint([
    "architecture-reviewed-current-receipt-v1",
    input.architectureId,
    input.relationshipClass,
    input.reviewClass,
    input.declarationFingerprint,
    input.reviewedBaselineFingerprint,
    input.reviewedAuthorityRevision,
    input.reviewedSourceSetFingerprint,
    input.reviewedProjectionFingerprint,
    input.reviewedAt,
  ]);
}

/**
 * Create metadata-only host-local evidence after an explicit human/agent review
 * accepted the current complete Architecture Impact evidence as still valid.
 * This does not update an ADR, baseline, link manifest, or canonical authority.
 */
export function createArchitectureReviewedCurrentReceipt(
  projectionInput: ArchitectureImpactProjection,
  review: Readonly<{ decision: "reviewed-current"; reviewedAt: string }>,
): ArchitectureReviewedCurrentReceipt {
  const projection = architectureImpactProjectionSchema.parse(projectionInput);
  const reviewedAt = isoTimestampSchema.parse(review.reviewedAt);
  if (projection.level !== "review" || projection.status !== "possible-impact") {
    throw new Error("Reviewed-current receipt requires an active possible-impact review.");
  }
  if (!projection.evidenceComplete || !projection.currentAuthorityRevision || !projection.currentSourceSetFingerprint) {
    throw new Error("Reviewed-current receipt requires complete current architecture evidence.");
  }

  const base = {
    schemaVersion: MSSR_ARCHITECTURE_REVIEWED_CURRENT_SCHEMA_VERSION,
    architectureId: projection.architectureId,
    relationshipClass: "declared" as const,
    reviewClass: "reviewed-current" as const,
    declarationFingerprint: projection.declarationFingerprint,
    reviewedBaselineFingerprint: projection.baselineFingerprint,
    reviewedAuthorityRevision: projection.currentAuthorityRevision,
    reviewedSourceSetFingerprint: projection.currentSourceSetFingerprint,
    reviewedProjectionFingerprint: projection.fingerprint,
    reviewedAt,
    metadataOnly: true as const,
    advisoryOnly: true as const,
  };
  return architectureReviewedCurrentReceiptSchema.parse({
    ...base,
    receiptFingerprint: receiptFingerprint(base),
  });
}

/**
 * Pure C2f-E decision. Hosts may persist receipts under `.mssr/runtime/` keyed
 * by architectureId. Only an exact match suppresses repeated startup review;
 * any new/incomplete evidence fails open to REVIEW.
 */
export function evaluateArchitectureReviewedCurrent(
  projectionInput: ArchitectureImpactProjection,
  receiptInput?: ArchitectureReviewedCurrentReceipt | null,
): ArchitectureReviewedCurrentEvaluation {
  const projection = architectureImpactProjectionSchema.parse(projectionInput);
  if (projection.level === "ok" || projection.status === "aligned") {
    return architectureReviewedCurrentEvaluationSchema.parse({
      schemaVersion: 1,
      architectureId: projection.architectureId,
      state: "not-applicable",
      level: "ok",
      suppressRepeatedReview: false,
      reasonCodes: ["architecture-aligned"],
      receiptValid: false,
      canonicalRewriteAllowed: false,
      advisoryOnly: true,
    });
  }

  if (!projection.evidenceComplete || !projection.currentAuthorityRevision || !projection.currentSourceSetFingerprint) {
    return architectureReviewedCurrentEvaluationSchema.parse({
      schemaVersion: 1,
      architectureId: projection.architectureId,
      state: "review-required",
      level: "review",
      suppressRepeatedReview: false,
      reasonCodes: ["review-evidence-incomplete"],
      receiptValid: false,
      canonicalRewriteAllowed: false,
      advisoryOnly: true,
    });
  }

  if (!receiptInput) {
    return architectureReviewedCurrentEvaluationSchema.parse({
      schemaVersion: 1,
      architectureId: projection.architectureId,
      state: "review-required",
      level: "review",
      suppressRepeatedReview: false,
      reasonCodes: ["review-receipt-missing"],
      receiptValid: false,
      canonicalRewriteAllowed: false,
      advisoryOnly: true,
    });
  }

  const receipt = architectureReviewedCurrentReceiptSchema.parse(receiptInput);
  const reasons: ArchitectureReviewedCurrentEvaluation["reasonCodes"] = [];
  const { receiptFingerprint: storedReceiptFingerprint, ...receiptBody } = receipt;
  if (storedReceiptFingerprint !== receiptFingerprint(receiptBody)) reasons.push("receipt-fingerprint-invalid");
  if (receipt.architectureId !== projection.architectureId) reasons.push("receipt-architecture-mismatch");
  if (receipt.declarationFingerprint !== projection.declarationFingerprint) reasons.push("declaration-fingerprint-changed");
  if (receipt.reviewedBaselineFingerprint !== projection.baselineFingerprint) reasons.push("reviewed-baseline-changed");
  if (receipt.reviewedAuthorityRevision !== projection.currentAuthorityRevision) reasons.push("authority-revision-changed");
  if (receipt.reviewedSourceSetFingerprint !== projection.currentSourceSetFingerprint) reasons.push("source-set-fingerprint-changed");
  if (receipt.reviewedProjectionFingerprint !== projection.fingerprint) reasons.push("projection-fingerprint-changed");

  if (reasons.length > 0) {
    return architectureReviewedCurrentEvaluationSchema.parse({
      schemaVersion: 1,
      architectureId: projection.architectureId,
      state: "receipt-invalidated",
      level: "review",
      suppressRepeatedReview: false,
      reasonCodes: reasons,
      receiptValid: false,
      canonicalRewriteAllowed: false,
      advisoryOnly: true,
    });
  }

  return architectureReviewedCurrentEvaluationSchema.parse({
    schemaVersion: 1,
    architectureId: projection.architectureId,
    state: "reviewed-current",
    level: "ok",
    suppressRepeatedReview: true,
    reasonCodes: ["reviewed-current-match"],
    receiptValid: true,
    canonicalRewriteAllowed: false,
    advisoryOnly: true,
  });
}
