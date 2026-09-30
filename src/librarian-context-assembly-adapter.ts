import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

type MssrContextAssemblyTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "context_assembly" }>;
};

/**
 * Adapt one privacy-bounded context assembly telemetry event into Librarian
 * ingress. The adapter stores only budget/delivery/paging state already present
 * in the strict telemetry contract; source bodies, selected unit contents,
 * prompts, transcripts and private reasoning never cross this boundary.
 */
export function librarianRecordFromContextAssemblyTelemetry(input: unknown): MssrLibrarianIngressRecord {
  const parsed = mssrTelemetryEnvelopeSchema.parse(input);
  if (parsed.event.kind !== "context_assembly") {
    throw new Error(`Context Assembly Librarian adapter requires context_assembly telemetry; received '${parsed.event.kind}'.`);
  }

  const envelope = parsed as MssrContextAssemblyTelemetryEnvelope;
  const event = envelope.event;

  return {
    namespace: "context-assembly",
    kind: "page",
    identity: `${envelope.traceId}:${envelope.eventId}`,
    sourceRef: `telemetry/${envelope.source}/context-assembly/${envelope.traceId}`,
    revision: envelope.eventId,
    metadata: {
      traceId: envelope.traceId,
      source: envelope.source,
      caller: envelope.caller,
      protocolVersion: envelope.protocolVersion,
      stage: event.stage,
      mode: event.mode,
      page: event.page,
      requestedContextChars: event.requestedContextChars,
      deliveredContextChars: event.deliveredContextChars,
      estimatedCharsSaved: event.estimatedCharsSaved,
      retainedContextCharsSaved: event.retainedContextCharsSaved,
      requiredOverflowChars: event.requiredOverflowChars,
      acceptedOverflowChars: event.acceptedOverflowChars,
      remainingRequiredUnits: event.remainingRequiredUnits,
      remainingAcceptedUnits: event.remainingAcceptedUnits,
      requiredBudgetExceeded: event.requiredBudgetExceeded,
      optionalContextOmitted: event.optionalContextOmitted,
      continuationIssued: event.continuationIssued,
      continuationConsumed: event.continuationConsumed,
      chainCompleted: event.chainCompleted,
    },
    provenance: {
      producer: "context-assembly-paging",
      host: envelope.source,
      traceId: envelope.traceId,
    },
  };
}
