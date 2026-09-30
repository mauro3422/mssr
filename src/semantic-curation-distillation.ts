import { createHash } from "node:crypto";
import { z } from "zod";

import {
  MSSR_SEMANTIC_CURATION_RELATIONS,
  MSSR_SEMANTIC_CURATION_VALIDITIES,
  type MssrSemanticCurationRelation,
} from "./semantic-curation.js";
import { mssrLearningDigestSchema, type MssrLearningDigest } from "./learning.js";

export const MSSR_SEMANTIC_DISTILLATION_SCHEMA_VERSION = 1 as const;
export const MSSR_SEMANTIC_DISTILLATION_MODE = "verified-shadow" as const;
export const MSSR_SEMANTIC_DISTILLATION_RETRIEVAL_METHODS = ["exact-hash", "tfidf", "fact-anchor"] as const;
export const MSSR_SEMANTIC_DISTILLATION_SCORE_BUCKETS = ["none", "weak", "medium", "strong", "exact"] as const;
export const MSSR_SEMANTIC_DISTILLATION_PRIORITY_DIRECTIONS = ["left-higher", "equal", "right-higher"] as const;
export const MSSR_SEMANTIC_DISTILLATION_LENGTH_RATIOS = ["similar", "different", "very-different"] as const;

const boundedKey = z.string().trim().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
const boundedRef = z.string().trim().min(1).max(240).refine((value) => !/[\r\n]/.test(value));
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const probability = z.number().min(0).max(1);

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const mssrSemanticTraceProjectionSchema = z.object({
  traceId: z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/).optional(),
  workflowKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
  semanticSignatureHash: hex64.optional(),
  finalStage: z.enum(["start", "implement", "verify", "persist", "close", "resume"]).optional(),
  outcomeStatus: z.string().min(1).max(40).optional(),
  accepted: z.boolean().optional(),
  verificationPassed: z.boolean().optional(),
  persisted: z.boolean().optional(),
  userCorrections: z.number().int().min(0).max(100).optional(),
  evidenceRefHashes: z.array(hex64).max(12).default([]),
}).strict();
export type MssrSemanticTraceProjection = z.infer<typeof mssrSemanticTraceProjectionSchema>;

export function projectMssrSemanticTraceLearning(args: {
  traceId?: string;
  workflowKey?: string;
  digest: MssrLearningDigest | unknown;
  evidenceRefs?: readonly string[];
}): MssrSemanticTraceProjection {
  const digest = mssrLearningDigestSchema.parse(args.digest);
  return mssrSemanticTraceProjectionSchema.parse({
    ...(args.traceId ? { traceId: args.traceId } : {}),
    ...(args.workflowKey ? { workflowKey: args.workflowKey } : {}),
    semanticSignatureHash: hash(digest.semanticSignature),
    finalStage: digest.finalStage,
    outcomeStatus: digest.outcome.status,
    ...(typeof digest.outcome.accepted === "boolean" ? { accepted: digest.outcome.accepted } : {}),
    ...(typeof digest.outcome.verificationPassed === "boolean" ? { verificationPassed: digest.outcome.verificationPassed } : {}),
    ...(typeof digest.outcome.persisted === "boolean" ? { persisted: digest.outcome.persisted } : {}),
    userCorrections: digest.outcome.userCorrections,
    evidenceRefHashes: [...new Set((args.evidenceRefs ?? []).map((item) => hash(item)))].slice(0, 12),
  });
}

