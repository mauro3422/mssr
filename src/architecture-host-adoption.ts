import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  architectureImpactManifestSchema,
  findArchitectureImpactForTouchedRefs,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import {
  architectureImpactHostEvidenceSchema,
  architectureImpactObservationPlanSchema,
  normalizeArchitectureImpactObservationEvidence,
  planArchitectureImpactObservations,
  type ArchitectureImpactHostEvidence,
  type ArchitectureImpactObservationPlan,
} from "./architecture-impact-observation.js";
import {
  architectureImpactProjectionSchema,
  architectureImpactReviewedBaselineSchema,
  evaluateArchitectureImpactProjection,
  type ArchitectureImpactReviewedBaseline,
} from "./architecture-impact-projection.js";
import {
  architectureReviewedCurrentEvaluationSchema,
  architectureReviewedCurrentReceiptSchema,
  evaluateArchitectureReviewedCurrent,
  type ArchitectureReviewedCurrentReceipt,
} from "./architecture-reviewed-current.js";
import {
  architectureContextFeedbackSchema,
  buildArchitectureContextFeedback,
} from "./architecture-context-feedback.js";
import {
  architectureStructureManifestSchema,
  architectureMarkdownAnchorIdSchema,
  validateArchitectureStructureAgainstImpactManifest,
  type ArchitectureStructureManifest,
} from "./architecture-impact-structure.js";
import {
  architectureSymbolAnalysisPlanSchema,
  planArchitectureSymbolAnalysis,
} from "./architecture-symbol-analysis.js";
import {
  architectureStructuralEvidenceSchema,
  architectureStructuralReviewedBaselineSchema,
  architectureStructuralRefinementSchema,
  type ArchitectureStructuralEvidence,
  type ArchitectureStructuralReviewedBaseline,
} from "./architecture-structural-contract.js";
import { evaluateArchitectureStructuralRefinement } from "./architecture-structural-refinement.js";
import {
  architectureDerivedGraphCandidatesSchema,
  architectureGraphHostEvidenceSchema,
  deriveArchitectureGraphCandidates,
  type ArchitectureGraphHostEvidence,
} from "./architecture-derived-graph.js";
import {
  architectureInvariantEvaluationSchema,
  architectureInvariantGraphEvidenceSchema,
  architectureInvariantManifestSchema,
  architectureInvariantRuleSchema,
  evaluateArchitectureInvariants,
  validateArchitectureInvariantManifestAgainstImpactManifest,
  type ArchitectureInvariantGraphEvidence,
  type ArchitectureInvariantManifest,
} from "./architecture-invariants.js";
import {
  projectContextManifestSchema,
  type ProjectContextManifest,
} from "./project-context.js";

export const MSSR_ARCHITECTURE_HOST_ADOPTION_SCHEMA_VERSION = 2 as const;

const touchedMatchSchema = z.object({
  architectureId: architectureImpactIdSchema,
  authorityRef: architectureImpactExactRefSchema,
  contextRef: architectureImpactIdSchema.optional(),
  matchedRefs: z.array(z.object({
    ref: architectureImpactExactRefSchema,
    role: z.enum(["authority", "impact"]),
  }).strict()).min(1),
}).strict();

const architectureHostStructuralPlanSchema = z.object({
  authorityAnchors: z.array(architectureMarkdownAnchorIdSchema),
  symbolAnalysisPlans: z.array(architectureSymbolAnalysisPlanSchema),
}).strict();

const architectureHostDerivedGraphPlanSchema = z.object({
  optional: z.literal(true),
  relationshipClass: z.literal("derived"),
  canonicalReviewEligible: z.literal(false),
}).strict();

const architectureHostInvariantPlanSchema = z.object({
  rules: z.array(architectureInvariantRuleSchema),
}).strict();

const architectureHostOptionalEvidencePlanSchema = z.object({
  structural: architectureHostStructuralPlanSchema.nullable(),
  derivedGraph: architectureHostDerivedGraphPlanSchema,
  invariants: architectureHostInvariantPlanSchema.nullable(),
  analyzersRequired: z.literal(false),
}).strict();

export const architectureHostAdoptionPlanItemSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_HOST_ADOPTION_SCHEMA_VERSION),
  touch: touchedMatchSchema,
  observationPlan: architectureImpactObservationPlanSchema,
  optionalEvidence: architectureHostOptionalEvidencePlanSchema,
  semanticOwner: z.literal("mssr"),
  hostOwnsObservation: z.literal(true),
  advisoryOnly: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.touch.architectureId !== value.observationPlan.architectureId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Host-adoption touch and observation plan must reference the same architectureId.",
      path: ["observationPlan", "architectureId"],
    });
  }
  if (value.touch.authorityRef !== value.observationPlan.authorityRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Host-adoption observation authority must match the touched architecture declaration.",
      path: ["observationPlan", "authorityRef"],
    });
  }
  for (const plan of value.optionalEvidence.structural?.symbolAnalysisPlans ?? []) {
    if (plan.architectureId !== value.touch.architectureId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host-adoption symbol analysis plans must remain scoped to the touched architecture.",
        path: ["optionalEvidence", "structural", "symbolAnalysisPlans"],
      });
    }
  }
  for (const rule of value.optionalEvidence.invariants?.rules ?? []) {
    if (rule.architectureId !== value.touch.architectureId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host-adoption invariant rules must remain scoped to the touched architecture.",
        path: ["optionalEvidence", "invariants", "rules"],
      });
    }
  }
});

const architectureAttentionLevelSchema = z.enum(["ok", "watch", "review"]);

export const architectureHostAdoptionEvaluationSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_HOST_ADOPTION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  projection: architectureImpactProjectionSchema,
  reviewedCurrent: architectureReviewedCurrentEvaluationSchema,
  structuralRefinement: architectureStructuralRefinementSchema.nullable(),
  derivedGraph: architectureDerivedGraphCandidatesSchema.nullable(),
  invariants: z.array(architectureInvariantEvaluationSchema),
  attentionLevel: architectureAttentionLevelSchema,
  reviewRequired: z.boolean(),
  replanRequired: z.boolean(),
  contextFeedback: architectureContextFeedbackSchema.nullable(),
  semanticOwner: z.literal("mssr"),
  canonicalRewriteAllowed: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict().superRefine((value, ctx) => {
  const expectedReview = value.attentionLevel === "review";
  if (value.reviewRequired !== expectedReview || value.replanRequired !== expectedReview) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Host-adoption review/replan flags must follow aggregate architecture attention.",
      path: ["reviewRequired"],
    });
  }
  if (expectedReview !== (value.contextFeedback !== null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Host-adoption context feedback exists exactly when aggregate architecture review is active.",
      path: ["contextFeedback"],
    });
  }
  for (const item of [value.structuralRefinement, value.derivedGraph, ...value.invariants]) {
    if (item && item.architectureId !== value.architectureId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host-adoption optional evidence outputs must remain scoped to the evaluated architecture.",
        path: ["architectureId"],
      });
    }
  }
});

export type ArchitectureHostAdoptionPlanItem = z.infer<typeof architectureHostAdoptionPlanItemSchema>;
export type ArchitectureHostAdoptionEvaluation = z.infer<typeof architectureHostAdoptionEvaluationSchema>;

export type PlanArchitectureHostAdoptionOptions = Readonly<{
  structureManifest?: ArchitectureStructureManifest | null;
  invariantManifest?: ArchitectureInvariantManifest | null;
}>;

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function attentionRank(level: "ok" | "watch" | "review"): number {
  return level === "ok" ? 0 : level === "watch" ? 1 : 2;
}

function maxAttention(
  left: "ok" | "watch" | "review",
  right: "ok" | "watch" | "review",
): "ok" | "watch" | "review" {
  return attentionRank(right) > attentionRank(left) ? right : left;
}

/**
 * Portable pre-edit host-adoption boundary. The host reports exact refs it is
 * about to touch; MSSR resolves only already-declared architecture relations.
 * Optional structural and invariant declarations add observation guidance only:
 * analyzers remain host-owned and optional, and derived graph discovery can never
 * widen the declared architecture scope.
 */
export function planArchitectureHostAdoption(
  manifestInput: ArchitectureImpactManifest,
  touchedRefsInput: readonly string[],
  options: PlanArchitectureHostAdoptionOptions = {},
): ArchitectureHostAdoptionPlanItem[] {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  const touchMatches = findArchitectureImpactForTouchedRefs(manifest, touchedRefsInput);
  const observationPlans = new Map(
    planArchitectureImpactObservations(manifest).map((plan) => [plan.architectureId, plan] as const),
  );
  const structure = options.structureManifest == null
    ? null
    : validateArchitectureStructureAgainstImpactManifest(
      architectureStructureManifestSchema.parse(options.structureManifest),
      manifest,
    );
  const symbolPlans = structure ? planArchitectureSymbolAnalysis(manifest, structure) : [];
  const invariants = options.invariantManifest == null
    ? null
    : validateArchitectureInvariantManifestAgainstImpactManifest(
      architectureInvariantManifestSchema.parse(options.invariantManifest),
      manifest,
    );

  return touchMatches.map((touch) => {
    const structureEntry = structure?.architectures.find((entry) => entry.architectureId === touch.architectureId);
    const rules = invariants?.invariants.filter((rule) => rule.architectureId === touch.architectureId) ?? [];
    return architectureHostAdoptionPlanItemSchema.parse({
      schemaVersion: MSSR_ARCHITECTURE_HOST_ADOPTION_SCHEMA_VERSION,
      touch,
      observationPlan: observationPlans.get(touch.architectureId),
      optionalEvidence: {
        structural: structureEntry ? {
          authorityAnchors: structureEntry.authorityAnchors ?? [],
          symbolAnalysisPlans: symbolPlans.filter((plan) => plan.architectureId === touch.architectureId),
        } : null,
        derivedGraph: {
          optional: true,
          relationshipClass: "derived",
          canonicalReviewEligible: false,
        },
        invariants: rules.length > 0 ? { rules } : null,
        analyzersRequired: false,
      },
      semanticOwner: "mssr",
      hostOwnsObservation: true,
      advisoryOnly: true,
    });
  });
}

