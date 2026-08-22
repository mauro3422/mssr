import { z } from "zod";

import {
  SKILL_PHASES,
  SKILL_SIGNALS,
  SKILL_STAGES,
  type SkillPhase,
  type SkillStage,
} from "./skill-routing.js";

/**
 * Portable MSSR lifecycle contract.
 *
 * Deliberately excludes host/session details such as process identifiers,
 * leases, timers, storage, and filesystem paths.
 */
export const MSSR_TRACE_CONTRACT_VERSION = "trace-contract-v1" as const;

export const MSSR_CHECKPOINT_TYPES = [
  "phase_completed",
  "verification",
  "persistence",
  "progress",
  "outcome",
  "friction",
  "context_used",
  "replan",
] as const;

export const MSSR_OUTCOME_EVIDENCE_KINDS = [
  "manifest",
  "tests",
  "runtime",
  "user-confirmation",
  "manual-review",
  "mixed",
  "other",
] as const;

export const MSSR_OUTCOME_DIMENSION_STATUSES = [
  "success",
  "degraded",
  "failed",
  "skipped",
  "pending",
] as const;

export const MSSR_CHECKPOINT_STATUSES = [
  "success",
  "partial",
  "failed",
  "skipped",
] as const;

/**
 * Portable close gates derived from one route lifecycle. They deliberately name
 * obligations rather than adapter events so every host can evaluate the same
 * contract before it records a successful outcome.
 */
export const MSSR_CLOSURE_OBLIGATION_KINDS = [
  "required-skills",
  "verification",
  "persistence",
  "close",
  "maintenance",
  "outcome",
] as const;

export const MSSR_SKILL_DECISIONS = ["accepted", "skipped"] as const;
export const MSSR_SKILL_DECISION_REASONS = [
  "required",
  "useful",
  "irrelevant-domain",
  "redundant",
  "deferred-phase",
  "context-budget",
  "unavailable",
  "host-policy",
  "not-evaluated",
  "other",
] as const;

export type MssrCheckpointType = typeof MSSR_CHECKPOINT_TYPES[number];
export type MssrOutcomeEvidenceKind = typeof MSSR_OUTCOME_EVIDENCE_KINDS[number];
export type MssrOutcomeDimensionStatus = typeof MSSR_OUTCOME_DIMENSION_STATUSES[number];
export type MssrCheckpointStatus = typeof MSSR_CHECKPOINT_STATUSES[number];
export type MssrClosureObligationKind = typeof MSSR_CLOSURE_OBLIGATION_KINDS[number];
export type MssrSkillDecision = typeof MSSR_SKILL_DECISIONS[number];
export type MssrSkillDecisionReason = typeof MSSR_SKILL_DECISION_REASONS[number];

/**
 * Only lifecycle-affecting fields are modeled here. Adapters can attach
 * metadata and evidence without coupling the core contract to their runtime.
 */
export const mssrTraceCheckpointSchema = z.object({
  eventType: z.enum(MSSR_CHECKPOINT_TYPES),
  stage: z.enum(SKILL_STAGES).optional(),
  status: z.enum(MSSR_CHECKPOINT_STATUSES).optional(),
  completedPhases: z.array(z.enum(SKILL_PHASES)).max(6).optional(),
  verificationPassed: z.boolean().optional(),
  persisted: z.boolean().optional(),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(20).optional(),
  // Adapters with leases may use this; the portable reducer ignores it.
  leaseMs: z.number().int().min(30_000).max(15 * 60_000).optional(),
}).passthrough();

export type MssrTraceCheckpoint = z.infer<typeof mssrTraceCheckpointSchema>;

/** Host-visible selection feedback. This is a bounded operational decision, not
 * hidden reasoning. Required skills remain workflow obligations; this schema is
 * primarily for optional candidate acceptance/skip evidence. */
export const mssrSkillDecisionSchema = z.object({
  skillName: z.string().trim().min(1).max(160),
  decision: z.enum(MSSR_SKILL_DECISIONS),
  reasonCode: z.enum(MSSR_SKILL_DECISION_REASONS),
  reasonSummary: z.string().trim().min(1).max(240).optional(),
  stage: z.enum(SKILL_STAGES).optional(),
}).strict();

