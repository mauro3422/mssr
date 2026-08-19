import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  projectContextManifestSchema,
  selectProjectContextModules,
  type MaterializedProjectContextModule,
  type ProjectContextCore,
  type ProjectContextManifest,
  type ProjectContextModule,
  type ProjectContextModuleDecision,
  type ProjectContextSource,
  type ProjectContextTopic,
} from "./project-context.js";
import {
  MSSR_PROJECT_CONTROL_FILES,
  mssrProjectRelativePath,
  resolveMssrProjectFile,
} from "./project-home.js";
import type { SkillStage, StructuredSkillIntent } from "./skill-routing.js";

export const MAX_PROJECT_CONTEXT_CHARS = 65_536;
export const DEFAULT_PROJECT_CONTEXT_MANIFEST_RELATIVE = mssrProjectRelativePath(MSSR_PROJECT_CONTROL_FILES.projectContextManifest);

export type ReadBoundedMarkdownResult = { content: string; sha256: string; bytes: number };

export function safeMarkdownPath(projectRoot: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new Error(`Project-context path must be relative, got absolute: ${relative}`);
  if (relative.split(/[\\/]+/).includes("..")) throw new Error(`Project-context path must not traverse, got: ${relative}`);
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Project-context path escapes project root: ${relative}`);
  if (path.extname(candidate).toLowerCase() !== ".md") throw new Error(`Project-context path must reference a markdown file: ${relative}`);
  return candidate;
}

export async function readBoundedMarkdown(filePath: string, maxChars: number = MAX_PROJECT_CONTEXT_CHARS): Promise<ReadBoundedMarkdownResult> {
  const buffer = await fs.readFile(filePath);
  if (buffer.byteLength > maxChars) throw new Error(`Project-context file exceeds ${maxChars} bytes: ${filePath}`);
  return { content: buffer.toString("utf8"), sha256: createHash("sha256").update(buffer).digest("hex"), bytes: buffer.byteLength };
}

function headingLevel(line: string): number | null {
  const match = /^(#{1,6})\s+\S/.exec(line.trim());
  return match ? match[1].length : null;
}

export function extractProjectContextSections(markdown: string, headings: readonly string[]): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  for (const requested of headings) {
    const matches = lines.map((line, index) => ({ line: line.trim(), index })).filter((item) => item.line === requested.trim());
    if (matches.length !== 1) throw new Error(`Expected one project-context heading '${requested}', found ${matches.length}.`);
    const start = matches[0].index;
    const level = headingLevel(lines[start]);
    if (!level) throw new Error(`Project context section is not a markdown heading: ${requested}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const next = headingLevel(lines[index]);
      if (next !== null && next <= level) { end = index; break; }
    }
    chunks.push(lines.slice(start, end).join("\n").trim());
  }
  return chunks.join("\n\n");
}

export type ProjectContextManifestLoadResult =
  | { found: false; path: string }
  | { found: true; manifest: ProjectContextManifest; path: string };

export async function loadProjectContextModuleManifest(projectRoot: string, manifestPath?: string): Promise<ProjectContextManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : (await resolveMssrProjectFile(projectRoot, MSSR_PROJECT_CONTROL_FILES.projectContextManifest)).absolutePath;
  try {
    const rawText = await fs.readFile(resolved, "utf8");
    return { found: true, manifest: projectContextManifestSchema.parse(JSON.parse(rawText)), path: resolved };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { found: false, path: resolved };
    throw error;
  }
}

export type ProjectContextContentRecord = {
  ref: string;
  content: string;
  sha256: string;
  bytes: number;
  sourcePath: string;
  kind: "context" | "memory" | "state" | "directive";
  topic?: ProjectContextTopic;
  area?: string;
};

export type LoadProjectContextModulesArgs = {
  projectRoot: string;
  intent: StructuredSkillIntent;
  stage: SkillStage;
  maxChars?: number;
  maxModules?: number;
  /** Hosts may omit the already-delivered core during a phase replan. */
  includeCore?: boolean;
};

export type LoadProjectContextModulesResult = {
  manifestStatus: "loaded" | "missing";
  manifestPath: string;
  core: ProjectContextContentRecord[];
  selected: ProjectContextContentRecord[];
  decisions: ProjectContextModuleDecision[];
  ambiguousExclusiveGroups: Array<{ group: string; candidates: string[]; score: number }>;
  requiredBudgetExceeded: string[];
  requiredOverflow: string[];
  remainingChars: number;
  advisoryOnly: true;
};

const HARD_MAX_CHARS = 20_000;
const HARD_MAX_MODULES = 32;

async function loadSource(
  projectRoot: string,
  ref: string,
  source: ProjectContextSource,
  kind: ProjectContextContentRecord["kind"],
  maxChars?: number,
  topic?: ProjectContextTopic,
  area?: string,
): Promise<ProjectContextContentRecord> {
  const absolute = safeMarkdownPath(projectRoot, source.path);
  // The per-entry max constrains the selected project-context payload, not the
  // backing Markdown document. A large authority may expose one deliberately
  // small section; the source file still remains bounded by the global hard
  // cap before any section extraction occurs.
  const raw = await readBoundedMarkdown(absolute, MAX_PROJECT_CONTEXT_CHARS);
  const selected = source.sections?.length ? extractProjectContextSections(raw.content, source.sections) : raw.content.trim();
  const bytes = Buffer.byteLength(selected, "utf8");
  const effectiveMax = Math.min(maxChars ?? MAX_PROJECT_CONTEXT_CHARS, MAX_PROJECT_CONTEXT_CHARS);
  if (bytes > effectiveMax) throw new Error(`Project-context selection exceeds ${effectiveMax} bytes: ${source.path}`);
  return {
    ref,
    content: selected,
    sha256: createHash("sha256").update(selected, "utf8").digest("hex"),
    bytes,
    sourcePath: source.path,
    kind,
    ...(topic ? { topic } : {}),
    ...(area ? { area } : {}),
  };
}

