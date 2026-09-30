import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

type MssrCheckpointTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "checkpoint" }>;
};

function optional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : value;
}

/**
 * Adapt one already privacy-bounded MSSR checkpoint telemetry envelope into the
 * Librarian ingress contract. This deliberately consumes telemetry rather than
 * trace working memory: raw prompts, transcripts, tool arguments, Git output,
 * hidden/private reasoning and free-form checkpoint/dimension summaries never
 * enter the returned record.
 */
export function librarianRecordFromTraceCheckpoint(input: unknown): MssrLibrarianIngressRecord {
  const parsed = mssrTelemetryEnvelopeSchema.parse(input);
  if (parsed.event.kind !== "checkpoint") {
    throw new Error(`Trace Librarian adapter requires checkpoint telemetry; received '${parsed.event.kind}'.`);
  }

  const envelope = parsed as MssrCheckpointTelemetryEnvelope;
  const checkpoint = envelope.event.checkpoint;
  const namespace = checkpoint.eventType === "outcome" ? "outcome" : "trace";

  return {
    namespace,
    kind: checkpoint.eventType,
    identity: `${envelope.traceId}:${envelope.eventId}`,
    sourceRef: `telemetry/${envelope.source}/trace/${envelope.traceId}`,
    revision: envelope.eventId,
    metadata: {
      traceId: envelope.traceId,
      source: envelope.source,
      caller: envelope.caller,
      protocolVersion: envelope.protocolVersion,
      eventType: checkpoint.eventType,
      stage: optional(checkpoint.stage),
      status: optional(checkpoint.status),
      completedPhases: checkpoint.completedPhases ?? [],
      verificationPassed: optional(checkpoint.verificationPassed),
      persisted: optional(checkpoint.persisted),
      signals: checkpoint.signals ?? [],
      skillName: optional(checkpoint.skillName),
      primarySkill: optional(checkpoint.primarySkill),
      supportingSkills: checkpoint.supportingSkills ?? [],
      metricName: optional(checkpoint.metricName),
      score: optional(checkpoint.score),
      accepted: optional(checkpoint.accepted),
      evidenceKind: optional(checkpoint.evidenceKind),
      evidenceRef: optional(checkpoint.evidenceRef),
      dimensions: (checkpoint.dimensions ?? []).map((dimension) => ({
        name: dimension.name,
        status: dimension.status,
        ...(dimension.evidenceRef ? { evidenceRef: dimension.evidenceRef } : {}),
      })),
      contextSources: checkpoint.contextSources ?? [],
      userCorrections: checkpoint.userCorrections ?? 0,
      model: optional(checkpoint.model),
      reasoningEffort: optional(checkpoint.reasoningEffort),
    },
    provenance: {
      producer: "trace-lifecycle",
      host: envelope.source,
      traceId: envelope.traceId,
    },
  };
}