export const mssrSemanticDistillationFeatureSchema = z.object({
  retrievalMethods: z.array(z.enum(MSSR_SEMANTIC_DISTILLATION_RETRIEVAL_METHODS)).max(3),
  scoreBucket: z.enum(MSSR_SEMANTIC_DISTILLATION_SCORE_BUCKETS),
  sourceScoreBucket: z.enum(MSSR_SEMANTIC_DISTILLATION_SCORE_BUCKETS),
  orderingMethod: z.enum(["mtime", "source-priority", "stable-path"]),
  priorityDirection: z.enum(MSSR_SEMANTIC_DISTILLATION_PRIORITY_DIRECTIONS),
  leftSourceKind: z.string().min(1).max(80),
  rightSourceKind: z.string().min(1).max(80),
  leftValidity: z.enum(MSSR_SEMANTIC_CURATION_VALIDITIES),
  rightValidity: z.enum(MSSR_SEMANTIC_CURATION_VALIDITIES),
  leftProtected: z.boolean(),
  rightProtected: z.boolean(),
  sameHash: z.boolean(),
  lengthRatio: z.enum(MSSR_SEMANTIC_DISTILLATION_LENGTH_RATIOS),
}).strict();
export type MssrSemanticDistillationFeature = z.infer<typeof mssrSemanticDistillationFeatureSchema>;

export function semanticDistillationScoreBucket(value: number, exact = false): typeof MSSR_SEMANTIC_DISTILLATION_SCORE_BUCKETS[number] {
  if (exact) return "exact";
  if (value <= 0) return "none";
  if (value < 0.25) return "weak";
  if (value < 0.6) return "medium";
  return "strong";
}

export function semanticDistillationLengthRatio(leftBytes: number, rightBytes: number): typeof MSSR_SEMANTIC_DISTILLATION_LENGTH_RATIOS[number] {
  const larger = Math.max(1, leftBytes, rightBytes);
  const smaller = Math.max(1, Math.min(leftBytes, rightBytes));
  const ratio = smaller / larger;
  if (ratio >= 0.72) return "similar";
  if (ratio >= 0.4) return "different";
  return "very-different";
}

export function semanticDistillationFeatureSignature(feature: MssrSemanticDistillationFeature): string {
  return hash(stableJson(mssrSemanticDistillationFeatureSchema.parse(feature)));
}

export const mssrSemanticDistillationVerificationSchema = z.object({
  status: z.enum(["unknown", "confirmed", "corrected", "rejected"]),
  relation: z.enum(MSSR_SEMANTIC_CURATION_RELATIONS).optional(),
  evidenceRef: boundedRef.optional(),
  verifiedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type MssrSemanticDistillationVerification = z.infer<typeof mssrSemanticDistillationVerificationSchema>;

export const mssrSemanticDistillationObservationSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_DISTILLATION_SCHEMA_VERSION),
  id: z.string().regex(/^semantic-observation:[0-9a-f]{24}$/),
  observedAt: z.string().datetime({ offset: true }),
  projectKey: boundedKey,
  edgeSignature: hex64,
  featureSignature: hex64,
  feature: mssrSemanticDistillationFeatureSchema,
  jev: z.object({
    relation: z.enum(MSSR_SEMANTIC_CURATION_RELATIONS),
    confidence: probability,
    provider: z.string().min(1).max(120),
    modelId: z.string().min(1).max(120),
  }).strict().optional(),
  trace: mssrSemanticTraceProjectionSchema.optional(),
  verification: mssrSemanticDistillationVerificationSchema,
  advisoryOnly: z.literal(true),
  canonicalRewriteAllowed: z.literal(false),
}).strict();
export type MssrSemanticDistillationObservation = z.infer<typeof mssrSemanticDistillationObservationSchema>;

export function createMssrSemanticDistillationObservation(args: {
  projectKey: string;
  edgeSignature: string;
  feature: MssrSemanticDistillationFeature;
  observedAt?: string;
  jev?: { relation: MssrSemanticCurationRelation; confidence: number; provider: string; modelId: string };
  trace?: MssrSemanticTraceProjection;
  verification?: MssrSemanticDistillationVerification;
}): MssrSemanticDistillationObservation {
  const observedAt = args.observedAt ?? new Date().toISOString();
  const feature = mssrSemanticDistillationFeatureSchema.parse(args.feature);
  const featureSignature = semanticDistillationFeatureSignature(feature);
  const idSeed = stableJson({ projectKey: args.projectKey, edgeSignature: args.edgeSignature, observedAt, jev: args.jev ?? null });
  return mssrSemanticDistillationObservationSchema.parse({
    schemaVersion: MSSR_SEMANTIC_DISTILLATION_SCHEMA_VERSION,
    id: `semantic-observation:${hash(idSeed).slice(0, 24)}`,
    observedAt,
    projectKey: args.projectKey,
    edgeSignature: args.edgeSignature,
    featureSignature,
    feature,
    ...(args.jev ? { jev: args.jev } : {}),
    ...(args.trace ? { trace: args.trace } : {}),
    verification: args.verification ?? { status: "unknown" },
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
  });
}

