import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromProjectContextSelectionTelemetry,
  librarianRecordsFromContextMessageEvidence,
  mssrContextMessageSelectionSchema,
  mssrTelemetryEnvelopeSchema,
} from "../dist/index.js";

const envelope = {
  protocolVersion: "mssr-telemetry-v1",
  eventId: "mssr-ext-project-context-001",
  emittedAt: "2026-09-29T18:35:00.000Z",
  source: "chatgpt-web",
  traceId: "mssr-project-context-adapter-001",
  caller: "chatgpt-web",
  event: {
    kind: "project_context_selection",
    stage: "start",
    projectName: "mssr",
    decisions: [
      { id: "mssr-context-economy-v2", selected: true, reason: "selected" },
      { id: "mssr-semantic-evidence-plane", selected: false, reason: "budget-exceeded" },
      { id: "mssr-context-plane-history", selected: false, reason: "intent-mismatch" },
    ],
  },
};

assert.equal(mssrTelemetryEnvelopeSchema.safeParse(envelope).success, true, "portable telemetry must own project_context_selection before the Librarian adapter claims coverage");

const record = librarianRecordFromProjectContextSelectionTelemetry(envelope);
assert.equal(record.namespace, "context");
assert.equal(record.kind, "project-selection");
assert.equal(record.identity, "mssr-project-context-adapter-001:mssr-ext-project-context-001");
assert.equal(record.sourceRef, "telemetry/chatgpt-web/project-context/mssr/mssr-project-context-adapter-001");
assert.equal(record.metadata.projectName, "mssr");
assert.equal(record.metadata.stage, "start");
assert.deepEqual(record.metadata.decisions, envelope.event.decisions);
assert.deepEqual(record.provenance, {
  producer: "project-context-selection",
  host: "chatgpt-web",
  traceId: "mssr-project-context-adapter-001",
});

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("mssr-semantic-evidence-plane"), true);
assert.equal(Object.hasOwn(record.metadata, "content"), false);
assert.equal(Object.hasOwn(record.metadata, "summary"), false);
assert.equal(Object.hasOwn(record.metadata, "score"), false);
assert.equal(Object.hasOwn(record.metadata, "matched"), false);

const catalogued = catalogMssrLibrarianRecord(record);
assert.equal(catalogued.contractKey, "context:project-selection:mssr-project-context-adapter-001:mssr-ext-project-context-001");
assert.equal(catalogued.metadataFingerprint.length, 64);
assert.equal(catalogued.recordFingerprint.length, 64);

assert.equal(mssrTelemetryEnvelopeSchema.safeParse({
  ...envelope,
  eventId: "mssr-ext-project-context-bad-reason",
  event: {
    ...envelope.event,
    decisions: [{ id: "module-a", selected: false, reason: "model-did-not-like-it" }],
  },
}).success, false, "selection reasons must use the portable deterministic vocabulary");

assert.equal(mssrTelemetryEnvelopeSchema.safeParse({
  ...envelope,
  eventId: "mssr-ext-project-context-raw-body",
  event: {
    ...envelope.event,
    moduleBody: "RAW MODULE BODY MUST NOT CROSS TELEMETRY",
  },
}).success, false, "strict telemetry must reject module/document bodies");

assert.equal(mssrTelemetryEnvelopeSchema.safeParse({
  ...envelope,
  eventId: "mssr-ext-project-context-score",
  event: {
    ...envelope.event,
    decisions: [{ id: "module-a", selected: true, reason: "selected", score: 999 }],
  },
}).success, false, "Librarian selection telemetry deliberately excludes selector scores/matched terms");

assert.throws(
  () => librarianRecordFromProjectContextSelectionTelemetry({
    ...envelope,
    eventId: "mssr-ext-context-assembly-pc-adapter",
    event: {
      kind: "context_assembly",
      stage: "start",
      mode: "selective",
      page: 1,
      requestedContextChars: 100,
      deliveredContextChars: 80,
      estimatedCharsSaved: 20,
      retainedContextCharsSaved: 0,
      requiredOverflowChars: 0,
      acceptedOverflowChars: 0,
      remainingRequiredUnits: 0,
      remainingAcceptedUnits: 0,
      requiredBudgetExceeded: false,
      optionalContextOmitted: false,
      continuationIssued: false,
      continuationConsumed: false,
      chainCompleted: true,
    },
  }),
  /requires project_context_selection telemetry/,
  "context assembly remains owned by its own adapter",
);

