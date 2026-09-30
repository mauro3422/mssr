import { createHash } from "node:crypto";
import { z } from "zod";
import type { MssrDocumentSurface } from "./document-surface.js";

export const MSSR_LIBRARIAN_CONTRACT_VERSION = 1 as const;
export const MSSR_LIBRARIAN_ROLE = "advisory-catalog" as const;

const tokenSchema = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/);
const boundedText = (max: number) => z.string().min(1).max(max);

export const mssrLibrarianIngressRecordSchema = z.object({
  namespace: tokenSchema,
  kind: tokenSchema,
  identity: boundedText(400),
  sourceRef: boundedText(1_000),
  revision: z.string().min(1).max(256).optional(),
  payloadFingerprint: z.string().min(1).max(256).optional(),
  metadata: z.unknown().optional(),
  provenance: z.object({
    producer: tokenSchema,
    host: z.string().min(1).max(120).optional(),
    traceId: z.string().min(1).max(200).optional(),
  }).strict(),
}).strict();

export type MssrLibrarianIngressRecord = z.infer<typeof mssrLibrarianIngressRecordSchema>;

export type MssrLibrarianCatalogRecord = MssrLibrarianIngressRecord & {
  contractVersion: typeof MSSR_LIBRARIAN_CONTRACT_VERSION;
  contractKey: string;
  normalizedSourceRef: string;
  metadataFingerprint: string | null;
  recordFingerprint: string;
};

export const MSSR_LIBRARIAN_DUPLICATE_CLASSES = [
  "exact-record",
  "same-source-revision",
  "same-payload",
  "same-metadata",
  "identity-collision",
] as const;

export type MssrLibrarianDuplicateClass = typeof MSSR_LIBRARIAN_DUPLICATE_CLASSES[number];

export type MssrLibrarianDuplicateGroup = {
  classification: MssrLibrarianDuplicateClass;
  deterministic: true;
  jevRequired: false;
  key: string;
  recordFingerprints: string[];
  contractKeys: string[];
  sourceRefs: string[];
  explanation: string;
};

export type MssrLibrarianAudit = {
  contractVersion: typeof MSSR_LIBRARIAN_CONTRACT_VERSION;
  role: typeof MSSR_LIBRARIAN_ROLE;
  inputRecords: number;
  catalogRecords: number;
  duplicateGroups: MssrLibrarianDuplicateGroup[];
  exactDuplicateGroups: number;
  sourceRevisionDuplicateGroups: number;
  payloadDuplicateGroups: number;
  metadataDuplicateGroups: number;
  identityCollisionGroups: number;
  deterministicDuplicateGroups: number;
  semanticComparisonBoundary: "different-normalized-evidence-requires-semantic-review";
  jevUsed: false;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const MAX_METADATA_DEPTH = 8;
const MAX_METADATA_KEYS = 512;
const MAX_METADATA_SERIALIZED_CHARS = 32_000;
const EXCLUDED_METADATA_KEY = /^(?:prompt|prompts|transcript|transcripts|raw|rawtext|rawbody|body|content|text|instructions|summary|description|apikey|accesskey|token|accesstoken|secret|credential|credentials|private|reasoning|toolarguments|arguments)$/i;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedSourceRef(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function normalizeMetadataValue(value: unknown, depth: number, counter: { keys: number }): JsonValue {
  if (depth > MAX_METADATA_DEPTH) throw new Error(`Librarian metadata exceeds max depth ${MAX_METADATA_DEPTH}.`);
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 240) throw new Error("Librarian metadata strings are limited to 240 characters.");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Librarian metadata numbers must be finite.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeMetadataValue(item, depth + 1, counter));
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(object).sort()) {
      counter.keys += 1;
      if (counter.keys > MAX_METADATA_KEYS) throw new Error(`Librarian metadata exceeds max key count ${MAX_METADATA_KEYS}.`);
      const item = object[key];
      if (item === undefined) continue;
      if (EXCLUDED_METADATA_KEY.test(key.replace(/[^a-z0-9]/gi, ""))) {
        throw new Error(`Librarian metadata key '${key}' is excluded because it may carry free-form or sensitive content.`);
      }
      out[key] = normalizeMetadataValue(item, depth + 1, counter);
    }
    return out;
  }
  throw new Error(`Unsupported Librarian metadata value type: ${typeof value}.`);
}

