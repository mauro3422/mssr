import { z } from "zod";
import type { ArchitectureImpactManifest } from "./architecture-impact.js";
import { architectureImpactProjectionSchema, validateArchitectureImpactReviewedBaseline, type ArchitectureImpactProjection, type ArchitectureImpactReviewedBaseline } from "./architecture-impact-projection.js";
import type { ArchitectureStructureManifest } from "./architecture-impact-structure.js";
import { architectureStructuralReviewedBaselineSchema, architectureStructuralRefinementSchema, architectureStructuralLandmarkKey, buildArchitectureStructureFingerprint, normalizeArchitectureStructuralEvidence, MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES, MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_STATUSES, MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION, reviewedStructuralLandmarkSchema, structuralChangeSchema, structuralUnresolvedSchema, semanticHash, type ArchitectureStructuralEvidence, type ArchitectureStructuralReviewedBaseline, type ArchitectureStructuralRefinement } from "./architecture-structural-contract.js";

function coarseBaselineRevisionForRef(baseline: ArchitectureImpactReviewedBaseline, ref: string): string | null {
  if (ref === baseline.authority.ref) return baseline.authority.revision;
  const item = baseline.impacts.find((candidate) => candidate.ref === ref);
  return item?.availability === "available" ? item.revision : null;
}

function baselineFingerprint(input: Readonly<{
  architectureId: string;
  coarseBaselineFingerprint: string;
  structureFingerprint: string;
  landmarks: readonly z.infer<typeof reviewedStructuralLandmarkSchema>[];
}>): string {
  return semanticHash("architecture-structural-reviewed-baseline-v1", [
    input.architectureId,
    input.coarseBaselineFingerprint,
    input.structureFingerprint,
    ...input.landmarks.map((item) => [
      architectureStructuralLandmarkKey(item),
      item.sourceRevision,
      item.fingerprintScheme,
      item.analyzerId ?? "no-analyzer",
      item.structuralFingerprint,
    ].join("|")),
  ]);
}

export function createArchitectureStructuralReviewedBaseline(input: Readonly<{
  impactManifest: ArchitectureImpactManifest;
  structureManifest: ArchitectureStructureManifest;
  coarseBaseline: ArchitectureImpactReviewedBaseline;
  evidence: ArchitectureStructuralEvidence;
  review: Readonly<{ reviewed: true }>;
}>): ArchitectureStructuralReviewedBaseline {
  if (input.review.reviewed !== true) throw new Error("Architecture structural baseline creation requires explicit reviewed=true confirmation.");
  const coarseBaseline = validateArchitectureImpactReviewedBaseline(input.coarseBaseline);
  const evidence = normalizeArchitectureStructuralEvidence(
    input.impactManifest,
    input.structureManifest,
    input.evidence,
    { requireAll: true },
  );
  if (coarseBaseline.architectureId !== evidence.architectureId) {
    throw new Error(`Architecture structural baseline architectureId mismatch: ${coarseBaseline.architectureId} vs ${evidence.architectureId}`);
  }
  const nonObserved = evidence.landmarks.filter((item) => item.availability !== "observed");
  if (nonObserved.length > 0) {
    throw new Error(`Architecture structural reviewed baseline requires observed landmarks; non-observed: ${nonObserved.map(architectureStructuralLandmarkKey).join(", ")}`);
  }

  const landmarks = evidence.landmarks as z.infer<typeof reviewedStructuralLandmarkSchema>[];
  for (const item of landmarks) {
    const expectedRevision = coarseBaselineRevisionForRef(coarseBaseline, item.ref);
    if (!expectedRevision) {
      throw new Error(`Architecture structural baseline cannot bind landmark to a non-available coarse source: ${item.ref}`);
    }
    if (item.sourceRevision !== expectedRevision) {
      throw new Error(`Architecture structural baseline sourceRevision mismatch for ${item.ref}: expected ${expectedRevision}, received ${item.sourceRevision}`);
    }
  }

  const structureFingerprint = buildArchitectureStructureFingerprint(
    input.impactManifest,
    input.structureManifest,
    evidence.architectureId,
  );
  const computedBaselineFingerprint = baselineFingerprint({
    architectureId: evidence.architectureId,
    coarseBaselineFingerprint: coarseBaseline.baselineFingerprint,
    structureFingerprint,
    landmarks,
  });
  return architectureStructuralReviewedBaselineSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION,
    architectureId: evidence.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    reviewClass: "reviewed",
    coarseBaselineFingerprint: coarseBaseline.baselineFingerprint,
    structureFingerprint,
    landmarks,
    baselineFingerprint: computedBaselineFingerprint,
  });
}