export type MssrSkillDecisionRecord = z.infer<typeof mssrSkillDecisionSchema>;

/**
 * Ephemeral host working memory for one open trace. It may preserve compact
 * hypotheses/decisions/evidence needed to resume work, but never raw prompts,
 * transcripts, secrets, or private chain-of-thought. Hosts should purge this
 * object after an outcome and keep only durable telemetry/evidence that belongs
 * in the normal trace contract.
 */
export const mssrTraceWorkingMemorySchema = z.object({
  retention: z.literal("until-outcome").default("until-outcome"),
  workingSummary: z.string().trim().min(1).max(1200).optional(),
  hypotheses: z.array(z.object({
    summary: z.string().trim().min(1).max(300),
    status: z.enum(["active", "supported", "rejected"]),
    evidenceRef: z.string().trim().min(1).max(240).optional(),
  }).strict()).max(8).default([]),
  decisions: z.array(z.object({
    subject: z.string().trim().min(1).max(120),
    decision: z.string().trim().min(1).max(240),
    reason: z.string().trim().min(1).max(300).optional(),
  }).strict()).max(16).default([]),
  nextGate: z.string().trim().min(1).max(300).optional(),
}).strict();

export type MssrTraceWorkingMemory = z.infer<typeof mssrTraceWorkingMemorySchema>;

/**
 * Serializable state: arrays are intentional so this can be transferred over
 * MCP and persisted as JSON by any host.
 */
export const mssrTraceLifecycleStateSchema = z.object({
  stage: z.enum(SKILL_STAGES),
  requiredSkills: z.array(z.string()).default([]),
  selectedSkills: z.array(z.string()).default([]),
  loadedSkills: z.array(z.string()).default([]),
  requiredPhases: z.array(z.enum(SKILL_PHASES)).default([]),
  completedPhases: z.array(z.enum(SKILL_PHASES)).default([]),
  routeCount: z.number().int().min(0).default(0),
  closed: z.boolean().default(false),
  maintenanceRequired: z.boolean().default(false),
  lifecycleRevision: z.number().int().min(0).default(0),
  closeRevision: z.number().int().min(0).default(0),
  maintenanceRevision: z.number().int().min(0).default(0),
}).strict();

export type MssrTraceLifecycleState = z.infer<typeof mssrTraceLifecycleStateSchema>;

type JsonRecord = Record<string, unknown>;

export type MssrTraceViolation = Readonly<{
  code:
    | "mssr-outcome-without-route"
    | "mssr-success-outcome-blocked-required-skills"
    | "mssr-success-outcome-blocked-required-phases"
    | "mssr-success-outcome-blocked-close"
    | "mssr-success-outcome-blocked-stale-close";
  blocking: boolean;
  missingSkills?: readonly string[];
  missingPhases?: readonly SkillPhase[];
}>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function stageFrom(value: unknown, fallback: SkillStage): SkillStage {
  const parsed = z.enum(SKILL_STAGES).safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

/** Interpret activeSkills from a route result without depending on an adapter. */
export function routeSkillRequirements(value: unknown): Array<{ name: string; required: boolean }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record || typeof record.name !== "string") return [];
    return [{ name: record.name, required: record.required === true }];
  });
}

/** Interpret loaded[] from skill_bootstrap. */
export function bootstrapLoadedSkillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return unique(value.flatMap((item) => {
    const record = asRecord(item);
    const skill = asRecord(record?.skill);
    if (!record || record.loaded !== true || typeof skill?.name !== "string") return [];
    return [skill.name];
  }));
}

/** Support coverage.requiredPhases as well as phasePlan. */
export function routeRequiredPhases(route: unknown): SkillPhase[] {
  const record = asRecord(route);
  if (!record) return [];

  const phases: string[] = [];
  const coverage = asRecord(record.coverage);
  if (Array.isArray(coverage?.requiredPhases)) {
    phases.push(...coverage.requiredPhases.filter((value): value is string => typeof value === "string"));
  }

  const phasePlan = Array.isArray(record.phasePlan) ? record.phasePlan : [];
  for (const item of phasePlan) {
    const phase = asRecord(item);
    if (phase?.required === true && typeof phase.phase === "string") phases.push(phase.phase);
  }

  return unique(phases).flatMap((phase) => {
    const parsed = z.enum(SKILL_PHASES).safeParse(phase);
    return parsed.success ? [parsed.data] : [];
  });
}

