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

export const PROJECT_CONTEXT_KINDS = ["context", "memory", "state", "directive"] as const;
export type ProjectContextKind = typeof PROJECT_CONTEXT_KINDS[number];

const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

export const projectContextSourceSchema = z.object({
  path: z.string().min(1).max(240),
  sections: z.array(z.string().min(1).max(160)).min(1).max(24).optional(),
}).strict();

export const projectContextCoreSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  kind: z.enum(["context", "memory", "state"]),
  description: z.string().min(1).max(300),
  source: projectContextSourceSchema,
  maxChars: z.number().int().min(200).max(80_000).optional(),
}).strict();

export const projectContextModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  kind: z.enum(PROJECT_CONTEXT_KINDS),
  description: z.string().min(1).max(300),
  source: projectContextSourceSchema,
  ...selectorFields,
  required: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  maxChars: z.number().int().min(200).max(80_000).optional(),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().refine((value) => !(value.required && value.exclusiveGroup), {
  message: "Required project-context modules cannot belong to an exclusive group.",
});

export const projectContextManifestSchema = z.object({
  schemaVersion: z.literal(1),
  core: z.array(projectContextCoreSchema).max(16).default([]),
  modules: z.array(projectContextModuleSchema).max(96).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const entry of [...value.core, ...value.modules]) {
    if (ids.has(entry.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate project-context id: ${entry.id}`,
        path: ["modules"],
      });
    }
    ids.add(entry.id);
  }
});

export type ProjectContextSource = z.infer<typeof projectContextSourceSchema>;
export type ProjectContextCore = z.infer<typeof projectContextCoreSchema>;
export type ProjectContextModule = z.infer<typeof projectContextModuleSchema>;
export type ProjectContextManifest = z.infer<typeof projectContextManifestSchema>;
export type MaterializedProjectContextModule = ProjectContextModule & { chars: number };
export type ProjectContextModuleDecision = ContextModuleDecision;

export function selectProjectContextModules(args: {
  modules: MaterializedProjectContextModule[];
  intent: StructuredSkillIntent;
  stage: SkillStage;
  maxModuleChars: number;
}): {
  selected: MaterializedProjectContextModule[];
  decisions: ProjectContextModuleDecision[];
  selectedChars: number;
  remainingChars: number;
  ambiguousGroups: Array<{ group: string; candidates: string[]; score: number }>;
} {
  return selectContextModules(args);
}
