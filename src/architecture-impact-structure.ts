import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  architectureImpactManifestSchema,
  findArchitectureImpactForTouchedRefs,
  type ArchitectureImpactManifest,
  type ArchitectureImpactTouchMatch,
} from "./architecture-impact.js";
import {
  MSSR_PROJECT_CONTROL_FILES,
  mssrProjectRelativePath,
  resolveMssrProjectFile,
} from "./project-home.js";

export const MSSR_ARCHITECTURE_STRUCTURE_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_STRUCTURE_ENTRIES = 64;
export const MAX_ARCHITECTURE_AUTHORITY_ANCHORS = 32;
export const MAX_ARCHITECTURE_IMPLEMENTATION_ENTRIES = 64;
export const MAX_ARCHITECTURE_SYMBOL_SELECTORS = 32;

export const DEFAULT_ARCHITECTURE_STRUCTURE_MANIFEST_RELATIVE = mssrProjectRelativePath(
  MSSR_PROJECT_CONTROL_FILES.architectureStructureManifest,
);

export const architectureMarkdownAnchorIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
export const architectureSymbolNameSchema = z.string().min(1).max(160).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Architecture symbol names must be bounded single-line values without surrounding whitespace.",
);

export const architectureSymbolSelectorSchema = z.object({
  kind: z.literal("symbol"),
  language: z.enum(["typescript", "javascript"]),
  name: architectureSymbolNameSchema,
  aspect: z.enum(["signature", "body", "shape"]),
}).strict();

export const architectureImplementationStructureSchema = z.object({
  ref: architectureImpactExactRefSchema,
  selectors: z.array(architectureSymbolSelectorSchema).min(1).max(MAX_ARCHITECTURE_SYMBOL_SELECTORS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.selectors.length; index += 1) {
    const selector = value.selectors[index];
    const key = `${selector.kind}\0${selector.language}\0${selector.name}\0${selector.aspect}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture symbol selector: ${selector.language}:${selector.name}:${selector.aspect}`,
        path: ["selectors", index],
      });
    }
    seen.add(key);
  }
});

export const architectureStructureEntrySchema = z.object({
  architectureId: architectureImpactIdSchema,
  authorityAnchors: z.array(architectureMarkdownAnchorIdSchema).min(1).max(MAX_ARCHITECTURE_AUTHORITY_ANCHORS).optional(),
  implementation: z.array(architectureImplementationStructureSchema).min(1).max(MAX_ARCHITECTURE_IMPLEMENTATION_ENTRIES).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.authorityAnchors?.length ?? 0) === 0 && (value.implementation?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Architecture structure entries must declare at least one authority anchor or implementation selector.",
    });
  }

  const anchors = new Set<string>();
  for (let index = 0; index < (value.authorityAnchors?.length ?? 0); index += 1) {
    const anchor = value.authorityAnchors![index];
    if (anchors.has(anchor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture authority anchor: ${anchor}`,
        path: ["authorityAnchors", index],
      });
    }
    anchors.add(anchor);
  }

  const refs = new Set<string>();
  for (let index = 0; index < (value.implementation?.length ?? 0); index += 1) {
    const ref = value.implementation![index].ref;
    if (refs.has(ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture implementation structure ref: ${ref}`,
        path: ["implementation", index, "ref"],
      });
    }
    refs.add(ref);
  }
});

