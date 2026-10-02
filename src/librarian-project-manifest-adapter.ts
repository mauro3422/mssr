import { createHash } from "node:crypto";
import { z } from "zod";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import { projectContextManifestSchema, projectContextReferencesManifestSchema, projectContextSegmentsManifestSchema } from "./project-context.js";
import { architectureImpactManifestSchema } from "./architecture-impact.js";
import { architectureStructureManifestSchema } from "./architecture-impact-structure.js";
import { architectureInvariantManifestSchema } from "./architecture-invariants.js";
import { documentFreshnessManifestSchema } from "./document-freshness.js";
import { documentContextManifestSchema } from "./document-context.js";
import { mssrContextMessagesManifestSchema } from "./context-message-repository-provider.js";
import { skillContextManifestSchema } from "./skill-context.js";
import { projectContextLibrarianManifestSchema } from "./project-context-librarian.js";

export const MSSR_LIBRARIAN_PROJECT_MANIFEST_KINDS = [
  "project-context",
  "project-context-segments",
  "project-context-references",
  "project-context-librarian",
  "architecture-impact",
  "architecture-structure",
  "architecture-invariants",
  "document-freshness",
  "document-context",
  "context-messages",
  "skill-context",
] as const;

export type MssrLibrarianProjectManifestKind = typeof MSSR_LIBRARIAN_PROJECT_MANIFEST_KINDS[number];

const manifestInputSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  manifestKind: z.enum(MSSR_LIBRARIAN_PROJECT_MANIFEST_KINDS),
  sourceRef: z.string().trim().min(1).max(400),
  revision: z.string().trim().min(1).max(256).optional(),
  manifest: z.unknown(),
  host: z.string().trim().min(1).max(120).optional(),
  traceId: z.string().trim().min(1).max(200).optional(),
}).strict();

type ManifestInput = z.infer<typeof manifestInputSchema>;

type ManifestEntry = {
  id: string;
  value: unknown;
};

const FREEFORM_KEYS = new Set(["description", "summary", "title", "text", "content", "prompt", "instructions", "note"]);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]));
  }
  throw new Error(`Unsupported project-manifest value type: ${typeof value}.`);
}

function structuralProjection(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(structuralProjection);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => item !== undefined && !FREEFORM_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, structuralProjection(item)]));
  }
  return null;
}

function fingerprint(value: unknown): string {
  return sha256(JSON.stringify(canonical(value)));
}

function parseManifest(kind: MssrLibrarianProjectManifestKind, input: unknown): unknown {
  switch (kind) {
    case "project-context": return projectContextManifestSchema.parse(input);
    case "project-context-segments": return projectContextSegmentsManifestSchema.parse(input);
    case "project-context-references": return projectContextReferencesManifestSchema.parse(input);
    case "project-context-librarian": return projectContextLibrarianManifestSchema.parse(input);
    case "architecture-impact": return architectureImpactManifestSchema.parse(input);
    case "architecture-structure": return architectureStructureManifestSchema.parse(input);
    case "architecture-invariants": return architectureInvariantManifestSchema.parse(input);
    case "document-freshness": return documentFreshnessManifestSchema.parse(input);
    case "document-context": return documentContextManifestSchema.parse(input);
    case "context-messages": return mssrContextMessagesManifestSchema.parse(input);
    case "skill-context": return skillContextManifestSchema.parse(input);
  }
}

function entriesFor(kind: MssrLibrarianProjectManifestKind, parsed: any): ManifestEntry[] {
  switch (kind) {
    case "project-context":
      return [...parsed.core, ...parsed.modules].map((entry: any) => ({ id: entry.id, value: entry }));
    case "project-context-segments":
      return parsed.modules.flatMap((binding: any) => binding.segments.map((segment: any) => ({
        id: `${binding.moduleId}:${segment.id}`,
        value: { moduleId: binding.moduleId, ...segment },
      })));
    case "project-context-references":
      return parsed.modules.flatMap((binding: any) => binding.references.map((reference: any) => ({
        id: `${binding.moduleId}:${reference.id}`,
        value: { moduleId: binding.moduleId, ...reference },
      })));
    case "project-context-librarian":
      return parsed.entries.map((entry: any) => ({
        id: `${entry.entryId}:${entry.headingPath.join(" > ")}`,
        value: entry,
      }));
    case "architecture-impact":
    case "architecture-structure":
      return parsed.architectures.map((entry: any) => ({ id: entry.architectureId, value: entry }));
    case "architecture-invariants":
      return parsed.invariants.map((entry: any) => ({ id: entry.invariantId, value: entry }));
    case "document-freshness":
      return parsed.documents.map((entry: any) => ({ id: entry.documentId, value: entry }));
    case "document-context":
      return [{ id: "core", value: parsed.core }, ...parsed.modules.map((entry: any) => ({ id: entry.id, value: entry }))];
    case "context-messages":
      return Object.entries(parsed.entries).map(([ref, value]) => ({ id: ref, value }));
    case "skill-context":
      return [{ id: "core", value: parsed.core }, ...parsed.modules.map((entry: any) => ({ id: entry.id, value: entry }))];
  }
}

function schemaVersion(parsed: unknown): number | string | null {
  const value = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).schemaVersion : undefined;
  return typeof value === "number" || typeof value === "string" ? value : null;
}

/**
 * Adapt validated repository-owned manifests into metadata-only Librarian records.
 * Exact manifest/entry bytes are represented by fingerprints; free-form prose
 * fields are stripped from retained metadata. Runtime adoption/current filesystem
 * state remain separate host observations.
 */
export function librarianRecordsFromProjectManifest(input: unknown): MssrLibrarianIngressRecord[] {
  const args: ManifestInput = manifestInputSchema.parse(input);
  const parsed = parseManifest(args.manifestKind, args.manifest);
  const entries = entriesFor(args.manifestKind, parsed);
  const payloadFingerprint = fingerprint(parsed);
  const revision = args.revision ?? payloadFingerprint;
  const provenance = {
    producer: "project-manifests",
    ...(args.host ? { host: args.host } : {}),
    ...(args.traceId ? { traceId: args.traceId } : {}),
  };

  const root: MssrLibrarianIngressRecord = {
    namespace: "manifest",
    kind: args.manifestKind,
    identity: `${args.projectName}:${args.sourceRef}`,
    sourceRef: args.sourceRef,
    revision,
    payloadFingerprint,
    metadata: {
      projectName: args.projectName,
      manifestKind: args.manifestKind,
      schemaVersion: schemaVersion(parsed),
      entryCount: entries.length,
      entryIds: entries.map((entry) => entry.id),
    },
    provenance,
  };

  const children = entries.map<MssrLibrarianIngressRecord>((entry) => ({
    namespace: "manifest",
    kind: `${args.manifestKind}-entry`,
    identity: `${args.projectName}:${args.sourceRef}#${entry.id}`,
    sourceRef: `${args.sourceRef}#${entry.id}`,
    revision,
    payloadFingerprint: fingerprint(entry.value),
    metadata: {
      projectName: args.projectName,
      manifestKind: args.manifestKind,
      entryId: entry.id,
      structure: structuralProjection(entry.value),
    },
    provenance,
  }));

  return [root, ...children];
}
