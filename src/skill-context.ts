import { z } from "zod";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_SIGNALS,
  SKILL_STAGES,
  type SkillStage,
  type StructuredSkillIntent,
} from "./skill-routing.js";
import { selectContextModules, type ContextModuleDecision } from "./context-selection.js";

const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

export const skillContextSourceSchema = z.object({
  path: z.string().min(1).max(240).optional(),
  sections: z.array(z.string().min(1).max(160)).min(1).max(24).optional(),
}).strict().refine((value) => Boolean(value.path) !== Boolean(value.sections), {
  message: "Exactly one of path or sections is required.",
});

export const skillContextModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  description: z.string().min(1).max(300),
  source: skillContextSourceSchema,
  ...selectorFields,
  required: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  maxChars: z.number().int().min(200).max(160_000).optional(),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().refine((value) => !(value.required && value.exclusiveGroup), {
  message: "Required modules cannot belong to an exclusive group.",
});

export const skillContextManifestSchema = z.object({
  schemaVersion: z.literal(1),
  core: skillContextSourceSchema,
  modules: z.array(skillContextModuleSchema).max(64).default([]),
}).strict();

export type SkillContextSource = z.infer<typeof skillContextSourceSchema>;
export type SkillContextManifest = z.infer<typeof skillContextManifestSchema>;
export type SkillContextModule = z.infer<typeof skillContextModuleSchema>;
export type MaterializedSkillContextModule = SkillContextModule & { chars: number };

export type SkillContextModuleDecision = ContextModuleDecision;

export function selectSkillContextModules(args: {
  modules: MaterializedSkillContextModule[];
  intent: StructuredSkillIntent;
  stage: SkillStage;
  maxModuleChars: number;
}): {
  selected: MaterializedSkillContextModule[];
  decisions: SkillContextModuleDecision[];
  selectedChars: number;
  remainingChars: number;
  ambiguousGroups: Array<{ group: string; candidates: string[]; score: number }>;
} {
  return selectContextModules(args);
}
