import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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
import {
  selectProjectContextModules,
  type MaterializedProjectContextModule,
  type ProjectContextModuleDecision,
} from "./project-context.js";

export const MAX_PROJECT_CONTEXT_CHARS = 65_536;
export const DEFAULT_PROJECT_CONTEXT_MANIFEST_RELATIVE = path.join(".bridge", "project-context-modules.json");

const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

export const projectContextCoreRefSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
}).strict();
export type ProjectContextCoreRef = z.infer<typeof projectContextCoreRefSchema>;

export const projectContextManifestModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  path: z.string().min(1).max(240),
  ...selectorFields,
  priority: z.number().int().min(-100).max(100).default(0),
  required: z.boolean().default(false),
  estimatedChars: z.number().int().min(1).max(MAX_PROJECT_CONTEXT_CHARS),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().refine((value) => !(value.required && value.exclusiveGroup), {
  message: "Required project-context modules cannot belong to an exclusive group.",
});
export type ProjectContextManifestModule = z.infer<typeof projectContextManifestModuleSchema>;

export const projectContextManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  canonicalOwner: z.string().min(1).max(120),
  core: z.array(projectContextCoreRefSchema).max(8).default([]),
  modules: z.array(projectContextManifestModuleSchema).max(32).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const entry of value.modules) {
    if (ids.has(entry.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate project-context module id: ${entry.id}`,
        path: ["modules"],
      });
    }
    ids.add(entry.id);
  }
  for (const ref of value.core) {
    if (!ids.has(ref.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Core project-context ref id not found in modules: ${ref.id}`,
        path: ["core"],
      });
    }
  }
});
export type ProjectContextManifestV1 = z.infer<typeof projectContextManifestV1Schema>;

export function safeMarkdownPath(projectRoot: string, relative: string): string {
  if (path.isAbsolute(relative)) {
    throw new Error(`Project-context path must be relative, got absolute: ${relative}`);
  }
  if (relative.split(/[\\/]+/).includes("..")) {
    throw new Error(`Project-context path must not traverse, got: ${relative}`);
  }
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(root, relative);
  const rootLower = root.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  if (candidateLower !== rootLower && !candidateLower.startsWith(`${rootLower}${path.sep}`)) {
    throw new Error(`Project-context path escapes project root: ${relative}`);
  }
  if (path.extname(candidate).toLowerCase() !== ".md") {
    throw new Error(`Project-context path must reference a markdown file: ${relative}`);
  }
  return candidate;
}

export type ReadBoundedMarkdownResult = { content: string; sha256: string; bytes: number };

export async function readBoundedMarkdown(
  filePath: string,
  maxChars: number = MAX_PROJECT_CONTEXT_CHARS,
): Promise<ReadBoundedMarkdownResult> {
  const buffer = await fs.readFile(filePath);
  if (buffer.byteLength > maxChars) {
    throw new Error(`Project-context file exceeds ${maxChars} bytes: ${filePath}`);
  }
  return {
    content: buffer.toString("utf8"),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.byteLength,
  };
}

export type ProjectContextModuleManifestLoadResult =
  | { found: false }
  | { found: true; manifest: ProjectContextManifestV1; path: string };

export async function loadProjectContextModuleManifest(
  projectRoot: string,
  manifestPath?: string,
): Promise<ProjectContextModuleManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : path.join(projectRoot, DEFAULT_PROJECT_CONTEXT_MANIFEST_RELATIVE);
  let rawText: string;
  try {
    rawText = await fs.readFile(resolved, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { found: false };
    }
    throw error;
  }
  const manifest = projectContextManifestV1Schema.parse(JSON.parse(rawText));
  return { found: true, manifest, path: resolved };
}

export type ProjectContextContentRecord = {
  ref: string;
  content: string;
  sha256: string;
  bytes: number;
};

export type LoadProjectContextModulesArgs = {
  projectRoot: string;
  intent: StructuredSkillIntent;
  stage: SkillStage;
  maxChars?: number;
  maxModules?: number;
  allowFullDocumentFallback?: boolean;
};

