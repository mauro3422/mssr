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
import {
  resolveMssrSemanticRelations,
  type MssrSemanticRelationInput,
  type MssrSemanticRelationKind,
  type MssrSemanticUnresolvedReference,
} from "./semantic-relations.js";

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
  relationId?: string;
  relationKind?: MssrSemanticRelationKind;
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
  unresolvedReferences: readonly MssrSemanticUnresolvedReference[];
  relationCandidateCount: number;
  situation: MssrSituationModelResult | null;
  contradictionProven: boolean;
  blocksPublication: boolean;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
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

function relationFindingType(source: MssrSituationSemanticClaim, target: MssrSituationSemanticClaim): MssrSemanticFindingType {
  if (source.authority === "canonical" && target.authority === "canonical") return "canonical-contradiction";
  if (source.source === "runtime") return "runtime-drift";
  if (source.kind === "state-value") return "state-contradiction";
  if (source.kind === "ownership") return "ownership-contradiction";
  if (source.kind === "decision-revision") return "decision-revision-contradiction";
  if (source.kind === "release-version") return "release-drift";
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

function comparableValue(claim: MssrSituationSemanticClaim): string | undefined {
  return claim.kind === "decision-revision" ? claim.revision : claim.value;
}

/**
 * R4 deterministic semantic consistency evaluator.
 *
 * Temporal validity is resolved before C2c. Explicit current declared
 * `mirrors`/`summarizes` relations may additionally compare two differently
 * named subjects; derived/lexical relations never enter proven truth.
 */
export function evaluateMssrSemanticConsistency(input: Readonly<{
  boundary?: MssrConsistencyBoundary;
  claims: readonly MssrSituationSemanticClaimInput[];
  relations?: readonly MssrSemanticRelationInput[];
  availableRefs?: readonly string[];
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

  const relationResolution = resolveMssrSemanticRelations({
    claims,
    relations: input.relations ?? [],
    availableRefs: input.availableRefs,
  });

  const observations = activeClaims.length > 0 ? buildMssrSemanticClaimSituation(activeClaims) : [];
  const situation = observations.length > 0 ? evaluateMssrSituationModel({ boundary, observations }) : null;
  const byObserver = new Map(activeClaims.map((claim) => [observerFor(claim), claim] as const));
  const findings: MssrSemanticConsistencyFinding[] = [];

  if (situation) {
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
  }

  for (const pair of relationResolution.comparisonPairs) {
    const sourceValue = comparableValue(pair.sourceClaim);
    const targetValue = comparableValue(pair.targetClaim);
    if (sourceValue === targetValue) continue;
    const canonicalConflict = pair.sourceClaim.authority === "canonical" && pair.targetClaim.authority === "canonical";
    const required = pair.relation.required || pair.sourceClaim.required || pair.targetClaim.required;
    const severity = canonicalConflict ? "error" : "review";
    findings.push({
      type: relationFindingType(pair.sourceClaim, pair.targetClaim),
      subject: pair.relation.toSubject,
      scope: pair.relation.scope,
      evidenceTier: "proven",
      sourceA: evidenceFor(pair.targetClaim),
      sourceB: evidenceFor(pair.sourceClaim),
      reasonCode: `declared-${pair.relation.kind}-${pair.sourceClaim.kind}-conflict`,
      severity,
      recommendedActions: ["inspect-authority", "inspect-declared-relation"],
      blocksPublication: boundary === "pre-release" && required && canonicalConflict,
      advisoryOnly: true,
      relationId: pair.relation.id,
      relationKind: pair.relation.kind,
    });
  }

  const findingKeys = new Set<string>();
  const dedupedFindings = findings
    .sort((left, right) => `${left.scope}:${left.subject}:${left.type}:${left.relationId ?? ""}:${left.sourceB.sourceRef}`
      .localeCompare(`${right.scope}:${right.subject}:${right.type}:${right.relationId ?? ""}:${right.sourceB.sourceRef}`))
    .filter((finding) => {
      const key = `${finding.scope}:${finding.subject}:${finding.type}:${finding.relationId ?? ""}:${finding.sourceA?.sourceRef ?? ""}:${finding.sourceB.sourceRef}:${finding.reasonCode}`;
      if (findingKeys.has(key)) return false;
      findingKeys.add(key);
      return true;
    });
  const contradictionProven = dedupedFindings.some((finding) => finding.evidenceTier === "proven");

  return {
    boundary,
    activeClaims,
    inactiveClaims,
    findings: dedupedFindings,
    unresolvedReferences: relationResolution.unresolvedReferences,
    relationCandidateCount: relationResolution.derivedCandidates.length,
    situation,
    contradictionProven,
    blocksPublication: dedupedFindings.some((finding) => finding.blocksPublication),
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
  };
}
