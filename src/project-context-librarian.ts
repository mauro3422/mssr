import { z } from "zod";
import { buildMssrMarkdownDocumentSurface, type MssrDocumentSurfaceHeading } from "./document-surface.js";
import { evidenceAtomFromLibrarianCatalogRecord, type MssrEvidenceAtom } from "./evidence-atom.js";
import { catalogMssrLibrarianRecord, type MssrLibrarianCatalogRecord } from "./librarian-contract.js";
import {
  projectContextManifestSchema,
  projectContextReferencesManifestSchema,
  projectContextSegmentsManifestSchema,
} from "./project-context.js";
import { SKILL_ACTIONS, SKILL_ARTIFACTS, SKILL_DOMAINS, SKILL_NEEDS, SKILL_SIGNALS } from "./skill-routing.js";

export const PROJECT_CONTEXT_LIBRARIAN_LIMITS = {
  declarations: 512,
  sourceFiles: 32,
  sidecarBytes: 2_000_000,
  charsPerSource: 2_000_000,
  totalSourceChars: 4_000_000,
} as const;

const boundedEntryId = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const relativeProjectPath = z.string().trim().min(1).max(240).refine((value) => {
  const normalized = value.replace(/\\/g, "/");
  return !normalized.startsWith("/")
    && !/^[a-z]:/i.test(normalized)
    && !normalized.split("/").some((part) => part === "" || part === "." || part === "..")
    && (/\.md$/i.test(normalized) || /\.markdown$/i.test(normalized));
}, "Project-context librarian sourcePath must be a normalized project-relative Markdown path.");
const headingPathSchema = z.array(z.string().trim().min(1).max(240)).min(1).max(12);
const closedSelectorsSchema = z.object({
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
}).strict().superRefine((selectors, ctx) => {
  let total = 0;
  for (const [field, values] of Object.entries(selectors)) {
    total += values.length;
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Duplicate project-context librarian selector in ${field}.` });
    }
    if (values.some((value) => value.includes("+"))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Selector values cannot contain the reserved '+' projection delimiter." });
    }
    const encodedLength = [...new Set(values)].sort().join("+").length;
    if (encodedLength > 120) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `The encoded ${field} selector exceeds the 120-character EvidenceAtom attribute limit.` });
    }
  }
  if (total === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A project-context librarian heading needs at least one explicit selector." });
});

export const projectContextLibrarianEntrySchema = z.object({
  entryId: boundedEntryId,
  sourcePath: relativeProjectPath,
  headingPath: headingPathSchema,
  expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  selectors: closedSelectorsSchema,
}).strict();

export const projectContextLibrarianManifestSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(projectContextLibrarianEntrySchema).max(PROJECT_CONTEXT_LIBRARIAN_LIMITS.declarations).default([]),
}).strict().superRefine((value, ctx) => {
  const bindings = new Set<string>();
  const sourcePaths = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    const key = JSON.stringify([entry.sourcePath.replace(/\\/g, "/"), entry.headingPath]);
    if (bindings.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entries", index], message: "A project-context librarian heading binding may be declared only once." });
    }
    bindings.add(key);
    sourcePaths.add(entry.sourcePath.replace(/\\/g, "/"));
  }
  if (sourcePaths.size > PROJECT_CONTEXT_LIBRARIAN_LIMITS.sourceFiles) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entries"], message: `Project-context librarian sidecars are limited to ${PROJECT_CONTEXT_LIBRARIAN_LIMITS.sourceFiles} source files.` });
  }
});

export type ProjectContextLibrarianEntry = z.infer<typeof projectContextLibrarianEntrySchema>;
export type ProjectContextLibrarianManifest = z.infer<typeof projectContextLibrarianManifestSchema>;

export type ProjectContextLibrarianProjectionIssue =
  | "unknown-entry"
  | "source-path-mismatch"
  | "unsupported-directive"
  | "indirect-source"
  | "source-not-provided"
  | "ambiguous-source-input"
  | "source-too-large"
  | "invalid-source"
  | "heading-not-found"
  | "ambiguous-heading"
  | "outside-manifest-section"
  | "stale-fingerprint";

export type ProjectContextLibrarianProjectionItem = {
  entryId: string;
  headingPath: string[];
  status: "projected" | "omitted";
  issue?: ProjectContextLibrarianProjectionIssue;
  sourceRef?: string;
  revision?: string;
  rangeId?: string;
  recordFingerprint?: string;
  evidenceAtomId?: string;
};

export type ProjectContextLibrarianProjection = {
  schemaVersion: 1;
  declared: number;
  projected: number;
  omitted: number;
  items: ProjectContextLibrarianProjectionItem[];
  records: MssrLibrarianCatalogRecord[];
  evidenceAtoms: MssrEvidenceAtom[];
  selectorsAreProjectDeclared: true;
  sourceOwnerIsCallerAsserted: true;
  advisoryOnly: true;
  truthAuthority: false;
  canonicalRewriteAllowed: false;
};

const sourceFileSchema = z.object({ path: relativeProjectPath, markdown: z.string() }).strict();
const projectionArgsSchema = z.object({
  projectContextManifest: z.unknown(),
  librarianManifest: z.unknown(),
  /** Pass null only after the host has observed that the optional sidecar is absent. */
  segmentsManifest: z.unknown().nullable(),
  /** Pass null only after the host has observed that the optional sidecar is absent. */
  referencesManifest: z.unknown().nullable(),
  sourceFiles: z.array(sourceFileSchema).max(PROJECT_CONTEXT_LIBRARIAN_LIMITS.sourceFiles),
  owner: z.string().trim().min(1).max(240),
  projectKey: z.string().trim().min(1).max(320).optional(),
}).strict();

function normalizeProjectPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return normalized;
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function isPrefixPath(prefix: readonly string[], value: readonly string[]): boolean {
  return prefix.length <= value.length && prefix.every((part, index) => part === value[index]);
}

function selectorAttribute(values: readonly string[]): string {
  return [...new Set(values)].sort().join("+");
}

function omission(entry: ProjectContextLibrarianEntry, issue: ProjectContextLibrarianProjectionIssue): ProjectContextLibrarianProjectionItem {
  return { entryId: entry.entryId, headingPath: entry.headingPath, status: "omitted", issue };
}

/**
 * Project explicitly declared, manifest-owned headings into exact-range Librarian
 * records and EvidenceAtoms. This is an opt-in metadata sidecar: module selectors
 * are deliberately never inherited, and every source binding is revalidated
 * against the current manifest and Markdown bytes on each call.
 */
export function projectMssrProjectContextLibrarianMetadata(input: unknown): ProjectContextLibrarianProjection {
  if (!input || typeof input !== "object"
    || !Object.hasOwn(input, "segmentsManifest")
    || !Object.hasOwn(input, "referencesManifest")) {
    throw new Error("Project-context librarian projection requires observed segment/reference sidecar inputs (use null only when a sidecar is confirmed absent).");
  }
  const args = projectionArgsSchema.parse(input);
  const totalSourceChars = args.sourceFiles.reduce((total, source) => total + source.markdown.length, 0);
  if (totalSourceChars > PROJECT_CONTEXT_LIBRARIAN_LIMITS.totalSourceChars) {
    throw new Error(`Project-context librarian projection exceeds ${PROJECT_CONTEXT_LIBRARIAN_LIMITS.totalSourceChars} total source characters.`);
  }
  const manifest = projectContextManifestSchema.parse(args.projectContextManifest);
  const librarianManifest = projectContextLibrarianManifestSchema.parse(args.librarianManifest);
  const segmentsManifest = projectContextSegmentsManifestSchema.parse(args.segmentsManifest ?? { schemaVersion: 1, modules: [] });
  const referencesManifest = projectContextReferencesManifestSchema.parse(args.referencesManifest ?? { schemaVersion: 1, modules: [] });
  const manifestEntries = [...manifest.core, ...manifest.modules];
  const entriesById = new Map(manifestEntries.map((entry) => [entry.id, entry]));
  const indirectModuleIds = new Set([
    ...segmentsManifest.modules.map((binding) => binding.moduleId),
    ...referencesManifest.modules.map((binding) => binding.moduleId),
  ]);
  const sourceInputs = new Map<string, string[]>();
  for (const source of args.sourceFiles) {
    const normalizedPath = normalizeProjectPath(source.path);
    if (!normalizedPath || source.markdown.length > PROJECT_CONTEXT_LIBRARIAN_LIMITS.charsPerSource) continue;
    const copies = sourceInputs.get(normalizedPath) ?? [];
    copies.push(source.markdown);
    sourceInputs.set(normalizedPath, copies);
  }
  const surfaces = new Map<string, ReturnType<typeof buildMssrMarkdownDocumentSurface>>();
  const records: MssrLibrarianCatalogRecord[] = [];
  const evidenceAtoms: MssrEvidenceAtom[] = [];
  const items: ProjectContextLibrarianProjectionItem[] = [];

  for (const entry of librarianManifest.entries) {
    const projectEntry = entriesById.get(entry.entryId);
    if (!projectEntry) {
      items.push(omission(entry, "unknown-entry"));
      continue;
    }
    const canonicalPath = normalizeProjectPath(projectEntry.source.path);
    const declaredPath = normalizeProjectPath(entry.sourcePath);
    if (!canonicalPath || !declaredPath || canonicalPath !== declaredPath) {
      items.push(omission(entry, "source-path-mismatch"));
      continue;
    }
    if (projectEntry.kind === "directive") {
      items.push(omission(entry, "unsupported-directive"));
      continue;
    }
    if (indirectModuleIds.has(entry.entryId)) {
      items.push(omission(entry, "indirect-source"));
      continue;
    }
    const sourceCopies = sourceInputs.get(canonicalPath) ?? [];
    if (sourceCopies.length === 0) {
      const suppliedWithOversize = args.sourceFiles.some((source) => normalizeProjectPath(source.path) === canonicalPath
        && source.markdown.length > PROJECT_CONTEXT_LIBRARIAN_LIMITS.charsPerSource);
      items.push(omission(entry, suppliedWithOversize ? "source-too-large" : "source-not-provided"));
      continue;
    }
    if (sourceCopies.length !== 1) {
      items.push(omission(entry, "ambiguous-source-input"));
      continue;
    }
    let surface = surfaces.get(canonicalPath);
    if (!surface) {
      try {
        surface = buildMssrMarkdownDocumentSurface({ sourceRef: canonicalPath, markdown: sourceCopies[0] });
        surfaces.set(canonicalPath, surface);
      } catch {
        items.push(omission(entry, "invalid-source"));
        continue;
      }
    }
    const matchingHeadings = surface.headings.filter((heading) => samePath(heading.headingPath, entry.headingPath));
    if (matchingHeadings.length === 0) {
      items.push(omission(entry, "heading-not-found"));
      continue;
    }
    if (matchingHeadings.length !== 1) {
      items.push(omission(entry, "ambiguous-heading"));
      continue;
    }
    const heading = matchingHeadings[0];
    if (projectEntry.source.sections?.length) {
      const allowed = surface.headings.some((candidate) => projectEntry.source.sections!.includes(candidate.selector)
        && isPrefixPath(candidate.headingPath, heading.headingPath));
      if (!allowed) {
        items.push(omission(entry, "outside-manifest-section"));
        continue;
      }
    }
    if (heading.fingerprint !== entry.expectedFingerprint) {
      items.push(omission(entry, "stale-fingerprint"));
      continue;
    }

    const sourceRef = canonicalPath;
    const identity = `${sourceRef}#${heading.id}`;
    const record = catalogMssrLibrarianRecord({
      namespace: "project-context",
      kind: "section",
      identity,
      sourceRef,
      revision: surface.revision,
      payloadFingerprint: heading.fingerprint,
      metadata: {
        entryId: entry.entryId,
        headingPath: heading.headingPath,
        selectors: entry.selectors,
        selectorSource: "project-context-librarian-v1",
      },
      provenance: { producer: "project-context-librarian" },
    });
    const attributes: Record<string, string> = {};
    for (const field of ["domains", "actions", "artifacts", "needs", "signals"] as const) {
      if (entry.selectors[field].length === 0) continue;
      const fieldName = field === "domains" ? "domain"
        : field === "actions" ? "action"
          : field === "artifacts" ? "artifact"
            : field === "needs" ? "need" : "signal";
      attributes[fieldName] = selectorAttribute(entry.selectors[field]);
    }
    const atom = evidenceAtomFromLibrarianCatalogRecord({
      record,
      sourceClass: "canonical",
      canonicalOwner: args.owner,
      authorityClass: "canonical",
      privacyClass: "project-metadata",
      freshness: "unknown",
      headingPath: heading.headingPath,
      range: {
        startLine: heading.startLine,
        endLine: heading.endLine,
        startOffset: heading.startOffset,
        endOffset: heading.endOffset,
      },
      reasonCodes: ["project-context-librarian-selector"],
      ...(args.projectKey ? { projectKey: args.projectKey } : {}),
      attributes,
    });
    records.push(record);
    evidenceAtoms.push(atom);
    items.push({
      entryId: entry.entryId,
      headingPath: heading.headingPath,
      status: "projected",
      sourceRef,
      revision: surface.revision,
      rangeId: heading.id,
      recordFingerprint: record.recordFingerprint,
      evidenceAtomId: atom.id,
    });
  }

  const projected = items.filter((item) => item.status === "projected").length;
  return {
    schemaVersion: 1,
    declared: librarianManifest.entries.length,
    projected,
    omitted: items.length - projected,
    items,
    records,
    evidenceAtoms,
    selectorsAreProjectDeclared: true,
    sourceOwnerIsCallerAsserted: true,
    advisoryOnly: true,
    truthAuthority: false,
    canonicalRewriteAllowed: false,
  };
}

export function projectContextLibrarianHeadingFingerprint(args: {
  sourceRef: string;
  markdown: string;
  headingPath: readonly string[];
}): string | null {
  const surface = buildMssrMarkdownDocumentSurface({ sourceRef: args.sourceRef, markdown: args.markdown });
  const matches: MssrDocumentSurfaceHeading[] = surface.headings.filter((heading) => samePath(heading.headingPath, args.headingPath));
  return matches.length === 1 ? matches[0].fingerprint : null;
}
