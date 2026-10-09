import type { Dirent } from "node:fs";
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
  safeMarkdownPath,
} from "./project-context-loader.js";
import {
  PROJECT_CONTEXT_LIBRARIAN_LIMITS,
  projectContextLibrarianManifestSchema,
  projectMssrProjectContextLibrarianMetadata,
} from "./project-context-librarian.js";
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

export type ProjectDocumentReferenceCandidate = {
  path: string;
  reviewPriority: "high" | "medium" | "low";
  reasons: string[];
};

export type ProjectDocumentReferenceAudit = {
  scannedMarkdown: number;
  candidateCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  connectedCount: number;
  truncated: boolean;
  candidates: ProjectDocumentReferenceCandidate[];
};

const LEGACY_MSSR_FILES = [
  "PROJECT_CONTEXT.md", "PROJECT_MEMORY.md", "PROJECT_STATE.md", "project-context.json",
  "project-context-modules.json", "project-context-librarian.json", "context-messages.json", "mssr-context-inbox.json",
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

const PROJECT_DOC_SCAN_ROOTS = ["docs", "documentation", "design"] as const;
const PROJECT_DOC_SCAN_SKIP_DIRS = new Set([
  ".git", ".mssr", "node_modules", "dist", "build", "target", "vendor", "coverage",
  "changelog", "changelogs", "archive", "archives", "history",
]);
const MAX_PROJECT_DOC_SCAN_FILES = 512;
const MAX_PROJECT_DOC_REFERENCE_CANDIDATES = 24;

function normalizeProjectRelative(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function classifyProjectDocumentCandidate(relativePath: string): ProjectDocumentReferenceCandidate | null {
  const normalized = normalizeProjectRelative(relativePath);
  if (normalized.startsWith("docs/decisions/") || normalized.startsWith("docs/adr/") || normalized.startsWith("adr/")) return null;

  const base = path.posix.basename(normalized);
  const reasons: string[] = [];
  const datedOrHistorical = /(?:^|[-_])(19|20)\d{2}(?:[-_]\d{2}){0,2}(?:[-_.]|$)/.test(base)
    || /(?:^|[-_])(history|historical|archive|incident|audit|report)(?:[-_.]|$)/.test(base);

  if (/^(architecture|roadmap|contracts?|design|decisions?)\.md$/.test(base)) {
    reasons.push(`canonical-name:${base.replace(/\.md$/, "")}`);
    const pathDepth = normalized.split("/").length;
    const topLevelAuthority = pathDepth === 1 || (pathDepth === 2 && normalized.startsWith("docs/"));
    return { path: relativePath, reviewPriority: datedOrHistorical ? "medium" : topLevelAuthority ? "high" : "medium", reasons };
  }
  if (/^(handoff|context|memory|state)\.md$/.test(base)) {
    reasons.push(`continuity-name:${base.replace(/\.md$/, "")}`);
    return { path: relativePath, reviewPriority: datedOrHistorical ? "low" : "medium", reasons };
  }
  if (/^(readme|index)\.md$/.test(base)) {
    reasons.push(`navigation-name:${base.replace(/\.md$/, "")}`);
    return { path: relativePath, reviewPriority: "low", reasons };
  }
  if (/(architecture|roadmap|contract|design|context|memory|evidence|routing|handoff)/.test(base)) {
    reasons.push("semantic-filename");
    return { path: relativePath, reviewPriority: datedOrHistorical ? "low" : "medium", reasons };
  }
  return null;
}

async function listProjectDocumentCandidates(projectRoot: string): Promise<{ scannedMarkdown: number; truncated: boolean; candidates: ProjectDocumentReferenceCandidate[] }> {
  const files: string[] = [];
  let truncated = false;

  async function addMarkdownFiles(dir: string, depth: number) {
    if (truncated || depth < 0) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_PROJECT_DOC_SCAN_FILES) { truncated = true; return; }
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (PROJECT_DOC_SCAN_SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        if (depth > 0) await addMarkdownFiles(abs, depth - 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(path.relative(projectRoot, abs).replace(/\\/g, "/"));
      }
    }
  }

  let rootEntries: Dirent[] = [];
  try { rootEntries = await fs.readdir(projectRoot, { withFileTypes: true }); } catch { /* keep empty */ }
  for (const entry of rootEntries) {
    if (files.length >= MAX_PROJECT_DOC_SCAN_FILES) { truncated = true; break; }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(entry.name);
  }
  for (const rootName of PROJECT_DOC_SCAN_ROOTS) {
    await addMarkdownFiles(path.join(projectRoot, rootName), 4);
  }

  const unique = [...new Set(files)].sort();
  return {
    scannedMarkdown: unique.length,
    truncated,
    candidates: unique.map(classifyProjectDocumentCandidate).filter((candidate): candidate is ProjectDocumentReferenceCandidate => candidate !== null),
  };
}

async function materializeExplicitProjectDocReferences(projectRoot: string, manifest: ResolvedProjectContextManifest): Promise<{ indexed: Set<string>; carrierText: string }> {
  const entries = [...manifest.core, ...manifest.modules];
  const externalReferencePaths = manifest.modules.flatMap((entry) => entry.references?.map((reference) => reference.source.path) ?? []);
  const indexed = new Set([
    ...entries.map((entry) => normalizeProjectRelative(entry.source.path)),
    ...externalReferencePaths.map(normalizeProjectRelative),
  ]);
  const carrierSources = [...new Set([
    ...entries.map((entry) => entry.source.path),
    ...externalReferencePaths,
  ].filter((sourcePath) => normalizeProjectRelative(sourcePath).startsWith(".mssr/")))];
  const chunks: string[] = [];
  for (const sourcePath of carrierSources) {
    try {
      const absolute = path.resolve(projectRoot, sourcePath);
      const stat = await fs.stat(absolute);
      if (!stat.isFile() || stat.size > MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES) continue;
      chunks.push((await fs.readFile(absolute, "utf8")).replace(/\\/g, "/").toLowerCase());
    } catch {
      // Missing/invalid declared sources are already reported by normal project-context health.
    }
  }
  return { indexed, carrierText: chunks.join("\n") };
}

async function auditProjectDocumentReferences(projectRoot: string, manifest: ResolvedProjectContextManifest): Promise<ProjectDocumentReferenceAudit> {
  const discovered = await listProjectDocumentCandidates(projectRoot);
  const explicit = await materializeExplicitProjectDocReferences(projectRoot, manifest);
  let connectedCount = 0;
  const disconnected: ProjectDocumentReferenceCandidate[] = [];

  for (const candidate of discovered.candidates) {
    const normalized = normalizeProjectRelative(candidate.path);
    if (explicit.indexed.has(normalized) || explicit.carrierText.includes(normalized)) connectedCount += 1;
    else disconnected.push(candidate);
  }

  const ordered = disconnected.sort((left, right) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[left.reviewPriority] - rank[right.reviewPriority] || left.path.localeCompare(right.path);
  });
  return {
    scannedMarkdown: discovered.scannedMarkdown,
    candidateCount: disconnected.length,
    highPriorityCount: disconnected.filter((item) => item.reviewPriority === "high").length,
    mediumPriorityCount: disconnected.filter((item) => item.reviewPriority === "medium").length,
    lowPriorityCount: disconnected.filter((item) => item.reviewPriority === "low").length,
    connectedCount,
    truncated: discovered.truncated || ordered.length > MAX_PROJECT_DOC_REFERENCE_CANDIDATES,
    candidates: ordered.slice(0, MAX_PROJECT_DOC_REFERENCE_CANDIDATES),
  };
}

