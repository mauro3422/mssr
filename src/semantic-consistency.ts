import {
  buildMssrSemanticClaimSituation,
  mssrSituationSemanticClaimBatchSchema,
  type MssrSituationClaimKind,
  type MssrSituationSemanticClaim,
  type MssrSituationSemanticClaimInput,
} from "./situation-claims.js";
import {
  evaluateMssrSituationModel,
  type MssrSituationModelResult,
} from "./situation-model.js";
import type {
  MssrConsistencyBoundary,
  MssrConsistencyMismatch,
} from "./consistency-projection.js";

/** Deterministic evidence tiers from ADR 0006. Similarity/model output never enters this evaluator. */
export const MSSR_SEMANTIC_EVIDENCE_TIERS = ["proven", "strong-review", "candidate", "unknown-abstain"] as const;
export type MssrSemanticEvidenceTier = typeof MSSR_SEMANTIC_EVIDENCE_TIERS[number];

export const MSSR_SEMANTIC_FINDING_TYPES = [
  "canonical-contradiction",
  "state-contradiction",
  "ownership-contradiction",
  "decision-revision-contradiction",
  "release-drift",
  "runtime-drift",
  "value-contradiction",
] as const;
export type MssrSemanticFindingType = typeof MSSR_SEMANTIC_FINDING_TYPES[number];

export const MSSR_SEMANTIC_INACTIVE_REASONS = ["historical-valid", "superseded-information", "validity-unknown"] as const;
export type MssrSemanticInactiveReason = typeof MSSR_SEMANTIC_INACTIVE_REASONS[number];

export type MssrSemanticFindingEvidence = Readonly<{
  source: string;
  sourceRef: string;
  authority: MssrSituationSemanticClaim["authority"];
  validity: MssrSituationSemanticClaim["validity"];
  scope: string;
  extractor: string;
  observedAt?: string;
  value?: string;
  revision?: string;
}>;

export type MssrSemanticConsistencyFinding = Readonly<{
  type: MssrSemanticFindingType;
  subject: string;
  scope: string;
  evidenceTier: MssrSemanticEvidenceTier;
  sourceA: MssrSemanticFindingEvidence | null;
  sourceB: MssrSemanticFindingEvidence;
  reasonCode: string;
  severity: "ok" | "watch" | "review" | "error";
  recommendedActions: readonly string[];
  blocksPublication: boolean;
  advisoryOnly: true;
}>;

export type MssrSemanticInactiveClaim = Readonly<{
  subject: string;
  scope: string;
  sourceRef: string;
  validity: MssrSituationSemanticClaim["validity"];
  reason: MssrSemanticInactiveReason;
}>;

export type MssrSemanticConsistencyEvaluation = Readonly<{
  boundary: MssrConsistencyBoundary;
  activeClaims: readonly MssrSituationSemanticClaim[];
  inactiveClaims: readonly MssrSemanticInactiveClaim[];
  findings: readonly MssrSemanticConsistencyFinding[];
  situation: MssrSituationModelResult | null;
  contradictionProven: boolean;
  blocksPublication: boolean;
  advisoryOnly: true;
}>;

function observerFor(claim: MssrSituationSemanticClaim): string {
  return `${claim.source}:${claim.sourceRef}`;
}

function evidenceFor(claim: MssrSituationSemanticClaim): MssrSemanticFindingEvidence {
  return {
    source: claim.source,
    sourceRef: claim.sourceRef,
    authority: claim.authority,
    validity: claim.validity,
    scope: claim.scope,
    extractor: claim.extractor,
    ...(claim.observedAt ? { observedAt: claim.observedAt } : {}),
    ...(claim.value ? { value: claim.value } : {}),
    ...(claim.revision ? { revision: claim.revision } : {}),
  };
}

function inactiveReason(claim: MssrSituationSemanticClaim): MssrSemanticInactiveReason | null {
  if (claim.validity === "historical") return "historical-valid";
  if (claim.validity === "superseded") return "superseded-information";
  if (claim.validity === "unknown") return "validity-unknown";
  return null;
}

function findingType(kind: MssrSituationClaimKind, mismatch: MssrConsistencyMismatch, observed: MssrSituationSemanticClaim): MssrSemanticFindingType {
  if (mismatch.kind === "canonical-conflict") return "canonical-contradiction";
  if (observed.source === "runtime") return "runtime-drift";
  if (kind === "state-value") return "state-contradiction";
  if (kind === "ownership") return "ownership-contradiction";
  if (kind === "decision-revision") return "decision-revision-contradiction";
  if (kind === "release-version") return "release-drift";
  return "value-contradiction";
}

