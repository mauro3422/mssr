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

export const projectContextSegmentSchema = z.object({
  id: areaSchema,
  sections: z.array(z.string().min(1).max(160)).min(1).max(12),
  baseline: z.boolean().default(false),
  terms: z.array(z.string().min(2).max(80)).max(24).default([]),
  ...selectorFields,
  priority: z.number().int().min(-100).max(100).default(0),
}).strict().superRefine((value, ctx) => {
  const selectorCount = value.stages.length + value.domains.length + value.actions.length
    + value.artifacts.length + value.needs.length + value.signals.length;
  if (value.baseline && (selectorCount > 0 || value.terms.length > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A project-context baseline segment must be unconditional inside its selected parent module.",
    });
  }
  if (!value.baseline && selectorCount === 0 && value.terms.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A non-baseline project-context segment needs declared selectors or summary terms.",
    });
  }
});

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
}).strict().superRefine((value, ctx) => {
  if ((value.required || value.requiredWhen) && value.exclusiveGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Required or conditionally required project-context modules cannot belong to an exclusive group.",
      path: ["exclusiveGroup"],
    });
  }
});

const projectContextSegmentBindingSchema = z.object({
  moduleId: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  segments: z.array(projectContextSegmentSchema).min(2).max(24),
}).strict().superRefine((value, ctx) => {
  const baselines = value.segments.filter((segment) => segment.baseline);
  if (baselines.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Segmented project-context modules require exactly one baseline segment; found ${baselines.length}.`, path: ["segments"] });
  }
  const ids = new Set<string>();
  const headings = new Set<string>();
  for (const [index, segment] of value.segments.entries()) {
    if (ids.has(segment.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate project-context segment id: ${segment.id}`, path: ["segments", index, "id"] });
    ids.add(segment.id);
    for (const heading of segment.sections) {
      const normalized = heading.trim();
      if (headings.has(normalized)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Project-context segment heading is declared more than once: ${normalized}`, path: ["segments", index, "sections"] });
      headings.add(normalized);
    }
  }
});

export const projectContextSegmentsManifestSchema = z.object({
  schemaVersion: z.literal(1),
  modules: z.array(projectContextSegmentBindingSchema).max(96).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const [index, binding] of value.modules.entries()) {
    if (ids.has(binding.moduleId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate project-context segment module id: ${binding.moduleId}`, path: ["modules", index, "moduleId"] });
    ids.add(binding.moduleId);
  }
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
export type ProjectContextSegment = z.infer<typeof projectContextSegmentSchema>;
export type ProjectContextSegmentsManifest = z.infer<typeof projectContextSegmentsManifestSchema>;
export type ProjectContextCore = z.infer<typeof projectContextCoreSchema>;
export type ProjectContextRequiredWhen = z.infer<typeof projectContextRequiredWhenSchema>;
export type ProjectContextModule = z.infer<typeof projectContextModuleSchema>;
export type ResolvedProjectContextModule = ProjectContextModule & { segments?: ProjectContextSegment[] };
export type ProjectContextManifest = z.infer<typeof projectContextManifestSchema>;
export type ResolvedProjectContextManifest = Omit<ProjectContextManifest, "modules"> & { modules: ResolvedProjectContextModule[] };
export type MaterializedProjectContextModule = ResolvedProjectContextModule & { chars: number };
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