export function validateArchitectureStructuralReviewedBaseline(
  baselineInput: ArchitectureStructuralReviewedBaseline,
): ArchitectureStructuralReviewedBaseline {
  const baseline = architectureStructuralReviewedBaselineSchema.parse(baselineInput);
  const expected = baselineFingerprint({
    architectureId: baseline.architectureId,
    coarseBaselineFingerprint: baseline.coarseBaselineFingerprint,
    structureFingerprint: baseline.structureFingerprint,
    landmarks: baseline.landmarks,
  });
  if (expected !== baseline.baselineFingerprint) {
    throw new Error("Architecture structural reviewed baseline fingerprint integrity check failed.");
  }
  return baseline;
}

function currentRevisionForChangedRef(coarse: ArchitectureImpactProjection, ref: string): string | null {
  if (ref === coarse.changes.find((item) => item.role === "authority")?.ref) return coarse.currentAuthorityRevision;
  const change = coarse.changes.find((item) => item.role === "impact" && item.ref === ref);
  if (!change) return null;
  return change.current.availability === "available" ? change.current.revision : null;
}

function refinementFingerprint(input: Readonly<{
  architectureId: string;
  coarseFingerprint: string;
  status: typeof MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_STATUSES[number];
  structureFingerprint: string;
  baselineFingerprint: string;
  reasonCodes: readonly string[];
  compared: readonly string[];
  changes: readonly z.infer<typeof structuralChangeSchema>[];
  unresolved: readonly z.infer<typeof structuralUnresolvedSchema>[];
}>): string {
  return semanticHash("architecture-structural-refinement-v1", [
    input.architectureId,
    input.coarseFingerprint,
    input.status,
    input.structureFingerprint,
    input.baselineFingerprint,
    ...input.reasonCodes,
    ...input.compared,
    ...input.changes.map((item) => `${item.key}|${item.baselineFingerprint}|${item.currentFingerprint}`),
    ...input.unresolved.map((item) => `${item.key}|${item.reasonCode}`),
  ]);
}

function finalizeRefinement(input: Readonly<{
  coarse: ArchitectureImpactProjection;
  status: typeof MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_STATUSES[number];
  structureFingerprint: string;
  baselineFingerprint: string;
  reasons: Set<typeof MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES[number]>;
  compared?: string[];
  changes?: z.infer<typeof structuralChangeSchema>[];
  unresolved?: z.infer<typeof structuralUnresolvedSchema>[];
}>): ArchitectureStructuralRefinement {
  const reasonCodes = [...input.reasons].sort();
  const comparedLandmarkKeys = input.compared ?? [];
  const changes = input.changes ?? [];
  const unresolved = input.unresolved ?? [];
  const level = input.status === "not-applicable" ? "ok" : input.status === "noise-candidate" ? "watch" : "review";
  const evidenceComplete = input.status !== "unresolved";
  const fingerprint = refinementFingerprint({
    architectureId: input.coarse.architectureId,
    coarseFingerprint: input.coarse.fingerprint,
    status: input.status,
    structureFingerprint: input.structureFingerprint,
    baselineFingerprint: input.baselineFingerprint,
    reasonCodes,
    compared: comparedLandmarkKeys,
    changes,
    unresolved,
  });
  return architectureStructuralRefinementSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION,
    architectureId: input.coarse.architectureId,
    coarseStatus: input.coarse.status,
    coarseFingerprint: input.coarse.fingerprint,
    status: input.status,
    level,
    relationshipClass: "declared",
    evidenceClass: "observed",
    structureFingerprint: input.structureFingerprint,
    structuralBaselineFingerprint: input.baselineFingerprint,
    reasonCodes,
    comparedLandmarkKeys,
    changes,
    unresolved,
    evidenceComplete,
    fingerprint,
    notifyOnWatch: false,
    advisoryOnly: true,
  });
}

/**
 * C2f-C.5-C3 refines a coarse C2f-C projection but never overwrites it.
 * - aligned => structural analysis is not required;
 * - unresolved => structural evidence cannot repair missing coarse evidence;
 * - possible-impact => compare only reviewed landmarks attached to the changed refs.
 * Unchanged compatible landmarks may classify the byte/revision change as a
 * noise candidate (WATCH), while changed landmarks remain review-worthy possible
 * impact. Scheme mismatch, stale source revisions or missing evidence fail closed.
 */
