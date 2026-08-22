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

export const PROJECT_CONTEXT_TOPICS = [
  "architecture",
  "design",
  "law",
  "pattern",
  "vocabulary",
  "decision",
  "state",
  "phase",
  "reference",
  "operations",
  "other",
] as const;
export type ProjectContextTopic = typeof PROJECT_CONTEXT_TOPICS[number];

const areaSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);

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

const semanticFields = {
  topic: z.enum(PROJECT_CONTEXT_TOPICS).optional(),
  area: areaSchema.optional(),
};

export const PROJECT_CONTEXT_MUTATION_ACTIONS = [
  "create",
  "edit",
  "move",
  "optimize",
  "save",
  "recover",
  "version",
  "publish",
  "maintain",
  "document",
] as const;

const PROJECT_CONTEXT_MUTATION_ACTION_SET = new Set<string>(PROJECT_CONTEXT_MUTATION_ACTIONS);

export const projectContextRequiredWhenSchema = z.object({
  mutation: z.literal(true),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).min(1).max(12).optional(),
}).strict();

export const projectContextCoreSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  kind: z.enum(["context", "memory", "state"]),
  description: z.string().min(1).max(300),
  source: projectContextSourceSchema,
  ...semanticFields,
  maxChars: z.number().int().min(200).max(80_000).optional(),
}).strict();

export const projectContextModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  kind: z.enum(PROJECT_CONTEXT_KINDS),
  description: z.string().min(1).max(300),
  source: projectContextSourceSchema,
  ...semanticFields,
  ...selectorFields,
  required: z.boolean().default(false),
  requiredWhen: projectContextRequiredWhenSchema.optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  maxChars: z.number().int().min(200).max(80_000).optional(),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().refine((value) => !((value.required || value.requiredWhen) && value.exclusiveGroup), {
  message: "Required or conditionally required project-context modules cannot belong to an exclusive group.",
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
export type ProjectContextRequiredWhen = z.infer<typeof projectContextRequiredWhenSchema>;
export type ProjectContextModule = z.infer<typeof projectContextModuleSchema>;
export type ProjectContextManifest = z.infer<typeof projectContextManifestSchema>;
export type MaterializedProjectContextModule = ProjectContextModule & { chars: number };
export type ProjectContextModuleDecision = ContextModuleDecision & { required: boolean; requiredBy: string[] };

export function defaultKindForProjectContextTopic(topic: ProjectContextTopic): "context" | "memory" | "state" {
  if (topic === "decision") return "memory";
  if (topic === "state" || topic === "phase") return "state";
  return "context";
}

export function isProjectContextMutationIntent(intent: StructuredSkillIntent): boolean {
  return intent.risk !== "read-only" || intent.actions.some((action) => PROJECT_CONTEXT_MUTATION_ACTION_SET.has(action));
}

export function resolveProjectContextModuleRequirement(
  module: Pick<ProjectContextModule, "required" | "requiredWhen">,
  intent: StructuredSkillIntent,
): { required: boolean; requiredBy: string[] } {
  const requiredBy: string[] = [];
  if (module.required) requiredBy.push("manifest");

  const conditional = module.requiredWhen;
  if (conditional?.mutation && isProjectContextMutationIntent(intent)) {
    const artifactScope = conditional.artifacts ?? [];
    if (artifactScope.length === 0) {
      requiredBy.push("mutation");
    } else {
      const matchedArtifacts = intent.artifacts.filter((artifact) => artifactScope.includes(artifact));
      if (matchedArtifacts.length > 0) {
        requiredBy.push("mutation", ...matchedArtifacts.map((artifact) => `artifact:${artifact}`));
      }
    }
  }

  return { required: requiredBy.length > 0, requiredBy };
}

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
  requiredIds: string[];
} {
  const originalById = new Map(args.modules.map((module) => [module.id, module]));
  const requirements = new Map(args.modules.map((module) => {
    const stageMatches = module.stages.length === 0 || module.stages.includes(args.stage);
    return [module.id, stageMatches ? resolveProjectContextModuleRequirement(module, args.intent) : { required: false, requiredBy: [] }];
  }));
  const effectiveModules = args.modules.map((module) => ({
    ...module,
    required: requirements.get(module.id)?.required ?? module.required,
  }));
  const selection = selectContextModules({
    ...args,
    modules: effectiveModules,
  });

  return {
    ...selection,
    selected: selection.selected.map((module) => originalById.get(module.id)!).filter(Boolean),
    decisions: selection.decisions.map((decision) => ({
      ...decision,
      ...(requirements.get(decision.id) ?? { required: false, requiredBy: [] }),
    })),
    requiredIds: [...requirements.entries()].filter(([, requirement]) => requirement.required).map(([id]) => id),
  };
}
