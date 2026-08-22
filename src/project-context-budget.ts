import path from "node:path";

import {
  type ProjectContextCore,
  type ProjectContextManifest,
  type ProjectContextModule,
} from "./project-context.js";
import {
  MAX_PROJECT_CONTEXT_CHARS,
  extractProjectContextSections,
  loadProjectContextModuleManifest,
} from "./project-context-loader.js";

export const PROJECT_CONTEXT_BUDGET_WATCH_RATIO = 0.75;
export const PROJECT_CONTEXT_BUDGET_REVIEW_RATIO = 0.90;

export const PROJECT_CONTEXT_BUDGET_LEVELS = ["ok", "watch", "review"] as const;
export type ProjectContextBudgetLevel = typeof PROJECT_CONTEXT_BUDGET_LEVELS[number];

export type ProjectContextBudgetEvaluation = Readonly<{
  entryId: string;
  core: boolean;
  sourcePath: string;
  selectedBytes: number;
  budgetBytes: number;
  remainingBytes: number;
  utilization: number;
  level: ProjectContextBudgetLevel;
  exceeded: boolean;
  recommendation: "KEEP_COMPACT" | "PLAN_MODULARIZATION" | "MODULARIZE_BEFORE_WRITE";
  recommendedSkills: readonly string[];
}>;

export type ProjectContextWritePreflight = Readonly<{
  projectRoot: string;
  targetRef: string;
  manifestStatus: "loaded" | "missing";
  affectedEntries: readonly ProjectContextBudgetEvaluation[];
  level: ProjectContextBudgetLevel;
  contractValid: boolean;
  replanBeforeWrite: boolean;
  recommendedAction: "none" | "project_context_modularization_plan";
  recommendedSkills: readonly string[];
  advisoryOnly: true;
}>;

function normalizeRef(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function maxLevel(a: ProjectContextBudgetLevel, b: ProjectContextBudgetLevel): ProjectContextBudgetLevel {
  const rank = { ok: 0, watch: 1, review: 2 } as const;
  return rank[b] > rank[a] ? b : a;
}

export function effectiveProjectContextEntryBudget(maxChars?: number): number {
  return Math.min(maxChars ?? MAX_PROJECT_CONTEXT_CHARS, MAX_PROJECT_CONTEXT_CHARS);
}

export function evaluateProjectContextEntryBudget(args: {
  entryId: string;
  core: boolean;
  sourcePath: string;
  selectedBytes: number;
  maxChars?: number;
}): ProjectContextBudgetEvaluation {
  const budgetBytes = effectiveProjectContextEntryBudget(args.maxChars);
  const selectedBytes = Math.max(0, Math.trunc(args.selectedBytes));
  const utilization = budgetBytes > 0 ? selectedBytes / budgetBytes : 1;
  const exceeded = selectedBytes > budgetBytes;
  const level: ProjectContextBudgetLevel = exceeded || utilization >= PROJECT_CONTEXT_BUDGET_REVIEW_RATIO
    ? "review"
    : utilization >= PROJECT_CONTEXT_BUDGET_WATCH_RATIO
      ? "watch"
      : "ok";
  return {
    entryId: args.entryId,
    core: args.core,
    sourcePath: args.sourcePath.replace(/\\/g, "/"),
    selectedBytes,
    budgetBytes,
    remainingBytes: Math.max(0, budgetBytes - selectedBytes),
    utilization,
    level,
    exceeded,
    recommendation: exceeded || level === "review"
      ? "MODULARIZE_BEFORE_WRITE"
      : level === "watch"
        ? "PLAN_MODULARIZATION"
        : "KEEP_COMPACT",
    recommendedSkills: level === "review" ? ["skill-maintenance-loop"] : [],
  };
}

function materializeSelectedBytes(nextText: string, entry: ProjectContextCore | ProjectContextModule): number {
  const selected = entry.source.sections?.length
    ? extractProjectContextSections(nextText, entry.source.sections)
    : nextText.trim();
  return Buffer.byteLength(selected, "utf8");
}

function targetEntries(manifest: ProjectContextManifest, targetRef: string): Array<{ entry: ProjectContextCore | ProjectContextModule; core: boolean }> {
  const normalized = normalizeRef(targetRef);
  return [
    ...manifest.core.map((entry) => ({ entry, core: true })),
    ...manifest.modules.map((entry) => ({ entry, core: false })),
  ].filter(({ entry }) => normalizeRef(entry.source.path) === normalized);
}

/**
 * Forecast the selected project-context payload produced by one proposed Markdown write.
 *
 * This is a portable integrity/preflight contract. It does not perform the write, mutate
 * manifests, increase budgets, or decide project truth. Hosts may use `contractValid=false`
 * as a deterministic validation failure because the proposed bytes cannot be materialized
 * under the repository-declared maxChars contract. REVIEW below the hard limit remains an
 * advisory replan signal and recommends the existing maintenance loop.
 */
export async function preflightMssrProjectContextWrite(args: {
  projectRoot: string;
  targetPath: string;
  nextText: string;
}): Promise<ProjectContextWritePreflight> {
  const projectRoot = path.resolve(args.projectRoot);
  const targetAbsolute = path.isAbsolute(args.targetPath)
    ? path.resolve(args.targetPath)
    : path.resolve(projectRoot, args.targetPath);
  const relative = path.relative(projectRoot, targetAbsolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Project-context preflight target must remain inside project root: ${args.targetPath}`);
  }
  const targetRef = relative.replace(/\\/g, "/");
  const loaded = await loadProjectContextModuleManifest(projectRoot);
  if (!loaded.found) {
    return {
      projectRoot,
      targetRef,
      manifestStatus: "missing",
      affectedEntries: [],
      level: "ok",
      contractValid: true,
      replanBeforeWrite: false,
      recommendedAction: "none",
      recommendedSkills: [],
      advisoryOnly: true,
    };
  }

  const evaluations: ProjectContextBudgetEvaluation[] = [];
  for (const { entry, core } of targetEntries(loaded.manifest, targetRef)) {
    let selectedBytes: number;
    try {
      selectedBytes = materializeSelectedBytes(args.nextText, entry);
    } catch (error) {
      throw new Error(`Project-context preflight cannot materialize '${entry.id}' from proposed ${targetRef}: ${error instanceof Error ? error.message : String(error)}`);
    }
    evaluations.push(evaluateProjectContextEntryBudget({
      entryId: entry.id,
      core,
      sourcePath: entry.source.path,
      selectedBytes,
      maxChars: entry.maxChars,
    }));
  }

  let level: ProjectContextBudgetLevel = "ok";
  for (const evaluation of evaluations) level = maxLevel(level, evaluation.level);
  const contractValid = evaluations.every((evaluation) => !evaluation.exceeded);
  const replanBeforeWrite = evaluations.some((evaluation) => evaluation.level === "review");
  return {
    projectRoot,
    targetRef,
    manifestStatus: "loaded",
    affectedEntries: evaluations,
    level,
    contractValid,
    replanBeforeWrite,
    recommendedAction: level === "ok" ? "none" : "project_context_modularization_plan",
    recommendedSkills: replanBeforeWrite ? ["skill-maintenance-loop"] : [],
    advisoryOnly: true,
  };
}
