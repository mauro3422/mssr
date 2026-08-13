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

/** Only phases that are objective success gates are enforced at outcome. Discovery,
 * safety and implementation may be represented by the route/host workflow itself. */
export function missingRequiredClosurePhases(state: MssrTraceLifecycleState): SkillPhase[] {
  const completed = new Set(state.completedPhases);
  return state.requiredPhases
    .filter((phase) => phase === "verification" || phase === "persistence")
    .filter((phase) => !completed.has(phase));
}

export function hasFreshMaintenanceClose(state: MssrTraceLifecycleState): boolean {
  return !state.maintenanceRequired || (
    state.closeRevision === state.lifecycleRevision
    && state.maintenanceRevision === state.lifecycleRevision
  );
}

export type MssrTraceClosureState = Readonly<{
  closureDue: boolean;
  canCloseSuccess: boolean;
  missingRequiredSkills: readonly string[];
  missingRequiredPhases: readonly SkillPhase[];
  needsCloseReplan: boolean;
  needsMaintenance: boolean;
  nextRequiredAction: "load-required-skills" | "verify" | "persist" | "replan-close" | "complete-maintenance" | "record-outcome" | "none";
}>;

/** Portable close preflight. The host decides when a task is actually ending;
 * once it enters stage=close this reports the exact observable gates instead of
 * relying on the model to remember them. */
export function getMssrTraceClosureState(input: MssrTraceLifecycleState): MssrTraceClosureState {
  const state = mssrTraceLifecycleStateSchema.parse(input);
  const missingSkills = missingRequiredSkills(state);
  const missingPhases = missingRequiredClosurePhases(state);
  const needsCloseReplan = state.maintenanceRequired && state.closeRevision !== state.lifecycleRevision;
  const needsMaintenance = state.maintenanceRequired
    && state.closeRevision === state.lifecycleRevision
    && state.maintenanceRevision !== state.lifecycleRevision;

  let nextRequiredAction: MssrTraceClosureState["nextRequiredAction"] = "record-outcome";
  if (state.closed) nextRequiredAction = "none";
  else if (missingSkills.length > 0) nextRequiredAction = "load-required-skills";
  else if (missingPhases.includes("verification")) nextRequiredAction = "verify";
  else if (missingPhases.includes("persistence")) nextRequiredAction = "persist";
  else if (needsCloseReplan) nextRequiredAction = "replan-close";
  else if (needsMaintenance) nextRequiredAction = "complete-maintenance";

  return {
    closureDue: state.stage === "close" && !state.closed,
    canCloseSuccess: !state.closed
      && state.routeCount > 0
      && missingSkills.length === 0
      && missingPhases.length === 0
      && !needsCloseReplan
      && !needsMaintenance,
    missingRequiredSkills: missingSkills,
    missingRequiredPhases: missingPhases,
    needsCloseReplan,
    needsMaintenance,
    nextRequiredAction,
  };
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
    return [{ code: "mssr-outcome-without-route", blocking: false }];
  }

  if (state.closed) return [];

  const violations: MssrTraceViolation[] = [];
  const missing = missingRequiredSkills(state);
  if (missing.length > 0) {
    violations.push({
      code: "mssr-success-outcome-blocked-required-skills",
      blocking: true,
      missingSkills: missing,
    });
  }

  // Required phases describe workflow coverage and are surfaced by the close
  // preflight. They are not a universal portable hard gate: each host decides
  // which phase requirements it can authoritatively enforce. Fresh maintenance
  // and required-skill loads remain portable integrity invariants.
  if (!hasFreshMaintenanceClose(state)) {
    violations.push({
      code: "mssr-success-outcome-blocked-stale-close",
      blocking: true,
    });
  }

  return violations;
}
