import fs from "node:fs/promises";
import path from "node:path";
import { type ProjectContextCore, type ResolvedProjectContextManifest, type ResolvedProjectContextModule } from "./project-context.js";
import { evaluateProjectContextEntryBudget } from "./project-context-budget.js";
import {
  MAX_PROJECT_CONTEXT_CHARS,
  MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES,
  extractProjectContextSections,
  inspectProjectContextSegments,
  loadProjectContextModuleManifest,
  readBoundedMarkdown,
} from "./project-context-loader.js";
import { MSSR_PROJECT_AUTHORITY_FILES, MSSR_PROJECT_CONTROL_FILES, MSSR_PROJECT_HOME_DIR } from "./project-home.js";

export const PROJECT_CONTEXT_HEALTH_LEVELS = ["ok", "watch", "review"] as const;
export type ProjectContextHealthLevel = typeof PROJECT_CONTEXT_HEALTH_LEVELS[number];

export type ProjectContextHealthFinding = {
  code: string;
  level: ProjectContextHealthLevel;
  target: string;
  message: string;
  recommendation: string;
  budget?: {
    selectedBytes: number;
    budgetBytes: number;
    remainingBytes: number;
    utilization: number;
  };
};

const LEGACY_MSSR_FILES = [
  "PROJECT_CONTEXT.md", "PROJECT_MEMORY.md", "PROJECT_STATE.md", "project-context.json",
  "project-context-modules.json", "context-messages.json", "mssr-context-inbox.json",
] as const;

async function exists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}

function maxLevel(a: ProjectContextHealthLevel, b: ProjectContextHealthLevel): ProjectContextHealthLevel {
  const rank = { ok: 0, watch: 1, review: 2 } as const;
  return rank[b] > rank[a] ? b : a;
}

async function listMarkdown(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(path.relative(root, abs).replace(/\\/g, "/"));
    }
  }
  await walk(root);
  return out.sort();
}

type ProjectContextEntryMeasurement = {
  bytes: number | null;
  physicalBytes: number;
  segmented: boolean;
  sourceHardLimitExceeded: boolean;
  baselineBytes: number | null;
  largestOptionalBytes: number | null;
};

async function selectedMeasurement(
  projectRoot: string,
  entry: ProjectContextCore | ResolvedProjectContextModule,
): Promise<ProjectContextEntryMeasurement | null> {
  try {
    const absolute = path.resolve(projectRoot, entry.source.path);
    const segmented = "segments" in entry && Boolean(entry.segments?.length);
    const physicalBytes = (await fs.stat(absolute)).size;
    const sourceHardLimit = segmented ? MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES : MAX_PROJECT_CONTEXT_CHARS;
    if (physicalBytes > sourceHardLimit) {
      return { bytes: null, physicalBytes, segmented, sourceHardLimitExceeded: true, baselineBytes: null, largestOptionalBytes: null };
    }
    const text = (await readBoundedMarkdown(absolute, sourceHardLimit)).content;
    if (segmented && "segments" in entry && entry.segments?.length) {
      const inspected = inspectProjectContextSegments(text, entry.segments);
      const baseline = inspected.find((segment) => segment.baseline);
      if (!baseline) return null;
      const largestOptionalBytes = inspected.filter((segment) => !segment.baseline).reduce((max, segment) => Math.max(max, segment.bytes), 0);
      return {
        bytes: baseline.bytes + largestOptionalBytes,
        physicalBytes,
        segmented: true,
        sourceHardLimitExceeded: false,
        baselineBytes: baseline.bytes,
        largestOptionalBytes,
      };
    }
    const selected = entry.source.sections?.length ? extractProjectContextSections(text, entry.source.sections) : text.trim();
    return {
      bytes: Buffer.byteLength(selected, "utf8"),
      physicalBytes,
      segmented: false,
      sourceHardLimitExceeded: false,
      baselineBytes: null,
      largestOptionalBytes: null,
    };
  } catch { return null; }
}

