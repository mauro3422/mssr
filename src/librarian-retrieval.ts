import { createHash } from "node:crypto";
import { z } from "zod";
import { buildMssrMarkdownDocumentSurface, type MssrDocumentSurface, type MssrDocumentSurfaceBlock, type MssrDocumentSurfaceHeading } from "./document-surface.js";
import {
  MSSR_EVIDENCE_AUTHORITY_CLASSES,
  MSSR_EVIDENCE_FRESHNESS,
  MSSR_EVIDENCE_PRIVACY_CLASSES,
  MSSR_EVIDENCE_SOURCE_CLASSES,
  mssrEvidenceAtomSchema,
  type MssrEvidenceAtom,
} from "./evidence-atom.js";
import { catalogMssrLibrarianRecord, mssrLibrarianIngressRecordSchema, type MssrLibrarianCatalogRecord, type MssrLibrarianIngressRecord } from "./librarian-contract.js";
import { foldMssrLibrarianSearchText, foldMssrLibrarianSearchTextWithSourceOffsets } from "./librarian-text-normalization.js";
import { SKILL_ACTIONS, SKILL_ARTIFACTS, SKILL_DOMAINS, SKILL_NEEDS, SKILL_RISKS, SKILL_SIGNALS } from "./skill-routing.js";

export const MSSR_LIBRARIAN_RETRIEVAL_LIMITS = {
  queryChars: 500,
  maxDocuments: 32,
  maxTotalDocumentChars: 4_000_000,
  maxLinesPerDocument: 50_000,
  maxTotalLines: 100_000,
  maxHeadingsPerDocument: 512,
  maxTotalHeadings: 2_048,
  maxRecordsPerDocument: 512,
  maxTotalRecords: 2_048,
  maxEvidenceAtomsPerDocument: 512,
  maxTotalEvidenceAtoms: 2_048,
  maxRanges: 16_000,
  maxCandidates: 10_000,
  maxResults: 100,
  snippetChars: 240,
  fetchChars: 20_000,
} as const;
const searchableMetadataSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/), z.union([z.string().max(120), z.number().finite(), z.boolean()])).optional().superRefine((value, ctx) => {
  if (value && Object.keys(value).length > 64) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Searchable Librarian metadata is limited to 64 projected fields." });
  if (value && Object.keys(value).some((key) => /(?:prompt|transcript|raw|body|content|text|instruction|summary|description|note|secret|credential|private|reasoning|argument|token)/i.test(key))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Searchable Librarian metadata key looks like free-form or sensitive content." });
  }
});
export const mssrLibrarianRetrievalDocumentSchema = z.object({
  owner: z.string().trim().min(1).max(240),
  sourceRef: z.string().trim().min(1).max(1_000),
  markdown: z.string().max(2_000_000),
  surface: z.unknown().optional(),
  records: z.array(z.unknown()).max(MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRecordsPerDocument).optional(),
  evidenceAtoms: z.array(mssrEvidenceAtomSchema).max(MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxEvidenceAtomsPerDocument).optional(),
  searchableMetadata: searchableMetadataSchema,
  privacyClass: z.enum(["project-metadata", "operational-metadata", "public-metadata", "sensitive-excluded"]).default("project-metadata"),
}).strict();
export type MssrLibrarianRetrievalDocument = z.input<typeof mssrLibrarianRetrievalDocumentSchema>;

export const mssrLibrarianRetrievalQuerySchema = z.object({
  query: z.string().trim().min(1).max(MSSR_LIBRARIAN_RETRIEVAL_LIMITS.queryChars),
  owner: z.string().trim().min(1).max(240).optional(),
  sourceRef: z.string().trim().min(1).max(1_000).optional(),
  namespace: z.string().trim().min(1).max(80).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.union([z.string().max(240), z.number(), z.boolean()])).optional(),
  maxResults: z.number().int().min(1).max(MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxResults).default(20),
  maxSnippetChars: z.number().int().min(40).max(MSSR_LIBRARIAN_RETRIEVAL_LIMITS.snippetChars).default(160),
}).strict();
export type MssrLibrarianRetrievalQuery = z.input<typeof mssrLibrarianRetrievalQuerySchema>;

