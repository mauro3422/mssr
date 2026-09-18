import crypto from "node:crypto";
import { z } from "zod";

export const MSSR_DOCUMENT_FRESHNESS_SCHEMA_VERSION = 1 as const;
export const MAX_DOCUMENT_FRESHNESS_DOCUMENTS = 64;
export const MAX_DOCUMENT_FRESHNESS_REFS = 64;
export const DEFAULT_DOCUMENT_FRESHNESS_MANIFEST_RELATIVE = ".mssr/document-freshness.json";

function addPathIssue(ctx: z.RefinementCtx, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}

/**
 * Document freshness is deliberately exact-path only. The contract is evidence
 * that a declared implementation/authority ref changed after a document's last
 * reviewed revision; it does not parse prose or claim that the document is
 * semantically wrong.
 */
export const documentFreshnessExactRefSchema = z.string().min(1).max(320).superRefine((value, ctx) => {
  if (value.includes("\\")) addPathIssue(ctx, "Document-freshness refs must use forward slashes.");
  if (value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:\//.test(value)) {
    addPathIssue(ctx, "Document-freshness refs must be project-relative, not absolute.");
  }
  if (value.includes("#")) addPathIssue(ctx, "Document-freshness refs must name exact files, not fragments.");
  if (/[*?\[\]{}!]/.test(value)) addPathIssue(ctx, "Document-freshness v1 does not allow glob or pattern refs.");
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    addPathIssue(ctx, "Document-freshness refs must be normalized exact paths without empty, '.' or '..' segments.");
  }
});

export const documentFreshnessIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);