const duplicate = librarianRecordFromProjectContextSelectionTelemetry({
  ...envelope,
  eventId: "mssr-ext-project-context-002",
});
const duplicateAudit = auditMssrLibrarianCatalog([record, duplicate]);
assert.ok(
  duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  "same trace + same bounded project-context decisions under another event id should be structurally visible",
);

const otherTrace = librarianRecordFromProjectContextSelectionTelemetry({
  ...envelope,
  eventId: "mssr-ext-project-context-003",
  traceId: "mssr-project-context-adapter-002",
});
const crossTraceAudit = auditMssrLibrarianCatalog([record, otherTrace]);
assert.equal(
  crossTraceAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  false,
  "equivalent selection shapes in different traces must not be mislabeled as structural duplication",
);

const contextMessageSelection = {
  selected: [{
    id: "architecture-decision:adr-0009",
    kind: "architecture-decision",
    severity: "info",
    title: "PRIVATE TITLE MUST NOT ENTER LIBRARIAN",
    summary: "PRIVATE SUMMARY MUST NOT ENTER LIBRARIAN",
    evidence: [{
      kind: "architecture-decision",
      ref: "docs/decisions/0009-semantic-evidence-plane.md",
      summary: "PRIVATE EVIDENCE SUMMARY MUST NOT ENTER LIBRARIAN",
      canonicalOwner: "D:/Dev/mssr",
      provenance: "project",
      freshness: "fresh",
      revision: "adr-0009-rev-1",
    }],
    advisoryActions: ["inspect-reference"],
    continuation: {
      traceId: "mssr-project-context-adapter-001",
      projectRevision: "project-rev-1",
      freshness: "fresh",
      unresolvedRefs: ["docs/next.md"],
      sourceReceipts: [{
        kind: "verification",
        ref: "tests/context-message",
        summary: "PRIVATE CONTINUATION SOURCE SUMMARY",
        canonicalOwner: "D:/Dev/mssr",
        provenance: "project",
        freshness: "fresh",
        revision: "test-rev-1",
      }],
      currentStage: "start",
      completedPhases: ["discovery"],
      nextGate: "PRIVATE NEXT GATE PROSE",
      summary: "PRIVATE CONTINUATION SUMMARY",
    },
    persistenceProposal: {
      target: "project-memory",
      summary: "PRIVATE PERSISTENCE PROPOSAL",
      evidence: [{
        kind: "project-memory",
        ref: ".mssr/PROJECT_MEMORY.md",
        summary: "PRIVATE PERSISTENCE EVIDENCE SUMMARY",
        canonicalOwner: "D:/Dev/mssr",
        provenance: "project",
        freshness: "fresh",
        revision: "memory-rev-1",
      }],
      reviewRequired: true,
    },
    stages: ["start"],
    domains: ["agent-orchestration"],
    actions: ["review"],
    artifacts: ["project"],
    needs: ["integrity-verification"],
    signals: ["reusable-pattern"],
    required: false,
    priority: 7,
    estimatedChars: 900,
  }],
  decisions: [
    {
      id: "architecture-decision:adr-0009",
      selected: true,
      score: 999,
      estimatedChars: 900,
      reason: "selected",
      matched: ["action:review", "signal:reusable-pattern"],
    },
    {
      id: "related-incident:old-context",
      selected: false,
      score: 123,
      estimatedChars: 420,
      reason: "budget-exceeded",
      matched: ["action:review"],
    },
  ],
  continuationReceipts: [],
  selectedChars: 900,
  remainingChars: 1100,
  remainingMessages: 3,
  requiredBudgetExceeded: false,
  requiredMessageOverflow: [],
  advisoryOnly: true,
};
assert.equal(mssrContextMessageSelectionSchema.safeParse(contextMessageSelection).success, true);

