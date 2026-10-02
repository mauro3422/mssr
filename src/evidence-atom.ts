import { createHash } from "node:crypto";
import { z } from "zod";
import type { MssrLibrarianCatalogRecord } from "./librarian-contract.js";

export const MSSR_EVIDENCE_ATOM_SCHEMA_VERSION = 2 as const;

export const MSSR_EVIDENCE_FRESHNESS = [
  "unknown",
  "fresh",
  "stale",
  "historical",
  "superseded",
] as const;

export const MSSR_EVIDENCE_AUTHORITY_CLASSES = [
  "canonical",
  "observed",
  "inferred",
  "learned",
  "mixed",
] as const;

export const MSSR_EVIDENCE_SOURCE_CLASSES = [
  "canonical",
  "observed",
  "inferred",
  "learned",
  "mixed",
] as const;

export const MSSR_EVIDENCE_PRIVACY_CLASSES = [
  "project-metadata",
  "operational-metadata",
  "public-metadata",
  "sensitive-excluded",
] as const;

export const MSSR_EVIDENCE_SELECTION_STATES = [
  "unknown",
  "selected",
  "skipped",
] as const;

export const MSSR_EVIDENCE_OUTCOME_STATES = [
  "unknown",
  "positive",
  "negative",
  "neutral",
  "not-applicable",
] as const;

const boundedToken = z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9._:-]*$/);
const boundedText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\r\n]/.test(value));
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const atomId = z.string().regex(/^evidence-atom:[0-9a-f]{24}$/);
const safeAttributeText = z.string().max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:/#@+-]*$/);

export const mssrEvidenceAtomSourceRangeSchema = z.object({
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  startOffset: z.number().int().min(0).optional(),
  endOffset: z.number().int().min(0).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.endLine < value.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endLine"], message: "Evidence range endLine must be >= startLine." });
  }
  if ((value.startOffset === undefined) !== (value.endOffset === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startOffset"], message: "Evidence range offsets must be supplied together." });
  }
  if (value.startOffset !== undefined && value.endOffset !== undefined && value.endOffset < value.startOffset) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endOffset"], message: "Evidence range endOffset must be >= startOffset." });
  }
});

export const mssrEvidenceAtomSchema = z.object({
  schemaVersion: z.literal(MSSR_EVIDENCE_ATOM_SCHEMA_VERSION),
  id: atomId,
  subject: z.object({
    namespace: boundedToken,
    kind: boundedToken,
    identity: boundedText(400),
  }).strict(),
  source: z.object({
    ref: boundedText(1_000),
    revision: boundedText(256).optional(),
    freshness: z.enum(MSSR_EVIDENCE_FRESHNESS),
    headingPath: z.array(boundedText(240)).max(12).optional(),
    range: mssrEvidenceAtomSourceRangeSchema.optional(),
    freshnessEvidence: z.object({
      canonicalOwner: boundedText(240),
      ref: boundedText(1_000),
      revision: boundedText(256),
      observedAt: z.string().datetime({ offset: true }),
    }).strict().optional(),
  }).strict().superRefine((value, ctx) => {
    if ((value.headingPath || value.range) && !value.revision) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["revision"], message: "Revision is required for exact heading/range evidence." });
    }
    if (value.freshness === "fresh" && !value.freshnessEvidence) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["freshnessEvidence"], message: "Fresh evidence requires an exact host observation." });
    }
    if (value.freshnessEvidence && (value.freshnessEvidence.ref !== value.ref || value.freshnessEvidence.revision !== value.revision)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["freshnessEvidence"], message: "Freshness observation must match the exact source ref and revision." });
    }
  }),
  provenance: z.object({
    producer: boundedToken,
    sourceClass: z.enum(MSSR_EVIDENCE_SOURCE_CLASSES),
    canonicalOwner: boundedText(240),
    host: boundedText(120).optional(),
    traceId: boundedText(200).optional(),
    projectKey: boundedText(320).optional(),
  }).strict(),
  fingerprints: z.object({
    record: hex64,
    payload: boundedText(256).optional(),
    metadata: hex64.optional(),
  }).strict(),
  reasonCodes: z.array(boundedToken).max(24).default([]),
  lineage: z.object({
    parentAtomIds: z.array(atomId).max(16).default([]),
    relatedAtomIds: z.array(atomId).max(32).default([]),
    supersedesAtomIds: z.array(atomId).max(16).default([]),
  }).strict(),
  dedupeKey: boundedText(500),
  authorityClass: z.enum(MSSR_EVIDENCE_AUTHORITY_CLASSES),
  privacyClass: z.enum(MSSR_EVIDENCE_PRIVACY_CLASSES),
  usage: z.object({
    selection: z.enum(MSSR_EVIDENCE_SELECTION_STATES),
    consumed: z.boolean(),
    outcome: z.enum(MSSR_EVIDENCE_OUTCOME_STATES),
    reasonCodes: z.array(boundedToken).max(24).default([]),
  }).strict().superRefine((value, ctx) => {
    if (value.selection === "skipped" && value.consumed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["consumed"], message: "Skipped evidence cannot be marked consumed." });
    }
  }),
  attributes: z.record(z.string().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/), z.union([safeAttributeText, z.number().finite(), z.boolean(), z.null()])).superRefine((value, ctx) => {
    if (Object.keys(value).length > 32) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence atom attributes are limited to 32 entries." });
    }
  }).default({}),
  advisoryOnly: z.literal(true),
  canonicalRewriteAllowed: z.literal(false),
}).strict().superRefine((value, ctx) => {
  if (value.privacyClass === "sensitive-excluded") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["privacyClass"], message: "Sensitive-excluded evidence cannot be persisted as an atom." });
  }
  if (value.source.freshnessEvidence && value.source.freshnessEvidence.canonicalOwner !== value.provenance.canonicalOwner) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source", "freshnessEvidence", "canonicalOwner"], message: "Freshness observation owner must match the canonical owner." });
  }
});