export function routeCompletedPhases(route: unknown): SkillPhase[] {
  const record = asRecord(route);
  const coverage = asRecord(record?.coverage);
  if (!Array.isArray(coverage?.completedPhases)) return [];
  return unique(coverage.completedPhases.filter((value): value is string => typeof value === "string")).flatMap((phase) => {
    const parsed = z.enum(SKILL_PHASES).safeParse(phase);
    return parsed.success ? [parsed.data] : [];
  });
}

export function routeRequiresMaintenance(route: unknown): boolean {
  return routeRequiredPhases(route).includes("maintenance");
}

export function maintenanceCheckpointCompleted(checkpoint: unknown): boolean {
  const parsed = mssrTraceCheckpointSchema.safeParse(checkpoint);
  if (!parsed.success) return false;

  const value = parsed.data;
  return value.eventType === "phase_completed"
    && value.stage === "close"
    && (value.status === undefined || value.status === "success")
    && Array.isArray(value.completedPhases)
    && value.completedPhases.includes("maintenance");
}

export function missingRequiredSkills(state: MssrTraceLifecycleState): string[] {
  const loaded = new Set(state.loadedSkills);
  return state.requiredSkills.filter((name) => !loaded.has(name)).sort();
}

/** Only phases with independently observable success evidence gate a successful outcome.
 * Discovery, safety and implementation may be represented by the route/host workflow itself;
 * maintenance has its own close-revision obligation. Keep every projection on this shared set. */
export const MSSR_OBJECTIVE_CLOSURE_PHASES = ["verification", "persistence"] as const satisfies readonly SkillPhase[];

export function objectiveClosurePhases(phases: readonly string[] | undefined): SkillPhase[] {
  const required = new Set(phases ?? []);
  return MSSR_OBJECTIVE_CLOSURE_PHASES.filter((phase) => required.has(phase));
}

export function missingRequiredClosurePhases(state: MssrTraceLifecycleState): SkillPhase[] {
  const completed = new Set(state.completedPhases);
  return objectiveClosurePhases(state.requiredPhases).filter((phase) => !completed.has(phase));
}

export function hasFreshMaintenanceClose(state: MssrTraceLifecycleState): boolean {
  return !state.maintenanceRequired || (
    state.closeRevision === state.lifecycleRevision
    && state.maintenanceRevision === state.lifecycleRevision
  );
}

export type MssrRouteClosureObligation = Readonly<{
  kind: MssrClosureObligationKind;
  required: boolean;
  /** `ready` is only used for the prospective outcome checkpoint. */
  status: "not-applicable" | "complete" | "pending" | "ready";
  missingSkills?: readonly string[];
  missingPhases?: readonly SkillPhase[];
}>;

export type MssrTraceClosureState = Readonly<{
  closureDue: boolean;
  canCloseSuccess: boolean;
  obligations: readonly MssrRouteClosureObligation[];
  missingRequiredSkills: readonly string[];
  missingRequiredPhases: readonly SkillPhase[];
  needsCloseReplan: boolean;
  needsMaintenance: boolean;
  nextRequiredAction: "load-required-skills" | "verify" | "persist" | "replan-close" | "complete-maintenance" | "record-outcome" | "none";
}>;

/**
 * Evaluate every portable obligation required by the current route lifecycle.
 * `outcome: ready` means that a successful outcome checkpoint may be recorded;
 * it does not claim that an outcome has already been persisted.
 */
