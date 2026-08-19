import type { MssrOperationalNoticeLevel } from "./operational-notices.js";
import { buildMssrOperationalFingerprint, type MssrOperationalProjection } from "./operational-projections.js";

export const MSSR_CONSISTENCY_AUTHORITIES = ["canonical", "replica", "historical"] as const;
export const MSSR_CONSISTENCY_ROLES = ["source", "generated", "installed", "runtime", "memory", "receipt", "state", "reference", "other"] as const;
export const MSSR_CONSISTENCY_OBSERVATION_STATES = ["observed", "unavailable", "unknown"] as const;
export const MSSR_CONSISTENCY_BOUNDARIES = ["ordinary", "context-load", "pre-execution", "pre-release", "post-restart", "outcome"] as const;

export type MssrConsistencyAuthority = typeof MSSR_CONSISTENCY_AUTHORITIES[number];
export type MssrConsistencyRole = typeof MSSR_CONSISTENCY_ROLES[number];
export type MssrConsistencyObservationState = typeof MSSR_CONSISTENCY_OBSERVATION_STATES[number];
export type MssrConsistencyBoundary = typeof MSSR_CONSISTENCY_BOUNDARIES[number];
export type MssrConsistencyMismatchKind = "canonical-conflict" | "value" | "revision" | "availability" | "insufficient";
export type MssrConsistencyAction =
  | "load-canonical-authority"
  | "inspect-canonical-authorities"
  | "inspect-source-replica"
  | "rebuild-generated-artifact"
  | "refresh-installed-artifact"
  | "verify-live-runtime"
  | "revalidate-context-evidence"
  | "review-stale-claim"
  | "replan-current-context";

export type MssrConsistencyObservation = Readonly<{
  /** Semantic fact being compared, for example `bridge.release-version`. */
  key: string;
  /** Stable bounded observer identity, for example `package.json` or `live-runtime`. */
  observer: string;
  role: MssrConsistencyRole;
  authority: MssrConsistencyAuthority;
  state: MssrConsistencyObservationState;
  /** Bounded structured claim only. Never pass raw prompts, transcripts, logs or free-form memory bodies. */
  value?: string;
  /** Optional bounded source revision/hash/version identity. */
  revision?: string;
  /** Whether this observation must agree/be available at critical release or closure boundaries. */
  required?: boolean;
}>;

export type MssrConsistencyMismatch = Readonly<{
  key: string;
  kind: MssrConsistencyMismatchKind;
  authorityObserver: string | null;
  observedObserver: string;
  observedRole: MssrConsistencyRole;
  observedAuthority: MssrConsistencyAuthority;
  required: boolean;
  expectedValue: string | null;
  actualValue: string | null;
  expectedRevision: string | null;
  actualRevision: string | null;
}>;

export type MssrConsistencyOperationalProjection = MssrOperationalProjection & Readonly<{
  boundary: MssrConsistencyBoundary;
  reasonCodes: readonly string[];
  mismatches: readonly MssrConsistencyMismatch[];
  recommendedActions: readonly MssrConsistencyAction[];
  keysObserved: readonly string[];
  notifyOnWatch: boolean;
  evidenceComplete: boolean;
}>;

const CRITICAL_BOUNDARIES = new Set<MssrConsistencyBoundary>(["pre-release", "post-restart", "outcome"]);

