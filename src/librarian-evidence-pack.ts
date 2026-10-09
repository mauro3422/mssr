import { z } from "zod";
import {
  MSSR_LIBRARIAN_RETRIEVAL_LIMITS,
  fetchMssrLibrarianEvidence,
  mssrLibrarianEvidenceHandleSchema,
  type MssrLibrarianEvidenceHandle,
} from "./librarian-retrieval.js";

export const MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS = {
  maxDocuments: 16,
  maxHandles: 16,
  maxTotalMarkdownChars: 4_000_000,
  maxTotalFetchedChars: 80_000,
} as const;

const evidencePackDocumentSchema = z.object({
  owner: z.string().trim().min(1).max(240),
  sourceRef: z.string().trim().min(1).max(1_000),
  markdown: z.string().max(2_000_000),
  privacyClass: z.enum(["project-metadata", "operational-metadata", "public-metadata", "sensitive-excluded"]),
}).strict();

function normalizeSourceRef(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function sourceKey(owner: string, sourceRef: string): string {
  return `${owner}\u0000${normalizeSourceRef(sourceRef)}`;
}

export const mssrLibrarianEvidencePackInputSchema = z.object({
  documents: z.array(evidencePackDocumentSchema).min(1).max(MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxDocuments),
  handles: z.array(mssrLibrarianEvidenceHandleSchema).min(1).max(MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxHandles),
}).strict().superRefine((value, ctx) => {
  const totalMarkdownChars = value.documents.reduce((total, document) => total + document.markdown.length, 0);
  if (totalMarkdownChars > MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalMarkdownChars) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: `Evidence pack source Markdown is capped at ${MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalMarkdownChars} total characters.` });
  }

  const documentsBySource = new Map<string, number>();
  value.documents.forEach((document, index) => {
    const key = sourceKey(document.owner, document.sourceRef);
    if (documentsBySource.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents", index], message: "Evidence pack documents must have unique normalized owner/source identities." });
    } else {
      documentsBySource.set(key, index);
    }
  });

  const seenHandles = new Set<string>();
  const referencedDocuments = new Set<number>();
  let totalFetchedChars = 0;
  value.handles.forEach((handle, index) => {
    if (seenHandles.has(handle.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["handles", index, "id"], message: "Evidence pack handle ids must be unique." });
    }
    seenHandles.add(handle.id);

    const documentIndex = documentsBySource.get(sourceKey(handle.owner, handle.sourceRef));
    if (documentIndex === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["handles", index], message: "Every evidence handle must bind to one supplied owner/source Markdown document." });
      return;
    }
    referencedDocuments.add(documentIndex);

    const exactRangeChars = handle.endOffset - handle.startOffset;
    if (exactRangeChars < 0 || exactRangeChars > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["handles", index], message: `Evidence pack ranges must be non-negative and no larger than ${MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars} characters.` });
    }
    totalFetchedChars += Math.max(0, exactRangeChars);
  });

  if (referencedDocuments.size !== value.documents.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: "Every supplied evidence pack document must be referenced by at least one exact handle." });
  }
  if (totalFetchedChars > MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalFetchedChars) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["handles"], message: `Evidence pack output is capped at ${MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalFetchedChars} exact-text characters.` });
  }
});

export type MssrLibrarianEvidencePackInput = z.input<typeof mssrLibrarianEvidencePackInputSchema>;

export type MssrLibrarianEvidencePackParagraph = {
  ordinal: number;
  exactText: string;
  citation: {
    display: string;
    handleId: string;
    owner: string;
    sourceRef: string;
    revision: string;
    rangeId: string;
    rangeKind: "section" | "block";
    startLine: number;
    endLine: number;
    fingerprint: string;
    privacyClass: MssrLibrarianEvidenceHandle["privacyClass"];
  };
};

/** Re-fetch and pack exact caller-owned source ranges as cited, read-only evidence. */
export function buildMssrLibrarianEvidencePack(input: MssrLibrarianEvidencePackInput) {
  const parsed = mssrLibrarianEvidencePackInputSchema.parse(input);
  const documents = new Map(parsed.documents.map((document) => [sourceKey(document.owner, document.sourceRef), document]));
  const paragraphs: MssrLibrarianEvidencePackParagraph[] = [];

  for (const handle of parsed.handles) {
    const document = documents.get(sourceKey(handle.owner, handle.sourceRef));
    if (!document) throw new Error("Evidence pack handle source is missing from the supplied documents.");
    const fetched = fetchMssrLibrarianEvidence({
      handle,
      owner: document.owner,
      sourceRef: document.sourceRef,
      markdown: document.markdown,
      privacyClass: document.privacyClass,
    });
    paragraphs.push({
      ordinal: paragraphs.length + 1,
      exactText: fetched.text,
      citation: {
        display: `${handle.sourceRef}:L${handle.startLine}-L${handle.endLine}`,
        handleId: handle.id,
        owner: handle.owner,
        sourceRef: handle.sourceRef,
        revision: handle.revision,
        rangeId: handle.rangeId,
        rangeKind: handle.rangeKind,
        startLine: handle.startLine,
        endLine: handle.endLine,
        fingerprint: fetched.fingerprint,
        privacyClass: handle.privacyClass,
      },
    });
  }

  const totalFetchedChars = paragraphs.reduce((total, paragraph) => total + paragraph.exactText.length, 0);
  if (totalFetchedChars > MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalFetchedChars) {
    throw new Error(`Evidence pack output is capped at ${MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxTotalFetchedChars} exact-text characters.`);
  }

  return {
    schemaVersion: 1 as const,
    kind: "mssr-librarian-evidence-pack" as const,
    assembly: "verbatim-source-ranges" as const,
    paragraphs,
    totalFetchedChars,
    advisoryOnly: true as const,
    truthAuthority: false as const,
    canonicalRewriteAllowed: false as const,
    ownerAndPrivacyAreCallerAsserted: true as const,
  };
}