export function evaluateMssrRouteClosureObligations(input: MssrTraceLifecycleState): MssrTraceClosureState {
  const state = mssrTraceLifecycleStateSchema.parse(input);
  const missingSkills = missingRequiredSkills(state);
  const missingPhases = missingRequiredClosurePhases(state);
  const closeComplete = state.routeCount > 0
    && state.stage === "close"
    && state.closeRevision === state.lifecycleRevision;
  const needsCloseReplan = state.routeCount > 0 && !closeComplete;
  const needsMaintenance = state.maintenanceRequired
    && closeComplete
    && state.maintenanceRevision !== state.lifecycleRevision;

  const obligations: MssrRouteClosureObligation[] = [
    {
      kind: "required-skills",
      required: state.requiredSkills.length > 0,
      status: missingSkills.length === 0 ? "complete" : "pending",
      ...(missingSkills.length > 0 ? { missingSkills } : {}),
    },
    {
      kind: "verification",
      required: state.requiredPhases.includes("verification"),
      status: !state.requiredPhases.includes("verification")
        ? "not-applicable"
        : missingPhases.includes("verification") ? "pending" : "complete",
    },
    {
      kind: "persistence",
      required: state.requiredPhases.includes("persistence"),
      status: !state.requiredPhases.includes("persistence")
        ? "not-applicable"
        : missingPhases.includes("persistence") ? "pending" : "complete",
    },
    {
      kind: "close",
      required: state.routeCount > 0,
      status: state.routeCount === 0 ? "not-applicable" : closeComplete ? "complete" : "pending",
    },
    {
      kind: "maintenance",
      required: state.maintenanceRequired,
      status: !state.maintenanceRequired
        ? "not-applicable"
        : needsMaintenance ? "pending" : hasFreshMaintenanceClose(state) && closeComplete ? "complete" : "pending",
    },
  ];
  const preOutcomeReady = !state.closed && obligations.every((obligation) =>
    !obligation.required || obligation.status === "complete",
  );
  obligations.push({
    kind: "outcome",
    required: true,
    status: state.closed ? "complete" : preOutcomeReady ? "ready" : "pending",
  });

  let nextRequiredAction: MssrTraceClosureState["nextRequiredAction"] = "record-outcome";
  if (state.closed) nextRequiredAction = "none";
  else if (missingSkills.length > 0) nextRequiredAction = "load-required-skills";
  else if (missingPhases.includes("verification")) nextRequiredAction = "verify";
  else if (missingPhases.includes("persistence")) nextRequiredAction = "persist";
  else if (needsCloseReplan) nextRequiredAction = "replan-close";
  else if (needsMaintenance) nextRequiredAction = "complete-maintenance";

  return {
    closureDue: state.stage === "close" && !state.closed,
    canCloseSuccess: preOutcomeReady,
    obligations,
    missingRequiredSkills: missingSkills,
    missingRequiredPhases: missingPhases,
    needsCloseReplan,
    needsMaintenance,
    nextRequiredAction,
  };
}

/** Backwards-compatible name for the portable close preflight. */
export function getMssrTraceClosureState(input: MssrTraceLifecycleState): MssrTraceClosureState {
  return evaluateMssrRouteClosureObligations(input);
}

export function createMssrTraceLifecycleState(
  stage: SkillStage = "start",
): MssrTraceLifecycleState {
  return {
    stage,
    requiredSkills: [],
    selectedSkills: [],
    loadedSkills: [],
    requiredPhases: [],
    completedPhases: [],
    routeCount: 0,
    closed: false,
    maintenanceRequired: false,
    lifecycleRevision: 0,
    closeRevision: 0,
    maintenanceRevision: 0,
  };
}

/** Apply a route or replan to the portable lifecycle state. */
export function reduceMssrRouteLifecycle(
  previous: MssrTraceLifecycleState | null,
  route: unknown,
): MssrTraceLifecycleState {
  const record = asRecord(route) ?? {};
  const previousState = previous ? mssrTraceLifecycleStateSchema.parse(previous) : null;
  const stage = stageFrom(record.stage, previousState?.stage ?? "start");
  const skills = routeSkillRequirements(record.activeSkills);
  const previousRevision = previousState?.lifecycleRevision ?? 0;
  const lifecycleRevision = previousState
    ? (stage === "close" ? previousRevision : previousRevision + 1)
    : 1;

  return {
    stage,
    requiredSkills: unique([
      ...(previousState?.requiredSkills ?? []),
      ...skills.filter((skill) => skill.required).map((skill) => skill.name),
    ]),
    selectedSkills: unique([
      ...(previousState?.selectedSkills ?? []),
      ...skills.map((skill) => skill.name),
    ]),
    loadedSkills: unique([
      ...(previousState?.loadedSkills ?? []),
      ...bootstrapLoadedSkillNames(record.loaded),
    ]),
    requiredPhases: unique([
      ...(previousState?.requiredPhases ?? []),
      ...routeRequiredPhases(record),
    ]) as SkillPhase[],
    completedPhases: unique([
      ...(previousState?.completedPhases ?? []),
      ...routeCompletedPhases(record),
    ]) as SkillPhase[],
    routeCount: (previousState?.routeCount ?? 0) + 1,
    // A replan always reopens the trace.
    closed: false,
    maintenanceRequired: previousState?.maintenanceRequired === true || routeRequiresMaintenance(record),
    lifecycleRevision,
    closeRevision: stage === "close" ? lifecycleRevision : previousState?.closeRevision ?? 0,
    maintenanceRevision: previousState?.maintenanceRevision ?? 0,
  };
}