function bounded(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function normalizedObservation(observation: MssrConsistencyObservation): MssrConsistencyObservation {
  return {
    key: bounded(observation.key, 120) ?? "unknown-key",
    observer: bounded(observation.observer, 160) ?? "unknown-observer",
    role: observation.role,
    authority: observation.authority,
    state: observation.state,
    ...(bounded(observation.value, 160) ? { value: bounded(observation.value, 160)! } : {}),
    ...(bounded(observation.revision, 160) ? { revision: bounded(observation.revision, 160)! } : {}),
    ...(observation.required === true ? { required: true } : {}),
  };
}

function mismatchIdentity(item: MssrConsistencyMismatch): string {
  return [
    item.key,
    item.kind,
    item.authorityObserver ?? "none",
    item.observedObserver,
    item.observedRole,
    item.observedAuthority,
    item.required ? "required" : "optional",
    item.expectedValue ?? "none",
    item.actualValue ?? "none",
    item.expectedRevision ?? "none",
    item.actualRevision ?? "none",
  ].join(":");
}

function roleActions(role: MssrConsistencyRole, historical: boolean): MssrConsistencyAction[] {
  if (historical) return ["load-canonical-authority", "revalidate-context-evidence", "review-stale-claim", "replan-current-context"];
  if (role === "generated") return ["rebuild-generated-artifact"];
  if (role === "installed") return ["refresh-installed-artifact"];
  if (role === "runtime") return ["verify-live-runtime"];
  if (role === "source") return ["inspect-source-replica"];
  if (role === "memory" || role === "receipt" || role === "state" || role === "reference") {
    return ["load-canonical-authority", "revalidate-context-evidence", "review-stale-claim"];
  }
  return ["load-canonical-authority"];
}

function mismatchFor(
  observation: MssrConsistencyObservation,
  baseline: MssrConsistencyObservation | null,
  kind: MssrConsistencyMismatchKind,
): MssrConsistencyMismatch {
  return {
    key: observation.key,
    kind,
    authorityObserver: baseline?.observer ?? null,
    observedObserver: observation.observer,
    observedRole: observation.role,
    observedAuthority: observation.authority,
    required: observation.required === true,
    expectedValue: bounded(baseline?.value, 160),
    actualValue: bounded(observation.value, 160),
    expectedRevision: bounded(baseline?.revision, 160),
    actualRevision: bounded(observation.revision, 160),
  };
}

/**
 * C2c consistency projection.
 *
 * Freshness and consistency are deliberately orthogonal: an immutable historical
 * receipt may be perfectly fresh as a receipt and still disagree with the current
 * canonical project fact. Hosts provide only bounded structured observations;
 * MSSR compares them, assigns attention, and suggests recovery. It never reads or
 * rewrites project truth by itself.
 */
export function evaluateMssrConsistencyOperationalAttention(input: Readonly<{
  boundary?: MssrConsistencyBoundary;
  observations: readonly MssrConsistencyObservation[];
}>): MssrConsistencyOperationalProjection {
  const boundary = input.boundary ?? "ordinary";
  const observations = input.observations.map(normalizedObservation).sort((a, b) =>
    `${a.key}:${a.authority}:${a.role}:${a.observer}`.localeCompare(`${b.key}:${b.authority}:${b.role}:${b.observer}`));
  const groups = new Map<string, MssrConsistencyObservation[]>();
  for (const observation of observations) {
    const current = groups.get(observation.key) ?? [];
    current.push(observation);
    groups.set(observation.key, current);
  }

  const reasonCodes = new Set<string>();
  const actions = new Set<MssrConsistencyAction>();
  const mismatches: MssrConsistencyMismatch[] = [];
  let canonicalConflict = false;
  let actionableMismatch = false;
  let criticalMismatch = false;
  let lowConfidence = false;
  let evidenceComplete = true;

  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!;
    const canonicals = group.filter((item) => item.authority === "canonical");
    const observedCanonicals = canonicals.filter((item) => item.state === "observed");
    const canonicalValues = [...new Set(observedCanonicals.map((item) => bounded(item.value, 160)).filter((value): value is string => value !== null))];
    const canonicalRevisions = [...new Set(observedCanonicals.map((item) => bounded(item.revision, 160)).filter((value): value is string => value !== null))];

    if (observedCanonicals.length === 0) {
      reasonCodes.add("canonical-baseline-missing");
      if (canonicals.some((item) => item.state === "unavailable")) reasonCodes.add("canonical-authority-unavailable");
      actions.add("load-canonical-authority");
      lowConfidence = true;
      evidenceComplete = false;
      continue;
    }

    if (canonicalValues.length > 1 || canonicalRevisions.length > 1) {
      canonicalConflict = true;
      evidenceComplete = false;
      reasonCodes.add("canonical-authority-conflict");
      actions.add("inspect-canonical-authorities");
      for (const canonical of observedCanonicals.slice(1)) {
        mismatches.push(mismatchFor(canonical, observedCanonicals[0], "canonical-conflict"));
      }
      continue;
    }

    const baseline = [...observedCanonicals].sort((a, b) => a.observer.localeCompare(b.observer))[0];
    const expectedValue = canonicalValues[0] ?? null;
    const expectedRevision = canonicalRevisions[0] ?? null;

    for (const observation of group) {
      if (observation.authority === "canonical") continue;
      const historical = observation.authority === "historical";
      if (observation.state === "unavailable") {
        mismatches.push(mismatchFor(observation, baseline, "availability"));
        reasonCodes.add(observation.required ? "required-observer-unavailable" : "observer-unavailable");
        for (const action of roleActions(observation.role, historical)) actions.add(action);
        if (observation.required) actionableMismatch = true;
        else lowConfidence = true;
        if (observation.required && CRITICAL_BOUNDARIES.has(boundary)) criticalMismatch = true;
        evidenceComplete = false;
        continue;
      }
      if (observation.state === "unknown") {
        mismatches.push(mismatchFor(observation, baseline, "insufficient"));
        reasonCodes.add(observation.required ? "required-observer-unknown" : "observer-unknown");
        for (const action of roleActions(observation.role, historical)) actions.add(action);
        if (observation.required) actionableMismatch = true;
        else lowConfidence = true;
        if (observation.required && CRITICAL_BOUNDARIES.has(boundary)) criticalMismatch = true;
        evidenceComplete = false;
        continue;
      }

      const actualValue = bounded(observation.value, 160);
      const actualRevision = bounded(observation.revision, 160);
      const valueMismatch = expectedValue !== null && actualValue !== null && expectedValue !== actualValue;
      const revisionMismatch = expectedRevision !== null && actualRevision !== null && expectedRevision !== actualRevision;
      const missingComparableClaim = (expectedValue !== null && actualValue === null) || (expectedRevision !== null && actualRevision === null);

      if (valueMismatch) mismatches.push(mismatchFor(observation, baseline, "value"));
      if (revisionMismatch) mismatches.push(mismatchFor(observation, baseline, "revision"));
      if (missingComparableClaim) {
        mismatches.push(mismatchFor(observation, baseline, "insufficient"));
        reasonCodes.add(observation.required ? "required-observer-incomplete" : "observer-incomplete");
        evidenceComplete = false;
        if (observation.required) actionableMismatch = true;
        else lowConfidence = true;
      }

      if (valueMismatch || revisionMismatch) {
        actionableMismatch = true;
        if (historical) reasonCodes.add("historical-claim-stale");
        else reasonCodes.add("replica-mismatch");
        if (observation.role === "generated") reasonCodes.add("generated-artifact-mismatch");
        else if (observation.role === "installed") reasonCodes.add("installed-artifact-mismatch");
        else if (observation.role === "runtime") reasonCodes.add("runtime-state-mismatch");
        else if (observation.role === "memory") reasonCodes.add("memory-claim-mismatch");
        else if (observation.role === "receipt") reasonCodes.add("receipt-claim-mismatch");
        else if (observation.role === "state") reasonCodes.add("state-claim-mismatch");
        else if (observation.role === "source") reasonCodes.add("source-replica-mismatch");
        for (const action of roleActions(observation.role, historical)) actions.add(action);
        if (!historical && observation.required && CRITICAL_BOUNDARIES.has(boundary)) criticalMismatch = true;
      }
    }
  }

  if (observations.length === 0) {
    reasonCodes.add("consistency-evidence-empty");
    lowConfidence = true;
    evidenceComplete = false;
  }

  const level: MssrOperationalNoticeLevel = canonicalConflict || criticalMismatch
    ? "error"
    : actionableMismatch || (CRITICAL_BOUNDARIES.has(boundary) && !evidenceComplete)
      ? "review"
      : lowConfidence
        ? "watch"
        : "ok";
  const sortedReasons = [...reasonCodes].sort();
  const sortedActions = [...actions].sort();
  const sortedMismatches = mismatches.sort((a, b) => mismatchIdentity(a).localeCompare(mismatchIdentity(b)));
  const keysObserved = [...groups.keys()].sort();

  return {
    level,
    boundary,
    fingerprint: buildMssrOperationalFingerprint([
      `boundary:${boundary}`,
      `keys:${keysObserved.join(",")}`,
      `observations:${observations.map((item) => [item.key, item.observer, item.role, item.authority, item.state, item.required === true ? "required" : "optional", bounded(item.value, 160) ?? "none", bounded(item.revision, 160) ?? "none"].join(":")).join("|")}`,
      `mismatches:${sortedMismatches.map(mismatchIdentity).join("|")}`,
      `reasons:${sortedReasons.join(",")}`,
    ]),
    reasonCodes: sortedReasons,
    mismatches: sortedMismatches,
    recommendedActions: sortedActions,
    keysObserved,
    notifyOnWatch: false,
    evidenceComplete,
    advisoryOnly: true,
  };
}