type ProjectContextReferenceMeasurement = {
  id: string;
  sourcePath: string;
  selectedBytes: number | null;
  physicalBytes: number | null;
  sourceHardLimitExceeded: boolean;
  error?: string;
};

type ProjectContextEntryMeasurement = {
  bytes: number | null;
  physicalBytes: number;
  segmented: boolean;
  referenced: boolean;
  sourceHardLimitExceeded: boolean;
  baselineBytes: number | null;
  largestOptionalBytes: number | null;
  referenceSources: ProjectContextReferenceMeasurement[];
};

async function selectedMeasurement(
  projectRoot: string,
  entry: ProjectContextCore | ResolvedProjectContextModule,
): Promise<ProjectContextEntryMeasurement | null> {
  try {
    const absolute = path.resolve(projectRoot, entry.source.path);
    const segmented = "segments" in entry && Boolean(entry.segments?.length);
    const referenced = "references" in entry && Boolean(entry.references?.length);
    const physicalBytes = (await fs.stat(absolute)).size;
    const sourceHardLimit = segmented ? MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES : MAX_PROJECT_CONTEXT_CHARS;
    if (physicalBytes > sourceHardLimit) {
      return { bytes: null, physicalBytes, segmented, referenced, sourceHardLimitExceeded: true, baselineBytes: null, largestOptionalBytes: null, referenceSources: [] };
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
        referenced: false,
        sourceHardLimitExceeded: false,
        baselineBytes: baseline.bytes,
        largestOptionalBytes,
        referenceSources: [],
      };
    }
    const selected = entry.source.sections?.length ? extractProjectContextSections(text, entry.source.sections) : text.trim();
    const baselineBytes = Buffer.byteLength(selected, "utf8");
    if (referenced && "references" in entry && entry.references?.length) {
      const referenceSources: ProjectContextReferenceMeasurement[] = [];
      let largestOptionalBytes = 0;
      let largestOptionalContent = "";
      for (const reference of entry.references) {
        try {
          const referenceAbsolute = path.resolve(projectRoot, reference.source.path);
          const referencePhysicalBytes = (await fs.stat(referenceAbsolute)).size;
          if (referencePhysicalBytes > MAX_PROJECT_CONTEXT_CHARS) {
            referenceSources.push({ id: reference.id, sourcePath: reference.source.path, selectedBytes: null, physicalBytes: referencePhysicalBytes, sourceHardLimitExceeded: true });
            continue;
          }
          const referenceText = (await readBoundedMarkdown(referenceAbsolute, MAX_PROJECT_CONTEXT_CHARS)).content;
          const referenceSelected = reference.source.sections?.length ? extractProjectContextSections(referenceText, reference.source.sections) : referenceText.trim();
          const referenceBytes = Buffer.byteLength(referenceSelected, "utf8");
          referenceSources.push({ id: reference.id, sourcePath: reference.source.path, selectedBytes: referenceBytes, physicalBytes: referencePhysicalBytes, sourceHardLimitExceeded: false });
          if (referenceBytes > largestOptionalBytes) {
            largestOptionalBytes = referenceBytes;
            largestOptionalContent = referenceSelected;
          }
        } catch (error) {
          referenceSources.push({ id: reference.id, sourcePath: reference.source.path, selectedBytes: null, physicalBytes: null, sourceHardLimitExceeded: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      const worstPayload = [selected.trim(), largestOptionalContent].filter(Boolean).join("\n\n");
      return {
        bytes: Buffer.byteLength(worstPayload, "utf8"),
        physicalBytes,
        segmented: false,
        referenced: true,
        sourceHardLimitExceeded: false,
        baselineBytes,
        largestOptionalBytes,
        referenceSources,
      };
    }
    return {
      bytes: baselineBytes,
      physicalBytes,
      segmented: false,
      referenced: false,
      sourceHardLimitExceeded: false,
      baselineBytes: null,
      largestOptionalBytes: null,
      referenceSources: [],
    };
  } catch { return null; }
}

async function inspectProjectContextLibrarianSidecar(
  projectRoot: string,
  manifest: ResolvedProjectContextManifest,
  findings: ProjectContextHealthFinding[],
): Promise<void> {
  const sidecarPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest);
  if (!(await exists(sidecarPath))) return;
  try {
    const projectRootReal = await fs.realpath(projectRoot);
    const sidecarRealPath = await fs.realpath(sidecarPath);
    const sidecarRelativePath = path.relative(projectRootReal, sidecarRealPath);
    if (!sidecarRelativePath || sidecarRelativePath === ".." || sidecarRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(sidecarRelativePath)) {
      findings.push({
        code: "project-context-librarian-sidecar-outside-project",
        level: "review",
        target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}`,
        message: "The Librarian sidecar resolves outside the project root and was not read.",
        recommendation: "MOVE_PROJECT_CONTEXT_LIBRARIAN_SIDECAR_INSIDE_PROJECT",
      });
      return;
    }
    const sidecarStat = await fs.stat(sidecarRealPath);
    if (!sidecarStat.isFile()) {
      findings.push({
        code: "invalid-project-context-librarian-sidecar",
        level: "review",
        target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}`,
        message: "The Librarian sidecar is not a regular file.",
        recommendation: "REPAIR_PROJECT_CONTEXT_LIBRARIAN_SIDECAR",
      });
      return;
    }
    if (sidecarStat.size > PROJECT_CONTEXT_LIBRARIAN_LIMITS.sidecarBytes) {
      findings.push({
        code: "project-context-librarian-sidecar-size-limit",
        level: "review",
        target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}`,
        message: `The Librarian sidecar is ${sidecarStat.size} bytes and exceeds its ${PROJECT_CONTEXT_LIBRARIAN_LIMITS.sidecarBytes}-byte inspection limit.`,
        recommendation: "SPLIT_PROJECT_CONTEXT_LIBRARIAN_SIDECAR",
      });
      return;
    }
    const sidecar = projectContextLibrarianManifestSchema.parse(JSON.parse((await readBoundedMarkdown(sidecarRealPath, PROJECT_CONTEXT_LIBRARIAN_LIMITS.sidecarBytes)).content));
    const baseManifestPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
    const baseManifest = JSON.parse(await fs.readFile(baseManifestPath, "utf8")) as unknown;
    const segmentsPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextSegmentsManifest);
    const referencesPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextReferencesManifest);
    const segmentsManifest = await exists(segmentsPath) ? JSON.parse(await fs.readFile(segmentsPath, "utf8")) as unknown : null;
    const referencesManifest = await exists(referencesPath) ? JSON.parse(await fs.readFile(referencesPath, "utf8")) as unknown : null;
    const entriesById = new Map([...manifest.core, ...manifest.modules].map((entry) => [entry.id, entry]));
    const paths = [...new Set(sidecar.entries.flatMap((entry) => {
      const canonical = entriesById.get(entry.entryId)?.source.path;
      return canonical ? [canonical] : [];
    }))];
    const sourceFiles: Array<{ path: string; markdown: string }> = [];
    let aggregateBytes = 0;
    for (const sourcePath of paths.slice(0, PROJECT_CONTEXT_LIBRARIAN_LIMITS.sourceFiles)) {
      const absolutePath = safeMarkdownPath(projectRoot, sourcePath);
      const resolvedPath = await fs.realpath(absolutePath).catch(() => null);
      if (!resolvedPath) continue;
      const relativePath = path.relative(projectRootReal, resolvedPath);
      if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) continue;
      const stat = await fs.stat(resolvedPath).catch(() => null);
      if (!stat?.isFile() || stat.size > PROJECT_CONTEXT_LIBRARIAN_LIMITS.charsPerSource) continue;
      if (aggregateBytes + stat.size > PROJECT_CONTEXT_LIBRARIAN_LIMITS.totalSourceChars) {
        findings.push({
          code: "project-context-librarian-source-total-limit",
          level: "review",
          target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}`,
          message: `Current source inspection would exceed the ${PROJECT_CONTEXT_LIBRARIAN_LIMITS.totalSourceChars}-byte aggregate limit.`,
          recommendation: "SPLIT_PROJECT_CONTEXT_LIBRARIAN_SIDECAR",
        });
        break;
      }
      const source = await readBoundedMarkdown(resolvedPath, PROJECT_CONTEXT_LIBRARIAN_LIMITS.charsPerSource);
      aggregateBytes += source.bytes;
      sourceFiles.push({ path: sourcePath, markdown: source.content });
    }
    const projection = projectMssrProjectContextLibrarianMetadata({
      projectContextManifest: baseManifest,
      librarianManifest: sidecar,
      segmentsManifest,
      referencesManifest,
      sourceFiles,
      owner: projectRoot,
      projectKey: path.basename(projectRoot),
    });
    for (const item of projection.items) {
      if (item.status === "projected") continue;
      const stale = item.issue === "stale-fingerprint";
      findings.push({
        code: stale ? "stale-project-context-librarian-heading" : "invalid-project-context-librarian-binding",
        level: "review",
        target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}#${item.entryId}`,
        message: `Librarian heading metadata was omitted${item.issue ? ` (${item.issue})` : ""}; verify its exact Project Context owner, source and heading fingerprint.`,
        recommendation: stale ? "REFRESH_OR_REMOVE_STALE_LIBRARIAN_METADATA" : "REVIEW_PROJECT_CONTEXT_LIBRARIAN_BINDING",
      });
    }
  } catch (error) {
    findings.push({
      code: "invalid-project-context-librarian-sidecar",
      level: "review",
      target: `${MSSR_PROJECT_HOME_DIR}/${MSSR_PROJECT_CONTROL_FILES.projectContextLibrarianManifest}`,
      message: error instanceof Error ? error.message : String(error),
      recommendation: "REPAIR_PROJECT_CONTEXT_LIBRARIAN_SIDECAR",
    });
  }
}

