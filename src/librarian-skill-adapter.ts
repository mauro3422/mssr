import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

type MssrSkillLoadTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "skill_load" }>;
};

type MssrSkillDecisionTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "skill_decision" }>;
};

/**
 * Adapt privacy-bounded skill load/selection telemetry into Librarian ingress.
 * Free-form warning/reason summary text is intentionally not retained: the
 * catalog keeps typed load/decision facts plus structured reason/peer identity.
 */
export function librarianRecordFromSkillTelemetry(input: unknown): MssrLibrarianIngressRecord {
  const parsed = mssrTelemetryEnvelopeSchema.parse(input);
  if (parsed.event.kind !== "skill_load" && parsed.event.kind !== "skill_decision") {
    throw new Error(`Skill Librarian adapter requires skill_load or skill_decision telemetry; received '${parsed.event.kind}'.`);
  }

  if (parsed.event.kind === "skill_load") {
    const envelope = parsed as MssrSkillLoadTelemetryEnvelope;
    const event = envelope.event;
    return {
      namespace: "skill",
      kind: "load",
      identity: `${envelope.traceId}:${envelope.eventId}`,
      sourceRef: `telemetry/${envelope.source}/skill/${envelope.traceId}`,
      revision: envelope.eventId,
      metadata: {
        traceId: envelope.traceId,
        source: envelope.source,
        caller: envelope.caller,
        protocolVersion: envelope.protocolVersion,
        skillName: event.skillName,
        skillSource: event.source ?? null,
        stage: event.stage ?? null,
        required: event.required ?? null,
        loaded: event.loaded,
        via: event.via,
        warningPresent: typeof event.warning === "string" && event.warning.length > 0,
      },
      provenance: {
        producer: "skill-selection-load",
        host: envelope.source,
        traceId: envelope.traceId,
      },
    };
  }

  const envelope = parsed as MssrSkillDecisionTelemetryEnvelope;
  const decision = envelope.event.decision;
  return {
    namespace: "skill",
    kind: "decision",
    identity: `${envelope.traceId}:${envelope.eventId}`,
    sourceRef: `telemetry/${envelope.source}/skill/${envelope.traceId}`,
    revision: envelope.eventId,
    metadata: {
      traceId: envelope.traceId,
      source: envelope.source,
      caller: envelope.caller,
      protocolVersion: envelope.protocolVersion,
      skillName: decision.skillName,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      relatedSkillName: decision.relatedSkillName ?? null,
      stage: decision.stage ?? null,
      reasonSummaryPresent: typeof decision.reasonSummary === "string" && decision.reasonSummary.length > 0,
    },
    provenance: {
      producer: "skill-selection-load",
      host: envelope.source,
      traceId: envelope.traceId,
    },
  };
}
