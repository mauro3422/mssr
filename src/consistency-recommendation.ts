import {
  evaluateMssrConsistencyOperationalAttention,
  type MssrConsistencyAction,
  type MssrConsistencyBoundary,
  type MssrConsistencyMismatch,
  type MssrConsistencyObservation,
  type MssrConsistencyOperationalProjection,
} from "./consistency-projection.js";

export const MSSR_CONSISTENCY_RECOMMENDATION_POLICY = "evidence-first-v1" as const;
export const MSSR_CONSISTENCY_RECOMMENDATION_STATUSES = ["ready", "deferred"] as const;
export const MSSR_CONSISTENCY_RECOMMENDATION_CONFIDENCE = ["low", "medium", "high"] as const;
export const MSSR_CONSISTENCY_RECOMMENDATION_MODES = ["none", "investigate", "repair", "review", "replan", "abstain"] as const;
export const MSSR_CONSISTENCY_ACTION_CLASSES = ["inspect", "verify", "repair", "review", "replan"] as const;
export const MSSR_CONSISTENCY_QUALITATIVE_LEVELS = ["low", "medium", "high"] as const;

export type MssrConsistencyRecommendationStatus = typeof MSSR_CONSISTENCY_RECOMMENDATION_STATUSES[number];
export type MssrConsistencyRecommendationConfidence = typeof MSSR_CONSISTENCY_RECOMMENDATION_CONFIDENCE[number];
export type MssrConsistencyRecommendationMode = typeof MSSR_CONSISTENCY_RECOMMENDATION_MODES[number];
export type MssrConsistencyActionClass = typeof MSSR_CONSISTENCY_ACTION_CLASSES[number];
export type MssrConsistencyQualitativeLevel = typeof MSSR_CONSISTENCY_QUALITATIVE_LEVELS[number];

export type MssrConsistencyRecommendationScoreBreakdown = Readonly<{
  attention: number;
  boundary: number;
  informationGain: number;
  mismatchCoverage: number;
  evidenceReadiness: number;
  riskPenalty: number;
  costPenalty: number;
  blastRadiusPenalty: number;
  dependencyPenalty: number;
}>;

export type MssrConsistencyRecommendation = Readonly<{
  action: MssrConsistencyAction;
  rank: number;
  status: MssrConsistencyRecommendationStatus;
  score: number;
  confidence: MssrConsistencyRecommendationConfidence;
  actionClass: MssrConsistencyActionClass;
  expectedInformationGain: MssrConsistencyQualitativeLevel;
  risk: MssrConsistencyQualitativeLevel;
  reversibility: MssrConsistencyQualitativeLevel;
  cost: MssrConsistencyQualitativeLevel;
  blastRadius: MssrConsistencyQualitativeLevel;
  mismatchKeys: readonly string[];
  dependsOn: readonly MssrConsistencyAction[];
  blockedBy: readonly string[];
  reasonCodes: readonly string[];
  scoreBreakdown: MssrConsistencyRecommendationScoreBreakdown;
  advisoryOnly: true;
}>;

export type MssrConsistencyRecommendationPlan = Readonly<{
  recommendationPolicy: typeof MSSR_CONSISTENCY_RECOMMENDATION_POLICY;
  recommendationMode: MssrConsistencyRecommendationMode;
  nextAction: MssrConsistencyAction | null;
  recommendations: readonly MssrConsistencyRecommendation[];
  repairDeferred: boolean;
  abstentionReasons: readonly string[];
  advisoryOnly: true;
}>;

export type MssrConsistencyDecisionSupport = MssrConsistencyOperationalProjection & MssrConsistencyRecommendationPlan;

type ActionProfile = Readonly<{
  actionClass: MssrConsistencyActionClass;
  informationGain: MssrConsistencyQualitativeLevel;
  risk: MssrConsistencyQualitativeLevel;
  reversibility: MssrConsistencyQualitativeLevel;
  cost: MssrConsistencyQualitativeLevel;
  blastRadius: MssrConsistencyQualitativeLevel;
}>;

