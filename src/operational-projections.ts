import type { MssrContextFreshness } from "./context-messages.js";
import type { MssrOperationalNoticeLevel } from "./operational-notices.js";
import type { MssrProjectKnowledgeMaintenanceResult } from "./project-knowledge-maintenance.js";
import {
  evaluateMssrRouteClosureObligations,
  hasFreshMaintenanceClose,
  type MssrTraceLifecycleState,
} from "./trace-contract.js";

export type MssrOperationalProjection = Readonly<{
  level: MssrOperationalNoticeLevel;
  fingerprint: string;
  advisoryOnly: true;
}>;

export type MssrContextFreshnessOperationalProjection = MssrOperationalProjection & Readonly<{
  counts: Readonly<Record<MssrContextFreshness, number>>;
  issueCount: number;
}>;

export type MssrProjectKnowledgeOperationalProjection = MssrOperationalProjection & Readonly<{
  maintenancePending: boolean;
  maintenanceFresh: boolean;
  targets: readonly string[];
}>;

export type MssrTraceLifecycleOperationalProjection = MssrOperationalProjection & Readonly<{
  idleObserved: boolean;
  nextRequiredAction: ReturnType<typeof evaluateMssrRouteClosureObligations>["nextRequiredAction"];
  missingRequiredSkills: readonly string[];
  missingRequiredPhases: readonly string[];
  needsMaintenance: boolean;
  needsCloseReplan: boolean;
}>;

export type MssrTunnelOperationalState = "healthy" | "degraded" | "unavailable" | "unknown";
export type MssrRuntimeContinuityState = "stable" | "restarted" | "unavailable" | "unknown";
export type MssrRestartOperationalState = "none" | "pending" | "failed" | "unknown";
export type MssrTransportOperationalState = "not-observed" | "healthy" | "response-lost" | "upstream-error" | "unknown";

export type MssrInfrastructureOperationalObservation = Readonly<{
  tunnel: MssrTunnelOperationalState;
  runtime: MssrRuntimeContinuityState;
  restart: MssrRestartOperationalState;
  transport?: MssrTransportOperationalState;
}>;

export type MssrInfrastructureOperationalProjection = MssrOperationalProjection & Readonly<{
  tunnel: MssrTunnelOperationalState;
  runtime: MssrRuntimeContinuityState;
  restart: MssrRestartOperationalState;
  transport: MssrTransportOperationalState;
  reasonCodes: readonly string[];
  notifyOnWatch: boolean;
}>;

export type MssrProviderOperationalState = "healthy" | "cached" | "degraded" | "unavailable" | "unknown";
export type MssrProviderTargetOperationalState =
  | "ready"
  | "warming"
  | "inactive"
  | "ambiguous"
  | "missing"
  | "inspection-failed"
  | "not-applicable"
  | "unknown";

export type MssrProviderOperationalObservation = Readonly<{
  providerKey: string;
  provider: MssrProviderOperationalState;
  target?: MssrProviderTargetOperationalState;
}>;

export type MssrProviderOperationalProjection = MssrOperationalProjection & Readonly<{
  providerKey: string;
  provider: MssrProviderOperationalState;
  target: MssrProviderTargetOperationalState;
  reasonCodes: readonly string[];
  notifyOnWatch: boolean;
}>;

export type MssrRoutingComplianceTraceState = "matched" | "missing" | "ambiguous" | "mismatch" | "not-applicable";
export type MssrRoutingComplianceRouteState = "present" | "missing" | "not-applicable";
export type MssrRoutingComplianceBoundary =
  | "ordinary"
  | "substantial-tool"
  | "phase-boundary"
  | "outcome"
  | "skill-load"
  | "route-replacement";
export type MssrRoutingComplianceAction =
  | "start-route"
  | "bootstrap-current-phase"
  | "inspect-traces"
  | "replan-current-trace"
  | "load-required-skills"
  | "complete-required-phases"
  | "record-or-resume-outcome";

export type MssrRoutingComplianceObservation = Readonly<{
  trace: MssrRoutingComplianceTraceState;
  route: MssrRoutingComplianceRouteState;
  boundary: MssrRoutingComplianceBoundary;
  requiredSkills?: readonly string[];
  selectedSkills?: readonly string[];
  loadedSkills?: readonly string[];
  requiredPhases?: readonly string[];
  completedPhases?: readonly string[];
  activeTraceReplacedBeforeOutcome?: boolean;
  routingEvidenceComplete?: boolean;
}>;

export type MssrRoutingComplianceOperationalProjection = MssrOperationalProjection & Readonly<{
  trace: MssrRoutingComplianceTraceState;
  route: MssrRoutingComplianceRouteState;
  boundary: MssrRoutingComplianceBoundary;
  reasonCodes: readonly string[];
  recommendedRequiredSkills: readonly string[];
  missingRequiredPhases: readonly string[];
  recommendedActions: readonly MssrRoutingComplianceAction[];
  notifyOnWatch: boolean;
}>;