export function canonicalizeMssrLibrarianMetadata(metadata: unknown): string | null {
  if (metadata === undefined) return null;
  const normalized = normalizeMetadataValue(metadata, 0, { keys: 0 });
  const serialized = JSON.stringify(normalized);
  if (serialized.length > MAX_METADATA_SERIALIZED_CHARS) {
    throw new Error(`Librarian metadata exceeds ${MAX_METADATA_SERIALIZED_CHARS} serialized characters.`);
  }
  return serialized;
}

export function catalogMssrLibrarianRecord(input: MssrLibrarianIngressRecord): MssrLibrarianCatalogRecord {
  const parsed = mssrLibrarianIngressRecordSchema.parse(input);
  const sourceRef = normalizedSourceRef(parsed.sourceRef);
  const contractKey = `${parsed.namespace}:${parsed.kind}:${parsed.identity.trim()}`;
  const canonicalMetadata = canonicalizeMssrLibrarianMetadata(parsed.metadata);
  const metadataFingerprint = canonicalMetadata === null ? null : sha256(canonicalMetadata);
  const recordFingerprint = sha256(JSON.stringify({
    contractKey,
    sourceRef,
    revision: parsed.revision ?? null,
    payloadFingerprint: parsed.payloadFingerprint ?? null,
    metadataFingerprint,
    producer: parsed.provenance.producer,
  }));
  return {
    ...parsed,
    contractVersion: MSSR_LIBRARIAN_CONTRACT_VERSION,
    contractKey,
    normalizedSourceRef: sourceRef,
    metadataFingerprint,
    recordFingerprint,
  };
}

