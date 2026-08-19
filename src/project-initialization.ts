import fs from "node:fs/promises";
import path from "node:path";
import { projectContextManifestSchema, type ProjectContextManifest } from "./project-context.js";
import {
  MSSR_PROJECT_AUTHORITY_FILES,
  MSSR_PROJECT_CONTROL_FILES,
  MSSR_PROJECT_HOME_DIR,
  mssrProjectAbsolutePath,
  mssrProjectRelativePath,
} from "./project-home.js";

const LEGACY_MSSR_FILES = [
  "PROJECT_CONTEXT.md",
  "PROJECT_MEMORY.md",
  "PROJECT_STATE.md",
  "project-context.json",
  "project-context-modules.json",
  "context-messages.json",
  "mssr-context-inbox.json",
] as const;

const DEFAULT_SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".cache", ".venv", "venv", "vendor", "workspace-snapshots", "_migration-backups", "godot-mcp-audit"]);

async function exists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}

async function writeIfMissing(target: string, content: string): Promise<boolean> {
  if (await exists(target)) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return true;
}

function repositoryName(projectRoot: string): string {
  return path.basename(path.resolve(projectRoot));
}

function initialManifest(): ProjectContextManifest {
  return projectContextManifestSchema.parse({
    schemaVersion: 1,
    core: [
      {
        id: "project-identity",
        kind: "context",
        topic: "vocabulary",
        description: "Repository identity needed before substantial work.",
        source: { path: ".mssr/PROJECT_CONTEXT.md", sections: ["## Project identity"] },
        maxChars: 1500,
      },
    ],
    modules: [
      {
        id: "project-architecture",
        kind: "context",
        topic: "architecture",
        description: "Stable local architecture and ownership facts.",
        source: { path: ".mssr/PROJECT_CONTEXT.md", sections: ["## Architecture"] },
        actions: ["design", "review", "analyze", "debug"],
        artifacts: ["project", "repository", "code"],
        priority: 30,
        maxChars: 5000,
      },
      {
        id: "project-decisions",
        kind: "memory",
        topic: "decision",
        description: "Durable local design and architecture decisions.",
        source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Decisions"] },
        actions: ["design", "review", "analyze", "recover"],
        needs: ["history-recovery"],
        priority: 30,
        maxChars: 5000,
      },
      {
        id: "project-current-phase",
        kind: "state",
        topic: "phase",
        description: "Current project phase, active work, blockers and handoff state.",
        source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Current phase"] },
        stages: ["start", "implement", "verify", "persist", "close", "resume"],
        priority: 35,
        maxChars: 3500,
      },
    ],
  });
}

function skeletons(projectRoot: string) {
  const name = repositoryName(projectRoot);
  return {
    [MSSR_PROJECT_AUTHORITY_FILES.context]: `# Project Context\n\n## Project identity\n\n- Repository: \`${name}\`\n\n## Architecture\n\nNo project-specific architecture facts have been recorded yet.\n`,
    [MSSR_PROJECT_AUTHORITY_FILES.memory]: "# Project Memory\n\n## Decisions\n\nNo durable project-specific decisions have been recorded yet.\n",
    [MSSR_PROJECT_AUTHORITY_FILES.state]: "# Project State\n\n## Current phase\n\n- MSSR project context initialized. No project-specific active phase has been recorded yet.\n",
  };
}

async function normalizeMssrGitignore(projectRoot: string): Promise<boolean> {
  const target = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, ".gitignore");
  let old = "";
  try { old = await fs.readFile(target, "utf8"); } catch {}
  const lines = old.replace(/\r\n/g, "\n").split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "/mssr-context-inbox.json" && line !== "mssr-context-inbox.json");
  if (!lines.some((line) => line.trim() === "/runtime/")) lines.push("/runtime/");
  const normalized = `${lines.filter((line, index, all) => line || (index > 0 && all[index - 1])).join("\n").replace(/^\n+|\n+$/g, "")}\n`;
  if (old === normalized) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, normalized, "utf8");
  return true;
}

async function removeDeprecatedCanonicalInbox(projectRoot: string): Promise<boolean> {
  const oldPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, "mssr-context-inbox.json");
  if (!(await exists(oldPath))) return false;
  // Runtime receipts are reconstructable evidence, not durable project knowledge.
  // The pre-0.2.18 inbox may contain .bridge-derived receipts, so the canonical-only
  // cutover deliberately discards it instead of carrying stale provenance forward.
  await fs.rm(oldPath, { force: true });
  return true;
}