export const architectureStructureManifestSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_STRUCTURE_SCHEMA_VERSION),
  architectures: z.array(architectureStructureEntrySchema).max(MAX_ARCHITECTURE_STRUCTURE_ENTRIES).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (let index = 0; index < value.architectures.length; index += 1) {
    const architectureId = value.architectures[index].architectureId;
    if (ids.has(architectureId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture structure architectureId: ${architectureId}`,
        path: ["architectures", index, "architectureId"],
      });
    }
    ids.add(architectureId);
  }
});

export type ArchitectureSymbolSelector = z.infer<typeof architectureSymbolSelectorSchema>;
export type ArchitectureImplementationStructure = z.infer<typeof architectureImplementationStructureSchema>;
export type ArchitectureStructureEntry = z.infer<typeof architectureStructureEntrySchema>;
export type ArchitectureStructureManifest = z.infer<typeof architectureStructureManifestSchema>;

export type ArchitectureStructureManifestLoadResult =
  | { found: false; path: string }
  | { found: true; manifest: ArchitectureStructureManifest; path: string };

function implementationRefMatchesLanguage(ref: string, language: ArchitectureSymbolSelector["language"]): boolean {
  const lower = ref.toLowerCase();
  if (language === "typescript") return lower.endsWith(".ts") || lower.endsWith(".tsx");
  return lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs");
}

/**
 * Structural metadata may only refine relations already declared by C2f-A.
 * It cannot create architecture authority, widen impactRefs, or promote a
 * derived relationship into canonical review authority.
 */
export function validateArchitectureStructureAgainstImpactManifest(
  structureInput: ArchitectureStructureManifest,
  impactInput: ArchitectureImpactManifest,
): ArchitectureStructureManifest {
  const structure = architectureStructureManifestSchema.parse(structureInput);
  const impact = architectureImpactManifestSchema.parse(impactInput);
  const declaredById = new Map(impact.architectures.map((entry) => [entry.architectureId, entry] as const));

  for (const entry of structure.architectures) {
    const declared = declaredById.get(entry.architectureId);
    if (!declared) {
      throw new Error(`Architecture structure references undeclared architectureId: ${entry.architectureId}`);
    }
    if ((entry.authorityAnchors?.length ?? 0) > 0 && !/\.md(?:own)?$/i.test(declared.authorityRef)) {
      throw new Error(`Architecture authority anchors require a Markdown authorityRef: ${entry.architectureId}:${declared.authorityRef}`);
    }
    for (const implementation of entry.implementation ?? []) {
      if (!declared.impactRefs.includes(implementation.ref)) {
        throw new Error(
          `Architecture structure cannot widen declared impactRefs for ${entry.architectureId}: ${implementation.ref}`,
        );
      }
      for (const selector of implementation.selectors) {
        if (!implementationRefMatchesLanguage(implementation.ref, selector.language)) {
          throw new Error(
            `Architecture symbol selector language does not match implementation ref: ${entry.architectureId}:${implementation.ref}:${selector.language}`,
          );
        }
      }
    }
  }

  return structure;
}

export async function loadArchitectureStructureManifest(
  projectRoot: string,
  impactManifest: ArchitectureImpactManifest,
  manifestPath?: string,
): Promise<ArchitectureStructureManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : (await resolveMssrProjectFile(projectRoot, MSSR_PROJECT_CONTROL_FILES.architectureStructureManifest)).absolutePath;

  let parsed: ArchitectureStructureManifest;
  try {
    parsed = architectureStructureManifestSchema.parse(JSON.parse(await fs.readFile(resolved, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { found: false, path: resolved };
    }
    throw error;
  }

  return {
    found: true,
    path: resolved,
    manifest: validateArchitectureStructureAgainstImpactManifest(parsed, impactManifest),
  };
}

export type ArchitectureTouchContextMatch = Omit<ArchitectureImpactTouchMatch, "matchedRefs"> & {
  authorityAnchors: string[];
  matchedRefs: Array<{
    ref: string;
    role: "authority" | "impact";
    selectors: ArchitectureSymbolSelector[];
  }>;
};

/**
 * Combine coarse pre-edit reverse lookup with optional structural refinement.
 * The coarse declared relation always wins: absence of a structure entry never
 * hides a relevant architecture.
 */
export function findArchitectureTouchContext(
  impactInput: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest | null | undefined,
  touchedRefs: readonly string[],
): ArchitectureTouchContextMatch[] {
  const impact = architectureImpactManifestSchema.parse(impactInput);
  const structure = structureInput
    ? validateArchitectureStructureAgainstImpactManifest(structureInput, impact)
    : null;
  const structureById = new Map((structure?.architectures ?? []).map((entry) => [entry.architectureId, entry] as const));

  return findArchitectureImpactForTouchedRefs(impact, touchedRefs).map((match) => {
    const refinement = structureById.get(match.architectureId);
    const selectorsByRef = new Map((refinement?.implementation ?? []).map((item) => [item.ref, item.selectors] as const));
    return {
      architectureId: match.architectureId,
      authorityRef: match.authorityRef,
      ...(match.contextRef ? { contextRef: match.contextRef } : {}),
      authorityAnchors: [...(refinement?.authorityAnchors ?? [])],
      matchedRefs: match.matchedRefs.map((item) => ({
        ...item,
        selectors: item.role === "impact" ? [...(selectorsByRef.get(item.ref) ?? [])] : [],
      })),
    };
  });
}
