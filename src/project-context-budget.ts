import fs from "node:fs/promises";
import path from "node:path";

import {
  type ProjectContextCore,
  type ResolvedProjectContextManifest,
  type ResolvedProjectContextModule,
} from "./project-context.js";
import {
  MAX_PROJECT_CONTEXT_CHARS,
  MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES,
  extractProjectContextSections,
  inspectProjectContextSegments,
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

export type ProjectContextPhysicalSourceEvaluation = Readonly<{
  entryId: string;
  sourcePath: string;
  currentBytes: number;
  nextBytes: number;
  budgetBytes: number;
  hardLimitBytes: number;
  utilization: number;
  level: ProjectContextBudgetLevel;
  exceededBudget: boolean;
  exceededHardLimit: boolean;
}>;

export type ProjectContextWritePreflight = Readonly<{
  projectRoot: string;
  targetRef: string;
  manifestStatus: "loaded" | "missing";
  affectedEntries: readonly ProjectContextBudgetEvaluation[];
  physicalSources: readonly ProjectContextPhysicalSourceEvaluation[];
  level: ProjectContextBudgetLevel;
  contractValid: boolean;
  replanBeforeWrite: boolean;
  maintenanceRequiredBeforeWrite: boolean;
  growthBlockedEntries: readonly string[];
  recommendedAction: "none" | "project_context_modularization_plan" | "mssr_project_maintain";
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

function materializeSelectedBytes(nextText: string, entry: ProjectContextCore | ResolvedProjectContextModule): number {
  if ("segments" in entry && entry.segments?.length) {
    const inspected = inspectProjectContextSegments(nextText, entry.segments);
    const baseline = inspected.find((segment) => segment.baseline);
    if (!baseline) throw new Error(`Segmented project-context module ${entry.id} has no baseline payload.`);
    const largestOptionalBytes = inspected.filter((segment) => !segment.baseline).reduce((max, segment) => Math.max(max, segment.bytes), 0);
    return baseline.bytes + largestOptionalBytes;
  }
  const selected = entry.source.sections?.length
    ? extractProjectContextSections(nextText, entry.source.sections)
    : nextText.trim();
  return Buffer.byteLength(selected, "utf8");
}

function targetEntries(manifest: ResolvedProjectContextManifest, targetRef: string): Array<{ entry: ProjectContextCore | ResolvedProjectContextModule; core: boolean }> {
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
 * as a deterministic validation failure when the proposed bytes exceed maxChars or would
 * grow an indexed entry into REVIEW pressure. Shrinking an already-pressured entry remains
 * allowed. REVIEW triggers MSSR maintenance/replan; semantic restructuring still requires
 * explicit review when the maintenance executor cannot prove an exact structural move.
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
      physicalSources: [],
      level: "ok",
      contractValid: true,
      replanBeforeWrite: false,
      maintenanceRequiredBeforeWrite: false,
      growthBlockedEntries: [],
      recommendedAction: "none",
      recommendedSkills: [],
      advisoryOnly: true,
    };
  }

  const currentText = await fs.readFile(targetAbsolute, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  const evaluations: ProjectContextBudgetEvaluation[] = [];
  const physicalSources: ProjectContextPhysicalSourceEvaluation[] = [];
  const growthBlockedEntries = new Set<string>();
  for (const { entry, core } of targetEntries(loaded.manifest, targetRef)) {
    let selectedBytes: number;
    try {
      selectedBytes = materializeSelectedBytes(args.nextText, entry);
    } catch (error) {
      throw new Error(`Project-context preflight cannot materialize '${entry.id}' from proposed ${targetRef}: ${error instanceof Error ? error.message : String(error)}`);
    }
    let currentSelectedBytes = 0;
    if (currentText !== null) {
      try { currentSelectedBytes = materializeSelectedBytes(currentText, entry); }
      catch { currentSelectedBytes = 0; }
    }
    const evaluation = evaluateProjectContextEntryBudget({
      entryId: entry.id,
      core,
      sourcePath: entry.source.path,
      selectedBytes,
      maxChars: entry.maxChars,
    });
    evaluations.push(evaluation);
    if (evaluation.level === "review" && selectedBytes > currentSelectedBytes) growthBlockedEntries.add(entry.id);

    if (!core && "segments" in entry && entry.segments?.length) {
      const currentBytes = currentText === null ? 0 : Buffer.byteLength(currentText, "utf8");
      const nextBytes = Buffer.byteLength(args.nextText, "utf8");
      const physicalBudget = evaluateProjectContextEntryBudget({
        entryId: entry.id,
        core: false,
        sourcePath: entry.source.path,
        selectedBytes: nextBytes,
        maxChars: MAX_PROJECT_CONTEXT_CHARS,
      });
      const exceededHardLimit = nextBytes > MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES;
      const physicalLevel: ProjectContextBudgetLevel = exceededHardLimit ? "review" : physicalBudget.level;
      physicalSources.push({
        entryId: entry.id,
        sourcePath: entry.source.path.replace(/\\/g, "/"),
        currentBytes,
        nextBytes,
        budgetBytes: MAX_PROJECT_CONTEXT_CHARS,
        hardLimitBytes: MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES,
        utilization: nextBytes / MAX_PROJECT_CONTEXT_CHARS,
        level: physicalLevel,
        exceededBudget: nextBytes > MAX_PROJECT_CONTEXT_CHARS,
        exceededHardLimit,
      });
      if (exceededHardLimit || (physicalLevel === "review" && nextBytes > currentBytes)) growthBlockedEntries.add(entry.id);
    }
  }

  let level: ProjectContextBudgetLevel = "ok";
  for (const evaluation of evaluations) level = maxLevel(level, evaluation.level);
  for (const source of physicalSources) level = maxLevel(level, source.level);
  const blockedEntries = [...growthBlockedEntries];
  const maintenanceRequiredBeforeWrite = blockedEntries.length > 0;
  const contractValid = evaluations.every((evaluation) => !evaluation.exceeded)
    && physicalSources.every((source) => !source.exceededHardLimit)
    && !maintenanceRequiredBeforeWrite;
  const replanBeforeWrite = maintenanceRequiredBeforeWrite
    || evaluations.some((evaluation) => evaluation.level === "review")
    || physicalSources.some((source) => source.level === "review");
  return {
    projectRoot,
    targetRef,
    manifestStatus: "loaded",
    affectedEntries: evaluations,
    physicalSources,
    level,
    contractValid,
    replanBeforeWrite,
    maintenanceRequiredBeforeWrite,
    growthBlockedEntries: blockedEntries,
    recommendedAction: maintenanceRequiredBeforeWrite
      ? "mssr_project_maintain"
      : level === "ok" ? "none" : "project_context_modularization_plan",
    recommendedSkills: replanBeforeWrite ? ["skill-maintenance-loop"] : [],
    advisoryOnly: true,
  };
}
