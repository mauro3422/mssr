import { createHash } from "node:crypto";
import { z } from "zod";

import {
  mssrSemanticTraceProjectionSchema,
  type MssrSemanticTraceProjection,
} from "./semantic-curation-distillation.js";
import { mssrExplicitVerifierIdentitySchema } from "./explicit-verification.js";

export const MSSR_SEMANTIC_EXPERIENCE_SCHEMA_VERSION = 1 as const;
export const MSSR_SEMANTIC_EXPERIENCE_MODE = "verified-shadow-experience" as const;
export const MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS = [
  "semantic-relation",
  "context-selection",
  "document-role",
  "placement",
  "drift-interpretation",
  "maintenance-disposition",
  "abstention-policy",
] as const;

export type MssrSemanticExperienceDecisionKind = typeof MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS[number];

const boundedToken = z.string().trim().min(1).max(120).refine((value) => !/[\r\n]/.test(value));
const boundedKey = z.string().trim().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
const boundedRef = z.string().trim().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
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

const boundedBooleanMap = z.record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/), z.boolean())
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 24) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "flags supports at most 24 keys" });
  });

const boundedBucketMap = z.record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/), boundedToken)
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 24) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "buckets supports at most 24 keys" });
  });

export const mssrSemanticExperienceFeatureSchema = z.object({
  subjectKind: boundedToken,
  candidateKinds: z.array(boundedToken).max(16).default([]),
  signals: z.array(boundedToken).max(24).default([]),
  flags: boundedBooleanMap.default({}),
  buckets: boundedBucketMap.default({}),
}).strict();
export type MssrSemanticExperienceFeature = z.infer<typeof mssrSemanticExperienceFeatureSchema>;

export function normalizeMssrSemanticExperienceFeature(feature: MssrSemanticExperienceFeature): MssrSemanticExperienceFeature {
  const parsed = mssrSemanticExperienceFeatureSchema.parse(feature);
  return {
    ...parsed,
    candidateKinds: [...new Set(parsed.candidateKinds)].sort(),
    signals: [...new Set(parsed.signals)].sort(),
    flags: Object.fromEntries(Object.entries(parsed.flags).sort(([left], [right]) => left.localeCompare(right))),
    buckets: Object.fromEntries(Object.entries(parsed.buckets).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export function semanticExperienceFeatureSignature(args: {
  decisionKind: MssrSemanticExperienceDecisionKind;
  feature: MssrSemanticExperienceFeature;
}): string {
  return hash(stableJson({ decisionKind: args.decisionKind, feature: normalizeMssrSemanticExperienceFeature(args.feature) }));
}

export const mssrSemanticExperienceEvidenceUnitSchema = z.object({
  sourceRef: boundedRef,
  sha256: hex64.optional(),
  startLine: z.number().int().min(1).max(10_000_000).optional(),
  endLine: z.number().int().min(1).max(10_000_000).optional(),
  role: boundedToken.optional(),
  selected: z.boolean().optional(),
  reasonCode: boundedToken.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.startLine !== undefined && value.endLine !== undefined && value.endLine < value.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endLine"], message: "endLine must be >= startLine" });
  }
});
export type MssrSemanticExperienceEvidenceUnit = z.infer<typeof mssrSemanticExperienceEvidenceUnitSchema>;

export const mssrSemanticExperienceProposalSchema = z.object({
  value: boundedToken,
  confidence: probability,
  provider: boundedToken,
  modelId: boundedToken,
}).strict();
export type MssrSemanticExperienceProposal = z.infer<typeof mssrSemanticExperienceProposalSchema>;

export const mssrSemanticExperienceVerificationSchema = z.object({
  status: z.enum(["unknown", "confirmed", "corrected", "rejected"]),
  value: boundedToken.optional(),
  evidenceRef: z.string().trim().min(1).max(240).refine((value) => !/[\r\n]/.test(value)).optional(),
  evidenceRevision: boundedToken.optional(),
  verificationId: z.string().regex(/^[A-Za-z0-9._:-]{6,200}$/).optional(),
  verifier: mssrExplicitVerifierIdentitySchema.optional(),
  independent: z.boolean().optional(),
  verifiedAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "corrected" && !value.value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Corrected semantic experience verification requires value." });
  }
  if (value.independent === true) {
    if (value.status === "unknown") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Unknown verification cannot be independently verified truth." });
    if (!value.verificationId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verificationId"], message: "Independent semantic experience verification requires verificationId." });
    if (!value.verifier) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verifier"], message: "Independent semantic experience verification requires verifier identity." });
    if (!value.evidenceRef) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceRef"], message: "Independent semantic experience verification requires evidenceRef." });
  }
});
export type MssrSemanticExperienceVerification = z.infer<typeof mssrSemanticExperienceVerificationSchema>;

export const mssrSemanticExperienceObservationSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_EXPERIENCE_SCHEMA_VERSION),
  id: z.string().regex(/^semantic-experience:[0-9a-f]{24}$/),
  observedAt: z.string().datetime({ offset: true }),
  projectKey: boundedKey,
  decisionKind: z.enum(MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS),
  decisionSignature: hex64,
  featureSignature: hex64,
  feature: mssrSemanticExperienceFeatureSchema,
  evidenceUnits: z.array(mssrSemanticExperienceEvidenceUnitSchema).max(24).default([]),
  proposal: mssrSemanticExperienceProposalSchema.optional(),
  trace: mssrSemanticTraceProjectionSchema.optional(),
  verification: mssrSemanticExperienceVerificationSchema,
  advisoryOnly: z.literal(true),
  authorityInfluence: z.literal(false),
  routingInfluence: z.literal(false),
  canonicalRewriteAllowed: z.literal(false),
  autoApplyAllowed: z.literal(false),
}).strict();
export type MssrSemanticExperienceObservation = z.infer<typeof mssrSemanticExperienceObservationSchema>;

