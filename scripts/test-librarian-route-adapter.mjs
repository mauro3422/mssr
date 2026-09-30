import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromRouteTelemetry,
} from "../dist/index.js";

const routeEnvelope = {
  protocolVersion: "mssr-telemetry-v1",
  eventId: "mssr-ext-route-001",
  emittedAt: "2026-09-29T17:00:00.000Z",
  source: "chatgpt-web",
  traceId: "mssr-route-adapter-001",
  caller: "chatgpt-web",
  event: {
    kind: "route",
    action: "bootstrap",
    taskHash: "a".repeat(64),
    route: {
      caller: "chatgpt-web",
      stage: "start",
      classificationMode: "structured-semantic",
      workflowKey: "librarian-route-replan-adapter",
      taskKey: "task-route-fixture",
      parentTraceId: null,
      supersedesTraceId: null,
      agentProfile: {
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
      contextUsed: true,
      contextCharacters: 321,
      workflows: ["skill-system-maintenance"],
      activeSkills: [{
        name: "mssr-agent-routing",
        source: "mssr-first-party",
        required: true,
        score: 180,
      }],
      deferredSkills: [{
        name: "systematic-debugging",
        source: "codex-local",
        required: false,
        score: 90,
      }],
      loadOrder: ["mssr-agent-routing"],
      deferredLoadOrder: ["systematic-debugging"],
      intent: {
        domains: ["agent-orchestration", "coding"],
        actions: ["analyze", "verify"],
        artifacts: ["project", "code"],
        needs: ["unit-tests"],
        signals: ["reusable-pattern"],
        risk: "write",
        ambiguity: "low",
      },
      signals: ["reusable-pattern"],
      ambiguity: "low",
      requiredPhases: ["discovery", "verification"],
      completedPhases: ["discovery"],
      missingRequiredPhases: ["verification"],
    },
  },
};

const record = librarianRecordFromRouteTelemetry(routeEnvelope);
assert.equal(record.namespace, "route");
assert.equal(record.kind, "bootstrap");
assert.equal(record.identity, "mssr-route-adapter-001:mssr-ext-route-001");
assert.equal(record.sourceRef, "telemetry/chatgpt-web/route/mssr-route-adapter-001");
assert.equal(record.revision, "mssr-ext-route-001");
assert.deepEqual(record.provenance, {
  producer: "route-replan",
  host: "chatgpt-web",
  traceId: "mssr-route-adapter-001",
});
assert.equal(record.metadata.taskHash, "a".repeat(64));
assert.equal(record.metadata.stage, "start");
assert.equal(record.metadata.intent.domains.includes("coding"), true);
assert.equal(Object.hasOwn(record.metadata.intent, "summary"), false);

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("task-route-fixture"), true, "explicit stable task identity remains bounded routing metadata");
assert.equal(serialized.includes("mssr-agent-routing"), true);

const catalogued = catalogMssrLibrarianRecord(record);
assert.equal(catalogued.contractKey, "route:bootstrap:mssr-route-adapter-001:mssr-ext-route-001");
assert.equal(catalogued.metadataFingerprint.length, 64);
assert.equal(catalogued.recordFingerprint.length, 64);

assert.throws(
  () => librarianRecordFromRouteTelemetry({
    ...routeEnvelope,
    eventId: "mssr-ext-route-raw-task",
    rawTask: "THIS RAW TASK MUST NEVER BE ACCEPTED",
  }),
  /Unrecognized key|unrecognized/i,
  "strict telemetry must reject raw top-level task text rather than retaining it",
);

assert.throws(
  () => librarianRecordFromRouteTelemetry({
    ...routeEnvelope,
    eventId: "mssr-ext-route-summary",
    event: {
      ...routeEnvelope.event,
      route: {
        ...routeEnvelope.event.route,
        summary: "THIS ROUTE SUMMARY MUST NEVER BE ACCEPTED",
      },
    },
  }),
  /Unrecognized key|unrecognized/i,
  "route telemetry must reject free-form route summaries",
);

assert.throws(
  () => librarianRecordFromRouteTelemetry({
    protocolVersion: "mssr-telemetry-v1",
    eventId: "mssr-ext-checkpoint-route-adapter",
    emittedAt: "2026-09-29T17:00:00.000Z",
    source: "chatgpt-web",
    traceId: "mssr-route-adapter-001",
    caller: "chatgpt-web",
    event: {
      kind: "checkpoint",
      checkpoint: {
        eventType: "verification",
        stage: "verify",
        status: "success",
      },
    },
  }),
  /requires route telemetry/,
  "lifecycle checkpoints remain a separate producer adapter",
);

const sameTraceDuplicate = librarianRecordFromRouteTelemetry({
  ...routeEnvelope,
  eventId: "mssr-ext-route-002",
});
const duplicateAudit = auditMssrLibrarianCatalog([record, sameTraceDuplicate]);
assert.ok(
  duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  "same trace + same bounded route metadata under different event ids should be structurally visible",
);

const otherTrace = librarianRecordFromRouteTelemetry({
  ...routeEnvelope,
  eventId: "mssr-ext-route-003",
  traceId: "mssr-route-adapter-002",
});
const crossTraceAudit = auditMssrLibrarianCatalog([record, otherTrace]);
assert.equal(
  crossTraceAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  false,
  "similar route shape in another trace must not be mislabeled as structural metadata duplication",
);

const coverage = getMssrLibrarianCoverageInventory(["route-replan"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-route-adapter.ts#librarianRecordFromRouteTelemetry");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian route adapter tests passed");
