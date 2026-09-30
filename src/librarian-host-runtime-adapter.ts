import { z } from "zod";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";

export const MSSR_LIBRARIAN_HOST_RUNTIME_OBSERVATION_VERSION = 1 as const;

const token = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const boundedRef = z.string().trim().min(1).max(240);
const boundedName = z.string().trim().min(1).max(160);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const nonNegativeInt = z.number().int().min(0).max(2_147_483_647);
const durationMs = z.number().min(0).max(86_400_000);
const optionalCorrelation = {
  traceId: boundedRef.optional(),
  workflowKey: boundedRef.optional(),
  taskKey: boundedRef.optional(),
  project: boundedName.optional(),
  relatedProject: boundedName.optional(),
} as const;

const common = {
  schemaVersion: z.literal(MSSR_LIBRARIAN_HOST_RUNTIME_OBSERVATION_VERSION),
  eventId: token,
  observedAt: z.string().datetime(),
  host: token,
  runtimeBootId: token,
  serverVersion: boundedName.optional(),
  pid: nonNegativeInt.optional(),
  ...optionalCorrelation,
} as const;

export const mssrLibrarianHostToolCallObservationSchema = z.object({
  ...common,
  kind: z.literal("tool-call"),
  toolName: boundedName,
  startedAt: z.string().datetime().optional(),
  durationMs,
  ok: z.boolean(),
  caller: boundedName.optional(),
  clientName: boundedName.optional(),
  model: boundedName.optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "max", "ultra", "unknown"]).optional(),
  inputKeys: z.array(boundedName).max(64).default([]),
  outputChars: nonNegativeInt.optional(),
  routingStatus: boundedName.optional(),
  mssrEligible: z.boolean().optional(),
  resultOk: z.boolean().nullable().optional(),
  resultCode: boundedName.nullable().optional(),
  resultStatus: boundedName.nullable().optional(),
  subjectKind: token.optional(),
  subjectFingerprint: sha256.optional(),
  errorClass: token.optional(),
  errorCode: token.optional(),
  errorFingerprint: sha256.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.ok && (value.errorClass || value.errorCode || value.errorFingerprint)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ok"],
      message: "Successful host tool calls cannot carry error metadata.",
    });
  }
});

export const mssrLibrarianHostRuntimeGenerationObservationSchema = z.object({
  ...common,
  kind: z.literal("runtime-generation"),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  callCount: nonNegativeInt,
  successfulCalls: nonNegativeInt.optional(),
  failedCalls: nonNegativeInt.optional(),
}).strict().superRefine((value, ctx) => {
  if (Date.parse(value.lastSeenAt) < Date.parse(value.firstSeenAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastSeenAt"],
      message: "Runtime generation lastSeenAt cannot precede firstSeenAt.",
    });
  }
  const accounted = (value.successfulCalls ?? 0) + (value.failedCalls ?? 0);
  if (accounted > value.callCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["callCount"],
      message: "Runtime generation successfulCalls + failedCalls cannot exceed callCount.",
    });
  }
});

export const mssrLibrarianHostRuntimeHealthObservationSchema = z.object({
  ...common,
  kind: z.literal("runtime-health"),
  component: token,
  status: z.enum(["healthy", "degraded", "unavailable", "unknown"]),
  checkCode: token.optional(),
  pendingCount: nonNegativeInt.optional(),
  failedCount: nonNegativeInt.optional(),
  droppedCount: nonNegativeInt.optional(),
  latencyMs: durationMs.optional(),
  evidenceFingerprint: sha256.optional(),
}).strict();

export const mssrLibrarianHostMetricObservationSchema = z.object({
  ...common,
  kind: z.literal("metric"),
  metricName: token,
  metricScope: token.optional(),
  value: z.number().finite(),
  unit: z.enum(["ms", "count", "ratio", "bytes", "chars", "percent"]),
  status: z.enum(["ok", "warning", "error", "unknown"]).optional(),
  subjectKind: token.optional(),
  subjectFingerprint: sha256.optional(),
}).strict();

export const mssrLibrarianHostRuntimeObservationSchema = z.union([
  mssrLibrarianHostToolCallObservationSchema,
  mssrLibrarianHostRuntimeGenerationObservationSchema,
  mssrLibrarianHostRuntimeHealthObservationSchema,
  mssrLibrarianHostMetricObservationSchema,
]);

export type MssrLibrarianHostRuntimeObservation = z.infer<typeof mssrLibrarianHostRuntimeObservationSchema>;