export function createMssrSemanticExperienceObservation(args: {
  projectKey: string;
  decisionKind: MssrSemanticExperienceDecisionKind;
  decisionSignature?: string;
  feature: MssrSemanticExperienceFeature;
  evidenceUnits?: readonly MssrSemanticExperienceEvidenceUnit[];
  proposal?: MssrSemanticExperienceProposal;
  trace?: MssrSemanticTraceProjection;
  verification?: MssrSemanticExperienceVerification;
  observedAt?: string;
}): MssrSemanticExperienceObservation {
  const observedAt = args.observedAt ?? new Date().toISOString();
  const feature = normalizeMssrSemanticExperienceFeature(args.feature);
  const featureSignature = semanticExperienceFeatureSignature({ decisionKind: args.decisionKind, feature });
  const evidenceUnits = (args.evidenceUnits ?? []).map((item) => mssrSemanticExperienceEvidenceUnitSchema.parse(item));
  const decisionSignature = args.decisionSignature && /^[0-9a-f]{64}$/.test(args.decisionSignature)
    ? args.decisionSignature
    : hash(stableJson({ decisionKind: args.decisionKind, featureSignature, evidenceUnits }));
  const idSeed = stableJson({
    projectKey: args.projectKey,
    decisionKind: args.decisionKind,
    decisionSignature,
    featureSignature,
    observedAt,
    proposal: args.proposal ?? null,
  });
  return mssrSemanticExperienceObservationSchema.parse({
    schemaVersion: 1,
    id: `semantic-experience:${hash(idSeed).slice(0, 24)}`,
    observedAt,
    projectKey: args.projectKey,
    decisionKind: args.decisionKind,
    decisionSignature,
    featureSignature,
    feature,
    evidenceUnits,
    ...(args.proposal ? { proposal: args.proposal } : {}),
    ...(args.trace ? { trace: args.trace } : {}),
    verification: args.verification ?? { status: "unknown" },
    advisoryOnly: true,
    authorityInfluence: false,
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    autoApplyAllowed: false,
  });
}

function verifiedValue(observation: MssrSemanticExperienceObservation): string | null {
  if (observation.verification.independent !== true) return null;
  if (observation.verification.status === "confirmed") return observation.verification.value ?? observation.proposal?.value ?? null;
  if (observation.verification.status === "corrected") return observation.verification.value ?? null;
  return null;
}