function canonicalCounterpart(projectRoot: string, legacyName: string): string | null {
  if (legacyName === "project-context-modules.json") return mssrProjectAbsolutePath(projectRoot, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  if (legacyName === "mssr-context-inbox.json") return mssrProjectAbsolutePath(projectRoot, MSSR_PROJECT_CONTROL_FILES.contextInbox);
  return mssrProjectAbsolutePath(projectRoot, legacyName);
}

async function cleanupLegacy(projectRoot: string): Promise<{ removed: string[]; blocked: string[] }> {
  const removed: string[] = [];
  const blocked: string[] = [];
  for (const name of LEGACY_MSSR_FILES) {
    const legacy = path.join(projectRoot, ".bridge", name);
    if (!(await exists(legacy))) continue;
    const canonical = canonicalCounterpart(projectRoot, name);
    const disposableRuntime = name === "mssr-context-inbox.json";
    if (!disposableRuntime && (!canonical || !(await exists(canonical)))) {
      blocked.push(path.posix.join(".bridge", name));
      continue;
    }
    await fs.rm(legacy, { force: true });
    removed.push(path.posix.join(".bridge", name));
  }
  return { removed, blocked };
}

export type InitializeMssrProjectOptions = {
  initializeMissing?: boolean;
  cleanupLegacyArtifacts?: boolean;
};

export async function initializeMssrProject(projectRootInput: string, options: InitializeMssrProjectOptions = {}) {
  const projectRoot = path.resolve(projectRootInput);
  const initializeMissing = options.initializeMissing ?? true;
  const cleanupLegacyArtifacts = options.cleanupLegacyArtifacts ?? true;
  const home = path.join(projectRoot, MSSR_PROJECT_HOME_DIR);
  const created: string[] = [];
  const updated: string[] = [];

  const legacySnapshot = await Promise.all(LEGACY_MSSR_FILES.map(async (name) => {
    const legacyPath = path.join(projectRoot, ".bridge", name);
    const canonical = canonicalCounterpart(projectRoot, name);
    return {
      name,
      legacyPath,
      legacyExists: await exists(legacyPath),
      canonical,
      canonicalExistedBefore: canonical ? await exists(canonical) : false,
    };
  }));
  const legacyBefore = legacySnapshot
    .filter((item) => item.legacyExists)
    .map((item) => path.posix.join(".bridge", item.name));
  const protectedLegacyNames = new Set(legacySnapshot
    .filter((item) => item.legacyExists && item.name !== "mssr-context-inbox.json" && !item.canonicalExistedBefore)
    .map((item) => item.name));

  if (initializeMissing) {
    await fs.mkdir(path.join(home, "runtime"), { recursive: true });
    await fs.mkdir(path.join(home, "knowledge"), { recursive: true });
    const docs = skeletons(projectRoot);
    for (const [name, content] of Object.entries(docs)) {
      if (protectedLegacyNames.has(name as typeof LEGACY_MSSR_FILES[number])) continue;
      const target = path.join(home, name);
      if (await writeIfMissing(target, content)) created.push(mssrProjectRelativePath(name));
    }
    const manifestTarget = path.join(home, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
    if (!protectedLegacyNames.has("project-context.json") && !protectedLegacyNames.has("project-context-modules.json")) {
      if (await writeIfMissing(manifestTarget, `${JSON.stringify(initialManifest(), null, 2)}\n`)) created.push(mssrProjectRelativePath(MSSR_PROJECT_CONTROL_FILES.projectContextManifest));
    }
  }

  if (await normalizeMssrGitignore(projectRoot)) updated.push(".mssr/.gitignore");
  if (await removeDeprecatedCanonicalInbox(projectRoot)) updated.push("removed:.mssr/mssr-context-inbox.json");

  const legacy = cleanupLegacyArtifacts
    ? await cleanupLegacy(projectRoot)
    : { removed: [], blocked: legacyBefore };
  for (const name of protectedLegacyNames) {
    const rel = path.posix.join(".bridge", name);
    if (!legacy.blocked.includes(rel)) legacy.blocked.push(rel);
  }
  legacy.blocked.sort();
  const manifestPath = path.join(home, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  let manifestStatus: "missing" | "valid" | "invalid" = "missing";
  let manifestError: string | null = null;
  if (await exists(manifestPath)) {
    try {
      projectContextManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath, "utf8")));
      manifestStatus = "valid";
    } catch (error) {
      manifestStatus = "invalid";
      manifestError = error instanceof Error ? error.message : String(error);
    }
  }

  const initialized = manifestStatus === "valid" && legacy.blocked.length === 0;
  return {
    projectRoot,
    initialized,
    manifestStatus,
    created,
    updated,
    legacy: { detected: legacyBefore, removed: legacy.removed, blocked: legacy.blocked },
    ...(manifestError ? { manifestError } : {}),
    idempotent: created.length === 0 && updated.length === 0 && legacy.removed.length === 0,
  };
}

export async function discoverMssrWorkspaceRepositories(workspaceRootInput: string, maxDepth = 2): Promise<string[]> {
  const root = path.resolve(workspaceRootInput);
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((entry) => entry.name === ".git")) {
      found.push(dir);
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || DEFAULT_SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }
  await walk(root, 0);
  return found.sort((a, b) => a.localeCompare(b));
}

export async function initializeMssrWorkspace(workspaceRoot: string, options: InitializeMssrProjectOptions & { maxDepth?: number } = {}) {
  const projects = await discoverMssrWorkspaceRepositories(workspaceRoot, options.maxDepth ?? 2);
  const results = [];
  for (const projectRoot of projects) results.push(await initializeMssrProject(projectRoot, options));
  return {
    workspaceRoot: path.resolve(workspaceRoot),
    projectCount: results.length,
    initialized: results.filter((item) => item.initialized).length,
    changed: results.filter((item) => !item.idempotent).map((item) => item.projectRoot),
    blocked: results.filter((item) => !item.initialized).map((item) => item.projectRoot),
    projects: results,
  };
}
