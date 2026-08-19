import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ProjectContextManifest } from "./project-context.js";
import { loadProjectContextModuleManifest } from "./project-context-loader.js";
import {
  MSSR_PROJECT_CONTROL_FILES,
  mssrProjectRelativePath,
  resolveMssrProjectFile,
} from "./project-home.js";

export const MSSR_ARCHITECTURE_IMPACT_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_IMPACT_ENTRIES = 64;
export const MAX_ARCHITECTURE_IMPACT_REFS = 64;
export const DEFAULT_ARCHITECTURE_IMPACT_MANIFEST_RELATIVE = mssrProjectRelativePath(
  MSSR_PROJECT_CONTROL_FILES.architectureImpactManifest,
);

export const architectureImpactIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);

function addPathIssue(ctx: z.RefinementCtx, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}

/**
 * C2f-A v1 deliberately accepts only exact canonical project-relative paths.
 * Globs/inferred graph expressions are a future contract and cannot silently
 * become trigger authority through this manifest.
 */
export const architectureImpactExactRefSchema = z.string().min(1).max(320).superRefine((value, ctx) => {
  if (value.includes("\\")) addPathIssue(ctx, "Architecture-impact refs must use forward slashes.");
  if (value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:\//.test(value)) {
    addPathIssue(ctx, "Architecture-impact refs must be project-relative, not absolute.");
  }
  if (value.includes("#")) addPathIssue(ctx, "Architecture-impact refs must name an exact file; use contextRef for indexed sections.");
  if (/[*?\[\]{}!]/.test(value)) addPathIssue(ctx, "Architecture-impact v1 does not allow glob or pattern refs.");

  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    addPathIssue(ctx, "Architecture-impact refs must be normalized exact paths without empty, '.' or '..' segments.");
  }
});

export const architectureImpactEntrySchema = z.object({
  architectureId: architectureImpactIdSchema,
  authorityRef: architectureImpactExactRefSchema,
  contextRef: architectureImpactIdSchema.optional(),
  impactRefs: z.array(architectureImpactExactRefSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.impactRefs.length; index += 1) {
    const ref = value.impactRefs[index];
    if (seen.has(ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate impactRef: ${ref}`,
        path: ["impactRefs", index],
      });
    }
    seen.add(ref);
  }
});

export const architectureImpactManifestSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_SCHEMA_VERSION),
  architectures: z.array(architectureImpactEntrySchema).max(MAX_ARCHITECTURE_IMPACT_ENTRIES).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (let index = 0; index < value.architectures.length; index += 1) {
    const entry = value.architectures[index];
    if (ids.has(entry.architectureId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architectureId: ${entry.architectureId}`,
        path: ["architectures", index, "architectureId"],
      });
    }
    ids.add(entry.architectureId);
  }
});

export type ArchitectureImpactEntry = z.infer<typeof architectureImpactEntrySchema>;
export type ArchitectureImpactManifest = z.infer<typeof architectureImpactManifestSchema>;

export type ArchitectureImpactTouchMatch = {
  architectureId: string;
  authorityRef: string;
  contextRef?: string;
  matchedRefs: Array<{ ref: string; role: "authority" | "impact" }>;
};

/**
 * Resolve architecture context before an edit occurs. This is a pure reverse lookup
 * over the reviewed declared relation: no filesystem read, hash comparison or
 * possible-impact projection is required. Shared refs intentionally return every
 * matching architecture in manifest order.
 */
export function findArchitectureImpactForTouchedRefs(
  manifestInput: ArchitectureImpactManifest,
  touchedRefsInput: readonly string[],
): ArchitectureImpactTouchMatch[] {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  const touchedRefs: string[] = [];
  const seen = new Set<string>();
  for (const raw of touchedRefsInput) {
    const ref = architectureImpactExactRefSchema.parse(raw);
    if (seen.has(ref)) continue;
    seen.add(ref);
    touchedRefs.push(ref);
  }

  return manifest.architectures.flatMap((entry): ArchitectureImpactTouchMatch[] => {
    const matchedRefs: ArchitectureImpactTouchMatch["matchedRefs"] = [];
    for (const ref of touchedRefs) {
      if (ref === entry.authorityRef) matchedRefs.push({ ref, role: "authority" });
      else if (entry.impactRefs.includes(ref)) matchedRefs.push({ ref, role: "impact" });
    }
    if (matchedRefs.length === 0) return [];
    return [{
      architectureId: entry.architectureId,
      authorityRef: entry.authorityRef,
      ...(entry.contextRef ? { contextRef: entry.contextRef } : {}),
      matchedRefs,
    }];
  });
}

export type ArchitectureImpactManifestLoadResult =
  | { found: false; path: string }
  | { found: true; manifest: ArchitectureImpactManifest; path: string; projectContextPath: string };

export function validateArchitectureImpactContextRefs(
  manifest: ArchitectureImpactManifest,
  projectContextManifest: ProjectContextManifest,
): ArchitectureImpactManifest {
  const indexedIds = new Set(
    [...projectContextManifest.core, ...projectContextManifest.modules].map((entry) => entry.id),
  );
  const unresolved = manifest.architectures
    .filter((entry) => entry.contextRef && !indexedIds.has(entry.contextRef))
    .map((entry) => `${entry.architectureId}:${entry.contextRef}`);
  if (unresolved.length > 0) {
    throw new Error(`Architecture-impact contextRef is not indexed by .mssr/project-context.json: ${unresolved.join(", ")}`);
  }
  return manifest;
}

export function resolveArchitectureImpactProjectPath(projectRoot: string, ref: string): string {
  const parsed = architectureImpactExactRefSchema.parse(ref);
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(root, parsed);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Architecture-impact ref escapes project root: ${ref}`);
  }
  return candidate;
}

/**
 * Load only the declared relationship contract. C2f-A performs no filesystem
 * observation of authorityRef/impactRefs and emits no drift decision or notice.
 */
export async function loadArchitectureImpactManifest(
  projectRoot: string,
  manifestPath?: string,
): Promise<ArchitectureImpactManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : (await resolveMssrProjectFile(projectRoot, MSSR_PROJECT_CONTROL_FILES.architectureImpactManifest)).absolutePath;

  let manifest: ArchitectureImpactManifest;
  try {
    const rawText = await fs.readFile(resolved, "utf8");
    manifest = architectureImpactManifestSchema.parse(JSON.parse(rawText));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { found: false, path: resolved };
    }
    throw error;
  }

  const projectContext = await loadProjectContextModuleManifest(projectRoot);
  if (manifest.architectures.some((entry) => entry.contextRef) && !projectContext.found) {
    throw new Error("Architecture-impact manifest declares contextRef but .mssr/project-context.json is missing.");
  }
  if (projectContext.found) validateArchitectureImpactContextRefs(manifest, projectContext.manifest);

  return {
    found: true,
    manifest,
    path: resolved,
    projectContextPath: projectContext.path,
  };
}