export const documentFreshnessEntrySchema = z.object({
  documentId: documentFreshnessIdSchema,
  documentRef: documentFreshnessExactRefSchema,
  kind: z.enum(["roadmap", "handoff", "status", "guide", "other"]).default("other"),
  impactRefs: z.array(documentFreshnessExactRefSchema).min(1).max(MAX_DOCUMENT_FRESHNESS_REFS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.impactRefs.length; index += 1) {
    const ref = value.impactRefs[index];
    if (seen.has(ref)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate impactRef: ${ref}`, path: ["impactRefs", index] });
    }
    seen.add(ref);
  }
  if (seen.has(value.documentRef)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A document cannot depend on itself for freshness.", path: ["impactRefs"] });
  }
});

export const documentFreshnessManifestSchema = z.object({
  schemaVersion: z.literal(MSSR_DOCUMENT_FRESHNESS_SCHEMA_VERSION),
  documents: z.array(documentFreshnessEntrySchema).max(MAX_DOCUMENT_FRESHNESS_DOCUMENTS).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  const refs = new Set<string>();
  for (let index = 0; index < value.documents.length; index += 1) {
    const entry = value.documents[index];
    if (ids.has(entry.documentId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate documentId: ${entry.documentId}`, path: ["documents", index, "documentId"] });
    }
    if (refs.has(entry.documentRef)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate documentRef: ${entry.documentRef}`, path: ["documents", index, "documentRef"] });
    }
    ids.add(entry.documentId);
    refs.add(entry.documentRef);
  }
});

export const documentFreshnessRelationSchema = z.enum(["not-newer", "newer", "unknown"]);

export const documentFreshnessObservationSchema = z.object({
  documentId: documentFreshnessIdSchema,
  documentRef: documentFreshnessExactRefSchema,
  documentAvailable: z.boolean(),
  documentRevision: z.string().min(1).max(240).nullable().default(null),
  impactRefs: z.array(z.object({
    ref: documentFreshnessExactRefSchema,
    available: z.boolean(),
    revision: z.string().min(1).max(240).nullable().default(null),
    relationToDocument: documentFreshnessRelationSchema,
  }).strict()).max(MAX_DOCUMENT_FRESHNESS_REFS),
}).strict();

export const documentFreshnessEvaluationInputSchema = z.object({
  manifest: documentFreshnessManifestSchema,
  observations: z.array(documentFreshnessObservationSchema).max(MAX_DOCUMENT_FRESHNESS_DOCUMENTS),
}).strict();

export type DocumentFreshnessManifest = z.infer<typeof documentFreshnessManifestSchema>;
export type DocumentFreshnessObservation = z.infer<typeof documentFreshnessObservationSchema>;
export type DocumentFreshnessLevel = "ok" | "watch" | "review";
export type DocumentFreshnessFinding = {
  level: Exclude<DocumentFreshnessLevel, "ok">;
  code: "document-missing" | "document-observation-missing" | "impact-ref-missing" | "impact-ref-newer" | "freshness-unknown";
  documentId: string;
  documentRef: string;
  impactRef?: string;
  message: string;
};

export type DocumentFreshnessEvaluation = {
  schemaVersion: 1;
  level: DocumentFreshnessLevel;
  findings: DocumentFreshnessFinding[];
  reviewDocuments: string[];
  fingerprint: string;
  advisoryOnly: true;
  semanticContradictionProven: false;
  canonicalRewriteAllowed: false;
};

function levelRank(level: DocumentFreshnessLevel): number {
  return level === "review" ? 2 : level === "watch" ? 1 : 0;
}

export function evaluateDocumentFreshness(input: z.input<typeof documentFreshnessEvaluationInputSchema>): DocumentFreshnessEvaluation {
  const parsed = documentFreshnessEvaluationInputSchema.parse(input);
  const byId = new Map(parsed.observations.map((item) => [item.documentId, item]));
  const findings: DocumentFreshnessFinding[] = [];

  for (const entry of parsed.manifest.documents) {
    const observation = byId.get(entry.documentId);
    if (!observation || observation.documentRef !== entry.documentRef) {
      findings.push({
        level: "watch",
        code: "document-observation-missing",
        documentId: entry.documentId,
        documentRef: entry.documentRef,
        message: `No bounded freshness observation is available for ${entry.documentRef}; review status is unknown.`,
      });
      continue;
    }
    if (!observation.documentAvailable) {
      findings.push({
        level: "review",
        code: "document-missing",
        documentId: entry.documentId,
        documentRef: entry.documentRef,
        message: `Declared document ${entry.documentRef} is unavailable and requires review.`,
      });
      continue;
    }

    const observedByRef = new Map(observation.impactRefs.map((item) => [item.ref, item]));
    for (const impactRef of entry.impactRefs) {
      const impact = observedByRef.get(impactRef);
      if (!impact || !impact.available) {
        findings.push({
          level: "review",
          code: "impact-ref-missing",
          documentId: entry.documentId,
          documentRef: entry.documentRef,
          impactRef,
          message: `Declared freshness input ${impactRef} is unavailable; ${entry.documentRef} must be reviewed before its current-state claims are trusted.`,
        });
        continue;
      }
      if (impact.relationToDocument === "newer") {
        findings.push({
          level: "review",
          code: "impact-ref-newer",
          documentId: entry.documentId,
          documentRef: entry.documentRef,
          impactRef,
          message: `${impactRef} changed after the last reviewed revision of ${entry.documentRef}; the document is review-due. This does not prove a semantic contradiction.`,
        });
      } else if (impact.relationToDocument === "unknown") {
        findings.push({
          level: "watch",
          code: "freshness-unknown",
          documentId: entry.documentId,
          documentRef: entry.documentRef,
          impactRef,
          message: `Revision ordering between ${entry.documentRef} and ${impactRef} is unknown; review may be needed if current-state claims depend on it.`,
        });
      }
    }
  }

  let level: DocumentFreshnessLevel = "ok";
  for (const finding of findings) {
    if (levelRank(finding.level) > levelRank(level)) level = finding.level;
  }
  const reviewDocuments = [...new Set(findings.filter((item) => item.level === "review").map((item) => item.documentRef))].sort();
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
    level,
    findings: findings.map((item) => ({ level: item.level, code: item.code, documentRef: item.documentRef, impactRef: item.impactRef ?? null })),
  }), "utf8").digest("hex");

  return {
    schemaVersion: 1,
    level,
    findings,
    reviewDocuments,
    fingerprint,
    advisoryOnly: true,
    semanticContradictionProven: false,
    canonicalRewriteAllowed: false,
  };
}