function commonMetadata(observation: MssrLibrarianHostRuntimeObservation) {
  return {
    schemaVersion: observation.schemaVersion,
    eventId: observation.eventId,
    observedAt: observation.observedAt,
    host: observation.host,
    runtimeBootId: observation.runtimeBootId,
    serverVersion: observation.serverVersion ?? null,
    pid: observation.pid ?? null,
    traceId: observation.traceId ?? null,
    workflowKey: observation.workflowKey ?? null,
    taskKey: observation.taskKey ?? null,
    project: observation.project ?? null,
    relatedProject: observation.relatedProject ?? null,
  };
}

/**
 * Convert one host-supplied, privacy-bounded operational observation into the
 * portable Librarian ingress contract. This parser is intentionally strict:
 * raw tool arguments/results, free-form error messages, filesystem/database
 * paths, prompts, transcripts and private reasoning are not part of any input
 * schema and therefore fail closed as unknown keys.
 */
export function librarianRecordFromHostRuntimeObservation(input: unknown): MssrLibrarianIngressRecord {
  const observation = mssrLibrarianHostRuntimeObservationSchema.parse(input);
  const identity = `${observation.host}:${observation.runtimeBootId}:${observation.eventId}`;
  const sourceRef = `host/${observation.host}/runtime/${observation.runtimeBootId}/${observation.kind}`;
  const base = commonMetadata(observation);

  if (observation.kind === "tool-call") {
    return {
      namespace: "tool",
      kind: "call",
      identity,
      sourceRef,
      revision: observation.eventId,
      metadata: {
        ...base,
        toolName: observation.toolName,
        startedAt: observation.startedAt ?? null,
        durationMs: observation.durationMs,
        ok: observation.ok,
        caller: observation.caller ?? null,
        clientName: observation.clientName ?? null,
        model: observation.model ?? null,
        reasoningEffort: observation.reasoningEffort ?? null,
        inputKeys: observation.inputKeys,
        outputChars: observation.outputChars ?? null,
        routingStatus: observation.routingStatus ?? null,
        mssrEligible: observation.mssrEligible ?? null,
        resultOk: observation.resultOk ?? null,
        resultCode: observation.resultCode ?? null,
        resultStatus: observation.resultStatus ?? null,
        subjectKind: observation.subjectKind ?? null,
        subjectFingerprint: observation.subjectFingerprint ?? null,
        errorClass: observation.errorClass ?? null,
        errorCode: observation.errorCode ?? null,
        errorFingerprint: observation.errorFingerprint ?? null,
      },
      provenance: {
        producer: "host-tool-runtime",
        host: observation.host,
        ...(observation.traceId ? { traceId: observation.traceId } : {}),
      },
    };
  }

  if (observation.kind === "runtime-generation") {
    return {
      namespace: "host",
      kind: "runtime-generation",
      identity,
      sourceRef,
      revision: observation.eventId,
      metadata: {
        ...base,
        firstSeenAt: observation.firstSeenAt,
        lastSeenAt: observation.lastSeenAt,
        callCount: observation.callCount,
        successfulCalls: observation.successfulCalls ?? null,
        failedCalls: observation.failedCalls ?? null,
      },
      provenance: {
        producer: "host-tool-runtime",
        host: observation.host,
        ...(observation.traceId ? { traceId: observation.traceId } : {}),
      },
    };
  }

  if (observation.kind === "runtime-health") {
    return {
      namespace: "host",
      kind: "runtime-health",
      identity,
      sourceRef,
      revision: observation.eventId,
      payloadFingerprint: observation.evidenceFingerprint,
      metadata: {
        ...base,
        component: observation.component,
        status: observation.status,
        checkCode: observation.checkCode ?? null,
        pendingCount: observation.pendingCount ?? null,
        failedCount: observation.failedCount ?? null,
        droppedCount: observation.droppedCount ?? null,
        latencyMs: observation.latencyMs ?? null,
      },
      provenance: {
        producer: "host-tool-runtime",
        host: observation.host,
        ...(observation.traceId ? { traceId: observation.traceId } : {}),
      },
    };
  }

  return {
    namespace: "metric",
    kind: "observation",
    identity,
    sourceRef,
    revision: observation.eventId,
    metadata: {
      ...base,
      metricName: observation.metricName,
      metricScope: observation.metricScope ?? null,
      value: observation.value,
      unit: observation.unit,
      status: observation.status ?? null,
      subjectKind: observation.subjectKind ?? null,
      subjectFingerprint: observation.subjectFingerprint ?? null,
    },
    provenance: {
      producer: "host-tool-runtime",
      host: observation.host,
      ...(observation.traceId ? { traceId: observation.traceId } : {}),
    },
  };
}