function grouped<T>(records: readonly T[], keyOf: (record: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return groups;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function duplicateGroup(
  classification: MssrLibrarianDuplicateClass,
  key: string,
  records: readonly MssrLibrarianCatalogRecord[],
  explanation: string,
): MssrLibrarianDuplicateGroup {
  return {
    classification,
    deterministic: true,
    jevRequired: false,
    key,
    recordFingerprints: unique(records.map((record) => record.recordFingerprint)),
    contractKeys: unique(records.map((record) => record.contractKey)),
    sourceRefs: unique(records.map((record) => record.normalizedSourceRef)),
    explanation,
  };
}

function distinctRecordCount(records: readonly MssrLibrarianCatalogRecord[]): number {
  return new Set(records.map((record) => record.recordFingerprint)).size;
}

function distinctContractCount(records: readonly MssrLibrarianCatalogRecord[]): number {
  return new Set(records.map((record) => record.contractKey)).size;
}

/**
 * Deterministic catalog audit for data that already crossed the Librarian ingress
 * contract. Exact structural duplication is resolved here; semantic equivalence is
 * intentionally left to the semantic layer (for example Jev) when fingerprints differ.
 */
export function auditMssrLibrarianCatalog(inputs: readonly MssrLibrarianIngressRecord[]): {
  records: MssrLibrarianCatalogRecord[];
  audit: MssrLibrarianAudit;
} {
  const records = inputs.map(catalogMssrLibrarianRecord);
  const duplicateGroups: MssrLibrarianDuplicateGroup[] = [];

  for (const [key, group] of grouped(records, (record) => record.recordFingerprint)) {
    if (group.length < 2) continue;
    duplicateGroups.push(duplicateGroup(
      "exact-record",
      key,
      group,
      "The same normalized contract record crossed the ingress boundary more than once.",
    ));
  }

  for (const [key, group] of grouped(records, (record) => record.revision && record.payloadFingerprint
    ? `${record.namespace}:${record.kind}:${record.normalizedSourceRef}@${record.revision}:${record.payloadFingerprint}`
    : null)) {
    if (group.length < 2 || distinctContractCount(group) < 2) continue;
    duplicateGroups.push(duplicateGroup(
      "same-source-revision",
      key,
      group,
      "Different contract identities with the same namespace, kind, source revision, and payload fingerprint are deterministic aliases at the same evidence granularity.",
    ));
  }

  for (const [key, group] of grouped(records, (record) => record.payloadFingerprint ?? null)) {
    if (group.length < 2 || distinctContractCount(group) < 2) continue;
    duplicateGroups.push(duplicateGroup(
      "same-payload",
      key,
      group,
      "Different contract identities expose the same payload fingerprint; semantic judgment is unnecessary for exact payload equality.",
    ));
  }

  for (const [key, group] of grouped(records, (record) => record.metadataFingerprint)) {
    if (group.length < 2 || distinctContractCount(group) < 2) continue;
    duplicateGroups.push(duplicateGroup(
      "same-metadata",
      key,
      group,
      "Different contract identities expose byte-stable normalized metadata; the duplication is structural and does not require Jev.",
    ));
  }

  for (const [key, group] of grouped(records, (record) => record.contractKey)) {
    if (group.length < 2 || distinctRecordCount(group) < 2) continue;
    duplicateGroups.push(duplicateGroup(
      "identity-collision",
      key,
      group,
      "One stable contract identity arrived with different normalized evidence. This is a contract collision/revision conflict, not something Jev should silently resolve.",
    ));
  }

  duplicateGroups.sort((left, right) => left.classification.localeCompare(right.classification) || left.key.localeCompare(right.key));
  const count = (classification: MssrLibrarianDuplicateClass) => duplicateGroups.filter((group) => group.classification === classification).length;

  return {
    records,
    audit: {
      contractVersion: MSSR_LIBRARIAN_CONTRACT_VERSION,
      role: MSSR_LIBRARIAN_ROLE,
      inputRecords: inputs.length,
      catalogRecords: records.length,
      duplicateGroups,
      exactDuplicateGroups: count("exact-record"),
      sourceRevisionDuplicateGroups: count("same-source-revision"),
      payloadDuplicateGroups: count("same-payload"),
      metadataDuplicateGroups: count("same-metadata"),
      identityCollisionGroups: count("identity-collision"),
      deterministicDuplicateGroups: duplicateGroups.length,
      semanticComparisonBoundary: "different-normalized-evidence-requires-semantic-review",
      jevUsed: false,
      advisoryOnly: true,
      canonicalRewriteAllowed: false,
    },
  };
}

/**
 * First adapter into the Librarian contract: expose one Document Surface as a
 * document record plus one record per heading/section, without copying source text.
 */
export function librarianRecordsFromDocumentSurface(args: {
  surface: MssrDocumentSurface;
  producer?: string;
  host?: string;
  traceId?: string;
}): MssrLibrarianIngressRecord[] {
  const producer = args.producer ?? "document-surface";
  const provenance = {
    producer,
    ...(args.host ? { host: args.host } : {}),
    ...(args.traceId ? { traceId: args.traceId } : {}),
  };
  const document: MssrLibrarianIngressRecord = {
    namespace: "document",
    kind: "surface",
    identity: args.surface.sourceRef,
    sourceRef: args.surface.sourceRef,
    revision: args.surface.revision,
    payloadFingerprint: args.surface.revision,
    metadata: {
      title: args.surface.title,
      lineCount: args.surface.lineCount,
      charCount: args.surface.charCount,
      byteCount: args.surface.byteCount,
      headingCount: args.surface.headingCount,
      blockCount: args.surface.blockCount,
      maxHeadingLevel: args.surface.maxHeadingLevel,
    },
    provenance,
  };

  const sections = args.surface.headings.map<MssrLibrarianIngressRecord>((heading) => ({
    namespace: "document",
    kind: "section",
    identity: `${args.surface.sourceRef}#${heading.id}`,
    sourceRef: args.surface.sourceRef,
    revision: args.surface.revision,
    payloadFingerprint: heading.fingerprint,
    metadata: {
      level: heading.level,
      title: heading.title,
      headingPath: heading.headingPath,
      parentId: heading.parentId,
      startLine: heading.startLine,
      endLine: heading.endLine,
      chars: heading.chars,
      bytes: heading.bytes,
      directBlockCount: heading.directBlockCount,
      descendantHeadingCount: heading.descendantHeadingCount,
      terms: heading.terms,
    },
    provenance,
  }));

  return [document, ...sections];
}