export type MssrEvidenceAtom = z.infer<typeof mssrEvidenceAtomSchema>;

export type BuildMssrEvidenceAtomInput = Omit<MssrEvidenceAtom, "schemaVersion" | "id" | "advisoryOnly" | "canonicalRewriteAllowed">;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizedInput(input: BuildMssrEvidenceAtomInput): BuildMssrEvidenceAtomInput {
  return {
    ...input,
    subject: {
      ...input.subject,
      identity: input.subject.identity.trim(),
    },
    source: {
      ...input.source,
      ref: input.source.ref.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
      ...(input.source.freshnessEvidence ? { freshnessEvidence: {
        ...input.source.freshnessEvidence,
        ref: input.source.freshnessEvidence.ref.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
      } } : {}),
      ...(input.source.headingPath ? { headingPath: input.source.headingPath.map((item) => item.trim()) } : {}),
    },
    reasonCodes: uniqueSorted(input.reasonCodes),
    lineage: {
      parentAtomIds: uniqueSorted(input.lineage.parentAtomIds),
      relatedAtomIds: uniqueSorted(input.lineage.relatedAtomIds),
      supersedesAtomIds: uniqueSorted(input.lineage.supersedesAtomIds),
    },
    usage: {
      ...input.usage,
      reasonCodes: uniqueSorted(input.usage.reasonCodes),
    },
    attributes: Object.fromEntries(Object.entries(input.attributes).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export function buildMssrEvidenceAtom(input: BuildMssrEvidenceAtomInput): MssrEvidenceAtom {
  const normalized = normalizedInput(input);
  const identityProjection = {
    subject: normalized.subject,
    source: normalized.source,
    provenance: normalized.provenance,
    fingerprints: normalized.fingerprints,
    dedupeKey: normalized.dedupeKey,
  };
  const id = `evidence-atom:${sha256(stableJson(identityProjection)).slice(0, 24)}`;
  return mssrEvidenceAtomSchema.parse({
    schemaVersion: MSSR_EVIDENCE_ATOM_SCHEMA_VERSION,
    id,
    ...normalized,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
  });
}

/**
 * Project one already-normalized Librarian catalog record into the smaller
 * EvidenceAtom layer. Full Librarian metadata is intentionally not copied.
 */
export function evidenceAtomFromLibrarianCatalogRecord(args: {
  record: MssrLibrarianCatalogRecord;
  sourceClass: MssrEvidenceAtom["provenance"]["sourceClass"];
  canonicalOwner: string;
  authorityClass: MssrEvidenceAtom["authorityClass"];
  privacyClass: MssrEvidenceAtom["privacyClass"];
  freshness?: MssrEvidenceAtom["source"]["freshness"];
  freshnessEvidence?: MssrEvidenceAtom["source"]["freshnessEvidence"];
  headingPath?: string[];
  range?: MssrEvidenceAtom["source"]["range"];
  reasonCodes?: string[];
  lineage?: Partial<MssrEvidenceAtom["lineage"]>;
  usage?: Partial<MssrEvidenceAtom["usage"]>;
  projectKey?: string;
  attributes?: Record<string, string | number | boolean | null>;
}): MssrEvidenceAtom {
  const { record } = args;
  return buildMssrEvidenceAtom({
    subject: {
      namespace: record.namespace,
      kind: record.kind,
      identity: record.identity,
    },
    source: {
      ref: record.normalizedSourceRef,
      ...(record.revision ? { revision: record.revision } : {}),
      freshness: args.freshness ?? "unknown",
      ...(args.freshnessEvidence ? { freshnessEvidence: args.freshnessEvidence } : {}),
      ...(args.headingPath ? { headingPath: args.headingPath } : {}),
      ...(args.range ? { range: args.range } : {}),
    },
    provenance: {
      producer: record.provenance.producer,
      sourceClass: args.sourceClass,
      canonicalOwner: args.canonicalOwner,
      ...(record.provenance.host ? { host: record.provenance.host } : {}),
      ...(record.provenance.traceId ? { traceId: record.provenance.traceId } : {}),
      ...(args.projectKey ? { projectKey: args.projectKey } : {}),
    },
    fingerprints: {
      record: record.recordFingerprint,
      ...(record.payloadFingerprint ? { payload: record.payloadFingerprint } : {}),
      ...(record.metadataFingerprint ? { metadata: record.metadataFingerprint } : {}),
    },
    reasonCodes: args.reasonCodes ?? [],
    lineage: {
      parentAtomIds: args.lineage?.parentAtomIds ?? [],
      relatedAtomIds: args.lineage?.relatedAtomIds ?? [],
      supersedesAtomIds: args.lineage?.supersedesAtomIds ?? [],
    },
    dedupeKey: `librarian:${record.contractKey}:${record.revision ?? record.recordFingerprint}`,
    authorityClass: args.authorityClass,
    privacyClass: args.privacyClass,
    usage: {
      selection: args.usage?.selection ?? "unknown",
      consumed: args.usage?.consumed ?? false,
      outcome: args.usage?.outcome ?? "unknown",
      reasonCodes: args.usage?.reasonCodes ?? [],
    },
    attributes: args.attributes ?? {},
  });
}
