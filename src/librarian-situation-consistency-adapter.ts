import { createHash } from "node:crypto";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  evaluateMssrSituationModel,
  type MssrSituationModelInput,
  type MssrSituationObservation,
} from "./situation-model.js";
import {
  evaluateMssrSemanticConsistency,
  type MssrSemanticConsistencyFinding,
} from "./semantic-consistency.js";
import type { MssrSituationSemanticClaimInput } from "./situation-claims.js";
import type { MssrSemanticRelationInput } from "./semantic-relations.js";
import {
  evaluateDocumentFreshness,
  type DocumentFreshnessEvaluation,
  type DocumentFreshnessManifest,
  type DocumentFreshnessObservation,
} from "./document-freshness.js";
import {
  architectureImpactProjectionSchema,
  type ArchitectureImpactProjection,
} from "./architecture-impact-projection.js";
import type { MssrConsistencyBoundary } from "./consistency-projection.js";

const MAX_ADAPTER_ID = 160;

function boundedId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ADAPTER_ID || /[\r\n]/.test(trimmed)) {
    throw new Error(`${label} must be a bounded single-line identifier (1-${MAX_ADAPTER_ID} chars).`);
  }
  return trimmed;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function provenance(args: { host?: string; traceId?: string }) {
  return {
    producer: "situation-consistency",
    ...(args.host ? { host: boundedId(args.host, "host") } : {}),
    ...(args.traceId ? { traceId: boundedId(args.traceId, "traceId") } : {}),
  };
}

function safeSituationObservation(observation: MssrSituationObservation & { confidence?: number }) {
  return {
    key: observation.key,
    observer: observation.observer,
    role: observation.role,
    authority: observation.authority,
    state: observation.state,
    revision: observation.revision ?? null,
    required: observation.required,
    category: observation.category,
    evidenceClass: observation.evidenceClass,
    confidence: observation.confidence ?? null,
    sourceRef: observation.sourceRef ?? null,
    valuePresent: observation.value !== undefined,
  };
}

function safeSemanticEvidence(evidence: MssrSemanticConsistencyFinding["sourceB"] | null) {
  if (!evidence) return null;
  return {
    source: evidence.source,
    sourceRef: evidence.sourceRef,
    authority: evidence.authority,
    validity: evidence.validity,
    scope: evidence.scope,
    extractor: evidence.extractor,
    observedAt: evidence.observedAt ?? null,
    revision: evidence.revision ?? null,
    valuePresent: evidence.value !== undefined,
  };
}

/**
 * Catalog one bounded Situation Model snapshot. Comparable scalar values are
 * intentionally represented only by a presence bit; the canonical/evaluated
 * owner retains the actual value. Free-form recovery recommendations never cross
 * this adapter.
 */
export function librarianRecordFromSituationModel(args: {
  snapshotId: string;
  input: MssrSituationModelInput;
  host?: string;
  traceId?: string;
}): MssrLibrarianIngressRecord {
  const snapshotId = boundedId(args.snapshotId, "snapshotId");
  const result = evaluateMssrSituationModel(args.input);
  const metadata = {
    boundary: result.boundary,
    observations: result.observations.map(safeSituationObservation),
    classification: {
      noticeClass: result.classification.noticeClass,
      primaryCategory: result.classification.primaryCategory,
      categories: result.classification.categories,
      level: result.classification.level,
      priority: result.classification.priority,
      advisoryOnly: result.classification.advisoryOnly,
    },
    mismatchCount: result.decision.mismatches.length,
    abstained: result.decision.recommendationMode === "abstain",
  };
  return {
    namespace: "consistency",
    kind: "situation-model",
    identity: snapshotId,
    sourceRef: `situation/${snapshotId}`,
    payloadFingerprint: sha256(JSON.stringify(metadata)),
    metadata,
    provenance: provenance(args),
  };
}

/**
 * Evaluate deterministic R4 semantic consistency and catalog only typed finding
 * identity/provenance. Comparable values and recommended-action prose remain at
 * the owning evaluator/source and are never copied into Librarian metadata.
 */
export function librarianRecordsFromSemanticConsistency(args: {
  evaluationId: string;
  boundary?: MssrConsistencyBoundary;
  claims: readonly MssrSituationSemanticClaimInput[];
  relations?: readonly MssrSemanticRelationInput[];
  availableRefs?: readonly string[];
  host?: string;
  traceId?: string;
}): MssrLibrarianIngressRecord[] {
  const evaluationId = boundedId(args.evaluationId, "evaluationId");
  const evaluation = evaluateMssrSemanticConsistency({
    boundary: args.boundary,
    claims: args.claims,
    relations: args.relations,
    availableRefs: args.availableRefs,
  });

  const summary: MssrLibrarianIngressRecord = {
    namespace: "consistency",
    kind: "semantic-evaluation",
    identity: evaluationId,
    sourceRef: `semantic-consistency/${evaluationId}`,
    metadata: {
      boundary: evaluation.boundary,
      activeClaimCount: evaluation.activeClaims.length,
      inactiveClaimCount: evaluation.inactiveClaims.length,
      findingCount: evaluation.findings.length,
      unresolvedReferenceCount: evaluation.unresolvedReferences.length,
      relationCandidateCount: evaluation.relationCandidateCount,
      contradictionProven: evaluation.contradictionProven,
      blocksPublication: evaluation.blocksPublication,
      advisoryOnly: evaluation.advisoryOnly,
      canonicalRewriteAllowed: evaluation.canonicalRewriteAllowed,
    },
    provenance: provenance(args),
  };

  const findings = evaluation.findings.map<MssrLibrarianIngressRecord>((finding, index) => {
    const metadata = {
      type: finding.type,
      subject: finding.subject,
      scope: finding.scope,
      evidenceTier: finding.evidenceTier,
      sourceA: safeSemanticEvidence(finding.sourceA),
      sourceB: safeSemanticEvidence(finding.sourceB),
      reasonCode: finding.reasonCode,
      severity: finding.severity,
      blocksPublication: finding.blocksPublication,
      advisoryOnly: finding.advisoryOnly,
      relationId: finding.relationId ?? null,
      relationKind: finding.relationKind ?? null,
      recommendedActionCount: finding.recommendedActions.length,
    };
    const fingerprint = sha256(JSON.stringify(metadata));
    return {
      namespace: "consistency",
      kind: "semantic-finding",
      identity: `${evaluationId}:${index + 1}:${fingerprint.slice(0, 16)}`,
      sourceRef: `semantic-consistency/${evaluationId}`,
      payloadFingerprint: fingerprint,
      metadata,
      provenance: provenance(args),
    };
  });

  return [summary, ...findings];
}

