import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { z } from "zod";
import {
  SKILL_CALLERS,
  SKILL_PHASES,
  SKILL_SIGNALS,
  SKILL_STAGES,
} from "./skill-routing.js";
import {
  MSSR_CHECKPOINT_STATUSES,
  MSSR_CHECKPOINT_TYPES,
  MSSR_OUTCOME_DIMENSION_STATUSES,
  MSSR_OUTCOME_EVIDENCE_KINDS,
} from "./trace-contract.js";

export const MSSR_TELEMETRY_PROTOCOL_VERSION = "mssr-telemetry-v1" as const;
export const MSSR_HOST_CALL_PROTOCOL_VERSION = "mssr-host-call-v1" as const;

const traceIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/);
const boundedName = z.string().trim().min(1).max(160);
const reasoningEffortSchema = z.enum(["low", "medium", "high", "xhigh", "max", "ultra", "unknown"]);

export const mssrHostCheckpointSchema = z.object({
  eventType: z.enum(MSSR_CHECKPOINT_TYPES),
  stage: z.enum(SKILL_STAGES).optional(),
  status: z.enum(MSSR_CHECKPOINT_STATUSES).optional(),
  completedPhases: z.array(z.enum(SKILL_PHASES)).max(6).optional(),
  verificationPassed: z.boolean().optional(),
  persisted: z.boolean().optional(),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(20).optional(),
  leaseMs: z.number().int().min(30_000).max(15 * 60_000).optional(),
  skillName: boundedName.optional(),
  primarySkill: boundedName.optional(),
  supportingSkills: z.array(boundedName).max(24).optional(),
  metricName: z.string().trim().min(1).max(120).optional(),
  score: z.number().min(0).max(1).optional(),
  accepted: z.boolean().optional(),
  evidenceKind: z.enum(MSSR_OUTCOME_EVIDENCE_KINDS).optional(),
  evidenceRef: z.string().max(300).optional(),
  dimensions: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    status: z.enum(MSSR_OUTCOME_DIMENSION_STATUSES),
    summary: z.string().max(200).optional(),
    evidenceRef: z.string().max(200).optional(),
  }).strict()).max(12).optional(),
  contextSources: z.array(z.enum([
    "current-conversation", "personal-context", "project-context", "git-history",
    "bridge-metrics", "user-upload", "codex-session", "other",
  ])).max(8).optional(),
  userCorrections: z.number().int().min(0).max(100).optional(),
  summary: z.string().max(300).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  reasoningEffort: reasoningEffortSchema.optional(),
}).strict();

const routedSkillSchema = z.object({
  name: boundedName,
  source: z.string().max(80).optional(),
  required: z.boolean(),
  score: z.number().optional(),
}).strict();

const routeTelemetrySchema = z.object({
  kind: z.literal("route"),
  action: z.enum(["plan", "bootstrap"]),
  taskHash: z.string().regex(/^[a-f0-9]{64}$/),
  route: z.object({
    caller: z.enum(SKILL_CALLERS),
    stage: z.enum(SKILL_STAGES),
    classificationMode: z.string().max(80),
    workflowKey: z.string().max(160).nullable().optional(),
    agentProfile: z.object({
      model: z.string().max(80),
      reasoningEffort: reasoningEffortSchema,
    }).strict(),
    contextUsed: z.boolean(),
    contextCharacters: z.number().int().min(0).max(4000),
    workflows: z.array(z.string().max(160)).max(24),
    activeSkills: z.array(routedSkillSchema).max(32),
    deferredSkills: z.array(routedSkillSchema).max(64),
    loadOrder: z.array(boundedName).max(32),
    deferredLoadOrder: z.array(boundedName).max(64),
    signals: z.array(z.enum(SKILL_SIGNALS)).max(20),
    ambiguity: z.string().max(20).optional(),
    requiredPhases: z.array(z.enum(SKILL_PHASES)).max(6),
    completedPhases: z.array(z.enum(SKILL_PHASES)).max(6),
    missingRequiredPhases: z.array(z.enum(SKILL_PHASES)).max(6),
  }).strict(),
}).strict();

const skillLoadTelemetrySchema = z.object({
  kind: z.literal("skill_load"),
  skillName: boundedName,
  source: z.string().max(80).optional(),
  stage: z.enum(SKILL_STAGES).optional(),
  required: z.boolean().optional(),
  loaded: z.boolean(),
  via: z.enum(["skill_load", "skill_bootstrap"]),
  warning: z.string().max(300).optional(),
}).strict();

const checkpointTelemetrySchema = z.object({
  kind: z.literal("checkpoint"),
  checkpoint: mssrHostCheckpointSchema,
}).strict();

export const mssrTelemetryEnvelopeSchema = z.object({
  protocolVersion: z.literal(MSSR_TELEMETRY_PROTOCOL_VERSION),
  eventId: z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/),
  emittedAt: z.string().datetime(),
  source: z.string().trim().min(1).max(80),
  traceId: traceIdSchema,
  caller: z.enum(SKILL_CALLERS),
  event: z.discriminatedUnion("kind", [routeTelemetrySchema, skillLoadTelemetrySchema, checkpointTelemetrySchema]),
}).strict();

export type MssrTelemetryEnvelope = z.infer<typeof mssrTelemetryEnvelopeSchema>;
export type MssrHostCheckpoint = z.infer<typeof mssrHostCheckpointSchema>;

const hashedHostIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const mssrHostCallEnvelopeSchema = z.object({
  protocolVersion: z.literal(MSSR_HOST_CALL_PROTOCOL_VERSION),
  eventId: z.string().regex(/^mssr-host-[a-f0-9]{64}$/),
  emittedAt: z.string().datetime(),
  source: z.literal("opencode-plugin"),
  caller: z.literal("opencode-local"),
  traceId: traceIdSchema.optional(),
  host: z.object({
    sessionKey: hashedHostIdSchema,
    messageKey: hashedHostIdSchema.optional(),
    callKey: hashedHostIdSchema,
    agent: boundedName,
    model: z.string().trim().min(1).max(160),
    reasoningEffort: reasoningEffortSchema,
    variant: z.string().trim().min(1).max(80).optional(),
    project: z.string().trim().min(1).max(120),
    projectKey: hashedHostIdSchema,
  }).strict(),
  tool: z.object({
    name: boundedName,
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationMs: z.number().int().min(0).max(24 * 60 * 60_000),
    status: z.enum(["success", "error"]),
  }).strict(),
}).strict();

export const mssrExternalTelemetryEnvelopeSchema = z.union([
  mssrTelemetryEnvelopeSchema,
  mssrHostCallEnvelopeSchema,
]);
export type MssrHostCallEnvelope = z.infer<typeof mssrHostCallEnvelopeSchema>;
export type MssrExternalTelemetryEnvelope = z.infer<typeof mssrExternalTelemetryEnvelopeSchema>;

export interface MssrTelemetrySink {
  emit(event: MssrTelemetryEnvelope): Promise<void>;
}

export interface MssrExternalTelemetrySink {
  emit(event: MssrExternalTelemetryEnvelope): Promise<void>;
}

export function hashMssrTelemetryTask(task: string): string {
  const normalized = task.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function createMssrTelemetryEnvelope(args: Omit<MssrTelemetryEnvelope, "protocolVersion" | "eventId" | "emittedAt">): MssrTelemetryEnvelope {
  return mssrTelemetryEnvelopeSchema.parse({
    ...args,
    protocolVersion: MSSR_TELEMETRY_PROTOCOL_VERSION,
    eventId: `mssr-ext-${randomUUID()}`,
    emittedAt: new Date().toISOString(),
  });
}

export class HttpMssrTelemetrySink implements MssrTelemetrySink {
  constructor(
    private readonly endpoint: string,
    private readonly tokenFile: string,
    private readonly timeoutMs = 5_000,
  ) {
    const url = new URL(endpoint);
    const loopback = ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error("MSSR telemetry endpoint must use HTTPS or loopback HTTP.");
    }
  }

  async emit(event: MssrExternalTelemetryEnvelope): Promise<void> {
    const token = (await fs.readFile(this.tokenFile, "utf8")).trim();
    if (token.length < 32) throw new Error("MSSR telemetry token file is missing a valid token.");
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(mssrExternalTelemetryEnvelopeSchema.parse(event)),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`MSSR telemetry endpoint returned HTTP ${response.status}.`);
  }
}

export function createMssrTelemetrySinkFromEnvironment(env: NodeJS.ProcessEnv = process.env): MssrTelemetrySink | null {
  const endpoint = env.MSSR_TELEMETRY_ENDPOINT?.trim();
  const tokenFile = env.MSSR_TELEMETRY_TOKEN_FILE?.trim();
  if (!endpoint && !tokenFile) return null;
  if (!endpoint || !tokenFile) {
    throw new Error("MSSR_TELEMETRY_ENDPOINT and MSSR_TELEMETRY_TOKEN_FILE must be configured together.");
  }
  const timeout = Number.parseInt(env.MSSR_TELEMETRY_TIMEOUT_MS ?? "", 10);
  return new HttpMssrTelemetrySink(endpoint, tokenFile, Number.isFinite(timeout) && timeout > 0 ? timeout : 5_000);
}

export function routeTelemetrySummary(route: Record<string, unknown>) {
  const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const skills = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => {
    const skill = asRecord(item);
    return typeof skill.name === "string" ? [{
      name: skill.name,
      source: typeof skill.source === "string" ? skill.source : undefined,
      required: skill.required === true,
      score: typeof skill.score === "number" ? skill.score : undefined,
    }] : [];
  }) : [];
  const intent = asRecord(route.intent);
  const coverage = asRecord(route.coverage);
  const profile = asRecord(route.agentProfile);
  return routeTelemetrySchema.shape.route.parse({
    caller: route.caller,
    stage: route.stage,
    classificationMode: route.classificationMode,
    workflowKey: typeof route.workflowKey === "string" ? route.workflowKey : null,
    agentProfile: {
      model: typeof profile.model === "string" ? profile.model : "unknown",
      reasoningEffort: typeof profile.reasoningEffort === "string" ? profile.reasoningEffort : "unknown",
    },
    contextUsed: route.contextUsed === true,
    contextCharacters: typeof route.contextCharacters === "number" ? route.contextCharacters : 0,
    workflows: Array.isArray(route.workflows) ? route.workflows : [],
    activeSkills: skills(route.activeSkills),
    deferredSkills: skills(route.deferredSkills),
    loadOrder: Array.isArray(route.loadOrder) ? route.loadOrder : [],
    deferredLoadOrder: Array.isArray(route.deferredLoadOrder) ? route.deferredLoadOrder : [],
    signals: Array.isArray(intent.signals) ? intent.signals : [],
    ambiguity: typeof intent.ambiguity === "string" ? intent.ambiguity : undefined,
    requiredPhases: Array.isArray(coverage.requiredPhases) ? coverage.requiredPhases : [],
    completedPhases: Array.isArray(coverage.completedPhases) ? coverage.completedPhases : [],
    missingRequiredPhases: Array.isArray(coverage.missingRequiredPhases) ? coverage.missingRequiredPhases : [],
  });
}