/**
 * Length-prefixed, deterministic identity for bounded operational evidence.
 * It is intentionally not a cryptographic hash: adapters may hash it for their
 * own queue keys, while every MSSR host still compares the same semantic value.
 */
export function buildMssrOperationalFingerprint(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("|");
}

/**
 * Project current Context Plane freshness into the shared operational levels.
 * Fresh evidence is OK, unknown-only evidence is WATCH, stale/unavailable is
 * REVIEW, and contradictory identity/provenance evidence is ERROR.
 */
export function evaluateMssrContextFreshnessOperationalAttention(
  freshness: readonly MssrContextFreshness[],
): MssrContextFreshnessOperationalProjection {
  const counts: Record<MssrContextFreshness, number> = {
    fresh: 0,
    stale: 0,
    conflicting: 0,
    unavailable: 0,
    unknown: 0,
  };
  for (const value of freshness) counts[value] += 1;

  const issueCount = counts.stale + counts.conflicting + counts.unavailable + counts.unknown;
  const level: MssrOperationalNoticeLevel = counts.conflicting > 0
    ? "error"
    : counts.stale > 0 || counts.unavailable > 0
      ? "review"
      : counts.unknown > 0
        ? "watch"
        : "ok";

  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `fresh:${counts.fresh}`,
      `stale:${counts.stale}`,
      `conflicting:${counts.conflicting}`,
      `unavailable:${counts.unavailable}`,
      `unknown:${counts.unknown}`,
    ]),
    counts,
    issueCount,
    advisoryOnly: true,
  };
}

/**
 * Project durable project-knowledge review debt into operational attention.
 * Completing maintenance for the current lifecycle revision resolves the
 * operational warning even though historical evidence remains in the trace.
 * A later material change invalidates that maintenance revision and reopens it.
 */
export function evaluateMssrProjectKnowledgeOperationalAttention(
  advisory: MssrProjectKnowledgeMaintenanceResult,
  lifecycle?: MssrTraceLifecycleState | null,
): MssrProjectKnowledgeOperationalProjection {
  const maintenanceFresh = Boolean(lifecycle?.maintenanceRequired)
    && lifecycle !== null
    && lifecycle !== undefined
    && hasFreshMaintenanceClose(lifecycle);
  const maintenancePending = Boolean(lifecycle?.maintenanceRequired) && !maintenanceFresh;
  const targetIdentity = advisory.targets
    .map((target) => `${target.target}:${target.level}:${target.authority}:${[...target.reasons].sort().join(",")}`)
    .sort();

  let level: MssrOperationalNoticeLevel;
  if (maintenanceFresh) level = "ok";
  else if (advisory.level === "required") level = "error";
  else if (advisory.level === "review" || maintenancePending) level = "review";
  else if (advisory.level === "watch") level = "watch";
  else level = "ok";

  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `maintenance-pending:${maintenancePending}`,
      `lifecycle-revision:${lifecycle?.lifecycleRevision ?? 0}`,
      ...targetIdentity,
    ]),
    maintenancePending,
    maintenanceFresh,
    targets: targetIdentity,
    advisoryOnly: true,
  };
}

/**
 * Host-neutral interpretation of an idle observation for an open trace.
 * The host owns the timer; MSSR owns what the bounded signal means. Silence is
 * never proof of completion, so idle can request REVIEW but cannot become ERROR
 * or synthesize an outcome.
 */
export function evaluateMssrTraceLifecycleOperationalAttention(
  lifecycle: MssrTraceLifecycleState,
  options: Readonly<{ idleObserved: boolean }>,
): MssrTraceLifecycleOperationalProjection {
  const closure = evaluateMssrRouteClosureObligations(lifecycle);
  const level: MssrOperationalNoticeLevel = lifecycle.closed || !options.idleObserved ? "ok" : "review";
  const missingRequiredSkills = [...closure.missingRequiredSkills].sort();
  const missingRequiredPhases = [...closure.missingRequiredPhases].sort();

  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `stage:${lifecycle.stage}`,
      `lifecycle-revision:${lifecycle.lifecycleRevision}`,
      `next:${closure.nextRequiredAction}`,
      `missing-skills:${missingRequiredSkills.join(",")}`,
      `missing-phases:${missingRequiredPhases.join(",")}`,
      `needs-close-replan:${closure.needsCloseReplan}`,
      `needs-maintenance:${closure.needsMaintenance}`,
    ]),
    idleObserved: options.idleObserved,
    nextRequiredAction: closure.nextRequiredAction,
    missingRequiredSkills,
    missingRequiredPhases,
    needsMaintenance: closure.needsMaintenance,
    needsCloseReplan: closure.needsCloseReplan,
    advisoryOnly: true,
  };
}