/**
 * Catalog Document Freshness findings without retaining generated human-facing
 * messages. Exact document/impact refs and the evaluator fingerprint are enough
 * for later evidence acquisition from the canonical owner.
 */
export function librarianRecordsFromDocumentFreshness(args: {
  evaluationId: string;
  manifest: DocumentFreshnessManifest;
  observations: readonly DocumentFreshnessObservation[];
  host?: string;
  traceId?: string;
}): MssrLibrarianIngressRecord[] {
  const evaluationId = boundedId(args.evaluationId, "evaluationId");
  const evaluation: DocumentFreshnessEvaluation = evaluateDocumentFreshness({
    manifest: args.manifest,
    observations: args.observations.map((observation) => ({
      ...observation,
      impactRefs: observation.impactRefs.map((impact) => ({ ...impact })),
    })),
  });

  const summary: MssrLibrarianIngressRecord = {
    namespace: "consistency",
    kind: "document-freshness-evaluation",
    identity: evaluationId,
    sourceRef: `document-freshness/${evaluationId}`,
    revision: evaluation.fingerprint,
    payloadFingerprint: evaluation.fingerprint,
    metadata: {
      level: evaluation.level,
      findingCount: evaluation.findings.length,
      reviewDocuments: evaluation.reviewDocuments,
      fingerprint: evaluation.fingerprint,
      advisoryOnly: evaluation.advisoryOnly,
      semanticContradictionProven: evaluation.semanticContradictionProven,
      canonicalRewriteAllowed: evaluation.canonicalRewriteAllowed,
    },
    provenance: provenance(args),
  };

  const findings = evaluation.findings.map<MssrLibrarianIngressRecord>((finding, index) => {
    const metadata = {
      level: finding.level,
      code: finding.code,
      documentId: finding.documentId,
      documentRef: finding.documentRef,
      impactRef: finding.impactRef ?? null,
    };
    const fingerprint = sha256(JSON.stringify(metadata));
    return {
      namespace: "consistency",
      kind: "document-freshness-finding",
      identity: `${evaluationId}:${index + 1}:${fingerprint.slice(0, 16)}`,
      sourceRef: finding.documentRef,
      revision: evaluation.fingerprint,
      payloadFingerprint: fingerprint,
      metadata,
      provenance: provenance(args),
    };
  });

  return [summary, ...findings];
}

/**
 * Architecture Impact projection is already a strict typed, prose-free contract.
 * Re-parse it here so callers cannot widen Librarian retention with ad-hoc fields.
 */
export function librarianRecordFromArchitectureImpactProjection(args: {
  projection: ArchitectureImpactProjection;
  host?: string;
  traceId?: string;
}): MssrLibrarianIngressRecord {
  const projection = architectureImpactProjectionSchema.parse(args.projection);
  const metadata = {
    schemaVersion: projection.schemaVersion,
    architectureId: projection.architectureId,
    status: projection.status,
    level: projection.level,
    relationshipClass: projection.relationshipClass,
    evidenceClass: projection.evidenceClass,
    declarationFingerprint: projection.declarationFingerprint,
    baselineFingerprint: projection.baselineFingerprint,
    baselineAuthorityRevision: projection.baselineAuthorityRevision,
    currentAuthorityRevision: projection.currentAuthorityRevision,
    baselineSourceSetFingerprint: projection.baselineSourceSetFingerprint,
    currentSourceSetFingerprint: projection.currentSourceSetFingerprint,
    reasonCodes: projection.reasonCodes,
    changes: projection.changes,
    unresolvedRefs: projection.unresolvedRefs,
    evidenceComplete: projection.evidenceComplete,
    fingerprint: projection.fingerprint,
    notifyOnWatch: projection.notifyOnWatch,
    advisoryOnly: projection.advisoryOnly,
  };
  return {
    namespace: "consistency",
    kind: "architecture-impact",
    identity: `${projection.architectureId}:${projection.fingerprint}`,
    sourceRef: `architecture-impact/${projection.architectureId}`,
    revision: projection.fingerprint,
    payloadFingerprint: sha256(JSON.stringify(metadata)),
    metadata,
    provenance: provenance(args),
  };
}
