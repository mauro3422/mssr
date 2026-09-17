import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  projectContextManifestSchema,
  projectContextSegmentsManifestSchema,
  selectProjectContextModules,
  type MaterializedProjectContextModule,
  type ProjectContextCore,
  type ProjectContextModuleDecision,
  type ProjectContextSegment,
  type ResolvedProjectContextManifest,
  type ResolvedProjectContextModule,
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
/**
 * Segmented histories may temporarily outgrow the normal context/source budget
 * while still exposing a small bounded payload. Keep a larger absolute read
 * ceiling so MSSR can diagnose and repair that state instead of becoming blind
 * the instant the backing file crosses the maintenance budget.
 */
export const MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES = MAX_PROJECT_CONTEXT_CHARS * 4;
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

type LocatedProjectContextSection = {
  heading: string;
  start: number;
  end: number;
  content: string;
};

function locateProjectContextSection(lines: readonly string[], requested: string): LocatedProjectContextSection {
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
  return { heading: requested.trim(), start, end, content: lines.slice(start, end).join("\n").trim() };
}

export function extractProjectContextSections(markdown: string, headings: readonly string[]): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  return headings.map((heading) => locateProjectContextSection(lines, heading).content).join("\n\n");
}

export type ProjectContextSegmentDecisionReason = "baseline" | "selected" | "stage-mismatch" | "intent-mismatch" | "ambiguous-candidate";

export type ProjectContextSegmentDecision = {
  id: string;
  selected: boolean;
  reason: ProjectContextSegmentDecisionReason;
  score: number;
  bytes: number;
  matched: string[];
};

export type ProjectContextSegmentInspection = {
  id: string;
  baseline: boolean;
  bytes: number;
  content: string;
};

function normalizedSemanticText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right);
  return left.filter((value) => wanted.has(value));
}

export function inspectProjectContextSegments(markdown: string, segments: readonly ProjectContextSegment[]): ProjectContextSegmentInspection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const located = segments.map((segment) => ({
    segment,
    sections: segment.sections.map((heading) => locateProjectContextSection(lines, heading)),
  }));
  const flattened = located.flatMap(({ segment, sections }) => sections.map((section) => ({ segmentId: segment.id, ...section })));
  for (let left = 0; left < flattened.length; left += 1) {
    for (let right = left + 1; right < flattened.length; right += 1) {
      const a = flattened[left];
      const b = flattened[right];
      if (a.start < b.end && b.start < a.end) {
        throw new Error(`Project-context segment sections overlap: ${a.segmentId}:${a.heading} and ${b.segmentId}:${b.heading}.`);
      }
    }
  }
  return located.map(({ segment, sections }) => {
    const content = sections.map((section) => section.content).join("\n\n");
    return { id: segment.id, baseline: segment.baseline, bytes: Buffer.byteLength(content, "utf8"), content };
  });
}

