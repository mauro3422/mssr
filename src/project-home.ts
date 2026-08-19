import fs from "node:fs/promises";
import path from "node:path";

/**
 * Portable MSSR project-control home.
 *
 * `.mssr/` is the only runtime/project-knowledge authority. Historical `.bridge/`
 * files are not read by MSSR. Explicit initialization or one-shot cleanup must
 * move/remove old MSSR artifacts before a repository is considered initialized.
 */
export const MSSR_PROJECT_HOME_DIR = ".mssr" as const;
export const MSSR_PROJECT_KNOWLEDGE_DIR = "knowledge" as const;
export const MSSR_PROJECT_RUNTIME_DIR = "runtime" as const;

export const MSSR_PROJECT_AUTHORITY_FILES = {
  context: "PROJECT_CONTEXT.md",
  memory: "PROJECT_MEMORY.md",
  state: "PROJECT_STATE.md",
} as const;

export const MSSR_PROJECT_CONTROL_FILES = {
  projectContextManifest: "project-context.json",
  architectureImpactManifest: "architecture-impact.json",
  architectureStructureManifest: "architecture-structure.json",
  architectureInvariantManifest: "architecture-invariants.json",
  contextMessagesManifest: "context-messages.json",
  contextInbox: "runtime/context-inbox.json",
} as const;

export type MssrProjectHomeSource = "canonical" | "missing";

export type MssrProjectFileResolution = Readonly<{
  source: MssrProjectHomeSource;
  relativePath: string;
  absolutePath: string;
}>;

function relativeIn(home: string, fileName: string): string {
  return path.posix.join(home, fileName.replace(/\\/g, "/"));
}

export function mssrProjectRelativePath(fileName: string): string {
  return relativeIn(MSSR_PROJECT_HOME_DIR, fileName);
}

export function mssrProjectAbsolutePath(projectRoot: string, fileName: string): string {
  return path.resolve(projectRoot, MSSR_PROJECT_HOME_DIR, fileName);
}

export function mssrKnowledgeRelativePath(topic: string, fileName: string): string {
  return path.posix.join(MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_KNOWLEDGE_DIR, topic, fileName.replace(/\\/g, "/"));
}

export function mssrRuntimeRelativePath(fileName: string): string {
  return path.posix.join(MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_RUNTIME_DIR, fileName.replace(/\\/g, "/"));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Canonical-only read resolver used by every MSSR host adapter. */
export async function resolveMssrProjectFile(
  projectRoot: string,
  fileName: string,
): Promise<MssrProjectFileResolution> {
  const relativePath = mssrProjectRelativePath(fileName);
  const absolutePath = mssrProjectAbsolutePath(projectRoot, fileName);
  return {
    source: await exists(absolutePath) ? "canonical" : "missing",
    relativePath,
    absolutePath,
  };
}

/** MSSR-owned writes always target the portable canonical home. */
export function resolveMssrProjectWritePath(projectRoot: string, fileName: string): string {
  return mssrProjectAbsolutePath(projectRoot, fileName);
}
