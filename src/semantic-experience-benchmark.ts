import {
  classifyMssrSemanticExperienceDeterministically,
  distillMssrSemanticExperience,
  mssrSemanticExperienceObservationSchema,
  type MssrSemanticExperienceObservation,
} from "./semantic-experience.js";

function verifiedValue(observation: MssrSemanticExperienceObservation): string | null {
  if (observation.verification.independent !== true) return null;
  if (observation.verification.status === "confirmed") return observation.verification.value ?? observation.proposal?.value ?? null;
  if (observation.verification.status === "corrected") return observation.verification.value ?? null;
  return null;
}

export type MssrSemanticExperienceBenchmarkPolicy = Readonly<{
  minVerifiedHoldout: number;
  minDistinctProjects: number;
  minFallbackPrecision: number;
  minFallbackCoverage: number;
  maxWrongDecisions: number;
}>;

export const DEFAULT_MSSR_SEMANTIC_EXPERIENCE_BENCHMARK_POLICY: MssrSemanticExperienceBenchmarkPolicy = {
  minVerifiedHoldout: 24,
  minDistinctProjects: 4,
  minFallbackPrecision: 0.95,
  minFallbackCoverage: 0.25,
  maxWrongDecisions: 0,
};

export type MssrSemanticExperienceBenchmarkReport = Readonly<{
  schemaVersion: 1;
  mode: "leave-one-project-out";
  evaluatedAt: string;
  projects: number;
  observations: number;
  verifiedTruth: number;
  rejected: number;
  shadow: number;
  fallback: Readonly<{
    decided: number;
    correct: number;
    wrong: number;
    abstained: number;
    precision: number | null;
    coverage: number;
  }>;
  provider: Readonly<{
    comparable: number;
    correct: number;
    wrong: number;
    accuracy: number | null;
  }>;
  byDecisionKind: Readonly<Record<string, Readonly<{
    verifiedTruth: number;
    fallbackDecided: number;
    fallbackCorrect: number;
    fallbackWrong: number;
    fallbackAbstained: number;
    providerComparable: number;
    providerCorrect: number;
  }>>>;
  promotion: Readonly<{
    status: "eligible-shadow-primary" | "blocked";
    eligible: boolean;
    reasons: readonly string[];
    policy: MssrSemanticExperienceBenchmarkPolicy;
    hostMayPreferFallback: boolean;
    advisoryOnly: true;
    authorityInfluence: false;
    routingInfluence: false;
    canonicalRewriteAllowed: false;
    autoApplyAllowed: false;
  }>;
}>;

/**
 * Evaluate Semantic Experience with project-level holdout. A holdout project is
 * never included in the profile used to classify its own verified observations.
 * This prevents same-project memorization from masquerading as cross-project
 * generalization. Raw provider proposals are compared but never treated as truth.
 */
