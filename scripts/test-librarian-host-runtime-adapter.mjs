import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  getMssrLibrarianCoverageInventoryForHost,
  librarianRecordFromHostRuntimeObservation,
  mssrLibrarianHostRuntimeObservationSchema,
} from "../dist/index.js";

const base = {
  schemaVersion: 1,
  eventId: "munbj2gx-xujwzgmg",
  observedAt: "2026-09-29T23:39:27.681Z",
  host: "bridge-mcp",
  runtimeBootId: "c1ec42b2-d0d0-4b65-9b12-48062c52a0e2",
  serverVersion: "0.6.141",
  pid: 31628,
  traceId: "mssr-20260929233740-f68ea5d9-8b2",
  workflowKey: "librarian-host-runtime-adapter",
  project: "mssr",
};

const toolCall = {
  ...base,
  kind: "tool-call",
  toolName: "read_file_lines",
  startedAt: "2026-09-29T23:39:27.681Z",
  durationMs: 3,
  ok: true,
  caller: "chatgpt-web",
  clientName: "openai-mcp",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  inputKeys: ["endLine", "maxLines", "path", "startLine"],
  outputChars: 12357,
  routingStatus: "traced",
  mssrEligible: true,
  resultOk: null,
  resultCode: null,
  resultStatus: null,
};

assert.equal(mssrLibrarianHostRuntimeObservationSchema.safeParse(toolCall).success, true);
const toolRecord = librarianRecordFromHostRuntimeObservation(toolCall);
assert.equal(toolRecord.namespace, "tool");
assert.equal(toolRecord.kind, "call");
assert.equal(toolRecord.identity, "bridge-mcp:c1ec42b2-d0d0-4b65-9b12-48062c52a0e2:munbj2gx-xujwzgmg");
assert.equal(toolRecord.sourceRef, "host/bridge-mcp/runtime/c1ec42b2-d0d0-4b65-9b12-48062c52a0e2/tool-call");
assert.equal(toolRecord.provenance.producer, "host-tool-runtime");
assert.equal(toolRecord.provenance.host, "bridge-mcp");
assert.equal(toolRecord.provenance.traceId, base.traceId);
assert.equal(toolRecord.metadata.toolName, "read_file_lines");
assert.deepEqual(toolRecord.metadata.inputKeys, ["endLine", "maxLines", "path", "startLine"]);
assert.equal(toolRecord.metadata.durationMs, 3);
assert.equal(toolRecord.metadata.outputChars, 12357);

const serializedTool = JSON.stringify(toolRecord);
for (const forbidden of ["arguments", "resultBody", "rawError", "sqlitePath", "jsonlPath", "prompt", "transcript", "privateReasoning"]) {
  assert.equal(serializedTool.includes(forbidden), false, `${forbidden} must not enter Librarian host runtime metadata`);
}

const cataloguedTool = catalogMssrLibrarianRecord(toolRecord);
assert.equal(cataloguedTool.metadataFingerprint.length, 64);
assert.equal(cataloguedTool.recordFingerprint.length, 64);
const exactAudit = auditMssrLibrarianCatalog([toolRecord, toolRecord]);
assert.ok(exactAudit.audit.duplicateGroups.some((group) => group.classification === "exact-record"));

const failedToolCall = {
  ...toolCall,
  eventId: "munbj2gx-failed-call",
  ok: false,
  resultOk: false,
  resultCode: "target-not-found",
  resultStatus: "failed",
  errorClass: "target-not-found",
  errorCode: "ENOENT",
  errorFingerprint: "a".repeat(64),
};
const failedRecord = librarianRecordFromHostRuntimeObservation(failedToolCall);
assert.equal(failedRecord.metadata.errorClass, "target-not-found");
assert.equal(failedRecord.metadata.errorCode, "ENOENT");
assert.equal(failedRecord.metadata.errorFingerprint, "a".repeat(64));

assert.equal(mssrLibrarianHostRuntimeObservationSchema.safeParse({
  ...toolCall,
  errorClass: "unexpected-error-on-success",
}).success, false, "successful calls must not carry error metadata");

