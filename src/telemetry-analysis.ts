import { z } from "zod";

import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";
import {
  learningContextKey,
  learningTransitionKey,
  mssrSemanticSignature,
  type MssrLearningDigest,
} from "./learning.js";

export type MssrTelemetryRate = Readonly<{
  numerator: number;
  denominator: number;
  value: number | null;
}>;

export type MssrMaintenanceCandidate = Readonly<{
  kind: "recurring-signal" | "required-load-gap";
  reviewOnly: true;
  signal?: string;
  skillName?: string;
  distinctTraceCount: number;
  traceIds: readonly string[];
}>;

export type MssrSkillSelectionSignature = Readonly<{
  signature: string;
  accepted: number;
  skipped: number;
  total: number;
}>;

export type MssrSkillSelectionFeedback = Readonly<{
  skillName: string;
  accepted: number;
  skipped: number;
  total: number;
  acceptanceRate: number | null;
  reasonCounts: Readonly<Record<string, number>>;
  signatures: readonly MssrSkillSelectionSignature[];
}>;

export type MssrHistoricalPriorRecommendation = "prefer" | "neutral" | "deprioritize" | "insufficient-evidence";

export type MssrSkillHistoricalPrior = Readonly<{
  semanticSignature: string;
  skillName: string;
  evidenceCount: number;
  recommendedCount: number;
  loadedCount: number;
  acceptedCount: number;
  skippedCount: number;
  successfulLoadedOutcomes: number;
  loadedOutcomeCount: number;
  activationRate: number | null;
  acceptanceRate: number | null;
  successRateWhenLoaded: number | null;
  eligible: boolean;
  recommendation: MssrHistoricalPriorRecommendation;
}>;

export type MssrSkillTransitionPrior = Readonly<{
  semanticSignature: string;
  fromStage: string;
  toStage: string;
  skillName: string;
  count: number;
  eligible: boolean;
}>;

export type MssrContextHistoricalPrior = Readonly<{
  semanticSignature: string;
  scope: "skill" | "project";
  owner: string;
  module: string;
  selected: number;
  skipped: number;
  total: number;
  selectionRate: number | null;
  eligible: boolean;
  recommendation: MssrHistoricalPriorRecommendation;
}>;

export type MssrTelemetryAnalysis = Readonly<{
  counters: Readonly<{
    inputEvents: number;
    validEvents: number;
    invalidEvents: number;
    duplicateEvents: number;
    routedTraces: number;
    tracesWithOutcome: number;
    learningDigests: number;
  }>;
  rates: Readonly<{
    structuredRouteRate: MssrTelemetryRate;
    requiredLoadCompliance: MssrTelemetryRate;
    selectedRouteToLoadCoverage: MssrTelemetryRate;
    verificationCoverage: MssrTelemetryRate;
    persistenceCoverage: MssrTelemetryRate;
    outcomeAttributionCoverage: MssrTelemetryRate;
    successRate: MssrTelemetryRate;
    acceptanceRate: MssrTelemetryRate;
  }>;
  intentDimensions: Readonly<{
    domains: Readonly<Record<string, number>>;
    actions: Readonly<Record<string, number>>;
    artifacts: Readonly<Record<string, number>>;
    needs: Readonly<Record<string, number>>;
    signals: Readonly<Record<string, number>>;
    risks: Readonly<Record<string, number>>;
    ambiguities: Readonly<Record<string, number>>;
  }>;
  selectionFeedback: readonly MssrSkillSelectionFeedback[];
  maintenanceCandidates: readonly MssrMaintenanceCandidate[];
  learning: Readonly<{
    mode: "observe-only";
    routingInfluence: false;
    digestCount: number;
    minEvidence: number;
    skillPriors: readonly MssrSkillHistoricalPrior[];
    transitions: readonly MssrSkillTransitionPrior[];
    contextPriors: readonly MssrContextHistoricalPrior[];
  }>;
}>;

type RouteEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "route" }>;
};
type LoadEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "skill_load" }>;
};
type DecisionEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "skill_decision" }>;
};
type CheckpointEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "checkpoint" }>;
};
type DigestEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "learning_digest" }>;
};

type TraceEvents = {
  routes: RouteEnvelope[];
  loads: LoadEnvelope[];
  decisions: DecisionEnvelope[];
  checkpoints: CheckpointEnvelope[];
  digests: DigestEnvelope[];
};

