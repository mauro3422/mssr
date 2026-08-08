import { z } from "zod";

import {
  SKILL_PHASES,
  SKILL_SIGNALS,
  SKILL_STAGES,
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

export type MssrCheckpointType = typeof MSSR_CHECKPOINT_TYPES[number];
export type MssrOutcomeEvidenceKind = typeof MSSR_OUTCOME_EVIDENCE_KINDS[number];
export type MssrOutcomeDimensionStatus = typeof MSSR_OUTCOME_DIMENSION_STATUSES[number];
export type MssrCheckpointStatus = typeof MSSR_CHECKPOINT_STATUSES[number];

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

/**
 * Serializable state: arrays are intentional so this can be transferred over
 * MCP and persisted as JSON by any host.
 */
export const mssrTraceLifecycleStateSchema = z.object({
  stage: z.enum(SKILL_STAGES),
  requiredSkills: z.array(z.string()).default([]),
  selectedSkills: z.array(z.string()).default([]),
  loadedSkills: z.array(z.string()).default([]),
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
    | "mssr-success-outcome-blocked-stale-close";
  blocking: boolean;
  missingSkills?: readonly string[];
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
export function routeRequiresMaintenance(route: unknown): boolean {
  const record = asRecord(route);
  if (!record) return false;

  const coverage = asRecord(record.coverage);
  if (Array.isArray(coverage?.requiredPhases) && coverage.requiredPhases.includes("maintenance")) {
    return true;
  }

  const phasePlan = Array.isArray(record.phasePlan) ? record.phasePlan : [];
  return phasePlan.some((item) => {
    const phase = asRecord(item);
    return phase?.phase === "maintenance" && phase.required === true;
  });
}

export function maintenanceCheckpointCompleted(checkpoint: unknown): boolean {
  const parsed = mssrTraceCheckpointSchema.safeParse(checkpoint);
  if (!parsed.success) return false;

  const value = parsed.data;
  return value.eventType === "phase_completed"
    && value.stage === "close"
    && value.status === "success"
    && Array.isArray(value.completedPhases)
    && value.completedPhases.includes("maintenance");
}

export function missingRequiredSkills(state: MssrTraceLifecycleState): string[] {
  const loaded = new Set(state.loadedSkills);
  return state.requiredSkills.filter((name) => !loaded.has(name)).sort();
}

export function hasFreshMaintenanceClose(state: MssrTraceLifecycleState): boolean {
  return !state.maintenanceRequired || (
    state.closeRevision === state.lifecycleRevision
    && state.maintenanceRevision === state.lifecycleRevision
  );
}

export function createMssrTraceLifecycleState(
  stage: SkillStage = "start",
): MssrTraceLifecycleState {
  return {
    stage,
    requiredSkills: [],
    selectedSkills: [],
    loadedSkills: [],
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

  if (checkpoint.eventType === "persistence") {
    next = { ...next, lifecycleRevision: next.lifecycleRevision + 1 };
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

  if (!hasFreshMaintenanceClose(state)) {
    violations.push({
      code: "mssr-success-outcome-blocked-stale-close",
      blocking: true,
    });
  }

  return violations;
}