export type LoadProjectContextModulesResult = {
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

async function loadProjectContextContentRecord(projectRoot: string, ref: string, relativePath: string): Promise<ProjectContextContentRecord> {
  const resolved = safeMarkdownPath(projectRoot, relativePath);
  const read = await readBoundedMarkdown(resolved);
  return { ref, content: read.content, sha256: read.sha256, bytes: read.bytes };
}

async function loadFullDocumentFallback(projectRoot: string): Promise<ProjectContextContentRecord | null> {
  for (const relative of [".bridge/PROJECT_CONTEXT.md", "docs/PROJECT_CONTEXT.md"]) {
    try {
      return await loadProjectContextContentRecord(projectRoot, relative, relative);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return null;
}

export async function loadProjectContextModules(
  args: LoadProjectContextModulesArgs,
): Promise<LoadProjectContextModulesResult> {
  const budgetChars = Math.min(args.maxChars ?? 6_000, HARD_MAX_CHARS);
  const budgetModules = Math.min(args.maxModules ?? 12, HARD_MAX_MODULES);

  const core: ProjectContextContentRecord[] = [];
  const selected: ProjectContextContentRecord[] = [];
  const requiredBudgetExceeded: string[] = [];
  const requiredOverflow = new Set<string>();
  const ambiguousExclusiveGroups: Array<{ group: string; candidates: string[]; score: number }> = [];

  const manifestResult = await loadProjectContextModuleManifest(args.projectRoot);
  if (!manifestResult.found) {
    if (args.allowFullDocumentFallback) {
      const fallback = await loadFullDocumentFallback(args.projectRoot);
      if (fallback) {
        core.push(fallback);
        if (fallback.bytes > HARD_MAX_CHARS) requiredOverflow.add(fallback.ref);
      }
    }
    return {
      core,
      selected,
      decisions: [],
      ambiguousExclusiveGroups,
      requiredBudgetExceeded,
      requiredOverflow: [...requiredOverflow],
      remainingChars: Math.max(0, budgetChars - core.reduce((sum, record) => sum + record.bytes, 0)),
      advisoryOnly: true,
    };
  }

  const { manifest } = manifestResult;
  const byId = new Map(manifest.modules.map((module) => [module.id, module]));
  const coreRefs = [...manifest.core].sort((a, b) => a.id.localeCompare(b.id));
  const coreIds = new Set(coreRefs.map((ref) => ref.id));
  let coreBytes = 0;

  for (const ref of coreRefs) {
    const module = byId.get(ref.id);
    if (!module) continue;
    const record = await loadProjectContextContentRecord(args.projectRoot, ref.id, module.path);
    core.push(record);
    coreBytes += record.bytes;
    if (record.bytes > HARD_MAX_CHARS) requiredOverflow.add(ref.id);
  }

  const requiredIds = new Set(manifest.modules.filter((module) => module.required).map((module) => module.id));
  for (const module of manifest.modules) {
    if (module.required && module.estimatedChars > HARD_MAX_CHARS) requiredOverflow.add(module.id);
  }

  const materialized: MaterializedProjectContextModule[] = manifest.modules
    .filter((module) => !coreIds.has(module.id))
    .map((module) => ({
      id: module.id,
      kind: "context",
      description: `Project-context module ${module.id}`,
      source: { path: module.path },
      stages: module.stages,
      domains: module.domains,
      actions: module.actions,
      artifacts: module.artifacts,
      needs: module.needs,
      signals: module.signals,
      required: module.required,
      priority: module.priority,
      exclusiveGroup: module.exclusiveGroup,
      chars: module.estimatedChars,
    }));

  const selection = selectProjectContextModules({
    modules: materialized,
    intent: args.intent,
    stage: args.stage,
    maxModuleChars: Math.max(0, budgetChars - coreBytes),
  });

  const eligibleReasons = new Set<ProjectContextModuleDecision["reason"]>([
    "selected", "budget-exceeded", "ambiguous-candidate", "exclusive-not-selected",
  ]);
  const eligibleByGroup = new Map<string, Array<{ id: string; score: number }>>();
  for (const decision of selection.decisions) {
    if (!eligibleReasons.has(decision.reason)) continue;
    const module = byId.get(decision.id);
    if (!module?.exclusiveGroup) continue;
    const members = eligibleByGroup.get(module.exclusiveGroup) ?? [];
    members.push({ id: decision.id, score: decision.score });
    eligibleByGroup.set(module.exclusiveGroup, members);
  }

  const forceExcluded = new Set<string>();
  for (const [group, members] of eligibleByGroup) {
    const candidates = members.map((member) => member.id).sort();
    if (candidates.length > 1) {
      ambiguousExclusiveGroups.push({ group, candidates, score: Math.max(...members.map((member) => member.score)) });
      for (const id of candidates) forceExcluded.add(id);
    }
  }

  const allowance = Math.max(0, budgetModules - core.length);
  const accepted = selection.selected.slice(0, allowance);

  let remainingChars = selection.remainingChars;
  for (const module of selection.selected.slice(allowance)) remainingChars += module.chars;

  const loadedIds = new Set<string>();
  for (const module of accepted) {
    if (forceExcluded.has(module.id)) {
      remainingChars += module.chars;
      continue;
    }
    const record = await loadProjectContextContentRecord(args.projectRoot, module.id, module.source.path);
    selected.push(record);
    loadedIds.add(module.id);
  }

  const decisions: ProjectContextModuleDecision[] = selection.decisions.map((decision) => {
    if (forceExcluded.has(decision.id)) {
      return { ...decision, selected: false, reason: "ambiguous-candidate" };
    }
    if (!loadedIds.has(decision.id) && decision.selected) {
      return { ...decision, selected: false, reason: "budget-exceeded" };
    }
    return { ...decision, selected: loadedIds.has(decision.id) };
  });

  for (const decision of decisions) {
    if (requiredIds.has(decision.id) && !decision.selected && decision.reason === "budget-exceeded") {
      requiredBudgetExceeded.push(decision.id);
    }
  }

  return {
    core,
    selected,
    decisions,
    ambiguousExclusiveGroups,
    requiredBudgetExceeded,
    requiredOverflow: [...requiredOverflow],
    remainingChars,
    advisoryOnly: true,
  };
}