/**
 * Interpret current host infrastructure evidence without equating a transport
 * symptom with operation failure. A response loss by itself is WATCH; a
 * corroborated runtime restart while the response was lost is REVIEW.
 */
export function evaluateMssrInfrastructureOperationalAttention(
  observation: MssrInfrastructureOperationalObservation,
): MssrInfrastructureOperationalProjection {
  const transport = observation.transport ?? "not-observed";
  const reasonCodes: string[] = [];

  if (observation.tunnel === "unavailable") reasonCodes.push("tunnel-unavailable");
  else if (observation.tunnel === "degraded") reasonCodes.push("tunnel-degraded");
  else if (observation.tunnel === "unknown") reasonCodes.push("tunnel-unknown");

  if (observation.runtime === "unavailable") reasonCodes.push("runtime-unavailable");
  else if (observation.runtime === "restarted") reasonCodes.push("runtime-restarted");
  else if (observation.runtime === "unknown") reasonCodes.push("runtime-unknown");

  if (observation.restart === "failed") reasonCodes.push("restart-failed");
  else if (observation.restart === "pending") reasonCodes.push("restart-pending");
  else if (observation.restart === "unknown") reasonCodes.push("restart-unknown");

  if (transport === "response-lost") reasonCodes.push("transport-response-lost");
  else if (transport === "upstream-error") reasonCodes.push("transport-upstream-error");
  else if (transport === "unknown") reasonCodes.push("transport-unknown");

  const hasTransportLoss = transport === "response-lost" || transport === "upstream-error";
  const level: MssrOperationalNoticeLevel = observation.tunnel === "unavailable"
    || observation.runtime === "unavailable"
    || observation.restart === "failed"
    ? "error"
    : observation.tunnel === "degraded"
      || observation.restart === "pending"
      || (observation.runtime === "restarted" && hasTransportLoss)
      ? "review"
      : observation.runtime === "restarted"
        || hasTransportLoss
        || observation.tunnel === "unknown"
        || observation.runtime === "unknown"
        || observation.restart === "unknown"
        || transport === "unknown"
        ? "watch"
        : "ok";

  const sortedReasons = [...reasonCodes].sort();
  const notifyOnWatch = level === "watch" && sortedReasons.some((reason) =>
    reason === "runtime-restarted"
    || reason === "transport-response-lost"
    || reason === "transport-upstream-error");

  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `tunnel:${observation.tunnel}`,
      `runtime:${observation.runtime}`,
      `restart:${observation.restart}`,
      `transport:${transport}`,
      `reasons:${sortedReasons.join(",")}`,
    ]),
    tunnel: observation.tunnel,
    runtime: observation.runtime,
    restart: observation.restart,
    transport,
    reasonCodes: sortedReasons,
    notifyOnWatch,
    advisoryOnly: true,
  };
}

/**
 * Normalize provider/catalog/target evidence into the shared attention levels.
 * Provider availability and target readiness remain distinct so a missing or
 * ambiguous target never masquerades as a dead provider.
 */
export function evaluateMssrProviderOperationalAttention(
  observation: MssrProviderOperationalObservation,
): MssrProviderOperationalProjection {
  const providerKey = observation.providerKey.trim().slice(0, 120) || "provider";
  const target = observation.target ?? "not-applicable";
  const reasonCodes: string[] = [];

  if (observation.provider === "unavailable") reasonCodes.push("provider-unavailable");
  else if (observation.provider === "degraded") reasonCodes.push("provider-degraded");
  else if (observation.provider === "cached") reasonCodes.push("provider-cached");
  else if (observation.provider === "unknown") reasonCodes.push("provider-unknown");

  if (target === "warming") reasonCodes.push("target-warming");
  else if (target === "inactive") reasonCodes.push("target-inactive");
  else if (target === "ambiguous") reasonCodes.push("target-ambiguous");
  else if (target === "missing") reasonCodes.push("target-missing");
  else if (target === "inspection-failed") reasonCodes.push("target-inspection-failed");
  else if (target === "unknown") reasonCodes.push("target-unknown");

  const level: MssrOperationalNoticeLevel = observation.provider === "unavailable"
    ? "error"
    : observation.provider === "cached"
      || observation.provider === "degraded"
      || target === "ambiguous"
      || target === "missing"
      || target === "inspection-failed"
      ? "review"
      : observation.provider === "unknown"
        || target === "warming"
        || target === "inactive"
        || target === "unknown"
        ? "watch"
        : "ok";

  const sortedReasons = [...reasonCodes].sort();
  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `provider-key:${providerKey}`,
      `provider:${observation.provider}`,
      `target:${target}`,
      `reasons:${sortedReasons.join(",")}`,
    ]),
    providerKey,
    provider: observation.provider,
    target,
    reasonCodes: sortedReasons,
    notifyOnWatch: false,
    advisoryOnly: true,
  };
}


