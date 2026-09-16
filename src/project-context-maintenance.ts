import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { projectContextManifestSchema, projectContextModuleSchema, type ProjectContextManifest } from "./project-context.js";
import { auditMssrProjectContextHealth } from "./project-context-health.js";
import { extractProjectContextSections } from "./project-context-loader.js";
import { planMssrProjectContextModularization, type ModularizationCandidate } from "./project-context-modularization.js";
import { MSSR_PROJECT_CONTROL_FILES, MSSR_PROJECT_HOME_DIR } from "./project-home.js";

export const mssrProjectContextMaintenanceInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  maxOperations: z.number().int().min(1).max(32).default(8),
  expectedManifestSha256: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
}).strict();

export type MssrProjectContextMaintenanceInput = z.infer<typeof mssrProjectContextMaintenanceInputSchema>;

export type ProjectContextMaintenanceBlocker = Readonly<{
  entryId: string | null;
  reason: string;
  sourcePath?: string;
  heading?: string;
}>;

export type ProjectContextMaintenanceApplied = Readonly<{
  entryId: string;
  sourcePath: string;
  heading: string;
  targetPath: string;
  sha256: string;
  chars: number;
}>;

const LOCK_STALE_MS = 5 * 60_000;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRef(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

async function readManifest(projectRoot: string): Promise<{ path: string; text: string; sha256: string; manifest: ProjectContextManifest }> {
  const manifestPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  const text = await fs.readFile(manifestPath, "utf8");
  return { path: manifestPath, text, sha256: sha256(text), manifest: projectContextManifestSchema.parse(JSON.parse(text)) };
}

function locateSection(markdown: string, heading: string): { selected: string; nextText: string } {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const requested = heading.trim();
  const matches = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((item) => item.line === requested);
  if (matches.length !== 1) throw new Error(`Expected one project-context heading '${requested}', found ${matches.length}.`);
  const start = matches[0].index;
  const levelMatch = /^(#{1,6})\s+\S/.exec(lines[start].trim());
  if (!levelMatch) throw new Error(`Project-context section is not a markdown heading: ${requested}`);
  const level = levelMatch[1].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const nextMatch = /^(#{1,6})\s+\S/.exec(lines[index].trim());
    if (nextMatch && nextMatch[1].length <= level) { end = index; break; }
  }
  const selected = lines.slice(start, end).join("\n").trim();
  const remaining = [...lines.slice(0, start), ...lines.slice(end)];
  while (remaining.length > 0 && remaining[0] === "") remaining.shift();
  while (remaining.length > 0 && remaining[remaining.length - 1] === "") remaining.pop();
  const compacted: string[] = [];
  for (const line of remaining) {
    if (line === "" && compacted[compacted.length - 1] === "") continue;
    compacted.push(line);
  }
  const nextNormalized = compacted.length ? `${compacted.join("\n")}\n` : "";
  return { selected, nextText: newline === "\n" ? nextNormalized : nextNormalized.replace(/\n/g, "\r\n") };
}

async function writeAtomic(filePath: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(temporary, "wx");
    await handle.writeFile(value, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, filePath);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}

async function acquireMaintenanceLock(projectRoot: string): Promise<() => Promise<void>> {
  const runtimeDir = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, "runtime");
  await fs.mkdir(runtimeDir, { recursive: true });
  const lockPath = path.join(runtimeDir, "project-context-maintenance.lock");
  const tryOpen = async () => {
    const handle = await fs.open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, "utf8");
    await handle.close();
  };
  try {
    await tryOpen();
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    const stat = await fs.stat(lockPath).catch(() => null);
    if (!stat || Date.now() - stat.mtimeMs <= LOCK_STALE_MS) {
      throw new Error("MSSR project-context maintenance is already running for this repository.");
    }
    const stalePath = `${lockPath}.${process.pid}.${Date.now()}.stale`;
    await fs.rename(lockPath, stalePath).catch(() => undefined);
    await tryOpen();
    await fs.unlink(stalePath).catch(() => undefined);
  }
  return async () => { await fs.unlink(lockPath).catch(() => undefined); };
}