export type MssrSemanticDistillationRule = Readonly<{
  featureSignature: string;
  relation: MssrSemanticCurationRelation;
  support: number;
  total: number;
  distinctProjects: number;
  distinctEvidenceUnits: number;
  observedRate: number;
  lowerBound95: number;
  upperBound95: number;
  jevAgreementRate: number | null;
}>;

export type MssrSemanticDistillationProfile = Readonly<{
  schemaVersion: 1;
  mode: "verified-shadow";
  generatedAt: string;
  rules: readonly MssrSemanticDistillationRule[];
  metrics: Readonly<{
    observations: number;
    shadow: number;
    verified: number;
    corrected: number;
    rejected: number;
    eligible: number;
    generatedRules: number;
  }>;
  policy: Readonly<{
    minObservations: number;
    minDistinctProjects: number;
    minLowerBound95: number;
    minDominance: number;
    contradictionsRequireReview: true;
    rawJevIsTrainingTruth: false;
    routingInfluence: false;
    canonicalRewriteAllowed: false;
  }>;
}>;

function wilson(successes: number, total: number): readonly [number, number] {
  if (total <= 0) return [0, 1];
  const z95 = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + z95 ** 2 / total;
  const center = (p + z95 ** 2 / (2 * total)) / denominator;
  const spread = z95 * Math.sqrt((p * (1 - p) + z95 ** 2 / (4 * total)) / total) / denominator;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}

function verifiedRelation(observation: MssrSemanticDistillationObservation): MssrSemanticCurationRelation | null {
  if (observation.verification.status === "confirmed") return observation.verification.relation ?? observation.jev?.relation ?? null;
  if (observation.verification.status === "corrected") return observation.verification.relation ?? null;
  return null;
}

function independentEvidenceKey(observation: MssrSemanticDistillationObservation): string {
  return observation.trace?.traceId
    ? `trace:${observation.trace.traceId}|feature:${observation.featureSignature}`
    : `project-edge:${observation.projectKey}|${observation.edgeSignature}`;
}

