import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromContextAssemblyTelemetry,
} from "../dist/index.js";

const envelope = {
  protocolVersion: "mssr-telemetry-v1",
  eventId: "mssr-ext-context-assembly-001",
  emittedAt: "2026-09-29T18:20:00.000Z",
  source: "chatgpt-web",
  traceId: "mssr-context-assembly-adapter-001",
  caller: "chatgpt-web",
  event: {
    kind: "context_assembly",
    stage: "verify",
    mode: "selective",
    page: 2,
    requestedContextChars: 18000,
    deliveredContextChars: 4393,
    estimatedCharsSaved: 1086,
    retainedContextCharsSaved: 727,
    requiredOverflowChars: 0,
    acceptedOverflowChars: 0,
    remainingRequiredUnits: 0,
    remainingAcceptedUnits: 3,
    requiredBudgetExceeded: false,
    optionalContextOmitted: true,
    continuationIssued: true,
    continuationConsumed: false,
    chainCompleted: false,
  },
};

const record = librarianRecordFromContextAssemblyTelemetry(envelope);
assert.equal(record.namespace, "context-assembly");
assert.equal(record.kind, "page");
assert.equal(record.identity, "mssr-context-assembly-adapter-001:mssr-ext-context-assembly-001");
assert.equal(record.sourceRef, "telemetry/chatgpt-web/context-assembly/mssr-context-assembly-adapter-001");
assert.equal(record.metadata.stage, "verify");
assert.equal(record.metadata.mode, "selective");
assert.equal(record.metadata.page, 2);
assert.equal(record.metadata.deliveredContextChars, 4393);
assert.equal(record.metadata.optionalContextOmitted, true);
assert.equal(record.metadata.continuationIssued, true);
assert.equal(record.metadata.chainCompleted, false);
assert.deepEqual(record.provenance, {
  producer: "context-assembly-paging",
  host: "chatgpt-web",
  traceId: "mssr-context-assembly-adapter-001",
});

const catalogued = catalogMssrLibrarianRecord(record);
assert.equal(catalogued.contractKey, "context-assembly:page:mssr-context-assembly-adapter-001:mssr-ext-context-assembly-001");
assert.equal(catalogued.metadataFingerprint.length, 64);
assert.equal(catalogued.recordFingerprint.length, 64);

assert.throws(
  () => librarianRecordFromContextAssemblyTelemetry({
    ...envelope,
    rawContext: "RAW CONTEXT MUST NEVER BE ACCEPTED",
  }),
  /Unrecognized key|unrecognized/i,
  "strict telemetry must reject raw context additions",
);

assert.throws(
  () => librarianRecordFromContextAssemblyTelemetry({
    ...envelope,
    eventId: "mssr-ext-route-context-adapter",
    event: {
      kind: "route",
      action: "plan",
      taskHash: "a".repeat(64),
      route: {
        caller: "chatgpt-web",
        stage: "start",
        classificationMode: "structured-semantic",
        agentProfile: { model: "gpt-5.6-sol", reasoningEffort: "high" },
        contextUsed: false,
        contextCharacters: 0,
        workflows: [],
        activeSkills: [],
        deferredSkills: [],
        loadOrder: [],
        deferredLoadOrder: [],
        signals: ["nominal"],
        requiredPhases: [],
        completedPhases: [],
        missingRequiredPhases: [],
      },
    },
  }),
  /requires context_assembly telemetry/,
  "route telemetry remains owned by the route adapter",
);

const duplicate = librarianRecordFromContextAssemblyTelemetry({
  ...envelope,
  eventId: "mssr-ext-context-assembly-002",
});
const duplicateAudit = auditMssrLibrarianCatalog([record, duplicate]);
assert.ok(
  duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  "same trace + same bounded assembly state under a different event id should be structurally visible",
);

const otherTrace = librarianRecordFromContextAssemblyTelemetry({
  ...envelope,
  eventId: "mssr-ext-context-assembly-003",
  traceId: "mssr-context-assembly-adapter-002",
});
const crossTraceAudit = auditMssrLibrarianCatalog([record, otherTrace]);
assert.equal(
  crossTraceAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  false,
  "equivalent assembly shapes in different traces must not be mislabeled as structural duplication",
);

const coverage = getMssrLibrarianCoverageInventory(["context-assembly-paging"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-context-assembly-adapter.ts#librarianRecordFromContextAssemblyTelemetry");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian context assembly adapter tests passed");