function rate(numerator: number, denominator: number): MssrTelemetryRate {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator };
}

function increment(target: Record<string, number>, values: readonly string[]): void {
  for (const value of new Set(values)) target[value] = (target[value] ?? 0) + 1;
}

function sortedCounts(value: Record<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function latest<T extends MssrTelemetryEnvelope>(events: readonly T[]): T | undefined {
  return [...events].sort((left, right) => left.emittedAt.localeCompare(right.emittedAt)).at(-1);
}

function latestAtOrBefore<T extends MssrTelemetryEnvelope>(events: readonly T[], emittedAt: string): T | undefined {
  return [...events]
    .filter((event) => event.emittedAt <= emittedAt)
    .sort((left, right) => left.emittedAt.localeCompare(right.emittedAt))
    .at(-1);
}

function routeSemanticSignature(route: RouteEnvelope["event"]["route"]): string {
  return mssrSemanticSignature(route);
}

function priorRecommendation(args: {
  eligible: boolean;
  positiveRate: number | null;
  successRate?: number | null;
}): MssrHistoricalPriorRecommendation {
  if (!args.eligible) return "insufficient-evidence";
  if (args.positiveRate !== null && args.positiveRate <= 0.3) return "deprioritize";
  if (args.positiveRate !== null && args.positiveRate >= 0.7 && (args.successRate === undefined || args.successRate === null || args.successRate >= 0.6)) return "prefer";
  return "neutral";
}

function boundedCandidate(
  kind: MssrMaintenanceCandidate["kind"],
  key: string,
  traceIds: Set<string>,
): MssrMaintenanceCandidate {
  const ids = [...traceIds].sort();
  return {
    kind,
    reviewOnly: true,
    ...(kind === "recurring-signal" ? { signal: key } : { skillName: key }),
    distinctTraceCount: ids.length,
    traceIds: ids.slice(0, 20),
  };
}

/**
 * Analyze privacy-bounded MSSR telemetry without reading prompts or inferring
 * unobserved skills. Candidates are review queues, never rewrite directives.
 */
export function analyzeMssrTelemetry(
  input: readonly unknown[],
  options: { minDistinctTraces?: number; minLearningTraces?: number } = {},
): MssrTelemetryAnalysis {
  const minDistinctTraces = z.number().int().min(2).max(100).default(3).parse(options.minDistinctTraces);
  const minLearningTraces = z.number().int().min(2).max(100).default(5).parse(options.minLearningTraces);
  const seen = new Set<string>();
  const events: MssrTelemetryEnvelope[] = [];
  let invalidEvents = 0;
  let duplicateEvents = 0;

  for (const item of input) {
    const parsed = mssrTelemetryEnvelopeSchema.safeParse(item);
    if (!parsed.success) {
      invalidEvents += 1;
      continue;
    }
    if (seen.has(parsed.data.eventId)) {
      duplicateEvents += 1;
      continue;
    }
    seen.add(parsed.data.eventId);
    events.push(parsed.data);
  }

  const traces = new Map<string, TraceEvents>();
  for (const event of events) {
    const trace = traces.get(event.traceId) ?? { routes: [], loads: [], decisions: [], checkpoints: [], digests: [] };
    if (event.event.kind === "route") trace.routes.push(event as RouteEnvelope);
    if (event.event.kind === "skill_load") trace.loads.push(event as LoadEnvelope);
    if (event.event.kind === "skill_decision") trace.decisions.push(event as DecisionEnvelope);
    if (event.event.kind === "checkpoint") trace.checkpoints.push(event as CheckpointEnvelope);
    if (event.event.kind === "learning_digest") trace.digests.push(event as DigestEnvelope);
    traces.set(event.traceId, trace);
  }

  const learningDigests: MssrLearningDigest[] = [...traces.values()].flatMap((trace) => {
    const digest = latest(trace.digests);
    return digest ? [digest.event.digest] : [];
  });

  let routedTraces = 0;
  let structuredRoutes = 0;
  let selectedSkills = 0;
  let selectedSkillsLoaded = 0;
  let requiredSkills = 0;
  let requiredSkillsLoaded = 0;
  let verificationRequired = 0;
  let verificationPassed = 0;
  let persistenceRequired = 0;
  let persistencePassed = 0;
  let tracesWithOutcome = 0;
  let attributedOutcomes = 0;
  let successfulOutcomes = 0;
  let measuredAcceptance = 0;
  let acceptedOutcomes = 0;

  const dimensionCounts = {
    domains: {} as Record<string, number>,
    actions: {} as Record<string, number>,
    artifacts: {} as Record<string, number>,
    needs: {} as Record<string, number>,
    signals: {} as Record<string, number>,
    risks: {} as Record<string, number>,
    ambiguities: {} as Record<string, number>,
  };
  const signalTraces = new Map<string, Set<string>>();
  const missingSkillTraces = new Map<string, Set<string>>();
  const decisionStats = new Map<string, {
    accepted: number;
    skipped: number;
    reasons: Record<string, number>;
    signatures: Map<string, { accepted: number; skipped: number }>;
  }>();

  for (const [traceId, trace] of traces) {
    const routeEnvelope = latest(trace.routes);
    if (!routeEnvelope) continue;
    routedTraces += 1;
    const route = routeEnvelope.event.route;
    if (route.classificationMode === "structured-semantic") structuredRoutes += 1;

    const loaded = new Set(trace.loads.filter((event) => event.event.loaded).map((event) => event.event.skillName));
    const selected = new Set(route.activeSkills.map((skill) => skill.name));
    const required = new Set(route.activeSkills.filter((skill) => skill.required).map((skill) => skill.name));
    selectedSkills += selected.size;
    selectedSkillsLoaded += [...selected].filter((skill) => loaded.has(skill)).length;
    requiredSkills += required.size;
    requiredSkillsLoaded += [...required].filter((skill) => loaded.has(skill)).length;
    for (const skillName of required) {
      if (loaded.has(skillName)) continue;
      const ids = missingSkillTraces.get(skillName) ?? new Set<string>();
      ids.add(traceId);
      missingSkillTraces.set(skillName, ids);
    }

    for (const decisionEnvelope of trace.decisions) {
      const decision = decisionEnvelope.event.decision;
      const stats = decisionStats.get(decision.skillName) ?? {
        accepted: 0,
        skipped: 0,
        reasons: {},
        signatures: new Map<string, { accepted: number; skipped: number }>(),
      };
      if (decision.decision === "accepted") stats.accepted += 1;
      else stats.skipped += 1;
      stats.reasons[decision.reasonCode] = (stats.reasons[decision.reasonCode] ?? 0) + 1;

      const decisionRoute = latestAtOrBefore(trace.routes, decisionEnvelope.emittedAt) ?? routeEnvelope;
      const signature = routeSemanticSignature(decisionRoute.event.route);
      const signatureStats = stats.signatures.get(signature) ?? { accepted: 0, skipped: 0 };
      if (decision.decision === "accepted") signatureStats.accepted += 1;
      else signatureStats.skipped += 1;
      stats.signatures.set(signature, signatureStats);
      decisionStats.set(decision.skillName, stats);
    }

    const checkpoints = trace.checkpoints.map((event) => event.event.checkpoint);
    if (route.requiredPhases.includes("verification")) {
      verificationRequired += 1;
      if (checkpoints.some((checkpoint) => checkpoint.eventType === "verification"
        && checkpoint.status === "success" && checkpoint.verificationPassed === true)) verificationPassed += 1;
    }
    if (route.requiredPhases.includes("persistence")) {
      persistenceRequired += 1;
      if (checkpoints.some((checkpoint) => checkpoint.eventType === "persistence"
        && checkpoint.status === "success" && checkpoint.persisted === true)) persistencePassed += 1;
    }

    const outcome = latest(trace.checkpoints.filter((event) => event.event.checkpoint.eventType === "outcome"));
    if (outcome) {
      tracesWithOutcome += 1;
      const value = outcome.event.checkpoint;
      if (value.primarySkill) attributedOutcomes += 1;
      if (value.status === "success") successfulOutcomes += 1;
      if (typeof value.accepted === "boolean") {
        measuredAcceptance += 1;
        if (value.accepted) acceptedOutcomes += 1;
      }
    }

    const intent = route.intent;
    const signals = intent?.signals ?? route.signals;
    if (intent) {
      increment(dimensionCounts.domains, intent.domains);
      increment(dimensionCounts.actions, intent.actions);
      increment(dimensionCounts.artifacts, intent.artifacts);
      increment(dimensionCounts.needs, intent.needs);
      increment(dimensionCounts.risks, [intent.risk]);
      increment(dimensionCounts.ambiguities, [intent.ambiguity]);
    }
    increment(dimensionCounts.signals, signals);
    for (const signal of new Set(signals.filter((value) => value !== "nominal"))) {
      const ids = signalTraces.get(signal) ?? new Set<string>();
      ids.add(traceId);
      signalTraces.set(signal, ids);
    }
  }

  const selectionFeedback: MssrSkillSelectionFeedback[] = [...decisionStats.entries()]
    .map(([skillName, stats]) => {
      const total = stats.accepted + stats.skipped;
      return {
        skillName,
        accepted: stats.accepted,
        skipped: stats.skipped,
        total,
        acceptanceRate: total === 0 ? null : stats.accepted / total,
        reasonCounts: sortedCounts(stats.reasons),
        signatures: [...stats.signatures.entries()]
          .map(([signature, values]) => ({
            signature,
            accepted: values.accepted,
            skipped: values.skipped,
            total: values.accepted + values.skipped,
          }))
          .sort((left, right) => left.signature.localeCompare(right.signature)),
      };
    })
    .sort((left, right) => left.skillName.localeCompare(right.skillName));

  const skillPriorStats = new Map<string, {
    semanticSignature: string;
    skillName: string;
    evidenceCount: number;
    recommendedCount: number;
    loadedCount: number;
    acceptedCount: number;
    skippedCount: number;
    successfulLoadedOutcomes: number;
    loadedOutcomeCount: number;
  }>();
  const transitionStats = new Map<string, { semanticSignature: string; fromStage: string; toStage: string; skillName: string; count: number }>();
  const contextStats = new Map<string, { semanticSignature: string; scope: "skill" | "project"; owner: string; module: string; selected: number; skipped: number }>();

  for (const digest of learningDigests) {
    const signature = digest.semanticSignature;
    const recommended = new Set(digest.recommendedSkills);
    const loaded = new Set(digest.loadedSkills);
    const latestDecisionBySkill = new Map<string, MssrLearningDigest["skillDecisions"][number]>();
    for (const decision of digest.skillDecisions) latestDecisionBySkill.set(decision.skillName, decision);
    const skills = new Set([...recommended, ...loaded, ...latestDecisionBySkill.keys()]);

    for (const skillName of skills) {
      const key = `${signature}\n${skillName}`;
      const stats = skillPriorStats.get(key) ?? {
        semanticSignature: signature,
        skillName,
        evidenceCount: 0,
        recommendedCount: 0,
        loadedCount: 0,
        acceptedCount: 0,
        skippedCount: 0,
        successfulLoadedOutcomes: 0,
        loadedOutcomeCount: 0,
      };
      stats.evidenceCount += 1;
      if (recommended.has(skillName)) stats.recommendedCount += 1;
      if (loaded.has(skillName)) {
        stats.loadedCount += 1;
        stats.loadedOutcomeCount += 1;
        if (digest.outcome.status === "success") stats.successfulLoadedOutcomes += 1;
      }
      const decision = latestDecisionBySkill.get(skillName);
      if (decision?.decision === "accepted") stats.acceptedCount += 1;
      if (decision?.decision === "skipped") stats.skippedCount += 1;
      skillPriorStats.set(key, stats);
    }

    for (const transition of digest.skillTransitions) {
      const key = `${signature}\n${learningTransitionKey(transition)}`;
      const stats = transitionStats.get(key) ?? { semanticSignature: signature, ...transition, count: 0 };
      stats.count += 1;
      transitionStats.set(key, stats);
    }

    for (const selection of digest.contextSelections) {
      const key = `${signature}\n${learningContextKey(selection)}`;
      const stats = contextStats.get(key) ?? {
        semanticSignature: signature,
        scope: selection.scope,
        owner: selection.owner,
        module: selection.module,
        selected: 0,
        skipped: 0,
      };
      if (selection.selected) stats.selected += 1;
      else stats.skipped += 1;
      contextStats.set(key, stats);
    }
  }

  const skillPriors: MssrSkillHistoricalPrior[] = [...skillPriorStats.values()].map((stats) => {
    const decisions = stats.acceptedCount + stats.skippedCount;
    const activationRate = stats.recommendedCount === 0 ? null : stats.loadedCount / stats.recommendedCount;
    const acceptanceRate = decisions === 0 ? null : stats.acceptedCount / decisions;
    const successRateWhenLoaded = stats.loadedOutcomeCount === 0 ? null : stats.successfulLoadedOutcomes / stats.loadedOutcomeCount;
    const eligible = stats.evidenceCount >= minLearningTraces;
    return {
      ...stats,
      activationRate,
      acceptanceRate,
      successRateWhenLoaded,
      eligible,
      recommendation: priorRecommendation({ eligible, positiveRate: acceptanceRate ?? activationRate, successRate: successRateWhenLoaded }),
    };
  }).sort((left, right) => left.semanticSignature.localeCompare(right.semanticSignature) || left.skillName.localeCompare(right.skillName));

  const transitions: MssrSkillTransitionPrior[] = [...transitionStats.values()]
    .map((stats) => ({ ...stats, eligible: stats.count >= minLearningTraces }))
    .sort((left, right) => left.semanticSignature.localeCompare(right.semanticSignature)
      || left.fromStage.localeCompare(right.fromStage)
      || left.toStage.localeCompare(right.toStage)
      || left.skillName.localeCompare(right.skillName));

  const contextPriors: MssrContextHistoricalPrior[] = [...contextStats.values()].map((stats) => {
    const total = stats.selected + stats.skipped;
    const selectionRate = total === 0 ? null : stats.selected / total;
    const eligible = total >= minLearningTraces;
    return {
      ...stats,
      total,
      selectionRate,
      eligible,
      recommendation: priorRecommendation({ eligible, positiveRate: selectionRate }),
    };
  }).sort((left, right) => left.semanticSignature.localeCompare(right.semanticSignature)
    || left.scope.localeCompare(right.scope)
    || left.owner.localeCompare(right.owner)
    || left.module.localeCompare(right.module));

  const maintenanceCandidates = [
    ...[...signalTraces.entries()]
      .filter(([, ids]) => ids.size >= minDistinctTraces)
      .map(([signal, ids]) => boundedCandidate("recurring-signal", signal, ids)),
    ...[...missingSkillTraces.entries()]
      .filter(([, ids]) => ids.size >= minDistinctTraces)
      .map(([skillName, ids]) => boundedCandidate("required-load-gap", skillName, ids)),
  ].sort((left, right) => left.kind.localeCompare(right.kind)
    || (left.signal ?? left.skillName ?? "").localeCompare(right.signal ?? right.skillName ?? ""));

  return {
    counters: {
      inputEvents: input.length,
      validEvents: events.length,
      invalidEvents,
      duplicateEvents,
      routedTraces,
      tracesWithOutcome,
      learningDigests: learningDigests.length,
    },
    rates: {
      structuredRouteRate: rate(structuredRoutes, routedTraces),
      requiredLoadCompliance: rate(requiredSkillsLoaded, requiredSkills),
      selectedRouteToLoadCoverage: rate(selectedSkillsLoaded, selectedSkills),
      verificationCoverage: rate(verificationPassed, verificationRequired),
      persistenceCoverage: rate(persistencePassed, persistenceRequired),
      outcomeAttributionCoverage: rate(attributedOutcomes, tracesWithOutcome),
      successRate: rate(successfulOutcomes, tracesWithOutcome),
      acceptanceRate: rate(acceptedOutcomes, measuredAcceptance),
    },
    intentDimensions: {
      domains: sortedCounts(dimensionCounts.domains),
      actions: sortedCounts(dimensionCounts.actions),
      artifacts: sortedCounts(dimensionCounts.artifacts),
      needs: sortedCounts(dimensionCounts.needs),
      signals: sortedCounts(dimensionCounts.signals),
      risks: sortedCounts(dimensionCounts.risks),
      ambiguities: sortedCounts(dimensionCounts.ambiguities),
    },
    selectionFeedback,
    maintenanceCandidates,
    learning: {
      mode: "observe-only",
      routingInfluence: false,
      digestCount: learningDigests.length,
      minEvidence: minLearningTraces,
      skillPriors,
      transitions,
      contextPriors,
    },
  };
}
