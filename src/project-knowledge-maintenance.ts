import { z } from "zod";

import {
  SKILL_ACTIONS,
  SKILL_SIGNALS,
  SKILL_STAGES,
  structuredSkillIntentSchema,
} from "./skill-routing.js";
import {
  mssrTraceLifecycleStateSchema,
  type MssrTraceLifecycleState,
} from "./trace-contract.js";

export const MSSR_PROJECT_KNOWLEDGE_TARGETS = ["agents", "context", "memory", "state", "skill", "reference"] as const;
export const MSSR_PROJECT_KNOWLEDGE_LEVELS = ["none", "watch", "review", "required"] as const;

export type MssrProjectKnowledgeTarget = typeof MSSR_PROJECT_KNOWLEDGE_TARGETS[number];
export type MssrProjectKnowledgeLevel = typeof MSSR_PROJECT_KNOWLEDGE_LEVELS[number];

export const mssrProjectKnowledgeMaintenanceInputSchema = z.object({
  stage: z.enum(SKILL_STAGES).optional(),
  eventType: z.string().trim().min(1).max(80).optional(),
  intent: structuredSkillIntentSchema.optional(),
  changedPaths: z.array(z.string().trim().min(1).max(4096)).max(400).default([]),
  toolNames: z.array(z.string().trim().min(1).max(160)).max(120).default([]),
  materialWrites: z.number().int().min(0).max(10_000).default(0),
  packageChanged: z.boolean().default(false),
  runtimeChanged: z.boolean().default(false),
  routingChanged: z.boolean().default(false),
  skillStructureChanged: z.boolean().default(false),
  contextFreshnessIssues: z.number().int().min(0).max(10_000).default(0),
  projectInitialized: z.boolean().optional(),
  projectContextHealth: z.enum(["ok", "watch", "review"]).optional(),
  userCorrections: z.number().int().min(0).max(1_000).default(0),
}).strict();

export type MssrProjectKnowledgeMaintenanceInput = z.infer<typeof mssrProjectKnowledgeMaintenanceInputSchema>;

export type MssrProjectKnowledgeMaintenanceTarget = Readonly<{
  target: MssrProjectKnowledgeTarget;
  level: Exclude<MssrProjectKnowledgeLevel, "none">;
  score: number;
  reasons: readonly string[];
  authority: string;
}>;

export type MssrProjectKnowledgeMaintenanceResult = Readonly<{
  level: MssrProjectKnowledgeLevel;
  due: boolean;
  targets: readonly MssrProjectKnowledgeMaintenanceTarget[];
  recommendedSkills: readonly string[];
  advisoryOnly: true;
  policy: string;
}>;

const AUTHORITY: Record<MssrProjectKnowledgeTarget, string> = {
  agents: "AGENTS.md",
  context: ".mssr/PROJECT_CONTEXT.md",
  memory: ".mssr/PROJECT_MEMORY.md",
  state: ".mssr/PROJECT_STATE.md",
  skill: "owning SKILL.md",
  reference: "owning skill references/",
};

const LEVEL_WEIGHT: Record<Exclude<MssrProjectKnowledgeLevel, "none">, number> = {
  watch: 1,
  review: 2,
  required: 3,
};

function normalizedPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function levelFor(score: number, forcedRequired: boolean): Exclude<MssrProjectKnowledgeLevel, "none"> | null {
  if (forcedRequired) return "required";
  if (score >= 4) return "review";
  if (score >= 2) return "watch";
  return null;
}

/**
 * Portable advisory classifier for project-knowledge drift.
 *
 * Hosts provide only bounded observable metadata (paths, tool names, trace stage,
 * runtime/package flags, freshness counts). The classifier recommends which
 * authority deserves review; it never mutates project knowledge and it never
 * treats telemetry as truth.
 */
