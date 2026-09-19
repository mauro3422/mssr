import { z } from "zod";

export const MSSR_SEMANTIC_SHADOW_SCHEMA_VERSION = 1 as const;
export const MSSR_SEMANTIC_SHADOW_LABELS = ["entails", "contradicts", "related", "unknown"] as const;

const boundedText = z.string().min(1).max(240).refine((value) => !/[\r\n]/.test(value));

export const mssrSemanticShadowObservationSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_SHADOW_SCHEMA_VERSION),
  candidateId: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/),
  modelId: boundedText,
  modelRevision: boundedText,
  label: z.enum(MSSR_SEMANTIC_SHADOW_LABELS),
  score: z.number().min(0).max(1),
  sourceRefs: z.tuple([boundedText, boundedText]),
  observedAt: z.string().datetime({ offset: true }),
}).strict();
export type MssrSemanticShadowObservation = z.infer<typeof mssrSemanticShadowObservationSchema>;

export const mssrSemanticShadowEvaluationSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_SHADOW_SCHEMA_VERSION),
  observation: mssrSemanticShadowObservationSchema,
  evidenceClass: z.literal("derived"),
  evidenceTier: z.literal("candidate"),
  routingInfluence: z.literal(false),
  canonicalRewriteAllowed: z.literal(false),
  directNoticeAuthority: z.literal(false),
  truthAuthority: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict();
export type MssrSemanticShadowEvaluation = z.infer<typeof mssrSemanticShadowEvaluationSchema>;

/**
 * Gate H boundary. A host may supply a local NLI/cross-encoder result for
 * longitudinal measurement, but MSSR pins it to derived/candidate evidence.
 * This function cannot promote the result into deterministic truth.
 */
export function evaluateMssrSemanticShadowEvidence(input: unknown): MssrSemanticShadowEvaluation {
  const observation = mssrSemanticShadowObservationSchema.parse(input);
  return mssrSemanticShadowEvaluationSchema.parse({
    schemaVersion: MSSR_SEMANTIC_SHADOW_SCHEMA_VERSION,
    observation,
    evidenceClass: "derived",
    evidenceTier: "candidate",
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    directNoticeAuthority: false,
    truthAuthority: false,
    advisoryOnly: true,
  });
}