function evidenceFamily(observation: MssrSemanticExperienceObservation): string {
  if (observation.trace?.traceId) return `trace:${observation.trace.traceId}|kind:${observation.decisionKind}|feature:${observation.featureSignature}`;
  return `project:${observation.projectKey}|decision:${observation.decisionSignature}|feature:${observation.featureSignature}`;
}

function wilson(successes: number, total: number): readonly [number, number] {
  if (total <= 0) return [0, 1];
  const z95 = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + z95 ** 2 / total;
  const center = (p + z95 ** 2 / (2 * total)) / denominator;
  const spread = z95 * Math.sqrt((p * (1 - p) + z95 ** 2 / (4 * total)) / total) / denominator;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}

export type MssrSemanticExperienceRule = Readonly<{
  decisionKind: MssrSemanticExperienceDecisionKind;
  featureSignature: string;
  value: string;
  support: number;
  total: number;
  distinctProjects: number;
  distinctEvidenceUnits: number;
  observedRate: number;
  lowerBound95: number;
  upperBound95: number;
  providerAgreementRate: number | null;
}>;

export type MssrSemanticExperienceProfile = Readonly<{
  schemaVersion: 1;
  mode: "verified-shadow-experience";
  generatedAt: string;
  rules: readonly MssrSemanticExperienceRule[];
  metrics: Readonly<{
    observations: number;
    shadow: number;
    verified: number;
    corrected: number;
    rejected: number;
    unverifiedFeedback: number;
    eligible: number;
    generatedRules: number;
    byDecisionKind: Readonly<Record<string, number>>;
  }>;
  policy: Readonly<{
    minObservations: number;
    minDistinctProjects: number;
    minLowerBound95: number;
    minDominance: number;
    rawProviderIsTrainingTruth: false;
    contradictionsRequireReview: true;
    routingInfluence: false;
    authorityInfluence: false;
    canonicalRewriteAllowed: false;
    autoApplyAllowed: false;
  }>;
}>;