export const MSSR_LIBRARIAN_SEARCH_PROJECTION_SCHEMA_VERSION = 1 as const;
const mssrLibrarianSearchProjectionFields = [
  "authorityClass", "artifact", "domain", "freshness", "need", "privacyClass", "rangeKind", "risk", "signal", "sourceClass", "action",
] as const;
export type MssrLibrarianSearchProjectionField = typeof mssrLibrarianSearchProjectionFields[number];
export type MssrLibrarianSearchProjectionMatch = {
  schemaVersion: typeof MSSR_LIBRARIAN_SEARCH_PROJECTION_SCHEMA_VERSION;
  projectionFingerprint: string;
  atomId: MssrEvidenceAtom["id"];
  recordFingerprint: string;
  producer: string;
  provenanceIsCallerAsserted: true;
  matches: Array<{ field: MssrLibrarianSearchProjectionField; value: string; queryTerms: string[] }>;
  filterMatches?: Array<{ field: MssrLibrarianSearchProjectionField; value: string }>;
};

export const mssrLibrarianEvidenceHandleSchema = z.object({
  version: z.literal(1), id: z.string().regex(/^[0-9a-f]{64}$/), owner: z.string().min(1).max(240), sourceRef: z.string().min(1).max(1_000),
  revision: z.string().min(1).max(256), rangeId: z.string().min(1).max(120), rangeKind: z.enum(["section", "block"]),
  startLine: z.number().int().min(1), endLine: z.number().int().min(1),
  startOffset: z.number().int().min(0), endOffset: z.number().int().min(0), fingerprint: z.string().regex(/^[0-9a-f]{64}$/), privacyClass: z.enum(["project-metadata", "operational-metadata", "public-metadata"]),
}).strict().superRefine((value, ctx) => {
  if (value.endLine < value.startLine) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endLine"], message: "Evidence handle endLine must be >= startLine." });
});
export type MssrLibrarianEvidenceHandle = z.infer<typeof mssrLibrarianEvidenceHandleSchema>;