export type EvaluateArchitectureHostAdoptionArgs = Readonly<{
  architectureManifest: ArchitectureImpactManifest;
  plan: ArchitectureHostAdoptionPlanItem;
  baseline: ArchitectureImpactReviewedBaseline;
  hostEvidence: ArchitectureImpactHostEvidence;
  projectContextManifest: ProjectContextManifest;
  reviewedCurrentReceipt?: ArchitectureReviewedCurrentReceipt | null;
  structureManifest?: ArchitectureStructureManifest | null;
  structuralBaseline?: ArchitectureStructuralReviewedBaseline | null;
  structuralEvidence?: ArchitectureStructuralEvidence | null;
  derivedGraphEvidence?: ArchitectureGraphHostEvidence | null;
  invariantManifest?: ArchitectureInvariantManifest | null;
  invariantGraphEvidence?: ArchitectureInvariantGraphEvidence | null;
}>;

/**
 * Portable post-observation adoption boundary. Coarse revision evidence remains
 * the base fact. Optional structural fingerprints may refine coarse attention,
 * derived graph evidence stays candidate-only, and declared invariants may raise
 * attention. A coarse reviewed-current receipt suppresses only the exact coarse
 * repeated-review state; it never suppresses newer structural/invariant REVIEW.
 */
export function evaluateArchitectureHostAdoption(
  args: EvaluateArchitectureHostAdoptionArgs,
): ArchitectureHostAdoptionEvaluation {
  const architectureManifest = architectureImpactManifestSchema.parse(args.architectureManifest);
  const plan = architectureHostAdoptionPlanItemSchema.parse(args.plan);
  const baseline = architectureImpactReviewedBaselineSchema.parse(args.baseline);
  const hostEvidence = architectureImpactHostEvidenceSchema.parse(args.hostEvidence);
  const projectContextManifest = projectContextManifestSchema.parse(args.projectContextManifest);
  const receipt = args.reviewedCurrentReceipt == null
    ? null
    : architectureReviewedCurrentReceiptSchema.parse(args.reviewedCurrentReceipt);

  if (baseline.architectureId !== plan.touch.architectureId) {
    throw new Error(`Architecture host-adoption baseline mismatch: expected ${plan.touch.architectureId}, received ${baseline.architectureId}`);
  }
  if (hostEvidence.architectureId !== plan.touch.architectureId) {
    throw new Error(`Architecture host-adoption evidence mismatch: expected ${plan.touch.architectureId}, received ${hostEvidence.architectureId}`);
  }

  const normalized = normalizeArchitectureImpactObservationEvidence(architectureManifest, hostEvidence);
  const projection = evaluateArchitectureImpactProjection({ baseline, current: normalized });
  const reviewedCurrent = evaluateArchitectureReviewedCurrent(projection, receipt);

  let structuralRefinement: z.infer<typeof architectureStructuralRefinementSchema> | null = null;
  const structure = args.structureManifest == null
    ? null
    : validateArchitectureStructureAgainstImpactManifest(
      architectureStructureManifestSchema.parse(args.structureManifest),
      architectureManifest,
    );
  const structuralBaseline = args.structuralBaseline == null
    ? null
    : architectureStructuralReviewedBaselineSchema.parse(args.structuralBaseline);
  const structuralEvidence = args.structuralEvidence == null
    ? null
    : architectureStructuralEvidenceSchema.parse(args.structuralEvidence);

  if ((structuralBaseline || structuralEvidence) && !structure) {
    throw new Error("Architecture host-adoption structural baseline/evidence requires a structure manifest.");
  }
  if (structuralEvidence && !structuralBaseline) {
    throw new Error("Architecture host-adoption structural evidence requires a reviewed structural baseline.");
  }
  if (structure) {
    const expectedEntry = structure.architectures.find((entry) => entry.architectureId === plan.touch.architectureId);
    const expectedStructuralPlan = expectedEntry ? {
      authorityAnchors: expectedEntry.authorityAnchors ?? [],
      symbolAnalysisPlans: planArchitectureSymbolAnalysis(architectureManifest, structure)
        .filter((item) => item.architectureId === plan.touch.architectureId),
    } : null;
    if (!sameJson(expectedStructuralPlan, plan.optionalEvidence.structural)) {
      throw new Error(`Architecture host-adoption structural plan is stale for ${plan.touch.architectureId}.`);
    }
  }
  if (structuralBaseline && structuralEvidence && structure) {
    if (structuralBaseline.architectureId !== plan.touch.architectureId || structuralEvidence.architectureId !== plan.touch.architectureId) {
      throw new Error(`Architecture host-adoption structural evidence mismatch for ${plan.touch.architectureId}.`);
    }
    structuralRefinement = evaluateArchitectureStructuralRefinement({
      impactManifest: architectureManifest,
      structureManifest: structure,
      coarse: projection,
      baseline: structuralBaseline,
      currentEvidence: structuralEvidence,
    });
  }

  let derivedGraph: z.infer<typeof architectureDerivedGraphCandidatesSchema> | null = null;
  if (args.derivedGraphEvidence != null) {
    const derivedEvidence = architectureGraphHostEvidenceSchema.parse(args.derivedGraphEvidence);
    if (derivedEvidence.architectureId !== plan.touch.architectureId) {
      throw new Error(`Architecture host-adoption derived graph evidence mismatch: expected ${plan.touch.architectureId}, received ${derivedEvidence.architectureId}`);
    }
    derivedGraph = deriveArchitectureGraphCandidates(architectureManifest, derivedEvidence);
  }

  let invariantEvaluations: z.infer<typeof architectureInvariantEvaluationSchema>[] = [];
  const invariantManifest = args.invariantManifest == null
    ? null
    : validateArchitectureInvariantManifestAgainstImpactManifest(
      architectureInvariantManifestSchema.parse(args.invariantManifest),
      architectureManifest,
    );
  const invariantEvidence = args.invariantGraphEvidence == null
    ? null
    : architectureInvariantGraphEvidenceSchema.parse(args.invariantGraphEvidence);
  if (invariantEvidence && !invariantManifest) {
    throw new Error("Architecture host-adoption invariant graph evidence requires an invariant manifest.");
  }
  if (invariantManifest) {
    const rules = invariantManifest.invariants.filter((rule) => rule.architectureId === plan.touch.architectureId);
    const expectedInvariantPlan = rules.length > 0 ? { rules } : null;
    if (!sameJson(expectedInvariantPlan, plan.optionalEvidence.invariants)) {
      throw new Error(`Architecture host-adoption invariant plan is stale for ${plan.touch.architectureId}.`);
    }
  }
  if (invariantManifest && invariantEvidence) {
    if (invariantEvidence.architectureId !== plan.touch.architectureId) {
      throw new Error(`Architecture host-adoption invariant evidence mismatch: expected ${plan.touch.architectureId}, received ${invariantEvidence.architectureId}`);
    }
    invariantEvaluations = evaluateArchitectureInvariants(
      architectureManifest,
      invariantManifest,
      invariantEvidence,
    ).filter((item) => item.architectureId === plan.touch.architectureId);
  }

  let attentionLevel: "ok" | "watch" | "review" = reviewedCurrent.level;
  if (structuralRefinement) attentionLevel = structuralRefinement.level;
  for (const invariant of invariantEvaluations) attentionLevel = maxAttention(attentionLevel, invariant.level);

  const reviewRequired = attentionLevel === "review";
  const additionalReasonCodes = [
    ...(structuralRefinement?.level === "review" ? ["architecture-structural-review", ...structuralRefinement.reasonCodes] : []),
    ...(invariantEvaluations.some((item) => item.level === "review") ? ["architecture-invariant-review", ...invariantEvaluations.filter((item) => item.level === "review").map((item) => item.reasonCode)] : []),
  ];
  const contextFeedback = reviewRequired
    ? buildArchitectureContextFeedback({
      architectureManifest,
      projection,
      projectContextManifest,
      architectureLevelOverride: "review",
      additionalReasonCodes,
    })
    : null;

  return architectureHostAdoptionEvaluationSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_HOST_ADOPTION_SCHEMA_VERSION,
    architectureId: projection.architectureId,
    projection,
    reviewedCurrent,
    structuralRefinement,
    derivedGraph,
    invariants: invariantEvaluations,
    attentionLevel,
    reviewRequired,
    replanRequired: reviewRequired,
    contextFeedback,
    semanticOwner: "mssr",
    canonicalRewriteAllowed: false,
    advisoryOnly: true,
  });
}