export function distillMssrSemanticExperience(args: {
  observations: readonly unknown[];
  minObservations?: number;
  minDistinctProjects?: number;
  minLowerBound95?: number;
  minDominance?: number;
}): MssrSemanticExperienceProfile {
  const observations = args.observations.flatMap((item) => {
    const parsed = mssrSemanticExperienceObservationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const minObservations = Math.max(3, Math.min(100, Math.floor(args.minObservations ?? 8)));
  const minDistinctProjects = Math.max(1, Math.min(20, Math.floor(args.minDistinctProjects ?? 2)));
  const minLowerBound95 = Math.max(0.5, Math.min(0.99, args.minLowerBound95 ?? 0.65));
  const minDominance = Math.max(0.5, Math.min(1, args.minDominance ?? 0.8));

  const latestByEvidence = new Map<string, MssrSemanticExperienceObservation>();
  for (const observation of observations) {
    if (!verifiedValue(observation)) continue;
    const key = evidenceFamily(observation);
    const current = latestByEvidence.get(key);
    if (!current || current.observedAt.localeCompare(observation.observedAt) <= 0) latestByEvidence.set(key, observation);
  }
  const eligible = [...latestByEvidence.values()];
  const groups = new Map<string, MssrSemanticExperienceObservation[]>();
  for (const observation of eligible) {
    const key = `${observation.decisionKind}|${observation.featureSignature}`;
    const values = groups.get(key) ?? [];
    values.push(observation);
    groups.set(key, values);
  }

  const rules: MssrSemanticExperienceRule[] = [];
  for (const values of groups.values()) {
    const first = values[0];
    if (!first) continue;
    const projects = new Set(values.map((item) => item.projectKey));
    if (values.length < minObservations || projects.size < minDistinctProjects) continue;
    const counts = new Map<string, number>();
    for (const observation of values) {
      const value = verifiedValue(observation);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const [value, support] = ranked[0] ?? [];
    if (!value) continue;
    if (first.decisionKind === "semantic-relation" && value === "contradicts") continue;
    const total = values.length;
    const observedRate = support / total;
    if (observedRate < minDominance) continue;
    const [lowerBound95, upperBound95] = wilson(support, total);
    if (lowerBound95 < minLowerBound95) continue;
    const proposalComparable = values.filter((item) => item.proposal);
    const providerAgreementRate = proposalComparable.length === 0
      ? null
      : proposalComparable.filter((item) => item.proposal?.value === verifiedValue(item)).length / proposalComparable.length;
    rules.push({
      decisionKind: first.decisionKind,
      featureSignature: first.featureSignature,
      value,
      support,
      total,
      distinctProjects: projects.size,
      distinctEvidenceUnits: total,
      observedRate: Number(observedRate.toFixed(6)),
      lowerBound95: Number(lowerBound95.toFixed(6)),
      upperBound95: Number(upperBound95.toFixed(6)),
      providerAgreementRate: providerAgreementRate === null ? null : Number(providerAgreementRate.toFixed(6)),
    });
  }
  rules.sort((left, right) => right.lowerBound95 - left.lowerBound95 || right.support - left.support || left.decisionKind.localeCompare(right.decisionKind) || left.featureSignature.localeCompare(right.featureSignature));
  const byDecisionKind = Object.fromEntries(MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS.map((kind) => [kind, observations.filter((item) => item.decisionKind === kind).length]));
  return {
    schemaVersion: 1,
    mode: MSSR_SEMANTIC_EXPERIENCE_MODE,
    generatedAt: new Date().toISOString(),
    rules,
    metrics: {
      observations: observations.length,
      shadow: observations.filter((item) => item.verification.status === "unknown" || item.verification.independent !== true).length,
      verified: observations.filter((item) => item.verification.status === "confirmed" && item.verification.independent === true).length,
      corrected: observations.filter((item) => item.verification.status === "corrected" && item.verification.independent === true).length,
      rejected: observations.filter((item) => item.verification.status === "rejected" && item.verification.independent === true).length,
      unverifiedFeedback: observations.filter((item) => item.verification.status !== "unknown" && item.verification.independent !== true).length,
      eligible: eligible.length,
      generatedRules: rules.length,
      byDecisionKind,
    },
    policy: {
      minObservations,
      minDistinctProjects,
      minLowerBound95,
      minDominance,
      rawProviderIsTrainingTruth: false,
      contradictionsRequireReview: true,
      routingInfluence: false,
      authorityInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    },
  };
}

export type MssrSemanticExperienceFallbackDecision = Readonly<{
  decisionKind: MssrSemanticExperienceDecisionKind;
  value: string | null;
  confidence: number;
  basis: "distilled-rule" | "abstain";
  support: number;
  reviewRequired: boolean;
  advisoryOnly: true;
  authorityInfluence: false;
  routingInfluence: false;
  canonicalRewriteAllowed: false;
  autoApplyAllowed: false;
}>;

export function classifyMssrSemanticExperienceDeterministically(args: {
  decisionKind: MssrSemanticExperienceDecisionKind;
  feature: MssrSemanticExperienceFeature;
  profile?: MssrSemanticExperienceProfile | null;
}): MssrSemanticExperienceFallbackDecision {
  const feature = normalizeMssrSemanticExperienceFeature(args.feature);
  const signature = semanticExperienceFeatureSignature({ decisionKind: args.decisionKind, feature });
  const rule = args.profile?.rules.find((item) => item.decisionKind === args.decisionKind && item.featureSignature === signature);
  if (rule && !(args.decisionKind === "semantic-relation" && rule.value === "contradicts")) {
    return {
      decisionKind: args.decisionKind,
      value: rule.value,
      confidence: rule.lowerBound95,
      basis: "distilled-rule",
      support: rule.support,
      reviewRequired: rule.lowerBound95 < 0.75,
      advisoryOnly: true,
      authorityInfluence: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    };
  }
  return {
    decisionKind: args.decisionKind,
    value: null,
    confidence: 0,
    basis: "abstain",
    support: 0,
    reviewRequired: true,
    advisoryOnly: true,
    authorityInfluence: false,
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    autoApplyAllowed: false,
  };
}