export type MssrLibrarianRetrievalResult = {
  handle: MssrLibrarianEvidenceHandle;
  score: number;
  title: string;
  headingPath: string[];
  snippet: string;
  metadata: Record<string, unknown>;
  evidenceTier: "candidate";
  advisoryOnly: true;
  truthAuthority: false;
  ownerAndPrivacyAreCallerAsserted: true;
  catalogProvenanceIsCallerAsserted: true;
  metadataProjectionMatches?: MssrLibrarianSearchProjectionMatch[];
};

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function normalizeRef(value: string): string { return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/"); }
function foldSearchText(value: string): string { return foldMssrLibrarianSearchText(value); }
function tokens(value: string): string[] { return [...new Set(foldSearchText(value).match(/[\p{L}\p{N}][\p{L}\p{N}_-]{1,}/gu) ?? [])]; }
function boundedSnippet(text: string, terms: readonly string[], maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const folded = foldMssrLibrarianSearchTextWithSourceOffsets(flat);
  const first = terms.map((term) => folded.normalized.indexOf(term)).filter((at) => at >= 0).sort((a, b) => a - b)[0];
  const sourceHit = first === undefined ? 0 : folded.starts[first] ?? 0;
  const points = Array.from(flat);
  const utf16Offsets: number[] = [0];
  for (const point of points) utf16Offsets.push(utf16Offsets.at(-1)! + point.length);
  let hitPoint = utf16Offsets.findIndex((offset) => offset >= sourceHit);
  if (hitPoint < 0) hitPoint = 0;
  const startPoint = Math.max(0, Math.min(hitPoint - Math.floor(maxChars / 4), Math.max(0, points.length - maxChars)));
  const prefix = startPoint > 0 ? "…" : "";
  let contentBudget = maxChars - prefix.length;
  let endPoint = Math.min(points.length, startPoint + contentBudget);
  if (endPoint < points.length) {
    contentBudget -= 1;
    endPoint = Math.min(points.length, startPoint + contentBudget);
  }
  return `${prefix}${points.slice(startPoint, endPoint).join("")}${endPoint < points.length ? "…" : ""}`;
}
function recordMetadata(records: readonly unknown[] | undefined, sourceRef: string, revision: string): MssrLibrarianCatalogRecord[] {
  const parsed: MssrLibrarianCatalogRecord[] = [];
  for (const raw of records ?? []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    // Catalog-only derived fields are deliberately stripped before strict ingress validation.
    const ingress = mssrLibrarianIngressRecordSchema.parse({
      namespace: item.namespace,
      kind: item.kind,
      identity: item.identity,
      sourceRef: item.sourceRef,
      ...(item.revision !== undefined ? { revision: item.revision } : {}),
      ...(item.payloadFingerprint !== undefined ? { payloadFingerprint: item.payloadFingerprint } : {}),
      ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
      provenance: item.provenance,
    });
    if (normalizeRef(ingress.sourceRef) !== sourceRef || (ingress.revision !== undefined && ingress.revision !== revision)) continue;
    // Re-catalogue caller data so forged derived fingerprints are not trusted.
    parsed.push(catalogMssrLibrarianRecord(ingress));
  }
  return parsed;
}
export function mssrLibrarianEvidenceHandleId(fields: Omit<MssrLibrarianEvidenceHandle, "id">): string {
  return sha256(JSON.stringify([fields.version, fields.owner, fields.sourceRef, fields.revision, fields.rangeId, fields.rangeKind, fields.startLine, fields.endLine, fields.startOffset, fields.endOffset, fields.fingerprint, fields.privacyClass]));
}
function sectionRanges(surface: MssrDocumentSurface): Array<{ id: string; kind: "section" | "block"; startOffset: number; endOffset: number; fingerprint: string; title: string; path: string[]; terms: string[]; hint: string; metadata: Record<string, unknown> }> {
  const headings = new Map(surface.headings.map((heading) => [heading.id, heading] as const));
  const headingRows = surface.headings.map((heading: MssrDocumentSurfaceHeading) => ({ id: heading.id, kind: "section" as const, startOffset: heading.startOffset, endOffset: heading.endOffset, fingerprint: heading.fingerprint, title: heading.title, path: heading.headingPath, terms: heading.terms, hint: heading.hint ?? "", metadata: { level: heading.level, headingPath: heading.headingPath, parentId: heading.parentId, startLine: heading.startLine, endLine: heading.endLine, chars: heading.chars, bytes: heading.bytes, terms: heading.terms } }));
  const blockRows = surface.blocks.map((block: MssrDocumentSurfaceBlock) => {
    const heading = block.sectionId ? headings.get(block.sectionId) : undefined;
    return { id: block.id, kind: "block" as const, startOffset: block.startOffset, endOffset: block.endOffset, fingerprint: block.fingerprint, title: heading?.title ?? surface.title ?? surface.sourceRef, path: heading?.headingPath ?? [], terms: block.terms, hint: block.hint, metadata: { blockKind: block.kind, sectionId: block.sectionId, startLine: block.startLine, endLine: block.endLine, chars: block.chars, bytes: block.bytes, terms: block.terms } };
  });
  return [...headingRows, ...blockRows];
}

type ProjectedAtomMetadata = {
  atom: MssrEvidenceAtom;
  projectionFingerprint: string;
  terms: Array<{ field: MssrLibrarianSearchProjectionField; value: string; tokens: string[] }>;
};

type MssrLibrarianRecordBinding = Pick<MssrLibrarianCatalogRecord,
  "namespace" | "kind" | "identity" | "normalizedSourceRef" | "revision" | "payloadFingerprint" | "provenance" | "recordFingerprint">;

function catalogRecordBindingKey(record: MssrLibrarianRecordBinding): string {
  return JSON.stringify([
    record.namespace,
    record.kind,
    record.identity,
    record.normalizedSourceRef,
    record.revision ?? null,
    record.payloadFingerprint ?? null,
    record.provenance.producer,
    record.recordFingerprint,
  ]);
}

function recordRangeKey(kind: string, identity: string, revision: string, payloadFingerprint: string): string {
  return JSON.stringify([kind, identity, revision, payloadFingerprint]);
}

function atomSubjectKey(namespace: string, kind: string, identity: string): string {
  return JSON.stringify([namespace, kind, identity]);
}

function closedAttributeValue(atom: MssrEvidenceAtom, field: MssrLibrarianSearchProjectionField): string | undefined {
  const value = atom.attributes[field];
  if (typeof value !== "string") return undefined;
  const vocabularies: Partial<Record<MssrLibrarianSearchProjectionField, readonly string[]>> = {
    authorityClass: MSSR_EVIDENCE_AUTHORITY_CLASSES,
    artifact: SKILL_ARTIFACTS,
    domain: SKILL_DOMAINS,
    freshness: MSSR_EVIDENCE_FRESHNESS,
    need: SKILL_NEEDS,
    privacyClass: MSSR_EVIDENCE_PRIVACY_CLASSES.filter((candidate) => candidate !== "sensitive-excluded"),
    rangeKind: ["section", "block"],
    risk: SKILL_RISKS,
    signal: SKILL_SIGNALS,
    sourceClass: MSSR_EVIDENCE_SOURCE_CLASSES,
    action: SKILL_ACTIONS,
  };
  return vocabularies[field]?.includes(value) ? value : undefined;
}

function projectedAtomMetadata(args: {
  atom: MssrEvidenceAtom;
  owner: string;
  sourceRef: string;
  revision: string;
  privacyClass: "project-metadata" | "operational-metadata" | "public-metadata" | "sensitive-excluded";
  range: ReturnType<typeof sectionRanges>[number];
  recordBindings: ReadonlySet<string>;
}): ProjectedAtomMetadata | null {
  const { atom, range, recordBindings } = args;
  const startLine = range.metadata.startLine;
  const endLine = range.metadata.endLine;
  if (typeof startLine !== "number" || typeof endLine !== "number") return null;
  const sourceRange = atom.source.range;
  if (!sourceRange || sourceRange.startOffset === undefined || sourceRange.endOffset === undefined) return null;
  if (atom.provenance.canonicalOwner !== args.owner || atom.privacyClass === "sensitive-excluded" || atom.privacyClass !== args.privacyClass) return null;
  if (atom.privacyClass !== "project-metadata" && atom.privacyClass !== "operational-metadata" && atom.privacyClass !== "public-metadata") return null;
  if (atom.source.ref !== args.sourceRef || atom.source.revision !== args.revision) return null;
  if (atom.subject.kind !== range.kind) return null;
  if (atom.fingerprints.payload !== range.fingerprint) return null;
  if (sourceRange.startLine !== startLine || sourceRange.endLine !== endLine || sourceRange.startOffset !== range.startOffset || sourceRange.endOffset !== range.endOffset) return null;

  if (!recordBindings.has(catalogRecordBindingKey({
    namespace: atom.subject.namespace,
    kind: atom.subject.kind,
    identity: atom.subject.identity,
    normalizedSourceRef: args.sourceRef,
    revision: args.revision,
    payloadFingerprint: range.fingerprint,
    provenance: { producer: atom.provenance.producer },
    recordFingerprint: atom.fingerprints.record,
  }))) return null;

  const fields: Array<{ field: MssrLibrarianSearchProjectionField; value: string }> = [
    { field: "authorityClass", value: atom.authorityClass },
    { field: "freshness", value: atom.source.freshness },
    { field: "privacyClass", value: atom.privacyClass },
    { field: "sourceClass", value: atom.provenance.sourceClass },
    ...mssrLibrarianSearchProjectionFields
      .filter((field) => !["authorityClass", "freshness", "privacyClass", "rangeKind", "sourceClass"].includes(field))
      .flatMap((field) => {
        const value = closedAttributeValue(atom, field);
        return value === undefined ? [] : [{ field, value }];
      }),
    { field: "rangeKind", value: range.kind },
  ];
  const uniqueFields = [...new Map(fields.map((entry) => [`${entry.field}:${entry.value}`, entry])).values()]
    .sort((left, right) => left.field.localeCompare(right.field) || left.value.localeCompare(right.value));
  const identity = {
    schemaVersion: MSSR_LIBRARIAN_SEARCH_PROJECTION_SCHEMA_VERSION,
    owner: args.owner,
    sourceRef: args.sourceRef,
    revision: args.revision,
    rangeId: range.id,
    rangeKind: range.kind,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    payloadFingerprint: range.fingerprint,
    privacyClass: args.privacyClass,
    atomId: atom.id,
    recordFingerprint: atom.fingerprints.record,
    producer: atom.provenance.producer,
    fields: uniqueFields,
  };
  return {
    atom,
    projectionFingerprint: sha256(JSON.stringify(identity)),
    terms: uniqueFields.map((entry) => ({ field: entry.field, value: entry.value, tokens: tokens(entry.value) })),
  };
}

function prepareMarkdown(markdown: string): { canonicalMarkdown: string; lineCount: number; potentialHeadingCount: number } {
  if (typeof markdown !== "string" || markdown.length > 2_000_000) throw new Error("Librarian retrieval source must be Markdown text up to 2,000,000 characters.");
  const canonicalMarkdown = markdown.replace(/\r\n?/g, "\n");
  let lineCount = 1;
  let potentialHeadingCount = 0;
  for (const line of canonicalMarkdown.split("\n")) {
    if (lineCount > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxLinesPerDocument) throw new Error(`Librarian retrieval document exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxLinesPerDocument} lines.`);
    if (/^ {0,3}#{1,6}\s+\S/.test(line)) {
      potentialHeadingCount += 1;
      if (potentialHeadingCount > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxHeadingsPerDocument) {
        throw new Error(`Librarian retrieval document exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxHeadingsPerDocument} potential headings.`);
      }
    }
    lineCount += 1;
  }
  return { canonicalMarkdown, lineCount, potentialHeadingCount };
}

export function searchMssrLibrarianEvidence(args: { documents: readonly MssrLibrarianRetrievalDocument[]; query: MssrLibrarianRetrievalQuery }): { results: MssrLibrarianRetrievalResult[]; advisoryOnly: true; truthAuthority: false; truncated: boolean } {
  const query = mssrLibrarianRetrievalQuerySchema.parse(args.query);
  if (args.documents.length > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxDocuments) throw new Error(`Librarian retrieval accepts at most ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxDocuments} documents.`);
  let suppliedChars = 0;
  let suppliedRecords = 0;
  let suppliedEvidenceAtoms = 0;
  for (const input of args.documents) {
    const value = input as unknown as { markdown?: unknown; records?: unknown; evidenceAtoms?: unknown };
    if (typeof value?.markdown === "string") {
      if (value.markdown.length > 2_000_000) throw new Error("Librarian retrieval source exceeds 2,000,000 characters.");
      suppliedChars += value.markdown.length;
      if (suppliedChars > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalDocumentChars) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalDocumentChars} total characters.`);
    }
    if (Array.isArray(value?.records)) {
      if (value.records.length > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRecordsPerDocument) throw new Error(`Librarian retrieval accepts at most ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRecordsPerDocument} records per document.`);
      suppliedRecords += value.records.length;
      if (suppliedRecords > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalRecords) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalRecords} total records.`);
    }
    if (Array.isArray(value?.evidenceAtoms)) {
      if (value.evidenceAtoms.length > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxEvidenceAtomsPerDocument) throw new Error(`Librarian retrieval accepts at most ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxEvidenceAtomsPerDocument} evidence atoms per document.`);
      suppliedEvidenceAtoms += value.evidenceAtoms.length;
      if (suppliedEvidenceAtoms > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalEvidenceAtoms) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalEvidenceAtoms} total evidence atoms.`);
    }
  }
  const documents = args.documents.map((input) => mssrLibrarianRetrievalDocumentSchema.parse(input));
  let totalChars = 0;
  let totalLines = 0;
  let totalRecords = 0;
  let totalHeadings = 0;
  const preparedDocuments: Array<(typeof documents)[number] & { canonicalMarkdown: string }> = [];
  for (const doc of documents) {
    const prepared = prepareMarkdown(doc.markdown);
    totalChars += prepared.canonicalMarkdown.length;
    totalLines += prepared.lineCount;
    totalHeadings += prepared.potentialHeadingCount;
    totalRecords += doc.records?.length ?? 0;
    if (totalChars > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalDocumentChars) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalDocumentChars} total characters.`);
    if (totalLines > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalLines) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalLines} total lines.`);
    if (totalHeadings > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalHeadings) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalHeadings} potential headings.`);
    if (totalRecords > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalRecords) throw new Error(`Librarian retrieval input exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalRecords} total records.`);
    preparedDocuments.push({ ...doc, canonicalMarkdown: prepared.canonicalMarkdown });
  }
  const queryTerms = tokens(query.query);
  if (queryTerms.length === 0) return { results: [], advisoryOnly: true, truthAuthority: false, truncated: false };
  const candidates: MssrLibrarianRetrievalResult[] = [];
  let totalRanges = 0;
  for (const doc of preparedDocuments) {
    const sourceRef = normalizeRef(doc.sourceRef);
    if (query.owner && query.owner !== doc.owner) continue;
    if (query.sourceRef && normalizeRef(query.sourceRef) !== sourceRef) continue;
    // Always derive from the current caller-provided source; an optional supplied surface is never trusted.
    const canonicalMarkdown = doc.canonicalMarkdown;
    const surface = buildMssrMarkdownDocumentSurface({ sourceRef, markdown: canonicalMarkdown });
    const revision = surface.revision;
    if (doc.privacyClass === "sensitive-excluded") continue;
    const records = recordMetadata(doc.records, sourceRef, revision);
    const evidenceAtoms = doc.evidenceAtoms ?? [];
    const recordsByRange = new Map<string, Map<string, MssrLibrarianCatalogRecord>>();
    for (const record of records) {
      if (record.kind === "surface" || record.revision !== revision || !record.payloadFingerprint) continue;
      const key = recordRangeKey(record.kind, record.identity, revision, record.payloadFingerprint);
      const group = recordsByRange.get(key) ?? new Map<string, MssrLibrarianCatalogRecord>();
      group.set(catalogRecordBindingKey(record), record);
      recordsByRange.set(key, group);
    }
    const atomsBySubject = new Map<string, MssrEvidenceAtom[]>();
    for (const atom of evidenceAtoms) {
      const key = atomSubjectKey(atom.subject.namespace, atom.subject.kind, atom.subject.identity);
      const group = atomsBySubject.get(key) ?? [];
      group.push(atom);
      atomsBySubject.set(key, group);
    }
    const sections = sectionRanges(surface);
    totalRanges += sections.length;
    if (sections.length > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRanges || totalRanges > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRanges) {
      throw new Error(`Librarian retrieval exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRanges} indexed ranges.`);
    }
    for (const range of sections) {
      // Exact range keys avoid rescanning every record for every indexed range.
      const attachedByBinding = new Map<string, MssrLibrarianCatalogRecord>();
      for (const identity of new Set([`${sourceRef}#${range.id}`, `${doc.sourceRef}#${range.id}`])) {
        const key = recordRangeKey(range.kind, identity, revision, range.fingerprint);
        for (const [binding, record] of recordsByRange.get(key) ?? []) attachedByBinding.set(binding, record);
      }
      const attached = [...attachedByBinding.values()];
      const recordBindings = new Set(attachedByBinding.keys());
      const projectedByFingerprint = new Map<string, ProjectedAtomMetadata>();
      const projectedSubjects = new Set(attached.map((record) => atomSubjectKey(record.namespace, record.kind, record.identity)));
      for (const subject of projectedSubjects) {
        for (const atom of atomsBySubject.get(subject) ?? []) {
          const projected = projectedAtomMetadata({ atom, owner: doc.owner, sourceRef, revision, privacyClass: doc.privacyClass, range, recordBindings });
          if (projected) projectedByFingerprint.set(projected.projectionFingerprint, projected);
        }
      }
      const projectedAtoms = [...projectedByFingerprint.values()];
      const projectedTerms = projectedAtoms.flatMap((projected) => projected.terms);
      const metadata: Record<string, unknown> = { sourceRef, revision, headingPath: range.path, ...range.metadata };
      if (query.namespace && !attached.some((record) => record.namespace === query.namespace)) continue;
      if (query.kind && !attached.some((record) => record.kind === query.kind)) continue;
      if (query.metadata && !Object.entries(query.metadata).every(([key, value]) => metadata[key] === value
        || doc.searchableMetadata?.[key] === value
        || projectedAtoms.some((projected) => projected.terms.some((term) => term.field === key && term.value === value)))) continue;
      const body = canonicalMarkdown.slice(range.startOffset, range.endOffset);
      const searchText = [range.title, range.path.join(" "), range.terms.join(" "), range.hint, body, JSON.stringify(metadata), JSON.stringify(doc.searchableMetadata ?? {}), projectedTerms.flatMap((term) => [term.value, ...term.tokens]).join(" ")].join(" ");
      const searchTerms = new Set(tokens(searchText));
      const matched = queryTerms.filter((term) => searchTerms.has(term));
      if (matched.length === 0) continue;
      const score = Number((matched.length / queryTerms.length).toFixed(6));
      const metadataProjectionMatches = projectedAtoms.flatMap((projected) => {
        const matches = projected.terms.flatMap((term) => {
          const queryMatches = queryTerms.filter((queryTerm) => term.tokens.includes(queryTerm));
          return queryMatches.length > 0 ? [{ field: term.field, value: term.value, queryTerms: queryMatches }] : [];
        });
        const filterMatches = Object.entries(query.metadata ?? {}).flatMap(([field, value]) =>
          typeof value === "string" && projected.terms.some((term) => term.field === field && term.value === value)
            ? [{ field: field as MssrLibrarianSearchProjectionField, value }]
            : [],
        );
        if (matches.length === 0 && filterMatches.length === 0) return [];
        return [{
          schemaVersion: MSSR_LIBRARIAN_SEARCH_PROJECTION_SCHEMA_VERSION,
          projectionFingerprint: projected.projectionFingerprint,
          atomId: projected.atom.id,
          recordFingerprint: projected.atom.fingerprints.record,
          producer: projected.atom.provenance.producer,
          provenanceIsCallerAsserted: true as const,
          matches,
          ...(filterMatches.length > 0 ? { filterMatches } : {}),
        }];
      });
      const handleFields = { version: 1 as const, owner: doc.owner, sourceRef, revision, rangeId: range.id, rangeKind: range.kind, startLine: range.metadata.startLine as number, endLine: range.metadata.endLine as number, startOffset: range.startOffset, endOffset: range.endOffset, fingerprint: range.fingerprint, privacyClass: doc.privacyClass as MssrLibrarianEvidenceHandle["privacyClass"] };
      const handle = mssrLibrarianEvidenceHandleSchema.parse({ ...handleFields, id: mssrLibrarianEvidenceHandleId(handleFields) });
      if (candidates.length >= MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxCandidates) throw new Error(`Librarian retrieval exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxCandidates} matching candidates.`);
      candidates.push({ handle, score, title: range.title.slice(0, 240), headingPath: range.path.slice(0, 12), snippet: boundedSnippet(body, queryTerms, query.maxSnippetChars), metadata, ...(metadataProjectionMatches.length > 0 ? { metadataProjectionMatches } : {}), evidenceTier: "candidate", advisoryOnly: true, truthAuthority: false, ownerAndPrivacyAreCallerAsserted: true, catalogProvenanceIsCallerAsserted: true });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.handle.owner.localeCompare(b.handle.owner) || a.handle.sourceRef.localeCompare(b.handle.sourceRef) || a.handle.startOffset - b.handle.startOffset || a.handle.id.localeCompare(b.handle.id));
  return { results: candidates.slice(0, query.maxResults), advisoryOnly: true, truthAuthority: false, truncated: candidates.length > query.maxResults };
}