export function distillMssrSemanticRelations(args: {
  observations: readonly unknown[];
  minObservations?: number;
  minDistinctProjects?: number;
  minLowerBound95?: number;
  minDominance?: number;
}): MssrSemanticDistillationProfile {
  const observations = args.observations.flatMap((item) => {
    const parsed = mssrSemanticDistillationObservationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const minObservations = Math.max(3, Math.min(100, Math.floor(args.minObservations ?? 8)));
  const minDistinctProjects = Math.max(1, Math.min(20, Math.floor(args.minDistinctProjects ?? 2)));
  const minLowerBound95 = Math.max(0.5, Math.min(0.99, args.minLowerBound95 ?? 0.65));
  const minDominance = Math.max(0.5, Math.min(1, args.minDominance ?? 0.8));

  const latestByEvidence = new Map<string, MssrSemanticDistillationObservation>();
  for (const observation of observations) {
    const relation = verifiedRelation(observation);
    if (!relation) continue;
    const key = independentEvidenceKey(observation);
    const current = latestByEvidence.get(key);
    if (!current || current.observedAt.localeCompare(observation.observedAt) <= 0) latestByEvidence.set(key, observation);
  }
  const eligible = [...latestByEvidence.values()];
  const groups = new Map<string, MssrSemanticDistillationObservation[]>();
  for (const observation of eligible) {
    const values = groups.get(observation.featureSignature) ?? [];
    values.push(observation);
    groups.set(observation.featureSignature, values);
  }

  const rules: MssrSemanticDistillationRule[] = [];
  for (const [featureSignature, values] of groups) {
    const projects = new Set(values.map((item) => item.projectKey));
    if (values.length < minObservations || projects.size < minDistinctProjects) continue;
    const counts = new Map<MssrSemanticCurationRelation, number>();
    for (const observation of values) {
      const relation = verifiedRelation(observation);
      if (relation) counts.set(relation, (counts.get(relation) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const [relation, support] = ranked[0] ?? [];
    if (!relation || relation === "contradicts") continue;
    const total = values.length;
    const observedRate = support / total;
    if (observedRate < minDominance) continue;
    const [lowerBound95, upperBound95] = wilson(support, total);
    if (lowerBound95 < minLowerBound95) continue;
    const jevComparable = values.filter((item) => item.jev);
    const jevAgreementRate = jevComparable.length === 0 ? null : jevComparable.filter((item) => item.jev?.relation === verifiedRelation(item)).length / jevComparable.length;
    rules.push({
      featureSignature,
      relation,
      support,
      total,
      distinctProjects: projects.size,
      distinctEvidenceUnits: total,
      observedRate: Number(observedRate.toFixed(6)),
      lowerBound95: Number(lowerBound95.toFixed(6)),
      upperBound95: Number(upperBound95.toFixed(6)),
      jevAgreementRate: jevAgreementRate === null ? null : Number(jevAgreementRate.toFixed(6)),
    });
  }
  rules.sort((left, right) => right.lowerBound95 - left.lowerBound95 || right.support - left.support || left.featureSignature.localeCompare(right.featureSignature));
  return {
    schemaVersion: 1,
    mode: MSSR_SEMANTIC_DISTILLATION_MODE,
    generatedAt: new Date().toISOString(),
    rules,
    metrics: {
      observations: observations.length,
      shadow: observations.filter((item) => item.verification.status === "unknown").length,
      verified: observations.filter((item) => item.verification.status === "confirmed").length,
      corrected: observations.filter((item) => item.verification.status === "corrected").length,
      rejected: observations.filter((item) => item.verification.status === "rejected").length,
      eligible: eligible.length,
      generatedRules: rules.length,
    },
    policy: {
      minObservations,
      minDistinctProjects,
      minLowerBound95,
      minDominance,
      contradictionsRequireReview: true,
      rawJevIsTrainingTruth: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
    },
  };
}

export type MssrDeterministicSemanticRelationDecision = Readonly<{
  relation: MssrSemanticCurationRelation | null;
  confidence: number;
  basis: "exact-hash" | "distilled-rule" | "abstain";
  support: number;
  reviewRequired: boolean;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
}>;

export function classifyMssrSemanticRelationDeterministically(args: {
  feature: MssrSemanticDistillationFeature;
  profile?: MssrSemanticDistillationProfile | null;
}): MssrDeterministicSemanticRelationDecision {
  const feature = mssrSemanticDistillationFeatureSchema.parse(args.feature);
  if (feature.sameHash || feature.retrievalMethods.includes("exact-hash")) {
    return {
      relation: "duplicate",
      confidence: 1,
      basis: "exact-hash",
      support: 1,
      reviewRequired: false,
      advisoryOnly: true,
      canonicalRewriteAllowed: false,
    };
  }
  const signature = semanticDistillationFeatureSignature(feature);
  const rule = args.profile?.rules.find((item) => item.featureSignature === signature);
  if (rule && rule.relation !== "contradicts") {
    return {
      relation: rule.relation,
      confidence: rule.lowerBound95,
      basis: "distilled-rule",
      support: rule.support,
      reviewRequired: rule.lowerBound95 < 0.75,
      advisoryOnly: true,
      canonicalRewriteAllowed: false,
    };
  }
  return {
    relation: null,
    confidence: 0,
    basis: "abstain",
    support: 0,
    reviewRequired: true,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
  };
}