export function reduceMssrSkillLoadLifecycle(
  previous: MssrTraceLifecycleState,
  skillName: string,
): MssrTraceLifecycleState {
  const state = mssrTraceLifecycleStateSchema.parse(previous);
  return {
    ...state,
    loadedSkills: unique([...state.loadedSkills, skillName]),
  };
}

/** Apply only portable lifecycle changes; host progress/timers are excluded. */
export function reduceMssrCheckpointLifecycle(
  previous: MssrTraceLifecycleState,
  checkpointInput: unknown,
): MssrTraceLifecycleState {
  const state = mssrTraceLifecycleStateSchema.parse(previous);
  const checkpoint = mssrTraceCheckpointSchema.parse(checkpointInput);
  let next: MssrTraceLifecycleState = { ...state };
  const completionAccepted = checkpoint.status === undefined || checkpoint.status === "success";

  if (completionAccepted && Array.isArray(checkpoint.completedPhases)) {
    next = {
      ...next,
      completedPhases: unique([...next.completedPhases, ...checkpoint.completedPhases]) as SkillPhase[],
    };
  }
  if (checkpoint.eventType === "verification" && completionAccepted && checkpoint.verificationPassed === true) {
    next = { ...next, completedPhases: unique([...next.completedPhases, "verification"]) as SkillPhase[] };
  }

  if (checkpoint.eventType === "persistence") {
    next = { ...next, lifecycleRevision: next.lifecycleRevision + 1 };
    if (completionAccepted && checkpoint.persisted === true) {
      next = { ...next, completedPhases: unique([...next.completedPhases, "persistence"]) as SkillPhase[] };
    }
  }

  if (maintenanceCheckpointCompleted(checkpoint) && next.closeRevision === next.lifecycleRevision) {
    next = { ...next, maintenanceRevision: next.lifecycleRevision };
  }

  if (checkpoint.eventType === "outcome") {
    next = { ...next, closed: true };
  }

  if (checkpoint.stage) {
    next = { ...next, stage: checkpoint.stage };
  }

  return mssrTraceLifecycleStateSchema.parse(next);
}

/** Shared validation policy for Bridge, Codex, and future adapters. */
export function validateMssrCheckpointLifecycle(
  state: MssrTraceLifecycleState | null,
  checkpointInput: unknown,
): readonly MssrTraceViolation[] {
  const checkpoint = mssrTraceCheckpointSchema.parse(checkpointInput);
  if (checkpoint.eventType !== "outcome" || checkpoint.status !== "success") return [];

  if (!state) {
    return [{ code: "mssr-outcome-without-route", blocking: true }];
  }

  if (state.closed) {
    return [{ code: "mssr-success-outcome-blocked-close", blocking: true }];
  }

  const violations: MssrTraceViolation[] = [];
  const closure = evaluateMssrRouteClosureObligations(state);
  if (closure.missingRequiredSkills.length > 0) {
    violations.push({
      code: "mssr-success-outcome-blocked-required-skills",
      blocking: true,
      missingSkills: closure.missingRequiredSkills,
    });
  }

  if (closure.missingRequiredPhases.length > 0) {
    violations.push({
      code: "mssr-success-outcome-blocked-required-phases",
      blocking: true,
      missingPhases: closure.missingRequiredPhases,
    });
  }

  if (closure.needsCloseReplan || checkpoint.stage !== "close") {
    violations.push({ code: "mssr-success-outcome-blocked-close", blocking: true });
  }

  if (state.maintenanceRequired && !hasFreshMaintenanceClose(state)) {
    violations.push({
      code: "mssr-success-outcome-blocked-stale-close",
      blocking: true,
    });
  }

  return violations;
}