function normalizedSorted(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function missingValues(required: readonly string[] | undefined, completed: readonly string[] | undefined): string[] {
  const completedSet = new Set(normalizedSorted(completed));
  return normalizedSorted(required).filter((value) => !completedSet.has(value));
}

/**
 * Portable C2b routing-compliance projection. Hosts observe trace/route/tool
 * evidence; MSSR assigns semantic attention and remediation hints. Optional
 * selected skills are deliberately excluded from compliance: only required
 * skills/phases can make the route incomplete.
 */
export function evaluateMssrRoutingComplianceOperationalAttention(
  observation: MssrRoutingComplianceObservation,
): MssrRoutingComplianceOperationalProjection {
  const missingSkills = missingValues(observation.requiredSkills, observation.loadedSkills);
  const missingPhases = observation.boundary === "outcome"
    ? missingValues(observation.requiredPhases, observation.completedPhases)
    : [];
  const reasonCodes: string[] = [];
  const recommendedActions = new Set<MssrRoutingComplianceAction>();
  const evidenceComplete = observation.routingEvidenceComplete !== false;

  if (!evidenceComplete) reasonCodes.push("routing-evidence-incomplete");

  if (observation.trace === "missing") {
    reasonCodes.push("trace-missing");
    recommendedActions.add("bootstrap-current-phase");
  } else if (observation.trace === "ambiguous") {
    reasonCodes.push("trace-ambiguous");
    recommendedActions.add("inspect-traces");
  } else if (observation.trace === "mismatch") {
    reasonCodes.push("trace-mismatch");
    recommendedActions.add("inspect-traces");
    recommendedActions.add("replan-current-trace");
  }

  if (observation.route === "missing") {
    reasonCodes.push("route-missing");
    if (observation.boundary === "substantial-tool") {
      reasonCodes.push("substantial-tool-without-route");
      recommendedActions.add("start-route");
    } else if (observation.boundary === "outcome") {
      reasonCodes.push("outcome-without-route");
      recommendedActions.add("start-route");
    }
  }

  if (missingSkills.length > 0) {
    reasonCodes.push("required-skill-not-loaded");
    recommendedActions.add("bootstrap-current-phase");
    recommendedActions.add("load-required-skills");
  }

  if (missingPhases.length > 0) {
    reasonCodes.push("required-phase-incomplete");
    recommendedActions.add("complete-required-phases");
  }

  if (observation.activeTraceReplacedBeforeOutcome === true) {
    reasonCodes.push("active-trace-replaced-before-outcome");
    recommendedActions.add("inspect-traces");
    recommendedActions.add("record-or-resume-outcome");
  }

  const sortedReasons = [...new Set(reasonCodes)].sort();
  const sortedActions = [...recommendedActions].sort();
  const fatal = observation.trace === "mismatch"
    || (observation.boundary === "outcome" && (
      observation.route === "missing"
      || observation.trace === "missing"
      || observation.trace === "ambiguous"
      || missingSkills.length > 0
      || missingPhases.length > 0
    ));
  const actionable = observation.trace === "missing"
    || observation.trace === "ambiguous"
    || observation.boundary === "substantial-tool" && observation.route === "missing"
    || observation.boundary === "phase-boundary" && missingSkills.length > 0
    || observation.activeTraceReplacedBeforeOutcome === true;
  const lowConfidence = !evidenceComplete || observation.route === "missing";
  const level: MssrOperationalNoticeLevel = fatal
    ? "error"
    : actionable
      ? "review"
      : lowConfidence
        ? "watch"
        : "ok";

  return {
    level,
    fingerprint: buildMssrOperationalFingerprint([
      `trace:${observation.trace}`,
      `route:${observation.route}`,
      `boundary:${observation.boundary}`,
      `missing-skills:${missingSkills.join(",")}`,
      `missing-phases:${missingPhases.join(",")}`,
      `replaced-before-outcome:${observation.activeTraceReplacedBeforeOutcome === true}`,
      `evidence-complete:${evidenceComplete}`,
      `reasons:${sortedReasons.join(",")}`,
    ]),
    trace: observation.trace,
    route: observation.route,
    boundary: observation.boundary,
    reasonCodes: sortedReasons,
    recommendedRequiredSkills: missingSkills,
    missingRequiredPhases: missingPhases,
    recommendedActions: sortedActions,
    notifyOnWatch: false,
    advisoryOnly: true,
  };
}