const contextMessageRecords = librarianRecordsFromContextMessageEvidence({
  projectName: "mssr",
  source: "chatgpt-web",
  traceId: "mssr-project-context-adapter-001",
  selection: contextMessageSelection,
  receipts: [{
    messageId: "architecture-decision:adr-0009",
    messageKind: "architecture-decision",
    selectedCount: 2,
    firstSelectedAt: "2026-09-29T18:00:00.000Z",
    lastSelectedAt: "2026-09-29T18:35:00.000Z",
    expiresAt: "2026-10-06T18:35:00.000Z",
    acknowledgedAt: "2026-09-29T18:36:00.000Z",
    fingerprint: "a".repeat(64),
    sources: [{
      kind: "architecture-decision",
      ref: "docs/decisions/0009-semantic-evidence-plane.md",
      summary: "PRIVATE RECEIPT SOURCE SUMMARY",
      canonicalOwner: "D:/Dev/mssr",
      provenance: "project",
      freshness: "fresh",
      revision: "adr-0009-rev-1",
    }],
    traceId: "mssr-project-context-adapter-001",
    nextGate: "PRIVATE RECEIPT NEXT GATE",
  }],
});
assert.equal(contextMessageRecords.length, 4, "two decisions + one selected message + one delivery receipt should cross ingress");
assert.equal(contextMessageRecords.filter((item) => item.kind === "selection-decision").length, 2);
assert.equal(contextMessageRecords.filter((item) => item.kind === "selected-message").length, 1);
assert.equal(contextMessageRecords.filter((item) => item.kind === "delivery-receipt").length, 1);

const selectedMessageRecord = contextMessageRecords.find((item) => item.kind === "selected-message");
assert.ok(selectedMessageRecord);
assert.equal(selectedMessageRecord.payloadFingerprint.length, 64);
assert.equal(selectedMessageRecord.metadata.messageKind, "architecture-decision");
assert.equal(selectedMessageRecord.metadata.evidence[0].revision, "adr-0009-rev-1");
assert.equal(selectedMessageRecord.metadata.persistenceProposal.target, "project-memory");

const receiptRecord = contextMessageRecords.find((item) => item.kind === "delivery-receipt");
assert.ok(receiptRecord);
assert.equal(receiptRecord.metadata.selectedCount, 2);
assert.equal(receiptRecord.metadata.acknowledgedAt, "2026-09-29T18:36:00.000Z");
assert.equal(receiptRecord.payloadFingerprint, "a".repeat(64));

const contextSerialized = JSON.stringify(contextMessageRecords);
for (const forbidden of [
  "PRIVATE TITLE MUST NOT ENTER LIBRARIAN",
  "PRIVATE SUMMARY MUST NOT ENTER LIBRARIAN",
  "PRIVATE EVIDENCE SUMMARY MUST NOT ENTER LIBRARIAN",
  "PRIVATE CONTINUATION SOURCE SUMMARY",
  "PRIVATE NEXT GATE PROSE",
  "PRIVATE CONTINUATION SUMMARY",
  "PRIVATE PERSISTENCE PROPOSAL",
  "PRIVATE PERSISTENCE EVIDENCE SUMMARY",
  "PRIVATE RECEIPT SOURCE SUMMARY",
  "PRIVATE RECEIPT NEXT GATE",
  "action:review",
  "signal:reusable-pattern",
  "\"score\":999",
]) {
  assert.equal(contextSerialized.includes(forbidden), false, `Librarian must strip '${forbidden}'`);
}
assert.equal(contextSerialized.includes("docs/decisions/0009-semantic-evidence-plane.md"), true, "bounded evidence refs should remain available");
assert.equal(contextSerialized.includes("budget-exceeded"), true, "deterministic skip reasons should remain available");

assert.throws(
  () => librarianRecordsFromContextMessageEvidence({
    projectName: "mssr",
    source: "chatgpt-web",
    selection: { ...contextMessageSelection, rawPrompt: "MUST FAIL" },
    receipts: [],
  }),
  /Unrecognized key|unrecognized/i,
  "strict context-message selection input must reject raw prompt additions",
);

const contextCatalog = contextMessageRecords.map(catalogMssrLibrarianRecord);
assert.ok(contextCatalog.every((item) => item.recordFingerprint.length === 64));

const coverage = getMssrLibrarianCoverageInventory(["project-context-selection"]);
assert.equal(coverage.entries[0].status, "instrumented", "module selection + Context Messages + delivery receipts are now covered");
assert.ok(coverage.entries[0].adapterRef.includes("librarianRecordsFromContextMessageEvidence"));
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.gaps.length, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian project context adapter tests passed");