export async function auditMssrProjectContextHealth(projectRootInput: string) {
  const projectRoot = path.resolve(projectRootInput);
  const home = path.join(projectRoot, MSSR_PROJECT_HOME_DIR);
  const manifestPath = path.join(home, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  const findings: ProjectContextHealthFinding[] = [];
  let manifest: ResolvedProjectContextManifest | null = null;
  let manifestStatus: "missing" | "valid" | "invalid" = "missing";

  if (await exists(manifestPath)) {
    try {
      const loaded = await loadProjectContextModuleManifest(projectRoot);
      if (!loaded.found) throw new Error("Project-context manifest disappeared during health inspection.");
      manifest = loaded.manifest;
      manifestStatus = "valid";
    } catch (error) {
      manifestStatus = "invalid";
      findings.push({ code: "invalid-manifest", level: "review", target: ".mssr/project-context.json or project-context-segments.json", message: error instanceof Error ? error.message : String(error), recommendation: "REPAIR_PROJECT_CONTEXT_MANIFEST" });
    }
  } else {
    findings.push({ code: "missing-manifest", level: "review", target: ".mssr/project-context.json", message: "The repository is not initialized under the MSSR project-context contract.", recommendation: "INITIALIZE_PROJECT_CONTEXT" });
  }

  for (const legacy of LEGACY_MSSR_FILES) {
    const target = path.join(projectRoot, ".bridge", legacy);
    if (await exists(target)) findings.push({ code: "legacy-mssr-artifact", level: "review", target: `.bridge/${legacy}`, message: "Canonical-only MSSR must not retain active project-control artifacts under .bridge/.", recommendation: "REMOVE_LEGACY_ARTIFACTS" });
  }

  for (const fileName of Object.values(MSSR_PROJECT_AUTHORITY_FILES)) {
    const target = path.join(home, fileName);
    if (!(await exists(target))) continue;
    const stat = await fs.stat(target);
    if (stat.size > 32_000) findings.push({ code: "oversized-authority", level: "review", target: `.mssr/${fileName}`, message: `${fileName} is ${stat.size} bytes; PROJECT_* should remain a compact control plane.`, recommendation: "SPLIT_TO_KNOWLEDGE_MODULES" });
    else if (stat.size > 16_000) findings.push({ code: "growing-authority", level: "watch", target: `.mssr/${fileName}`, message: `${fileName} is ${stat.size} bytes and is approaching monolithic context.`, recommendation: "REVIEW_MODULARIZATION" });
  }

  if (manifest) {
    if (manifest.modules.length > 48) findings.push({ code: "many-modules", level: "review", target: ".mssr/project-context.json", message: `${manifest.modules.length} modules make the manifest difficult to curate.`, recommendation: "REVIEW_AREA_GROUPING" });
    else if (manifest.modules.length > 24) findings.push({ code: "many-modules", level: "watch", target: ".mssr/project-context.json", message: `${manifest.modules.length} modules warrant an organization review.`, recommendation: "REVIEW_AREA_GROUPING" });

    for (const entry of manifest.core) {
      const measurement = await selectedMeasurement(projectRoot, entry);
      const chars = measurement?.bytes ?? null;
      if (chars === null) {
        findings.push({ code: "missing-core-source", level: "review", target: entry.source.path, message: `Core module ${entry.id} cannot be materialized.`, recommendation: "REPAIR_MODULE_SOURCE" });
      } else if (entry.maxChars !== undefined) {
        const budget = evaluateProjectContextEntryBudget({ entryId: entry.id, core: true, sourcePath: entry.source.path, selectedBytes: chars, maxChars: entry.maxChars });
        if (budget.level !== "ok") findings.push({
          code: budget.exceeded ? "core-entry-budget-exceeded" : "core-entry-budget-pressure",
          level: budget.level,
          target: entry.id,
          message: `Core module ${entry.id} loads ${chars}/${budget.budgetBytes} bytes (${Math.round(budget.utilization * 100)}%).`,
          recommendation: budget.level === "review" ? "SPLIT_TO_KNOWLEDGE_MODULES" : "NARROW_CORE",
          budget: { selectedBytes: budget.selectedBytes, budgetBytes: budget.budgetBytes, remainingBytes: budget.remainingBytes, utilization: budget.utilization },
        });
      } else if (chars > 10_000) findings.push({ code: "oversized-core-module", level: "review", target: entry.id, message: `Core module ${entry.id} loads ${chars} bytes.`, recommendation: "SPLIT_TO_KNOWLEDGE_MODULES" });
      else if (chars > 5_000) findings.push({ code: "growing-core-module", level: "watch", target: entry.id, message: `Core module ${entry.id} loads ${chars} bytes.`, recommendation: "NARROW_CORE" });
    }
    for (const entry of manifest.modules) {
      const measurement = await selectedMeasurement(projectRoot, entry);
      const chars = measurement?.bytes ?? null;
      if (measurement?.segmented) {
        const physicalBudget = evaluateProjectContextEntryBudget({
          entryId: entry.id,
          core: false,
          sourcePath: entry.source.path,
          selectedBytes: measurement.physicalBytes,
          maxChars: MAX_PROJECT_CONTEXT_CHARS,
        });
        if (measurement.sourceHardLimitExceeded) {
          findings.push({
            code: "segmented-source-hard-limit-exceeded",
            level: "review",
            target: entry.id,
            message: `Segmented module ${entry.id} backing source is ${measurement.physicalBytes} bytes and exceeds the ${MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES}-byte recovery hard limit.`,
            recommendation: "REVIEW_SEGMENTED_SOURCE_STORAGE",
          });
        } else if (physicalBudget.level !== "ok") {
          findings.push({
            code: physicalBudget.exceeded ? "segmented-source-budget-exceeded" : "segmented-source-budget-pressure",
            level: physicalBudget.level,
            target: entry.id,
            message: `Segmented module ${entry.id} backing source is ${measurement.physicalBytes}/${MAX_PROJECT_CONTEXT_CHARS} bytes (${Math.round(physicalBudget.utilization * 100)}% of the normal physical maintenance budget); selected payload budgeting remains separate.`,
            recommendation: physicalBudget.level === "review" ? "REVIEW_SEGMENTED_SOURCE_STORAGE" : "PLAN_SEGMENTED_SOURCE_STORAGE_REVIEW",
            budget: { selectedBytes: physicalBudget.selectedBytes, budgetBytes: physicalBudget.budgetBytes, remainingBytes: physicalBudget.remainingBytes, utilization: physicalBudget.utilization },
          });
        }
      }
      if (chars === null) {
        if (!measurement?.sourceHardLimitExceeded) findings.push({ code: entry.segments?.length ? "invalid-segment-contract" : "missing-module-source", level: "review", target: entry.source.path, message: `Module ${entry.id} cannot be materialized${entry.segments?.length ? " under its segment contract" : ""}.`, recommendation: entry.segments?.length ? "REVIEW_MODULE_SEGMENTS" : "REPAIR_MODULE_SOURCE" });
      } else if (entry.maxChars !== undefined) {
        const budget = evaluateProjectContextEntryBudget({ entryId: entry.id, core: false, sourcePath: entry.source.path, selectedBytes: chars, maxChars: entry.maxChars });
        if (budget.level !== "ok") findings.push({
          code: budget.exceeded ? "module-entry-budget-exceeded" : "module-entry-budget-pressure",
          level: budget.level,
          target: entry.id,
          message: measurement?.segmented
            ? `Segmented module ${entry.id} has a worst single-target payload of ${chars}/${budget.budgetBytes} bytes (${Math.round(budget.utilization * 100)}%; baseline ${measurement.baselineBytes} + largest optional ${measurement.largestOptionalBytes}).`
            : `Module ${entry.id} loads ${chars}/${budget.budgetBytes} bytes (${Math.round(budget.utilization * 100)}%).`,
          recommendation: budget.level === "review" ? "SPLIT_MODULE" : "REVIEW_MODULE_SPLIT",
          budget: { selectedBytes: budget.selectedBytes, budgetBytes: budget.budgetBytes, remainingBytes: budget.remainingBytes, utilization: budget.utilization },
        });
      } else if (chars > 14_000) findings.push({ code: "oversized-module", level: "review", target: entry.id, message: `Module ${entry.id} loads ${chars} bytes.`, recommendation: "SPLIT_MODULE" });
      else if (chars > 7_000) findings.push({ code: "growing-module", level: "watch", target: entry.id, message: `Module ${entry.id} loads ${chars} bytes.`, recommendation: "REVIEW_MODULE_SPLIT" });
      if (!entry.segments?.length && !entry.source.sections?.length && chars !== null && chars > 24_000) findings.push({ code: "whole-file-module", level: chars > 48_000 ? "review" : "watch", target: entry.id, message: `Module ${entry.id} loads an entire ${chars}-byte file.`, recommendation: "SELECT_STABLE_SECTION" });
    }

    const projectMemoryPath = `.mssr/${MSSR_PROJECT_AUTHORITY_FILES.memory}`.toLowerCase();
    const rootBackedMemoryModules = manifest.modules.filter((entry) =>
      entry.kind === "memory"
      && entry.source.path.replace(/\\/g, "/").toLowerCase() === projectMemoryPath,
    );
    if (rootBackedMemoryModules.length >= 2) {
      const level: ProjectContextHealthLevel = rootBackedMemoryModules.length >= 8 ? "review" : "watch";
      findings.push({
        code: "root-backed-memory-fanout",
        level,
        target: `.mssr/${MSSR_PROJECT_AUTHORITY_FILES.memory}`,
        message: `${rootBackedMemoryModules.length} optional memory modules share PROJECT_MEMORY.md; semantic selection is modular but physical storage is still accumulating in the root authority.`,
        recommendation: "EXTRACT_MEMORY_REFS",
      });
    }

    const indexed = new Set([...manifest.core, ...manifest.modules].map((entry) => entry.source.path.replace(/\\/g, "/").toLowerCase()));
    const knowledgeRoot = path.join(home, "knowledge");
    for (const rel of await listMarkdown(knowledgeRoot)) {
      const projectRel = `.mssr/knowledge/${rel}`.toLowerCase();
      if (!indexed.has(projectRel)) findings.push({ code: "unindexed-knowledge", level: "watch", target: `.mssr/knowledge/${rel}`, message: "Knowledge file exists but cannot be selected by MSSR.", recommendation: "INDEX_KNOWLEDGE_FILE" });
    }
  }

  let level: ProjectContextHealthLevel = "ok";
  for (const finding of findings) level = maxLevel(level, finding.level);
  return {
    projectRoot,
    level,
    manifestStatus,
    moduleCount: manifest?.modules.length ?? 0,
    coreCount: manifest?.core.length ?? 0,
    findings,
    recommendations: [...new Set(findings.map((finding) => finding.recommendation))],
    advisoryOnly: true,
  };
}