export function fetchMssrLibrarianEvidence(args: { handle: MssrLibrarianEvidenceHandle; owner: string; sourceRef: string; markdown: string; privacyClass: MssrLibrarianEvidenceHandle["privacyClass"] | "sensitive-excluded" }): { handle: MssrLibrarianEvidenceHandle; text: string; fingerprint: string; advisoryOnly: true; truthAuthority: false } {
  const handle = mssrLibrarianEvidenceHandleSchema.parse(args.handle);
  if (args.privacyClass === "sensitive-excluded") throw new Error("Librarian evidence fetch refused by privacy policy.");
  if (args.privacyClass !== handle.privacyClass) throw new Error("Evidence handle privacy classification mismatch.");
  const { id, ...fields } = handle;
  if (id !== mssrLibrarianEvidenceHandleId(fields)) throw new Error("Evidence handle id mismatch.");
  if (args.owner !== handle.owner || normalizeRef(args.sourceRef) !== handle.sourceRef) throw new Error("Evidence handle owner/source identity mismatch.");
  const { canonicalMarkdown, potentialHeadingCount } = prepareMarkdown(args.markdown);
  if (potentialHeadingCount > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxHeadingsPerDocument) throw new Error(`Librarian retrieval fetch exceeds ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxHeadingsPerDocument} potential headings.`);
  const surface = buildMssrMarkdownDocumentSurface({ sourceRef: normalizeRef(args.sourceRef), markdown: canonicalMarkdown });
  if (surface.revision !== handle.revision) throw new Error("Evidence handle is stale for the caller-provided source revision.");
  const ranges = sectionRanges(surface);
  const range = ranges.find((item) => item.id === handle.rangeId && item.kind === handle.rangeKind);
  if (!range || range.startOffset !== handle.startOffset || range.endOffset !== handle.endOffset
    || range.metadata.startLine !== handle.startLine || range.metadata.endLine !== handle.endLine
    || range.fingerprint !== handle.fingerprint) throw new Error("Evidence handle range or fingerprint mismatch.");
  const text = canonicalMarkdown.slice(range.startOffset, range.endOffset).slice(0, MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars);
  if (text.length !== range.endOffset - range.startOffset) throw new Error("Exact evidence range exceeds fetch size limit.");
  return { handle, text, fingerprint: range.fingerprint, advisoryOnly: true, truthAuthority: false };
}