export function evaluateMssrProjectKnowledgeMaintenance(
  input: MssrProjectKnowledgeMaintenanceInput,
): MssrProjectKnowledgeMaintenanceResult {
  const parsed = mssrProjectKnowledgeMaintenanceInputSchema.parse(input);
  const scores = new Map<MssrProjectKnowledgeTarget, number>();
  const reasons = new Map<MssrProjectKnowledgeTarget, Set<string>>();
  const forcedRequired = new Set<MssrProjectKnowledgeTarget>();
  const touched = new Set<MssrProjectKnowledgeTarget>();

  const add = (target: MssrProjectKnowledgeTarget, score: number, reason: string, required = false) => {
    scores.set(target, (scores.get(target) ?? 0) + score);
    const values = reasons.get(target) ?? new Set<string>();
    values.add(reason);
    reasons.set(target, values);
    if (required) forcedRequired.add(target);
  };

  const paths = parsed.changedPaths.map(normalizedPath);
  for (const file of paths) {
    if (file === "agents.md" || file.endsWith("/agents.md")) touched.add("agents");
    if (file === ".mssr/project_context.md") touched.add("context");
    if (file === ".mssr/project_memory.md") touched.add("memory");
    if (file === ".mssr/project_state.md") touched.add("state");
    if (file === ".mssr/project-context.json") touched.add("context");
    if (file.startsWith(".mssr/knowledge/decision/")) touched.add("memory");
    else if (file.startsWith(".mssr/knowledge/state/") || file.startsWith(".mssr/knowledge/phase/")) touched.add("state");
    else if (file.startsWith(".mssr/knowledge/")) touched.add("context");
    if (/(?:^|\/)skills\/[^/]+\/skill\.md$/.test(file)) touched.add("skill");
    if (/(?:^|\/)skills\/[^/]+\/references\//.test(file)) touched.add("reference");

    if (file === "package.json" || file.endsWith("/package.json") || file === "package-lock.json") {
      add("state", 2, "package-metadata-changed");
    }
    if (file.startsWith("changelogs/") || file === "changelog.md") add("state", 1, "release-history-changed");
    if (file.startsWith("docs/decisions/") || file.includes("architecture")) {
      add("context", 3, "architecture-decision-changed");
      add("memory", 2, "durable-decision-changed");
    }
    if (file.startsWith("src/") && /(adapter|context|routing|trace|project-home|project-knowledge|provider|schema|registry)/.test(file)) {
      add("context", 2, "control-plane-contract-changed");
    }
    if (file === "templates/agents.mssr.md" || file.includes("host-adapter-contract")) {
      add("agents", 4, "transversal-agent-contract-changed");
    }
    if (file.startsWith("config/skill-routing/") || file.includes("skill-routing")) add("skill", 3, "routing-contract-changed");
    if (/(?:^|\/)skills\/[^/]+\/skill\.md$/.test(file)) add("skill", 2, "skill-capability-changed");
    if (/(?:^|\/)skills\/[^/]+\/references\//.test(file)) add("reference", 2, "skill-recipe-changed");
    if (file.endsWith("context-modules.json")) {
      add("skill", 2, "skill-context-selection-changed");
      add("reference", 1, "recipe-selection-changed");
    }
  }

  if (parsed.packageChanged) add("state", 3, "package-version-or-dependency-changed");
  if (parsed.runtimeChanged) add("state", 4, "runtime-adoption-changed");
  if (parsed.routingChanged) add("skill", 4, "routing-semantics-changed");
  if (parsed.skillStructureChanged) {
    add("skill", 3, "skill-structure-changed");
    add("reference", 2, "skill-recipes-or-modules-changed");
  }
  if (parsed.contextFreshnessIssues > 0) {
    add("context", 5, "context-freshness-conflict", true);
    add("state", 3, "context-plane-evidence-stale");
  }
  if (parsed.projectInitialized === false) {
    add("context", 5, "project-context-not-initialized");
    add("state", 2, "project-initialization-required");
  }
  if (parsed.projectContextHealth === "review") add("context", 4, "project-context-health-review");
  else if (parsed.projectContextHealth === "watch") add("context", 2, "project-context-health-watch");
  if (parsed.userCorrections > 0) add("memory", Math.min(4, 1 + parsed.userCorrections), "user-correction-observed");

  const intent = parsed.intent;
  const actions = new Set(intent?.actions ?? []);
  const signals = new Set(intent?.signals ?? []);
  if (actions.has("design")) add("context", 1, "design-work-observed");
  if (["version", "publish", "maintain"].some((value) => actions.has(value as typeof SKILL_ACTIONS[number]))) add("state", 1, "release-or-maintenance-work-observed");
  if (signals.has("reusable-pattern")) {
    add("memory", 2, "reusable-pattern-observed");
    add("skill", 1, "reusable-pattern-may-belong-to-skill");
  }
  if (["repeated-friction", "manual-workaround", "conflicting-evidence"].some((value) => signals.has(value as typeof SKILL_SIGNALS[number]))) {
    add("memory", 2, "durable-lesson-signal-observed");
  }

  if (parsed.materialWrites >= 3) add("state", 1, "multiple-material-writes");
  if (parsed.materialWrites >= 6 && actions.has("design")) add("context", 1, "broad-design-write-set");

  // If an authority is already part of the observed change set, do not nag merely
  // because the same evidence points at it. Consistency/freshness gates still
  // verify whether that update was correct; forced freshness conflicts remain due.
  for (const target of touched) {
    if (!forcedRequired.has(target)) {
      scores.set(target, Math.max(0, (scores.get(target) ?? 0) - 3));
      const values = reasons.get(target) ?? new Set<string>();
      values.add("authority-already-touched");
      reasons.set(target, values);
    }
  }

  const targets: MssrProjectKnowledgeMaintenanceTarget[] = [];
  for (const target of MSSR_PROJECT_KNOWLEDGE_TARGETS) {
    const score = scores.get(target) ?? 0;
    const level = levelFor(score, forcedRequired.has(target));
    if (!level) continue;
    targets.push({
      target,
      level,
      score,
      reasons: [...(reasons.get(target) ?? [])].sort(),
      authority: AUTHORITY[target],
    });
  }

  targets.sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] || b.score - a.score || a.target.localeCompare(b.target));
  const level: MssrProjectKnowledgeLevel = targets.some((target) => target.level === "required")
    ? "required"
    : targets.some((target) => target.level === "review")
      ? "review"
      : targets.some((target) => target.level === "watch")
        ? "watch"
        : "none";
  const due = level === "review" || level === "required";
  const recommendedSkills = due
    ? [
        "skill-maintenance-loop",
        ...(targets.some((target) => target.target === "skill" || target.target === "reference") ? ["skill-routing-maintainer"] : []),
      ]
    : [];

  return {
    level,
    due,
    targets,
    recommendedSkills,
    advisoryOnly: true,
    policy: "Observable metadata may trigger review of the canonical owner, but MSSR never auto-writes AGENTS, .mssr PROJECT_* authorities, skills, references, routing, or changelogs.",
  };
}

/**
 * Apply a project-knowledge advisory to the portable trace lifecycle.
 *
 * REVIEW/REQUIRED means a reviewed maintenance pass is now part of the close
 * contract. If maintenance for the current lifecycle revision had already been
 * completed, a newly observed material advisory invalidates that revision once,
 * making the prior close/maintenance stale without requiring hosts to invent
 * their own revision semantics.
 */
export function applyMssrProjectKnowledgeMaintenanceToLifecycle(
  input: MssrTraceLifecycleState,
  advisory: MssrProjectKnowledgeMaintenanceResult,
): MssrTraceLifecycleState {
  const state = mssrTraceLifecycleStateSchema.parse(input);
  if (!advisory.due) return state;

  const maintenanceWasFresh = state.maintenanceRequired
    && state.maintenanceRevision === state.lifecycleRevision;
  const lifecycleRevision = maintenanceWasFresh
    ? state.lifecycleRevision + 1
    : state.lifecycleRevision;

  return mssrTraceLifecycleStateSchema.parse({
    ...state,
    maintenanceRequired: true,
    lifecycleRevision,
  });
}