export function benchmarkMssrSemanticExperience(args: {
  observations: readonly unknown[];
  policy?: Partial<MssrSemanticExperienceBenchmarkPolicy>;
  evaluatedAt?: string;
}): MssrSemanticExperienceBenchmarkReport {
  const observations = args.observations.flatMap((item) => {
    const parsed = mssrSemanticExperienceObservationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const policy: MssrSemanticExperienceBenchmarkPolicy = {
    ...DEFAULT_MSSR_SEMANTIC_EXPERIENCE_BENCHMARK_POLICY,
    ...(args.policy ?? {}),
  };
  const projectKeys = [...new Set(observations.map((item) => item.projectKey))].sort();
  let verifiedTruth = 0;
  let rejected = 0;
  let shadow = 0;
  let decided = 0;
  let correct = 0;
  let wrong = 0;
  let abstained = 0;
  let providerComparable = 0;
  let providerCorrect = 0;
  let providerWrong = 0;
  const byDecisionKind: Record<string, {
    verifiedTruth: number;
    fallbackDecided: number;
    fallbackCorrect: number;
    fallbackWrong: number;
    fallbackAbstained: number;
    providerComparable: number;
    providerCorrect: number;
  }> = {};

  for (const observation of observations) {
    if (observation.verification.status === "unknown" || observation.verification.independent !== true) shadow += 1;
    if (observation.verification.status === "rejected" && observation.verification.independent === true) rejected += 1;
  }

  for (const holdoutProject of projectKeys) {
    const training = observations.filter((item) => item.projectKey !== holdoutProject);
    const profile = distillMssrSemanticExperience({ observations: training });
    const holdout = observations.filter((item) => item.projectKey === holdoutProject);
    for (const observation of holdout) {
      const truth = verifiedValue(observation);
      if (!truth) continue;
      verifiedTruth += 1;
      const bucket = byDecisionKind[observation.decisionKind] ??= {
        verifiedTruth: 0,
        fallbackDecided: 0,
        fallbackCorrect: 0,
        fallbackWrong: 0,
        fallbackAbstained: 0,
        providerComparable: 0,
        providerCorrect: 0,
      };
      bucket.verifiedTruth += 1;
      const fallback = classifyMssrSemanticExperienceDeterministically({
        decisionKind: observation.decisionKind,
        feature: observation.feature,
        profile,
      });
      if (fallback.value === null) {
        abstained += 1;
        bucket.fallbackAbstained += 1;
      } else {
        decided += 1;
        bucket.fallbackDecided += 1;
        if (fallback.value === truth) {
          correct += 1;
          bucket.fallbackCorrect += 1;
        } else {
          wrong += 1;
          bucket.fallbackWrong += 1;
        }
      }
      if (observation.proposal) {
        providerComparable += 1;
        bucket.providerComparable += 1;
        if (observation.proposal.value === truth) {
          providerCorrect += 1;
          bucket.providerCorrect += 1;
        } else {
          providerWrong += 1;
        }
      }
    }
  }

  const precision = decided > 0 ? correct / decided : null;
  const coverage = verifiedTruth > 0 ? decided / verifiedTruth : 0;
  const providerAccuracy = providerComparable > 0 ? providerCorrect / providerComparable : null;
  const reasons: string[] = [];
  if (verifiedTruth < policy.minVerifiedHoldout) reasons.push(`verified-holdout:${verifiedTruth}<${policy.minVerifiedHoldout}`);
  if (projectKeys.length < policy.minDistinctProjects) reasons.push(`distinct-projects:${projectKeys.length}<${policy.minDistinctProjects}`);
  if (precision === null) reasons.push("fallback-no-decisions");
  else if (precision < policy.minFallbackPrecision) reasons.push(`fallback-precision:${precision.toFixed(4)}<${policy.minFallbackPrecision.toFixed(4)}`);
  if (coverage < policy.minFallbackCoverage) reasons.push(`fallback-coverage:${coverage.toFixed(4)}<${policy.minFallbackCoverage.toFixed(4)}`);
  if (wrong > policy.maxWrongDecisions) reasons.push(`fallback-wrong:${wrong}>${policy.maxWrongDecisions}`);
  const eligible = reasons.length === 0;

  return {
    schemaVersion: 1,
    mode: "leave-one-project-out",
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    projects: projectKeys.length,
    observations: observations.length,
    verifiedTruth,
    rejected,
    shadow,
    fallback: {
      decided,
      correct,
      wrong,
      abstained,
      precision: precision === null ? null : Number(precision.toFixed(6)),
      coverage: Number(coverage.toFixed(6)),
    },
    provider: {
      comparable: providerComparable,
      correct: providerCorrect,
      wrong: providerWrong,
      accuracy: providerAccuracy === null ? null : Number(providerAccuracy.toFixed(6)),
    },
    byDecisionKind,
    promotion: {
      status: eligible ? "eligible-shadow-primary" : "blocked",
      eligible,
      reasons,
      policy,
      hostMayPreferFallback: eligible,
      advisoryOnly: true,
      authorityInfluence: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    },
  };
}