export function evaluateArchitectureStructuralRefinement(input: Readonly<{
  impactManifest: ArchitectureImpactManifest;
  structureManifest: ArchitectureStructureManifest;
  coarse: ArchitectureImpactProjection;
  baseline: ArchitectureStructuralReviewedBaseline;
  currentEvidence?: ArchitectureStructuralEvidence;
}>): ArchitectureStructuralRefinement {
  const coarse = architectureImpactProjectionSchema.parse(input.coarse);
  const baseline = validateArchitectureStructuralReviewedBaseline(input.baseline);
  if (coarse.architectureId !== baseline.architectureId) {
    throw new Error(`Architecture structural refinement architectureId mismatch: ${coarse.architectureId} vs ${baseline.architectureId}`);
  }
  if (coarse.baselineFingerprint !== baseline.coarseBaselineFingerprint) {
    throw new Error("Architecture structural baseline does not belong to the coarse reviewed baseline used by this projection.");
  }

  const structureFingerprint = buildArchitectureStructureFingerprint(
    input.impactManifest,
    input.structureManifest,
    coarse.architectureId,
  );
  const reasons = new Set<typeof MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES[number]>();

  if (structureFingerprint !== baseline.structureFingerprint) {
    reasons.add("structure-declaration-changed");
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }
  if (coarse.status === "aligned") {
    reasons.add("coarse-aligned");
    return finalizeRefinement({
      coarse,
      status: "not-applicable",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }
  if (coarse.status === "unresolved") {
    reasons.add("coarse-unresolved");
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }

  if (coarse.changes.some((change) => change.kind === "availability")) {
    reasons.add("coarse-availability-change-unresolved");
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }

  const changedRefs = new Set(coarse.changes.map((change) => change.ref));
  const relevantBaseline = baseline.landmarks.filter((item) => changedRefs.has(item.ref));
  if (relevantBaseline.length === 0) {
    reasons.add("changed-source-without-structural-landmark");
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }
  if (!input.currentEvidence) {
    reasons.add("structural-evidence-required");
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
    });
  }

  const current = normalizeArchitectureStructuralEvidence(
    input.impactManifest,
    input.structureManifest,
    input.currentEvidence,
    { requireAll: false },
  );
  if (current.architectureId !== coarse.architectureId) {
    throw new Error(`Current structural evidence architectureId mismatch: expected ${coarse.architectureId}, received ${current.architectureId}`);
  }
  const currentByKey = new Map(current.landmarks.map((item) => [architectureStructuralLandmarkKey(item), item] as const));
  const compared: string[] = [];
  const changes: z.infer<typeof structuralChangeSchema>[] = [];
  const unresolved: z.infer<typeof structuralUnresolvedSchema>[] = [];

  for (const baselineItem of relevantBaseline) {
    const key = architectureStructuralLandmarkKey(baselineItem);
    const currentItem = currentByKey.get(key);
    if (!currentItem) {
      reasons.add("structural-landmark-missing");
      unresolved.push({ key, ref: baselineItem.ref, landmark: baselineItem.landmark, reasonCode: "structural-landmark-missing" });
      continue;
    }
    const expectedRevision = currentRevisionForChangedRef(coarse, baselineItem.ref);
    if (!expectedRevision || currentItem.sourceRevision !== expectedRevision) {
      reasons.add("structural-source-revision-mismatch");
      unresolved.push({ key, ref: baselineItem.ref, landmark: baselineItem.landmark, reasonCode: "structural-source-revision-mismatch" });
      continue;
    }
    if (currentItem.availability === "missing") {
      reasons.add("structural-landmark-missing");
      unresolved.push({ key, ref: baselineItem.ref, landmark: baselineItem.landmark, reasonCode: "structural-landmark-missing" });
      continue;
    }
    if (currentItem.availability === "unavailable") {
      reasons.add("structural-landmark-unavailable");
      unresolved.push({ key, ref: baselineItem.ref, landmark: baselineItem.landmark, reasonCode: "structural-landmark-unavailable" });
      continue;
    }
    if (currentItem.fingerprintScheme !== baselineItem.fingerprintScheme) {
      reasons.add("structural-fingerprint-scheme-mismatch");
      unresolved.push({ key, ref: baselineItem.ref, landmark: baselineItem.landmark, reasonCode: "structural-fingerprint-scheme-mismatch" });
      continue;
    }
    compared.push(key);
    if (currentItem.structuralFingerprint !== baselineItem.structuralFingerprint) {
      reasons.add("structural-fingerprint-changed");
      changes.push({
        key,
        ref: baselineItem.ref,
        landmark: baselineItem.landmark,
        fingerprintScheme: baselineItem.fingerprintScheme,
        baselineFingerprint: baselineItem.structuralFingerprint,
        currentFingerprint: currentItem.structuralFingerprint,
      });
    }
  }

  if (unresolved.length > 0) {
    return finalizeRefinement({
      coarse,
      status: "unresolved",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
      compared,
      changes,
      unresolved,
    });
  }
  if (changes.length > 0) {
    return finalizeRefinement({
      coarse,
      status: "structural-possible-impact",
      structureFingerprint,
      baselineFingerprint: baseline.baselineFingerprint,
      reasons,
      compared,
      changes,
    });
  }

  reasons.add("structural-fingerprints-aligned");
  return finalizeRefinement({
    coarse,
    status: "noise-candidate",
    structureFingerprint,
    baselineFingerprint: baseline.baselineFingerprint,
    reasons,
    compared,
  });
}