function sectionLineRange(markdown: string, heading: string): { start: number; end: number } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const requested = heading.trim();
  const matches = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((item) => item.line === requested);
  if (matches.length !== 1) throw new Error(`Expected one project-context heading '${requested}', found ${matches.length}.`);
  const start = matches[0].index;
  const levelMatch = /^(#{1,6})\s+\S/.exec(lines[start].trim());
  if (!levelMatch) throw new Error(`Project-context section is not a markdown heading: ${requested}`);
  const level = levelMatch[1].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const nextMatch = /^(#{1,6})\s+\S/.exec(lines[index].trim());
    if (nextMatch && nextMatch[1].length <= level) { end = index; break; }
  }
  return { start, end };
}

function rangesOverlap(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end;
}

async function candidateBlocker(projectRoot: string, manifest: ProjectContextManifest, candidate: ModularizationCandidate): Promise<ProjectContextMaintenanceBlocker | null> {
  if (candidate.core || candidate.requiresCoreDecision) {
    return { entryId: candidate.entryId, reason: "core-requires-explicit-minimum-decision", sourcePath: candidate.sourcePath, heading: candidate.heading };
  }
  if (!candidate.preserveModuleId || candidate.suggestedModuleId !== candidate.entryId) {
    return { entryId: candidate.entryId, reason: "split-would-change-logical-module-identity", sourcePath: candidate.sourcePath, heading: candidate.heading };
  }
  const module = manifest.modules.find((entry) => entry.id === candidate.entryId);
  if (!module) return { entryId: candidate.entryId, reason: "module-missing-from-live-manifest", sourcePath: candidate.sourcePath, heading: candidate.heading };
  if ((module.source.sections ?? []).length !== 1 || module.source.sections?.[0]?.trim() !== candidate.heading.trim()) {
    return { entryId: candidate.entryId, reason: "module-is-not-one-exact-indexed-section", sourcePath: candidate.sourcePath, heading: candidate.heading };
  }

  const sourceRef = normalizeRef(candidate.sourcePath);
  const sourceEntries = [...manifest.core, ...manifest.modules].filter((entry) => normalizeRef(entry.source.path) === sourceRef);
  let sourceText: string;
  let candidateRange: { start: number; end: number };
  try {
    sourceText = await fs.readFile(path.resolve(projectRoot, candidate.sourcePath), "utf8");
    candidateRange = sectionLineRange(sourceText, candidate.heading);
  } catch {
    return { entryId: candidate.entryId, reason: "source-selector-cannot-be-revalidated", sourcePath: candidate.sourcePath, heading: candidate.heading };
  }

  for (const entry of sourceEntries) {
    if (entry.id === candidate.entryId) continue;
    const sections = entry.source.sections ?? [];
    if (sections.length === 0) {
      return { entryId: candidate.entryId, reason: "source-has-whole-file-consumer", sourcePath: candidate.sourcePath, heading: candidate.heading };
    }
    for (const otherHeading of sections) {
      let otherRange: { start: number; end: number };
      try {
        otherRange = sectionLineRange(sourceText, otherHeading);
      } catch {
        return { entryId: candidate.entryId, reason: "source-selector-cannot-be-revalidated", sourcePath: candidate.sourcePath, heading: candidate.heading };
      }
      if (rangesOverlap(candidateRange, otherRange)) {
        return { entryId: candidate.entryId, reason: "section-overlaps-another-logical-consumer", sourcePath: candidate.sourcePath, heading: candidate.heading };
      }
    }
  }

  const targetRef = normalizeRef(candidate.suggestedPath);
  const targetOwnedByOtherEntry = [...manifest.core, ...manifest.modules].some((entry) => entry.id !== candidate.entryId && normalizeRef(entry.source.path) === targetRef);
  if (targetOwnedByOtherEntry) {
    return { entryId: candidate.entryId, reason: "target-path-already-owned-by-another-entry", sourcePath: candidate.sourcePath, heading: candidate.heading };
  }
  return null;
}