async function loadCore(projectRoot: string, entry: ProjectContextCore): Promise<ProjectContextContentRecord> {
  return await loadSource(projectRoot, entry.id, entry.source, entry.kind, entry.maxChars, entry.topic, entry.area);
}

async function loadModule(projectRoot: string, entry: ProjectContextModule): Promise<ProjectContextContentRecord> {
  return await loadSource(projectRoot, entry.id, entry.source, entry.kind, entry.maxChars, entry.topic, entry.area);
}

export async function loadProjectContextModules(args: LoadProjectContextModulesArgs): Promise<LoadProjectContextModulesResult> {
  const budgetChars = Math.min(args.maxChars ?? 6_000, HARD_MAX_CHARS);
  const budgetModules = Math.min(args.maxModules ?? 12, HARD_MAX_MODULES);
  const manifestResult = await loadProjectContextModuleManifest(args.projectRoot);
  if (!manifestResult.found) {
    return {
      manifestStatus: "missing",
      manifestPath: manifestResult.path,
      core: [], selected: [], decisions: [], ambiguousExclusiveGroups: [], requiredBudgetExceeded: [], requiredOverflow: [],
      remainingChars: budgetChars, advisoryOnly: true,
    };
  }

  const { manifest } = manifestResult;
  const core: ProjectContextContentRecord[] = [];
  const requiredOverflow = new Set<string>();
  let coreBytes = 0;
  if (args.includeCore !== false) {
    for (const entry of manifest.core) {
      const record = await loadCore(args.projectRoot, entry);
      core.push(record);
      coreBytes += record.bytes;
      if (record.bytes > HARD_MAX_CHARS) requiredOverflow.add(entry.id);
    }
  }

  // Select semantic candidates before reading optional files. Zero-char proxies keep
  // eligibility deterministic while avoiding I/O for irrelevant project knowledge.
  const proxies: MaterializedProjectContextModule[] = manifest.modules.map((module) => ({ ...module, chars: 0 }));
  const eligibility = selectProjectContextModules({ modules: proxies, intent: args.intent, stage: args.stage, maxModuleChars: Number.MAX_SAFE_INTEGER });
  const eligibleIds = new Set(eligibility.selected.map((module) => module.id));
  const materialized: MaterializedProjectContextModule[] = [];
  const records = new Map<string, ProjectContextContentRecord>();
  for (const module of manifest.modules) {
    if (!eligibleIds.has(module.id)) continue;
    const record = await loadModule(args.projectRoot, module);
    records.set(module.id, record);
    materialized.push({ ...module, chars: record.bytes });
    if (module.required && record.bytes > HARD_MAX_CHARS) requiredOverflow.add(module.id);
  }

  const requiredChars = materialized.filter((module) => module.required).reduce((sum, module) => sum + module.chars, 0);
  const moduleBudget = Math.max(0, budgetChars - coreBytes);
  const finalSelection = selectProjectContextModules({
    modules: materialized,
    intent: args.intent,
    stage: args.stage,
    maxModuleChars: Math.max(moduleBudget, requiredChars),
  });
  const selectedIds = new Set(finalSelection.selected.slice(0, budgetModules).map((module) => module.id));
  const selected = finalSelection.selected.slice(0, budgetModules).map((module) => records.get(module.id)!).filter(Boolean);
  const requiredBudgetExceeded = requiredChars > moduleBudget
    ? materialized.filter((module) => module.required).map((module) => module.id)
    : materialized.filter((module) => module.required && !selectedIds.has(module.id)).map((module) => module.id);

  const eligibilityById = new Map(eligibility.decisions.map((decision) => [decision.id, decision]));
  const finalById = new Map(finalSelection.decisions.map((decision) => [decision.id, decision]));
  const decisions = manifest.modules.map((module) => finalById.get(module.id) ?? eligibilityById.get(module.id) ?? {
    id: module.id, selected: false, score: 0, chars: 0, reason: "intent-mismatch" as const, matched: [],
  }).map((decision) => selectedIds.has(decision.id) ? { ...decision, selected: true, reason: "selected" as const } : decision);

  return {
    manifestStatus: "loaded",
    manifestPath: manifestResult.path,
    core,
    selected,
    decisions,
    ambiguousExclusiveGroups: [...eligibility.ambiguousGroups, ...finalSelection.ambiguousGroups.filter((group) => !eligibility.ambiguousGroups.some((existing) => existing.group === group.group))],
    requiredBudgetExceeded,
    requiredOverflow: [...requiredOverflow],
    remainingChars: Math.max(0, budgetChars - coreBytes - selected.reduce((sum, record) => sum + record.bytes, 0)),
    advisoryOnly: true,
  };
}
