import { z } from "zod";

import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

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

export type MssrTelemetryAnalysis = Readonly<{
  counters: Readonly<{
    inputEvents: number;
    validEvents: number;
    invalidEvents: number;
    duplicateEvents: number;
    routedTraces: number;
    tracesWithOutcome: number;
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
  maintenanceCandidates: readonly MssrMaintenanceCandidate[];
}>;

type RouteEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "route" }>;
};
type LoadEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "skill_load" }>;
};
type CheckpointEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "checkpoint" }>;
};

type TraceEvents = {
  routes: RouteEnvelope[];
  loads: LoadEnvelope[];
  checkpoints: CheckpointEnvelope[];
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
  options: { minDistinctTraces?: number } = {},
): MssrTelemetryAnalysis {
  const minDistinctTraces = z.number().int().min(2).max(100).default(3).parse(options.minDistinctTraces);
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
    const trace = traces.get(event.traceId) ?? { routes: [], loads: [], checkpoints: [] };
    if (event.event.kind === "route") trace.routes.push(event as RouteEnvelope);
    if (event.event.kind === "skill_load") trace.loads.push(event as LoadEnvelope);
    if (event.event.kind === "checkpoint") trace.checkpoints.push(event as CheckpointEnvelope);
    traces.set(event.traceId, trace);
  }

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
    maintenanceCandidates,
  };
}