async function applyCandidate(projectRoot: string, candidate: ModularizationCandidate): Promise<ProjectContextMaintenanceApplied> {
  const manifestRead = await readManifest(projectRoot);
  const blocker = await candidateBlocker(projectRoot, manifestRead.manifest, candidate);
  if (blocker) throw new Error(`Unsafe project-context auto-modularization for ${candidate.entryId}: ${blocker.reason}`);

  const moduleIndex = manifestRead.manifest.modules.findIndex((entry) => entry.id === candidate.entryId);
  const module = manifestRead.manifest.modules[moduleIndex];
  const sourcePath = path.resolve(projectRoot, candidate.sourcePath);
  const targetPath = path.resolve(projectRoot, candidate.suggestedPath);
  const projectRelativeTarget = path.relative(projectRoot, targetPath);
  if (projectRelativeTarget.startsWith("..") || path.isAbsolute(projectRelativeTarget) || !normalizeRef(candidate.suggestedPath).startsWith(".mssr/knowledge/")) {
    throw new Error(`Refusing project-context maintenance target outside .mssr/knowledge: ${candidate.suggestedPath}`);
  }

  const sourceBefore = await fs.readFile(sourcePath, "utf8");
  const located = locateSection(sourceBefore, candidate.heading);
  const canonicalSelected = extractProjectContextSections(sourceBefore, [candidate.heading]);
  const selectedHash = sha256(canonicalSelected);
  if (selectedHash !== candidate.sha256 || located.selected !== canonicalSelected) {
    throw new Error(`Project-context section changed since plan for ${candidate.entryId}; expected ${candidate.sha256}, observed ${selectedHash}.`);
  }

  const targetText = `${canonicalSelected.trim()}\n`;
  const existingTarget = await fs.readFile(targetPath, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (existingTarget !== null && existingTarget.trim() !== canonicalSelected.trim()) {
    throw new Error(`Project-context maintenance target already exists with different content: ${candidate.suggestedPath}`);
  }

  const updatedModule = projectContextModuleSchema.parse({ ...module, source: { path: candidate.suggestedPath } });
  const modules = [...manifestRead.manifest.modules];
  modules[moduleIndex] = updatedModule;
  const nextManifest = projectContextManifestSchema.parse({ ...manifestRead.manifest, modules });
  const nextManifestText = `${JSON.stringify(nextManifest, null, 2)}\n`;

  const originalTarget = existingTarget;
  let wroteTarget = false;
  let wroteSource = false;
  let wroteManifest = false;
  try {
    if (existingTarget === null) {
      await writeAtomic(targetPath, targetText);
      wroteTarget = true;
    }
    await writeAtomic(sourcePath, located.nextText);
    wroteSource = true;
    const manifestStillCurrent = await fs.readFile(manifestRead.path, "utf8");
    if (sha256(manifestStillCurrent) !== manifestRead.sha256) {
      throw new Error("Project-context manifest changed concurrently during maintenance; rolling back.");
    }
    await writeAtomic(manifestRead.path, nextManifestText);
    wroteManifest = true;

    const afterSelected = await fs.readFile(targetPath, "utf8");
    const afterManifest = projectContextManifestSchema.parse(JSON.parse(await fs.readFile(manifestRead.path, "utf8")));
    const afterModule = afterManifest.modules.find((entry) => entry.id === candidate.entryId);
    if (!afterModule || normalizeRef(afterModule.source.path) !== normalizeRef(candidate.suggestedPath) || sha256(afterSelected.trim()) !== candidate.sha256) {
      throw new Error(`Project-context maintenance readback failed for ${candidate.entryId}.`);
    }
    return {
      entryId: candidate.entryId,
      sourcePath: candidate.sourcePath,
      heading: candidate.heading,
      targetPath: candidate.suggestedPath,
      sha256: candidate.sha256,
      chars: candidate.chars,
    };
  } catch (error) {
    if (wroteManifest) await writeAtomic(manifestRead.path, manifestRead.text).catch(() => undefined);
    if (wroteSource) await writeAtomic(sourcePath, sourceBefore).catch(() => undefined);
    if (wroteTarget && originalTarget === null) await fs.unlink(targetPath).catch(() => undefined);
    else if (originalTarget !== null) await writeAtomic(targetPath, originalTarget).catch(() => undefined);
    throw error;
  }
}

/**
 * Apply only structurally provable Project Context maintenance.
 *
 * This executor never summarizes project knowledge, invents selectors, changes a logical
 * module id/kind, narrows core, or promotes telemetry into project truth. It relocates exact
 * already-indexed non-core sections behind the same module contract and verifies hashes/readback.
 */
export async function maintainMssrProjectContext(input: MssrProjectContextMaintenanceInput) {
  const parsed = mssrProjectContextMaintenanceInputSchema.parse(input);
  const projectRoot = path.resolve(parsed.projectRoot);
  const releaseLock = await acquireMaintenanceLock(projectRoot);
  try {
    const initialManifest = await readManifest(projectRoot);
    if (parsed.expectedManifestSha256 && initialManifest.sha256 !== parsed.expectedManifestSha256.toLowerCase()) {
      throw new Error(`Project-context manifest changed before maintenance; expected ${parsed.expectedManifestSha256.toLowerCase()}, observed ${initialManifest.sha256}.`);
    }
    const beforeHealth = await auditMssrProjectContextHealth(projectRoot);
    const plan = await planMssrProjectContextModularization(projectRoot);
    if (plan.status === "blocked") {
      return { projectRoot, status: "blocked" as const, beforeHealth, afterHealth: beforeHealth, applied: [], blockers: [{ entryId: null, reason: plan.reason }], semanticRewrite: false, automaticScope: "exact-indexed-section-only" as const };
    }

    const blockers: ProjectContextMaintenanceBlocker[] = [];
    const safe: ModularizationCandidate[] = [];
    for (const candidate of plan.candidates) {
      const blocker = await candidateBlocker(projectRoot, initialManifest.manifest, candidate);
      if (blocker) blockers.push(blocker);
      else safe.push(candidate);
    }

    const pressureCodes = new Set([
      "oversized-core-module",
      "growing-core-module",
      "oversized-module",
      "growing-module",
      "core-entry-budget-pressure",
      "core-entry-budget-exceeded",
      "module-entry-budget-pressure",
      "module-entry-budget-exceeded",
    ]);
    for (const finding of plan.health.findings.filter((item) => pressureCodes.has(item.code))) {
      const entry = [...initialManifest.manifest.core, ...initialManifest.manifest.modules].find((item) => item.id === finding.target);
      if (!entry || entry.source.sections?.length) continue;
      if (blockers.some((item) => item.entryId === entry.id)) continue;
      const core = initialManifest.manifest.core.some((item) => item.id === entry.id);
      blockers.push({
        entryId: entry.id,
        reason: core ? "core-requires-explicit-minimum-decision" : "whole-file-module-requires-semantic-segmentation",
        sourcePath: entry.source.path,
      });
    }

    for (const inspection of plan.authoritySections) {
      for (const section of inspection.largestSections) {
        if (section.recommendation === "REVIEW_FOR_MODULE_SPLIT" || section.recommendation === "REVIEW_FOR_KNOWLEDGE_CAPTURE") {
          blockers.push({ entryId: null, reason: section.recommendation.toLowerCase().replace(/_/g, "-"), sourcePath: inspection.authority, heading: section.heading });
        }
      }
    }

    const applied: ProjectContextMaintenanceApplied[] = [];
    for (const candidate of safe.slice(0, parsed.maxOperations)) {
      try {
        applied.push(await applyCandidate(projectRoot, candidate));
      } catch (error) {
        blockers.push({
          entryId: candidate.entryId,
          reason: `apply-failed:${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
          sourcePath: candidate.sourcePath,
          heading: candidate.heading,
        });
      }
    }
    if (safe.length > parsed.maxOperations) {
      blockers.push({ entryId: null, reason: `operation-limit-reached:${safe.length - parsed.maxOperations}-safe-candidate(s)-remain` });
    }

    const afterHealth = await auditMssrProjectContextHealth(projectRoot);
    const afterPlan = await planMssrProjectContextModularization(projectRoot);
    const status = applied.length === 0
      ? (afterHealth.level === "ok" ? "not-needed" : "review-required")
      : (afterPlan.candidates.length === 0 && afterHealth.level === "ok" ? "maintained" : "maintained-with-review");
    return {
      projectRoot,
      status,
      beforeHealth,
      afterHealth,
      applied,
      blockers,
      remainingCandidateCount: afterPlan.candidates.length,
      semanticRewrite: false,
      automaticScope: "exact-indexed-section-only" as const,
      policy: "MSSR may automatically relocate exact already-indexed non-core sections while preserving logical module identity, kind and selectors. Core narrowing, whole-file semantic splits, selector invention, summarization and conflicting targets remain review-only.",
    };
  } finally {
    await releaseLock();
  }
}
