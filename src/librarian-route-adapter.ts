import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

type MssrRouteTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "route" }>;
};

/**
 * Adapt one already privacy-bounded MSSR route telemetry envelope into the
 * Librarian ingress contract. The route telemetry contract already excludes raw
 * task/context text, intent summaries, capability prose, transcripts and hidden
 * reasoning; this adapter still uses an explicit allowlist instead of copying the
 * envelope wholesale so future telemetry additions do not silently widen
 * Librarian retention.
 */
export function librarianRecordFromRouteTelemetry(input: unknown): MssrLibrarianIngressRecord {
  const parsed = mssrTelemetryEnvelopeSchema.parse(input);
  if (parsed.event.kind !== "route") {
    throw new Error(`Route Librarian adapter requires route telemetry; received '${parsed.event.kind}'.`);
  }

  const envelope = parsed as MssrRouteTelemetryEnvelope;
  const event = envelope.event;
  const route = event.route;

  return {
    namespace: "route",
    kind: event.action,
    identity: `${envelope.traceId}:${envelope.eventId}`,
    sourceRef: `telemetry/${envelope.source}/route/${envelope.traceId}`,
    revision: envelope.eventId,
    metadata: {
      traceId: envelope.traceId,
      source: envelope.source,
      caller: envelope.caller,
      protocolVersion: envelope.protocolVersion,
      action: event.action,
      taskHash: event.taskHash,
      stage: route.stage,
      classificationMode: route.classificationMode,
      workflowKey: route.workflowKey ?? null,
      taskKey: route.taskKey ?? null,
      parentTraceId: route.parentTraceId ?? null,
      supersedesTraceId: route.supersedesTraceId ?? null,
      agentProfile: {
        model: route.agentProfile.model,
        reasoningEffort: route.agentProfile.reasoningEffort,
      },
      contextUsed: route.contextUsed,
      contextCharacters: route.contextCharacters,
      workflows: route.workflows,
      activeSkills: route.activeSkills.map((skill) => ({
        name: skill.name,
        source: skill.source ?? null,
        required: skill.required,
        score: skill.score ?? null,
      })),
      deferredSkills: route.deferredSkills.map((skill) => ({
        name: skill.name,
        source: skill.source ?? null,
        required: skill.required,
        score: skill.score ?? null,
      })),
      loadOrder: route.loadOrder,
      deferredLoadOrder: route.deferredLoadOrder,
      intent: route.intent ? {
        domains: route.intent.domains,
        actions: route.intent.actions,
        artifacts: route.intent.artifacts,
        needs: route.intent.needs,
        signals: route.intent.signals,
        risk: route.intent.risk,
        ambiguity: route.intent.ambiguity,
      } : null,
      signals: route.signals,
      ambiguity: route.ambiguity ?? null,
      requiredPhases: route.requiredPhases,
      completedPhases: route.completedPhases,
      missingRequiredPhases: route.missingRequiredPhases,
    },
    provenance: {
      producer: "route-replan",
      host: envelope.source,
      traceId: envelope.traceId,
    },
  };
}