export async function auditMssrProjectContextHealth(projectRootInput: string) {
  const projectRoot = path.resolve(projectRootInput);
  const home = path.join(projectRoot, MSSR_PROJECT_HOME_DIR);
  const manifestPath = path.join(home, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  const findings: ProjectContextHealthFinding[] = [];
  let manifest: ResolvedProjectContextManifest | null = null;
  let manifestStatus: "missing" | "valid" | "invalid" = "missing";
  let referenceAudit: ProjectDocumentReferenceAudit | null = null;

  if (await exists(manifestPath)) {
    try {
      const loaded = await loadProjectContextModuleManifest(projectRoot);
      if (!loaded.found) throw new Error("Project-context manifest disappeared during health inspection.");
      manifest = loaded.manifest;
      manifestStatus = "valid";
    } catch (error) {
      manifestStatus = "invalid";
      findings.push({ code: "invalid-manifest", level: "review", target: ".mssr/project-context.json, project-context-segments.json or project-context-refs.json", message: error instanceof Error ? error.message : String(error), recommendation: "REPAIR_PROJECT_CONTEXT_MANIFEST" });
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
    await inspectProjectContextLibrarianSidecar(projectRoot, manifest, findings);
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
      if (measurement?.referenced) {
        for (const reference of measurement.referenceSources) {
          if (reference.error) {
            findings.push({
              code: "external-reference-unreadable",
              level: "review",
              target: reference.sourcePath,
              message: `External reference ${entry.id}/${reference.id} cannot be materialized: ${reference.error}`,
              recommendation: "REPAIR_EXTERNAL_REFERENCE_SOURCE",
            });
            continue;
          }
          if (reference.sourceHardLimitExceeded) {
            findings.push({
              code: "external-reference-hard-limit-exceeded",
              level: "review",
              target: reference.sourcePath,
              message: `External reference ${entry.id}/${reference.id} is ${reference.physicalBytes} bytes and exceeds the ${MAX_PROJECT_CONTEXT_CHARS}-byte per-reference hard limit.`,
              recommendation: "SPLIT_EXTERNAL_REFERENCE",
            });
            continue;
          }
          if (reference.physicalBytes !== null) {
            const referenceBudget = evaluateProjectContextEntryBudget({
              entryId: `${entry.id}:${reference.id}`,
              core: false,
              sourcePath: reference.sourcePath,
              selectedBytes: reference.physicalBytes,
              maxChars: MAX_PROJECT_CONTEXT_CHARS,
            });
            if (referenceBudget.level !== "ok") findings.push({
              code: referenceBudget.exceeded ? "external-reference-source-budget-exceeded" : "external-reference-source-budget-pressure",
              level: referenceBudget.level,
              target: reference.sourcePath,
              message: `External reference ${entry.id}/${reference.id} backing source is ${reference.physicalBytes}/${MAX_PROJECT_CONTEXT_CHARS} bytes (${Math.round(referenceBudget.utilization * 100)}%).`,
              recommendation: referenceBudget.level === "review" ? "SPLIT_EXTERNAL_REFERENCE" : "REVIEW_EXTERNAL_REFERENCE_SPLIT",
              budget: { selectedBytes: referenceBudget.selectedBytes, budgetBytes: referenceBudget.budgetBytes, remainingBytes: referenceBudget.remainingBytes, utilization: referenceBudget.utilization },
            });
          }
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
            : measurement?.referenced
              ? `Referenced module ${entry.id} has a worst single-target payload of ${chars}/${budget.budgetBytes} bytes (${Math.round(budget.utilization * 100)}%; baseline ${measurement.baselineBytes} + largest external ref ${measurement.largestOptionalBytes}).`
              : `Module ${entry.id} loads ${chars}/${budget.budgetBytes} bytes (${Math.round(budget.utilization * 100)}%).`,
          recommendation: budget.level === "review" ? "SPLIT_MODULE" : "REVIEW_MODULE_SPLIT",
          budget: { selectedBytes: budget.selectedBytes, budgetBytes: budget.budgetBytes, remainingBytes: budget.remainingBytes, utilization: budget.utilization },
        });
      } else if (chars > 14_000) findings.push({ code: "oversized-module", level: "review", target: entry.id, message: `Module ${entry.id} loads ${chars} bytes.`, recommendation: "SPLIT_MODULE" });
      else if (chars > 7_000) findings.push({ code: "growing-module", level: "watch", target: entry.id, message: `Module ${entry.id} loads ${chars} bytes.`, recommendation: "REVIEW_MODULE_SPLIT" });
      if (!entry.segments?.length && !entry.references?.length && !entry.source.sections?.length && chars !== null && chars > 24_000) findings.push({ code: "whole-file-module", level: chars > 48_000 ? "review" : "watch", target: entry.id, message: `Module ${entry.id} loads an entire ${chars}-byte file.`, recommendation: "SELECT_STABLE_SECTION" });
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

    const indexed = new Set([
      ...[...manifest.core, ...manifest.modules].map((entry) => entry.source.path.replace(/\\/g, "/").toLowerCase()),
      ...manifest.modules.flatMap((entry) => entry.references?.map((reference) => reference.source.path.replace(/\\/g, "/").toLowerCase()) ?? []),
    ]);
    const knowledgeRoot = path.join(home, "knowledge");
    for (const rel of await listMarkdown(knowledgeRoot)) {
      const projectRel = `.mssr/knowledge/${rel}`.toLowerCase();
      if (!indexed.has(projectRel)) findings.push({ code: "unindexed-knowledge", level: "watch", target: `.mssr/knowledge/${rel}`, message: "Knowledge file exists but cannot be selected by MSSR.", recommendation: "INDEX_KNOWLEDGE_FILE" });
    }

    referenceAudit = await auditProjectDocumentReferences(projectRoot, manifest);
    if (referenceAudit.highPriorityCount > 0) {
      const examples = referenceAudit.candidates.filter((item) => item.reviewPriority === "high").slice(0, 4).map((item) => item.path);
      findings.push({
        code: "unreviewed-project-doc-references",
        level: "watch",
        target: "project-documentation",
        message: `${referenceAudit.highPriorityCount} high-priority project documentation candidate(s) are not explicitly connected to selectable MSSR context${examples.length ? `: ${examples.join(", ")}` : ""}. Candidate discovery is advisory and does not prove canonical ownership.`,
        recommendation: "REVIEW_PROJECT_DOC_REFERENCES",
      });
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
    referenceAudit,
    findings,
    recommendations: [...new Set(findings.map((finding) => finding.recommendation))],
    advisoryOnly: true,
  };
}
