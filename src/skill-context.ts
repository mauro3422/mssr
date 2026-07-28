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

export type SkillContextModuleDecision = {
  id: string;
  selected: boolean;
  score: number;
  chars: number;
  reason: "selected" | "stage-mismatch" | "intent-mismatch" | "budget-exceeded" | "ambiguous-candidate" | "exclusive-not-selected";
  matched: string[];
};

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right);
  return left.filter((value) => wanted.has(value));
}

function stageMatches(stages: readonly SkillStage[], stage: SkillStage): boolean {
  return stages.length === 0 || stages.includes(stage);
}

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
  const evaluated = args.modules.map((module) => {
    if (!stageMatches(module.stages, args.stage)) {
      return { module, score: -1, matched: [] as string[], eligible: false, reason: "stage-mismatch" as const };
    }

    const dimensions = [
      ["domain", module.domains, args.intent.domains],
      ["action", module.actions, args.intent.actions],
      ["artifact", module.artifacts, args.intent.artifacts],
      ["need", module.needs, args.intent.needs],
      ["signal", module.signals, args.intent.signals],
    ] as const;
    const weights: Record<string, number> = { domain: 8, action: 10, artifact: 10, need: 12, signal: 14 };
    const matched: string[] = [];
    let score = module.priority;
    let hasSelector = false;
    let allSpecifiedMatch = true;

    for (const [label, expected, actual] of dimensions) {
      if (expected.length === 0) continue;
      hasSelector = true;
      const hits = overlap(actual, expected);
      if (hits.length === 0) allSpecifiedMatch = false;
      for (const hit of hits) matched.push(`${label}:${hit}`);
      score += hits.length * weights[label];
    }

    const eligible = module.required || (hasSelector && allSpecifiedMatch);
    return {
      module,
      score,
      matched,
      eligible,
      reason: eligible ? "selected" as const : "intent-mismatch" as const,
    };
  });

  const exclusiveRejected = new Map<string, "ambiguous-candidate" | "exclusive-not-selected">();
  const ambiguousGroups: Array<{ group: string; candidates: string[]; score: number }> = [];
  const rankedCandidates = evaluated.filter((item) => item.eligible && !item.module.exclusiveGroup);
  const exclusiveGroups = new Map<string, typeof evaluated>();

  for (const item of evaluated.filter((candidate) => candidate.eligible && candidate.module.exclusiveGroup)) {
    const group = item.module.exclusiveGroup as string;
    const members = exclusiveGroups.get(group) ?? [];
    members.push(item);
    exclusiveGroups.set(group, members);
  }

  for (const [group, members] of exclusiveGroups) {
    const sorted = [...members].sort((a, b) => b.score - a.score
      || b.module.priority - a.module.priority
      || a.module.id.localeCompare(b.module.id));
    const topScore = sorted[0].score;
    const tied = sorted.filter((item) => item.score === topScore);
    if (tied.length > 1) {
      ambiguousGroups.push({ group, candidates: tied.map((item) => item.module.id), score: topScore });
      for (const item of tied) exclusiveRejected.set(item.module.id, "ambiguous-candidate");
      for (const item of sorted.slice(tied.length)) exclusiveRejected.set(item.module.id, "exclusive-not-selected");
      continue;
    }
    rankedCandidates.push(sorted[0]);
    for (const item of sorted.slice(1)) exclusiveRejected.set(item.module.id, "exclusive-not-selected");
  }

  const ranked = rankedCandidates.sort((a, b) => Number(b.module.required) - Number(a.module.required)
    || b.score - a.score
    || b.module.priority - a.module.priority
    || a.module.id.localeCompare(b.module.id));

  let remaining = Math.max(0, Math.floor(args.maxModuleChars));
  const selected: MaterializedSkillContextModule[] = [];
  const selectedIds = new Set<string>();
  const budgetRejected = new Set<string>();

  for (const item of ranked) {
    if (item.module.chars <= remaining) {
      selected.push(item.module);
      selectedIds.add(item.module.id);
      remaining -= item.module.chars;
    } else {
      budgetRejected.add(item.module.id);
    }
  }

  const decisions = evaluated.map((item): SkillContextModuleDecision => ({
    id: item.module.id,
    selected: selectedIds.has(item.module.id),
    score: item.score,
    chars: item.module.chars,
    reason: selectedIds.has(item.module.id)
      ? "selected"
      : budgetRejected.has(item.module.id)
        ? "budget-exceeded"
        : exclusiveRejected.get(item.module.id) ?? item.reason,
    matched: item.matched,
  }));

  return {
    selected,
    decisions,
    selectedChars: selected.reduce((sum, module) => sum + module.chars, 0),
    remainingChars: remaining,
    ambiguousGroups,
  };
}