const ACTION_PROFILES: Readonly<Record<MssrConsistencyAction, ActionProfile>> = {
  "load-canonical-authority": { actionClass: "inspect", informationGain: "high", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "inspect-canonical-authorities": { actionClass: "inspect", informationGain: "high", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "inspect-source-replica": { actionClass: "inspect", informationGain: "high", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "rebuild-generated-artifact": { actionClass: "repair", informationGain: "low", risk: "medium", reversibility: "high", cost: "medium", blastRadius: "medium" },
  "refresh-installed-artifact": { actionClass: "repair", informationGain: "low", risk: "high", reversibility: "medium", cost: "medium", blastRadius: "high" },
  "verify-live-runtime": { actionClass: "verify", informationGain: "high", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "revalidate-context-evidence": { actionClass: "verify", informationGain: "high", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "review-stale-claim": { actionClass: "review", informationGain: "medium", risk: "low", reversibility: "high", cost: "low", blastRadius: "low" },
  "replan-current-context": { actionClass: "replan", informationGain: "low", risk: "low", reversibility: "high", cost: "medium", blastRadius: "low" },
};

const LEVEL_POINTS = { ok: 0, watch: 10, review: 22, error: 34 } as const;
const BOUNDARY_POINTS: Readonly<Record<MssrConsistencyBoundary, number>> = {
  ordinary: 0,
  "context-load": 4,
  "pre-execution": 6,
  "pre-release": 10,
  "post-restart": 10,
  outcome: 12,
};
const INFORMATION_POINTS: Readonly<Record<MssrConsistencyQualitativeLevel, number>> = { low: 4, medium: 12, high: 22 };
const RISK_PENALTY: Readonly<Record<MssrConsistencyQualitativeLevel, number>> = { low: 0, medium: -8, high: -16 };
const COST_PENALTY: Readonly<Record<MssrConsistencyQualitativeLevel, number>> = { low: 0, medium: -5, high: -10 };
const BLAST_RADIUS_PENALTY: Readonly<Record<MssrConsistencyQualitativeLevel, number>> = { low: 0, medium: -7, high: -14 };
const RISK_ORDER: Readonly<Record<MssrConsistencyQualitativeLevel, number>> = { low: 0, medium: 1, high: 2 };

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function observationGroups(observations: readonly MssrConsistencyObservation[]): Map<string, MssrConsistencyObservation[]> {
  const result = new Map<string, MssrConsistencyObservation[]>();
  for (const observation of observations) {
    const current = result.get(observation.key) ?? [];
    current.push(observation);
    result.set(observation.key, current);
  }
  return result;
}

function mismatchMatchesAction(action: MssrConsistencyAction, mismatch: MssrConsistencyMismatch): boolean {
  switch (action) {
    case "inspect-canonical-authorities": return mismatch.kind === "canonical-conflict";
    case "inspect-source-replica": return mismatch.observedRole === "source" || mismatch.observedRole === "generated";
    case "rebuild-generated-artifact": return mismatch.observedRole === "generated";
    case "refresh-installed-artifact": return mismatch.observedRole === "installed";
    case "verify-live-runtime": return mismatch.observedRole === "runtime";
    case "revalidate-context-evidence":
    case "review-stale-claim":
    case "replan-current-context":
      return mismatch.observedAuthority === "historical"
        || mismatch.observedRole === "memory"
        || mismatch.observedRole === "receipt"
        || mismatch.observedRole === "state"
        || mismatch.observedRole === "reference";
    case "load-canonical-authority": return true;
  }
}

function confidenceFor(args: {
  action: MssrConsistencyAction;
  relevant: readonly MssrConsistencyMismatch[];
  missingCanonicalKeys: ReadonlySet<string>;
  projection: MssrConsistencyOperationalProjection;
  deferred: boolean;
}): MssrConsistencyRecommendationConfidence {
  if (args.deferred) return "medium";
  if (args.action === "load-canonical-authority" && args.missingCanonicalKeys.size > 0) return "high";
  if (args.action === "inspect-canonical-authorities" && args.relevant.some((item) => item.kind === "canonical-conflict")) return "high";
  if (args.relevant.length === 0) return args.projection.evidenceComplete ? "medium" : "low";
  const exact = args.relevant.every((item) =>
    item.kind === "canonical-conflict"
    || ((item.expectedValue !== null && item.actualValue !== null)
      || (item.expectedRevision !== null && item.actualRevision !== null)));
  if (exact) return "high";
  return args.projection.evidenceComplete ? "medium" : "low";
}

function modeForAction(action: MssrConsistencyAction): MssrConsistencyRecommendationMode {
  const cls = ACTION_PROFILES[action].actionClass;
  if (cls === "inspect" || cls === "verify") return "investigate";
  if (cls === "repair") return "repair";
  if (cls === "review") return "review";
  if (cls === "replan") return "replan";
  return "none";
}

/**
 * C2d Evidence-First Decision Ranker.
 *
 * C2c owns diagnosis. C2d consumes that bounded diagnosis plus the same bounded
 * observations and produces a deterministic, auditable next-action plan. It is
 * deliberately not a learned policy yet: ranking is governed by explicit
 * information-gain, evidence-readiness, dependency and risk rules so later
 * empirical calibration can be shadow-tested without changing diagnosis or
 * permissions.
 */
export function planMssrConsistencyRecommendations(input: Readonly<{
  projection: MssrConsistencyOperationalProjection;
  observations: readonly MssrConsistencyObservation[];
}>): MssrConsistencyRecommendationPlan {
  const { projection } = input;
  const observations = [...input.observations].sort((a, b) =>
    `${a.key}:${a.authority}:${a.role}:${a.observer}`.localeCompare(`${b.key}:${b.authority}:${b.role}:${b.observer}`));
  const groups = observationGroups(observations);
  const missingCanonicalKeys = new Set<string>();
  const canonicalConflictKeys = new Set(projection.mismatches.filter((item) => item.kind === "canonical-conflict").map((item) => item.key));
  const sourceProblemKeys = new Set(projection.mismatches.filter((item) => item.observedRole === "source" && item.observedAuthority === "replica").map((item) => item.key));
  const generatedMismatchKeys = new Set(projection.mismatches.filter((item) => item.observedRole === "generated").map((item) => item.key));
  const historicalMismatchKeys = new Set(projection.mismatches.filter((item) => item.observedAuthority === "historical").map((item) => item.key));

  for (const [key, group] of groups) {
    if (!group.some((item) => item.authority === "canonical" && item.state === "observed")) missingCanonicalKeys.add(key);
  }

  const candidateActions = new Set<MssrConsistencyAction>(projection.recommendedActions);
  for (const key of generatedMismatchKeys) {
    const group = groups.get(key) ?? [];
    const sourceReplica = group.find((item) => item.role === "source" && item.authority === "replica");
    if (!sourceReplica || sourceReplica.state !== "observed" || sourceProblemKeys.has(key)) candidateActions.add("inspect-source-replica");
  }

  if (candidateActions.size === 0) {
    const abstentionReasons = projection.level === "ok"
      ? []
      : projection.reasonCodes.length > 0
        ? [...projection.reasonCodes]
        : ["no-actionable-evidence"];
    return {
      recommendationPolicy: MSSR_CONSISTENCY_RECOMMENDATION_POLICY,
      recommendationMode: projection.level === "ok" ? "none" : "abstain",
      nextAction: null,
      recommendations: [],
      repairDeferred: false,
      abstentionReasons,
      advisoryOnly: true,
    };
  }

  const drafts = [...candidateActions].map((action) => {
    const profile = ACTION_PROFILES[action];
    const relevant = projection.mismatches.filter((item) => mismatchMatchesAction(action, item));
    const mismatchKeys = new Set(relevant.map((item) => item.key));
    if (action === "load-canonical-authority") for (const key of missingCanonicalKeys) mismatchKeys.add(key);

    const dependsOn = new Set<MssrConsistencyAction>();
    const blockedBy = new Set<string>();
    const reasonCodes = new Set<string>();
    let evidenceReadiness = 0;

    if (projection.level !== "ok") reasonCodes.add(`attention-${projection.level}`);
    if (projection.boundary !== "ordinary") reasonCodes.add(`boundary-${projection.boundary}`);

    const touchesConflict = [...mismatchKeys].some((key) => canonicalConflictKeys.has(key));
    if (touchesConflict && action !== "inspect-canonical-authorities") {
      blockedBy.add("canonical-authority-conflict");
      reasonCodes.add("canonical-conflict-gate");
    }

    if (action === "inspect-canonical-authorities" && canonicalConflictKeys.size > 0) {
      evidenceReadiness += 15;
      reasonCodes.add("resolve-authority-before-repair");
    }

    if (action === "load-canonical-authority") {
      if (missingCanonicalKeys.size > 0) {
        evidenceReadiness += 12;
        reasonCodes.add("canonical-baseline-missing");
      } else {
        evidenceReadiness -= 10;
        reasonCodes.add("canonical-baseline-already-observed");
      }
    }

    if (action === "inspect-source-replica") {
      const unresolved = [...generatedMismatchKeys].filter((key) => {
        const group = groups.get(key) ?? [];
        const sourceReplica = group.find((item) => item.role === "source" && item.authority === "replica");
        return !sourceReplica || sourceReplica.state !== "observed" || sourceProblemKeys.has(key);
      });
      for (const key of unresolved) mismatchKeys.add(key);
      if (unresolved.length > 0) {
        evidenceReadiness += 12;
        reasonCodes.add("source-replica-needs-proof");
      }
    }

    if (action === "rebuild-generated-artifact") {
      const generatedKeys = relevant.map((item) => item.key);
      const unresolvedSource = generatedKeys.some((key) => {
        const group = groups.get(key) ?? [];
        const sourceReplica = group.find((item) => item.role === "source" && item.authority === "replica");
        return !sourceReplica || sourceReplica.state !== "observed" || sourceProblemKeys.has(key);
      });
      if (unresolvedSource) {
        dependsOn.add("inspect-source-replica");
        blockedBy.add("source-replica-unproven");
        reasonCodes.add("diagnose-source-before-rebuild");
      } else if (relevant.length > 0) {
        evidenceReadiness += 12;
        reasonCodes.add("generated-replica-proven-stale");
      }
    }

    if (action === "verify-live-runtime") {
      const runtimeKeys = new Set(relevant.map((item) => item.key));
      if ([...runtimeKeys].some((key) => generatedMismatchKeys.has(key))) {
        dependsOn.add("rebuild-generated-artifact");
        blockedBy.add("generated-artifact-stale");
        reasonCodes.add("repair-generated-before-runtime-verification");
      }
    }

    if (action === "refresh-installed-artifact" && relevant.length > 0) {
      evidenceReadiness += 10;
      reasonCodes.add("installed-replica-proven-stale");
    }

    if (action === "revalidate-context-evidence" && historicalMismatchKeys.size > 0) {
      evidenceReadiness += 12;
      reasonCodes.add("historical-claim-needs-current-evidence");
    }
    if (action === "review-stale-claim" && historicalMismatchKeys.size > 0) {
      evidenceReadiness += 5;
      reasonCodes.add("preserve-history-separate-from-current-state");
    }
    if (action === "replan-current-context" && historicalMismatchKeys.size > 0) {
      reasonCodes.add("replan-after-stale-context-signal");
    }

    const exactComparable = relevant.filter((item) =>
      (item.expectedValue !== null && item.actualValue !== null)
      || (item.expectedRevision !== null && item.actualRevision !== null));
    if (profile.actionClass === "repair" && projection.evidenceComplete) evidenceReadiness += 10;
    if (profile.actionClass === "repair" && exactComparable.length === relevant.length && relevant.length > 0) evidenceReadiness += 6;
    if ((profile.actionClass === "inspect" || profile.actionClass === "verify") && !projection.evidenceComplete) evidenceReadiness += 10;

    const requiredRelevant = relevant.some((item) => item.required);
    const mismatchCoverage = Math.min(12, relevant.length * 4) + (requiredRelevant ? 6 : 0);
    const dependencyPenalty = blockedBy.size > 0 || dependsOn.size > 0 ? -40 : 0;
    const breakdown: MssrConsistencyRecommendationScoreBreakdown = {
      attention: LEVEL_POINTS[projection.level],
      boundary: BOUNDARY_POINTS[projection.boundary],
      informationGain: INFORMATION_POINTS[profile.informationGain],
      mismatchCoverage,
      evidenceReadiness,
      riskPenalty: RISK_PENALTY[profile.risk],
      costPenalty: COST_PENALTY[profile.cost],
      blastRadiusPenalty: BLAST_RADIUS_PENALTY[profile.blastRadius],
      dependencyPenalty,
    };
    const score = clampScore(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
    const deferred = blockedBy.size > 0 || dependsOn.size > 0;

    return {
      action,
      status: deferred ? "deferred" as const : "ready" as const,
      score,
      confidence: confidenceFor({ action, relevant, missingCanonicalKeys, projection, deferred }),
      actionClass: profile.actionClass,
      expectedInformationGain: profile.informationGain,
      risk: profile.risk,
      reversibility: profile.reversibility,
      cost: profile.cost,
      blastRadius: profile.blastRadius,
      mismatchKeys: uniqSorted(mismatchKeys),
      dependsOn: uniqSorted(dependsOn),
      blockedBy: uniqSorted(blockedBy),
      reasonCodes: uniqSorted(reasonCodes),
      scoreBreakdown: breakdown,
      advisoryOnly: true as const,
    };
  });

  drafts.sort((a, b) => {
    if (a.status !== b.status) return a.status === "ready" ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    if (RISK_ORDER[a.risk] !== RISK_ORDER[b.risk]) return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
    return a.action.localeCompare(b.action);
  });

  const recommendations: MssrConsistencyRecommendation[] = drafts.map((item, index) => ({ ...item, rank: index + 1 }));
  const next = recommendations.find((item) => item.status === "ready") ?? null;
  const repairDeferred = recommendations.some((item) => item.actionClass === "repair" && item.status === "deferred");

  return {
    recommendationPolicy: MSSR_CONSISTENCY_RECOMMENDATION_POLICY,
    recommendationMode: next ? modeForAction(next.action) : "abstain",
    nextAction: next?.action ?? null,
    recommendations,
    repairDeferred,
    abstentionReasons: next ? [] : uniqSorted(projection.reasonCodes.length > 0 ? projection.reasonCodes : ["no-ready-action"]),
    advisoryOnly: true,
  };
}

/** Evaluate C2c diagnosis and attach the C2d governed recommendation plan. */
export function evaluateMssrConsistencyDecisionSupport(input: Readonly<{
  boundary?: MssrConsistencyBoundary;
  observations: readonly MssrConsistencyObservation[];
}>): MssrConsistencyDecisionSupport {
  const projection = evaluateMssrConsistencyOperationalAttention(input);
  const plan = planMssrConsistencyRecommendations({ projection, observations: input.observations });
  return {
    ...projection,
    ...plan,
    // Compatibility: preserve the old flat field while making its order meaningful.
    recommendedActions: plan.recommendations.map((item) => item.action),
  };
}
