import { z } from "zod";

import {
  SKILL_SIGNALS,
  SKILL_STAGES,
  type SkillStage,
} from "./skill-routing.js";
import {
  MSSR_CHECKPOINT_STATUSES,
  mssrSkillDecisionSchema,
} from "./trace-contract.js";

export const MSSR_LEARNING_DIGEST_VERSION = "learning-digest-v1" as const;

const boundedName = z.string().trim().min(1).max(160);
const semanticSignatureSchema = z.string().trim().min(1).max(1200);

export const MSSR_LEARNING_CONTEXT_REASONS = [
  "selected",
  "required",
  "dependency",
  "intent-mismatch",
  "budget-exceeded",
  "ambiguous",
  "host-policy",
  "other",
] as const;

export const mssrLearningFindingSchema = z.object({
  summary: z.string().trim().min(1).max(220),
  status: z.enum(["supported", "rejected"]),
  evidenceRef: z.string().trim().min(1).max(240),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(8).default([]),
}).strict();

export const mssrLearningContextSelectionSchema = z.object({
  scope: z.enum(["skill", "project"]),
  owner: boundedName,
  module: boundedName,
  selected: z.boolean(),
  reasonCode: z.enum(MSSR_LEARNING_CONTEXT_REASONS),
}).strict();

export const mssrLearningSkillTransitionSchema = z.object({
  fromStage: z.enum(SKILL_STAGES),
  toStage: z.enum(SKILL_STAGES),
  skillName: boundedName,
}).strict();

/**
 * Durable, privacy-bounded learning artifact distilled when one trace closes.
 * It intentionally excludes workingSummary, active hypotheses, raw prompts,
 * transcripts, secrets, private reasoning, and arbitrary scratchpad text.
 */
export const mssrLearningDigestSchema = z.object({
  version: z.literal(MSSR_LEARNING_DIGEST_VERSION).default(MSSR_LEARNING_DIGEST_VERSION),
  semanticSignature: semanticSignatureSchema,
  finalStage: z.enum(SKILL_STAGES),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(20).default([]),
  recommendedSkills: z.array(boundedName).max(48).default([]),
  loadedSkills: z.array(boundedName).max(48).default([]),
  skillDecisions: z.array(mssrSkillDecisionSchema).max(48).default([]),
  skillTransitions: z.array(mssrLearningSkillTransitionSchema).max(64).default([]),
  contextSelections: z.array(mssrLearningContextSelectionSchema).max(96).default([]),
  findings: z.array(mssrLearningFindingSchema).max(12).default([]),
  outcome: z.object({
    status: z.enum(MSSR_CHECKPOINT_STATUSES),
    accepted: z.boolean().optional(),
    score: z.number().min(0).max(1).optional(),
    primarySkill: boundedName.optional(),
    supportingSkills: z.array(boundedName).max(24).default([]),
    verificationPassed: z.boolean().optional(),
    persisted: z.boolean().optional(),
    userCorrections: z.number().int().min(0).max(100).default(0),
  }).strict(),
}).strict();

export type MssrLearningDigest = z.infer<typeof mssrLearningDigestSchema>;
export type MssrLearningFinding = z.infer<typeof mssrLearningFindingSchema>;
export type MssrLearningContextSelection = z.infer<typeof mssrLearningContextSelectionSchema>;
export type MssrLearningSkillTransition = z.infer<typeof mssrLearningSkillTransitionSchema>;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Canonical privacy-safe signature used for historical routing priors. */
export function mssrSemanticSignature(route: unknown): string {
  const routeRecord = record(route) ?? {};
  const stage = z.enum(SKILL_STAGES).safeParse(routeRecord.stage);
  const intent = record(routeRecord.intent);
  if (!intent) return `stage=${stage.success ? stage.data : "start"}|legacy`;

  const values = (key: string): string[] => Array.isArray(intent[key])
    ? uniqueSorted(intent[key].filter((item): item is string => typeof item === "string"))
    : [];

  return [
    `stage=${stage.success ? stage.data : "start"}`,
    `d=${values("domains").join(",")}`,
    `a=${values("actions").join(",")}`,
    `r=${values("artifacts").join(",")}`,
    `n=${values("needs").join(",")}`,
    `s=${values("signals").join(",")}`,
  ].join("|");
}

export function createMssrLearningDigest(input: Omit<MssrLearningDigest, "version"> & { version?: typeof MSSR_LEARNING_DIGEST_VERSION }): MssrLearningDigest {
  return mssrLearningDigestSchema.parse({
    ...input,
    version: MSSR_LEARNING_DIGEST_VERSION,
  });
}

export function learningTransitionKey(input: Pick<MssrLearningSkillTransition, "fromStage" | "toStage" | "skillName">): string {
  return `${input.fromStage}->${input.toStage}|${input.skillName}`;
}

export function learningContextKey(input: Pick<MssrLearningContextSelection, "scope" | "owner" | "module">): string {
  return `${input.scope}|${input.owner}|${input.module}`;
}

export function normalizeLearningStages(values: readonly string[]): SkillStage[] {
  return uniqueSorted(values).flatMap((value) => {
    const parsed = z.enum(SKILL_STAGES).safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}
