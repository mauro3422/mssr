import { createHash } from "node:crypto";
import { z } from "zod";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  fingerprintMssrContextMessage,
  mssrContextDeliveryReceiptSchema,
  type MssrContextDeliveryReceipt,
} from "./context-message-inbox.js";
import {
  mssrContextMessageSelectionSchema,
  type MssrContextEvidenceReference,
  type MssrContextMessageSelection,
} from "./context-messages.js";
import {
  mssrTelemetryEnvelopeSchema,
  type MssrTelemetryEnvelope,
} from "./telemetry.js";

type MssrProjectContextSelectionTelemetryEnvelope = MssrTelemetryEnvelope & {
  event: Extract<MssrTelemetryEnvelope["event"], { kind: "project_context_selection" }>;
};

const contextEvidenceInputSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  source: z.string().trim().min(1).max(120),
  traceId: z.string().trim().min(1).max(200).optional(),
  selection: mssrContextMessageSelectionSchema,
  receipts: z.array(mssrContextDeliveryReceiptSchema).max(64),
}).strict();

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function evidenceMetadata(evidence: MssrContextEvidenceReference) {
  return {
    kind: evidence.kind,
    ref: evidence.ref,
    canonicalOwner: evidence.canonicalOwner,
    provenance: evidence.provenance,
    freshness: evidence.freshness,
    observedAt: evidence.observedAt,
    revision: evidence.revision,
  };
}

/**
 * Adapt one privacy-bounded project-context module-selection event into
 * Librarian ingress. Only module ids, selected flags and deterministic reason
 * codes cross this boundary. Module/document bodies, intent summaries, matched
 * terms, scores and delivery/receipt payloads remain outside this adapter.
 */
export function librarianRecordFromProjectContextSelectionTelemetry(input: unknown): MssrLibrarianIngressRecord {
  const parsed = mssrTelemetryEnvelopeSchema.parse(input);
  if (parsed.event.kind !== "project_context_selection") {
    throw new Error(`Project Context Librarian adapter requires project_context_selection telemetry; received '${parsed.event.kind}'.`);
  }

  const envelope = parsed as MssrProjectContextSelectionTelemetryEnvelope;
  const event = envelope.event;

  return {
    namespace: "context",
    kind: "project-selection",
    identity: `${envelope.traceId}:${envelope.eventId}`,
    sourceRef: `telemetry/${envelope.source}/project-context/${event.projectName}/${envelope.traceId}`,
    revision: envelope.eventId,
    metadata: {
      traceId: envelope.traceId,
      source: envelope.source,
      caller: envelope.caller,
      protocolVersion: envelope.protocolVersion,
      projectName: event.projectName,
      stage: event.stage,
      decisions: event.decisions.map((decision) => ({
        id: decision.id,
        selected: decision.selected,
        reason: decision.reason,
      })),
    },
    provenance: {
      producer: "project-context-selection",
      host: envelope.source,
      traceId: envelope.traceId,
    },
  };
}

/**
 * Adapt the already-portable Context Message selection + delivery-receipt
 * contracts into Librarian records. Message title/summary, evidence summaries,
 * selector matches/scores, persistence proposal prose and continuation summary
 * never enter the catalog. Content identity is carried by stable fingerprints.
 */
export function librarianRecordsFromContextMessageEvidence(input: unknown): MssrLibrarianIngressRecord[] {
  const parsed = contextEvidenceInputSchema.parse(input);
  const selection = parsed.selection as MssrContextMessageSelection;
  const receipts = parsed.receipts as MssrContextDeliveryReceipt[];
  const selectedById = new Map(selection.selected.map((message) => [message.id, message]));
  const records: MssrLibrarianIngressRecord[] = [];

  for (const decision of selection.decisions) {
    const decisionFingerprint = sha256(JSON.stringify({
      id: decision.id,
      selected: decision.selected,
      reason: decision.reason,
      estimatedChars: decision.estimatedChars,
    }));
    records.push({
      namespace: "context-message",
      kind: "selection-decision",
      identity: `${parsed.projectName}:${decision.id}`,
      sourceRef: `context-plane/${parsed.projectName}/message/${decision.id}/selection`,
      revision: decisionFingerprint,
      payloadFingerprint: decisionFingerprint,
      metadata: {
        projectName: parsed.projectName,
        messageId: decision.id,
        selected: decision.selected,
        reason: decision.reason,
        estimatedChars: decision.estimatedChars,
      },
      provenance: {
        producer: "project-context-selection",
        host: parsed.source,
        traceId: parsed.traceId,
      },
    });

    const message = selectedById.get(decision.id);
    if (!message) continue;
    const messageFingerprint = fingerprintMssrContextMessage(message);
    records.push({
      namespace: "context-message",
      kind: "selected-message",
      identity: `${parsed.projectName}:${message.id}`,
      sourceRef: `context-plane/${parsed.projectName}/message/${message.id}`,
      revision: messageFingerprint,
      payloadFingerprint: messageFingerprint,
      metadata: {
        projectName: parsed.projectName,
        messageId: message.id,
        messageKind: message.kind,
        severity: message.severity,
        required: message.required,
        priority: message.priority,
        dedupeKey: message.dedupeKey,
        advisoryActions: message.advisoryActions,
        stages: message.stages,
        domains: message.domains,
        actions: message.actions,
        artifacts: message.artifacts,
        needs: message.needs,
        signals: message.signals,
        evidence: message.evidence.map(evidenceMetadata),
        continuation: message.continuation ? {
          traceId: message.continuation.traceId,
          projectRevision: message.continuation.projectRevision,
          freshness: message.continuation.freshness,
          unresolvedRefs: message.continuation.unresolvedRefs,
          currentStage: message.continuation.currentStage,
          completedPhases: message.continuation.completedPhases,
          sourceReceipts: message.continuation.sourceReceipts.map(evidenceMetadata),
        } : undefined,
        persistenceProposal: message.persistenceProposal ? {
          target: message.persistenceProposal.target,
          reviewRequired: message.persistenceProposal.reviewRequired,
          evidence: message.persistenceProposal.evidence.map(evidenceMetadata),
        } : undefined,
      },
      provenance: {
        producer: "project-context-selection",
        host: parsed.source,
        traceId: parsed.traceId,
      },
    });
  }

  for (const receipt of receipts) {
    const revision = receipt.fingerprint ?? sha256(JSON.stringify({
      messageId: receipt.messageId,
      messageKind: receipt.messageKind,
      firstSelectedAt: receipt.firstSelectedAt,
      lastSelectedAt: receipt.lastSelectedAt,
    }));
    records.push({
      namespace: "context-message",
      kind: "delivery-receipt",
      identity: `${parsed.projectName}:${receipt.messageId}`,
      sourceRef: `context-plane/${parsed.projectName}/message/${receipt.messageId}/delivery`,
      revision,
      payloadFingerprint: receipt.fingerprint,
      metadata: {
        projectName: parsed.projectName,
        messageId: receipt.messageId,
        messageKind: receipt.messageKind,
        selectedCount: receipt.selectedCount,
        firstSelectedAt: receipt.firstSelectedAt,
        lastSelectedAt: receipt.lastSelectedAt,
        expiresAt: receipt.expiresAt,
        acknowledgedAt: receipt.acknowledgedAt,
        sourceTraceId: receipt.traceId,
        sources: receipt.sources.map(evidenceMetadata),
      },
      provenance: {
        producer: "project-context-selection",
        host: parsed.source,
        traceId: parsed.traceId,
      },
    });
  }

  return records;
}