function selectProjectContextSegmentPayload(args: {
  entry: ResolvedProjectContextModule;
  markdown: string;
  intent: StructuredSkillIntent;
  stage: SkillStage;
}): { content: string; decisions: ProjectContextSegmentDecision[]; ambiguity: { candidates: string[]; score: number } | null } {
  const segments = args.entry.segments;
  if (!segments?.length) return { content: args.markdown.trim(), decisions: [], ambiguity: null };
  const inspected = inspectProjectContextSegments(args.markdown, segments);
  const inspectedById = new Map(inspected.map((item) => [item.id, item]));
  const summary = normalizedSemanticText(args.intent.summary ?? "");
  const dimensions = [
    ["domain", "domains", 8],
    ["action", "actions", 10],
    ["artifact", "artifacts", 10],
    ["need", "needs", 12],
    ["signal", "signals", 14],
  ] as const;

  const evaluated = segments.map((segment, index) => {
    const payload = inspectedById.get(segment.id)!;
    if (segment.baseline) return { segment, payload, index, eligible: true, score: Number.MAX_SAFE_INTEGER, matched: ["baseline"], reason: "baseline" as const };
    if (segment.stages.length > 0 && !segment.stages.includes(args.stage)) {
      return { segment, payload, index, eligible: false, score: -1, matched: [] as string[], reason: "stage-mismatch" as const };
    }
    let score = segment.priority;
    let allSpecifiedMatch = true;
    const matched: string[] = [];
    for (const [label, key, weight] of dimensions) {
      const expected = segment[key];
      if (expected.length === 0) continue;
      const hits = overlap(args.intent[key], expected);
      if (hits.length === 0) allSpecifiedMatch = false;
      for (const hit of hits) matched.push(`${label}:${hit}`);
      score += hits.length * weight;
    }
    if (segment.terms.length > 0) {
      const termHits = segment.terms.filter((term) => summary.includes(normalizedSemanticText(term)));
      if (termHits.length === 0) allSpecifiedMatch = false;
      for (const term of termHits) matched.push(`term:${term}`);
      score += termHits.length * 16;
    }
    return { segment, payload, index, eligible: allSpecifiedMatch, score, matched, reason: allSpecifiedMatch ? "selected" as const : "intent-mismatch" as const };
  });

  const baseline = evaluated.find((item) => item.segment.baseline)!;
  const candidates = evaluated.filter((item) => !item.segment.baseline && item.eligible)
    .sort((a, b) => b.score - a.score || b.segment.priority - a.segment.priority || a.index - b.index);
  const topScore = candidates[0]?.score;
  const tied = topScore === undefined ? [] : candidates.filter((item) => item.score === topScore);
  const chosen = tied.length === 1 ? tied[0] : null;
  const selectedIds = new Set<string>([baseline.segment.id, ...(chosen ? [chosen.segment.id] : [])]);
  const selectedPayloads = inspected.filter((item) => selectedIds.has(item.id));
  const content = selectedPayloads.map((item) => item.content).join("\n\n");
  const effectiveMax = Math.min(args.entry.maxChars ?? MAX_PROJECT_CONTEXT_CHARS, MAX_PROJECT_CONTEXT_CHARS);
  if (Buffer.byteLength(content, "utf8") > effectiveMax) {
    throw new Error(`Project-context segmented selection exceeds ${effectiveMax} bytes: ${args.entry.source.path}`);
  }
  const ambiguity = tied.length > 1 ? { candidates: tied.map((item) => item.segment.id), score: topScore! } : null;
  const decisions = evaluated.map((item): ProjectContextSegmentDecision => ({
    id: item.segment.id,
    selected: selectedIds.has(item.segment.id),
    reason: item.segment.baseline
      ? "baseline"
      : ambiguity?.candidates.includes(item.segment.id)
        ? "ambiguous-candidate"
        : selectedIds.has(item.segment.id)
          ? "selected"
          : item.reason,
    score: item.score,
    bytes: item.payload.bytes,
    matched: item.matched,
  }));
  return { content, decisions, ambiguity };
}

export type ProjectContextManifestLoadResult =
  | { found: false; path: string; segmentsPath: string; segmentsStatus: "missing" }
  | { found: true; manifest: ResolvedProjectContextManifest; path: string; segmentsPath: string; segmentsStatus: "loaded" | "missing" };