for (const forbiddenInput of [
  { arguments: { path: "D:/private/value.txt" } },
  { result: { secret: "raw-result" } },
  { error: "raw free-form error with local path" },
  { sqlitePath: "D:/Dev/bridge-mcp/data/bridge-metrics.sqlite" },
  { prompt: "raw user prompt" },
  { transcript: "raw transcript" },
  { privateReasoning: "hidden reasoning" },
]) {
  assert.equal(
    mssrLibrarianHostRuntimeObservationSchema.safeParse({ ...toolCall, ...forbiddenInput }).success,
    false,
    `strict runtime schema must reject ${Object.keys(forbiddenInput)[0]}`,
  );
}

const generation = librarianRecordFromHostRuntimeObservation({
  ...base,
  eventId: "runtime-generation-001",
  observedAt: "2026-09-29T23:40:00.000Z",
  kind: "runtime-generation",
  firstSeenAt: "2026-09-29T22:25:39.296Z",
  lastSeenAt: "2026-09-29T23:40:00.000Z",
  callCount: 549,
  successfulCalls: 548,
  failedCalls: 1,
});
assert.equal(generation.namespace, "host");
assert.equal(generation.kind, "runtime-generation");
assert.equal(generation.metadata.callCount, 549);

assert.equal(mssrLibrarianHostRuntimeObservationSchema.safeParse({
  ...base,
  eventId: "runtime-generation-invalid",
  kind: "runtime-generation",
  firstSeenAt: "2026-09-29T23:40:00.000Z",
  lastSeenAt: "2026-09-29T22:25:39.296Z",
  callCount: 1,
}).success, false, "generation time range must be monotonic");

const health = librarianRecordFromHostRuntimeObservation({
  ...base,
  eventId: "runtime-health-001",
  kind: "runtime-health",
  component: "metrics-persistence",
  status: "healthy",
  checkCode: "worker-single-writer",
  pendingCount: 0,
  failedCount: 0,
  droppedCount: 0,
  latencyMs: 2.27,
  evidenceFingerprint: "b".repeat(64),
});
assert.equal(health.namespace, "host");
assert.equal(health.kind, "runtime-health");
assert.equal(health.payloadFingerprint, "b".repeat(64));

const metric = librarianRecordFromHostRuntimeObservation({
  ...base,
  eventId: "metric-001",
  kind: "metric",
  metricName: "bridge-dispatch-latency",
  metricScope: "read_file_lines",
  value: 42.53,
  unit: "ms",
  status: "ok",
});
assert.equal(metric.namespace, "metric");
assert.equal(metric.kind, "observation");
assert.equal(metric.metadata.metricName, "bridge-dispatch-latency");

const portableCoverage = getMssrLibrarianCoverageInventory(["host-tool-runtime-metrics"]);
assert.equal(portableCoverage.entries[0].status, "partial", "portable adapter exists but no host adoption is implied");
assert.equal(portableCoverage.entries[0].adapterRef, "src/librarian-host-runtime-adapter.ts#librarianRecordFromHostRuntimeObservation");
assert.equal(portableCoverage.summary.conditionalGaps, 1);
assert.equal(portableCoverage.gaps[0].code, "conditional-producer-partial");
assert.equal(portableCoverage.negativeClaimPolicy.globalNegativeClaimAllowed, false);

const bridgeCoverage = getMssrLibrarianCoverageInventoryForHost({
  host: "bridge-mcp",
  declarations: [{
    schemaVersion: 1,
    producerId: "host-tool-runtime-metrics",
    host: "bridge-mcp",
    status: "instrumented",
    conditional: true,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
    adapterRef: "bridge-host:librarian-host-runtime-v1",
    sourceRefs: ["bridge-metrics", "bridge-runtime-health"],
    capabilities: ["tool-call", "runtime-generation", "runtime-health", "metric"],
    canProve: ["Bridge host emitted bounded runtime observations through the tested portable contract."],
    cannotProve: ["Coverage for another host or raw arguments/results excluded by the contract."],
  }],
  ids: ["host-tool-runtime-metrics"],
});
assert.equal(bridgeCoverage.entries[0].status, "instrumented");
assert.equal(bridgeCoverage.summary.conditionalGaps, 0);
assert.equal(bridgeCoverage.negativeClaimPolicy.globalNegativeClaimAllowed, true);

console.log("librarian host runtime adapter tests passed");