function evidenceTier(mismatch: MssrConsistencyMismatch): MssrSemanticEvidenceTier {
  return mismatch.kind === "insufficient" || mismatch.kind === "availability" ? "strong-review" : "proven";
}

function mismatchReason(mismatch: MssrConsistencyMismatch): string {
  if (mismatch.kind === "canonical-conflict") return "canonical-authority-conflict";
  if (mismatch.kind === "availability") return "current-claim-unavailable";
  if (mismatch.kind === "insufficient") return "current-claim-insufficient";
  if (mismatch.kind === "revision") return "current-revision-conflict";
  return "current-value-conflict";
}

/**
 * R4 deterministic semantic consistency slice.
 *
 * Temporal validity is resolved before C2c: historical and explicitly superseded
 * claims remain observable provenance but are not current truth and therefore do
 * not create repeated mismatch noise. Only explicit current claims are projected
 * into the existing Situation Model/C2c evaluator.
 */
export function evaluateMssrSemanticConsistency(input: Readonly<{
  boundary?: MssrConsistencyBoundary;
  claims: readonly MssrSituationSemanticClaimInput[];
}>): MssrSemanticConsistencyEvaluation {
  const boundary = input.boundary ?? "ordinary";
  const claims = mssrSituationSemanticClaimBatchSchema.parse(input.claims);
  const activeClaims: MssrSituationSemanticClaim[] = [];
  const inactiveClaims: MssrSemanticInactiveClaim[] = [];

  for (const claim of claims) {
    const reason = inactiveReason(claim);
    if (reason) {
      inactiveClaims.push({
        subject: claim.subject,
        scope: claim.scope,
        sourceRef: claim.sourceRef,
        validity: claim.validity,
        reason,
      });
    } else {
      activeClaims.push(claim);
    }
  }

  activeClaims.sort((left, right) =>
    `${left.scope}:${left.kind}:${left.subject}:${left.authority}:${observerFor(left)}`
      .localeCompare(`${right.scope}:${right.kind}:${right.subject}:${right.authority}:${observerFor(right)}`));
  inactiveClaims.sort((left, right) => `${left.scope}:${left.subject}:${left.sourceRef}`.localeCompare(`${right.scope}:${right.subject}:${right.sourceRef}`));

  if (activeClaims.length === 0) {
    return {
      boundary,
      activeClaims,
      inactiveClaims,
      findings: [],
      situation: null,
      contradictionProven: false,
      blocksPublication: false,
      advisoryOnly: true,
    };
  }

  const observations = buildMssrSemanticClaimSituation(activeClaims);
  const situation = evaluateMssrSituationModel({ boundary, observations });
  const byObserver = new Map(activeClaims.map((claim) => [observerFor(claim), claim] as const));
  const findings: MssrSemanticConsistencyFinding[] = [];

  for (const mismatch of situation.decision.mismatches) {
    const observed = byObserver.get(mismatch.observedObserver);
    if (!observed) continue;
    const authority = mismatch.authorityObserver ? byObserver.get(mismatch.authorityObserver) ?? null : null;
    const tier = evidenceTier(mismatch);
    findings.push({
      type: findingType(observed.kind, mismatch, observed),
      subject: observed.subject,
      scope: observed.scope,
      evidenceTier: tier,
      sourceA: authority ? evidenceFor(authority) : null,
      sourceB: evidenceFor(observed),
      reasonCode: mismatchReason(mismatch),
      severity: situation.decision.level,
      recommendedActions: situation.decision.recommendedActions,
      blocksPublication: boundary === "pre-release" && situation.decision.level === "error" && tier === "proven",
      advisoryOnly: true,
    });
  }

  findings.sort((left, right) => `${left.scope}:${left.subject}:${left.type}:${left.sourceB.sourceRef}`.localeCompare(`${right.scope}:${right.subject}:${right.type}:${right.sourceB.sourceRef}`));
  const contradictionProven = findings.some((finding) => finding.evidenceTier === "proven");

  return {
    boundary,
    activeClaims,
    inactiveClaims,
    findings,
    situation,
    contradictionProven,
    blocksPublication: findings.some((finding) => finding.blocksPublication),
    advisoryOnly: true,
  };
}