export async function loadProjectContextModuleManifest(projectRoot: string, manifestPath?: string): Promise<ProjectContextManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : (await resolveMssrProjectFile(projectRoot, MSSR_PROJECT_CONTROL_FILES.projectContextManifest)).absolutePath;
  const segmentsPath = path.join(path.dirname(resolved), "project-context-segments.json");
  try {
    const rawText = await fs.readFile(resolved, "utf8");
    const manifest = projectContextManifestSchema.parse(JSON.parse(rawText));
    let segmentBindings: ReturnType<typeof projectContextSegmentsManifestSchema.parse>["modules"] = [];
    let segmentsStatus: "loaded" | "missing" = "missing";
    try {
      const segmentText = await fs.readFile(segmentsPath, "utf8");
      segmentBindings = projectContextSegmentsManifestSchema.parse(JSON.parse(segmentText)).modules;
      segmentsStatus = "loaded";
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    const bindingById = new Map(segmentBindings.map((binding) => [binding.moduleId, binding.segments]));
    for (const binding of segmentBindings) {
      const module = manifest.modules.find((candidate) => candidate.id === binding.moduleId);
      if (!module) throw new Error(`Project-context segment sidecar references unknown module: ${binding.moduleId}`);
      if (module.source.sections?.length) throw new Error(`Segmented project-context module cannot also declare parent source.sections: ${binding.moduleId}`);
    }
    const resolvedManifest: ResolvedProjectContextManifest = {
      ...manifest,
      modules: manifest.modules.map((module) => {
        const segments = bindingById.get(module.id);
        return segments ? { ...module, segments } : module;
      }),
    };
    return { found: true, manifest: resolvedManifest, path: resolved, segmentsPath, segmentsStatus };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { found: false, path: resolved, segmentsPath, segmentsStatus: "missing" };
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
  segmentDecisions?: ProjectContextSegmentDecision[];
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
  ambiguousSegments: Array<{ moduleId: string; candidates: string[]; score: number }>;
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

async function loadModule(
  projectRoot: string,
  entry: ResolvedProjectContextModule,
  intent: StructuredSkillIntent,
  stage: SkillStage,
): Promise<{ record: ProjectContextContentRecord; ambiguity: { candidates: string[]; score: number } | null }> {
  if (!entry.segments?.length) {
    return { record: await loadSource(projectRoot, entry.id, entry.source, entry.kind, entry.maxChars, entry.topic, entry.area), ambiguity: null };
  }
  const absolute = safeMarkdownPath(projectRoot, entry.source.path);
  const raw = await readBoundedMarkdown(absolute, MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES);
  const segmented = selectProjectContextSegmentPayload({ entry, markdown: raw.content, intent, stage });
  const bytes = Buffer.byteLength(segmented.content, "utf8");
  return {
    record: {
      ref: entry.id,
      content: segmented.content,
      sha256: createHash("sha256").update(segmented.content, "utf8").digest("hex"),
      bytes,
      sourcePath: entry.source.path,
      kind: entry.kind,
      ...(entry.topic ? { topic: entry.topic } : {}),
      ...(entry.area ? { area: entry.area } : {}),
      segmentDecisions: segmented.decisions,
    },
    ambiguity: segmented.ambiguity,
  };
}

export async function loadProjectContextModules(args: LoadProjectContextModulesArgs): Promise<LoadProjectContextModulesResult> {
  const budgetChars = Math.min(args.maxChars ?? 6_000, HARD_MAX_CHARS);
  const budgetModules = Math.min(args.maxModules ?? 12, HARD_MAX_MODULES);
  const manifestResult = await loadProjectContextModuleManifest(args.projectRoot);
  if (!manifestResult.found) {
    return {
      manifestStatus: "missing",
      manifestPath: manifestResult.path,
      core: [], selected: [], decisions: [], ambiguousExclusiveGroups: [], ambiguousSegments: [], requiredBudgetExceeded: [], requiredOverflow: [],
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
  const effectiveRequiredIds = new Set(eligibility.requiredIds);
  const materialized: MaterializedProjectContextModule[] = [];
  const records = new Map<string, ProjectContextContentRecord>();
  const ambiguousSegments: Array<{ moduleId: string; candidates: string[]; score: number }> = [];
  for (const module of manifest.modules) {
    if (!eligibleIds.has(module.id)) continue;
    const loaded = await loadModule(args.projectRoot, module, args.intent, args.stage);
    const record = loaded.record;
    records.set(module.id, record);
    materialized.push({ ...module, chars: record.bytes });
    if (loaded.ambiguity) ambiguousSegments.push({ moduleId: module.id, ...loaded.ambiguity });
    if (effectiveRequiredIds.has(module.id) && record.bytes > HARD_MAX_CHARS) requiredOverflow.add(module.id);
  }

  const requiredChars = materialized.filter((module) => effectiveRequiredIds.has(module.id)).reduce((sum, module) => sum + module.chars, 0);
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
    ? materialized.filter((module) => effectiveRequiredIds.has(module.id)).map((module) => module.id)
    : materialized.filter((module) => effectiveRequiredIds.has(module.id) && !selectedIds.has(module.id)).map((module) => module.id);

  const eligibilityById = new Map(eligibility.decisions.map((decision) => [decision.id, decision]));
  const finalById = new Map(finalSelection.decisions.map((decision) => [decision.id, decision]));
  const decisions = manifest.modules.map((module) => finalById.get(module.id) ?? eligibilityById.get(module.id) ?? {
    id: module.id,
    selected: false,
    score: 0,
    chars: 0,
    reason: "intent-mismatch" as const,
    matched: [],
    required: false,
    requiredBy: [],
  }).map((decision) => selectedIds.has(decision.id) ? { ...decision, selected: true, reason: "selected" as const } : decision);

  return {
    manifestStatus: "loaded",
    manifestPath: manifestResult.path,
    core,
    selected,
    decisions,
    ambiguousExclusiveGroups: [...eligibility.ambiguousGroups, ...finalSelection.ambiguousGroups.filter((group) => !eligibility.ambiguousGroups.some((existing) => existing.group === group.group))],
    ambiguousSegments,
    requiredBudgetExceeded,
    requiredOverflow: [...requiredOverflow],
    remainingChars: Math.max(0, budgetChars - coreBytes - selected.reduce((sum, record) => sum + record.bytes, 0)),
    advisoryOnly: true,
  };
}
