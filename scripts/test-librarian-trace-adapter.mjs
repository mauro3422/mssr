import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromTraceCheckpoint,
} from "../dist/index.js";

const checkpointEnvelope = {
  protocolVersion: "mssr-telemetry-v1",
  eventId: "mssr-ext-checkpoint-001",
  emittedAt: "2026-09-29T16:45:00.000Z",
  source: "chatgpt-web",
  traceId: "mssr-trace-adapter-001",
  caller: "chatgpt-web",
  event: {
    kind: "checkpoint",
    checkpoint: {
      eventType: "verification",
      stage: "verify",
      status: "success",
      completedPhases: ["discovery", "safety", "implementation", "verification"],
      verificationPassed: true,
      persisted: false,
      signals: ["reusable-pattern"],
      skillName: "mssr-agent-routing",
      primarySkill: "mssr-agent-routing",
      supportingSkills: ["shared-skill-governance"],
      metricName: "adapter-fixture",
      score: 1,
      accepted: true,
      evidenceKind: "tests",
      evidenceRef: "fixture:test-librarian-trace-adapter",
      dimensions: [{
        name: "privacy",
        status: "success",
        summary: "THIS DIMENSION SUMMARY MUST NOT ENTER THE LIBRARIAN",
        evidenceRef: "fixture:privacy",
      }],
      contextSources: ["project-context"],
      userCorrections: 0,
      summary: "THIS CHECKPOINT SUMMARY MUST NOT ENTER THE LIBRARIAN",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
    },
  },
};

const record = librarianRecordFromTraceCheckpoint(checkpointEnvelope);
assert.equal(record.namespace, "trace");
assert.equal(record.kind, "verification");
assert.equal(record.identity, "mssr-trace-adapter-001:mssr-ext-checkpoint-001");
assert.equal(record.sourceRef, "telemetry/chatgpt-web/trace/mssr-trace-adapter-001");
assert.equal(record.revision, "mssr-ext-checkpoint-001");
assert.deepEqual(record.provenance, {
  producer: "trace-lifecycle",
  host: "chatgpt-web",
  traceId: "mssr-trace-adapter-001",
});

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("THIS CHECKPOINT SUMMARY MUST NOT ENTER THE LIBRARIAN"), false);
assert.equal(serialized.includes("THIS DIMENSION SUMMARY MUST NOT ENTER THE LIBRARIAN"), false);
assert.equal(serialized.includes("fixture:test-librarian-trace-adapter"), true, "bounded evidence refs should remain available");
assert.equal(serialized.includes("fixture:privacy"), true);
assert.equal(Object.hasOwn(record.metadata, "summary"), false);
assert.equal(record.metadata.dimensions[0].summary, undefined);

const catalogued = catalogMssrLibrarianRecord(record);
assert.equal(catalogued.contractKey, "trace:verification:mssr-trace-adapter-001:mssr-ext-checkpoint-001");
assert.equal(catalogued.metadataFingerprint.length, 64);
assert.equal(catalogued.recordFingerprint.length, 64);

const outcome = librarianRecordFromTraceCheckpoint({
  ...checkpointEnvelope,
  eventId: "mssr-ext-outcome-001",
  event: {
    kind: "checkpoint",
    checkpoint: {
      eventType: "outcome",
      stage: "close",
      status: "success",
      completedPhases: ["discovery", "safety", "implementation", "verification", "persistence", "maintenance"],
      primarySkill: "mssr-agent-routing",
      supportingSkills: ["skill-maintenance-loop"],
      accepted: true,
      evidenceKind: "mixed",
      evidenceRef: "fixture:outcome",
      contextSources: ["project-context"],
      userCorrections: 0,
      summary: "OUTCOME FREE FORM SUMMARY MUST ALSO BE STRIPPED",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
    },
  },
});
assert.equal(outcome.namespace, "outcome");
assert.equal(outcome.kind, "outcome");
assert.equal(JSON.stringify(outcome).includes("OUTCOME FREE FORM SUMMARY MUST ALSO BE STRIPPED"), false);

assert.throws(
  () => librarianRecordFromTraceCheckpoint({
    ...checkpointEnvelope,
    eventId: "mssr-ext-route-001",
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
  /requires checkpoint telemetry/,
  "route telemetry remains a separate producer adapter and must not be silently swallowed",
);

const sameTraceDuplicate = librarianRecordFromTraceCheckpoint({
  ...checkpointEnvelope,
  eventId: "mssr-ext-checkpoint-002",
});
const duplicateAudit = auditMssrLibrarianCatalog([record, sameTraceDuplicate]);
assert.ok(
  duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  "same trace + same bounded checkpoint metadata under different event ids should be structurally visible",
);

const otherTrace = librarianRecordFromTraceCheckpoint({
  ...checkpointEnvelope,
  eventId: "mssr-ext-checkpoint-003",
  traceId: "mssr-trace-adapter-002",
});
const crossTraceAudit = auditMssrLibrarianCatalog([record, otherTrace]);
assert.equal(
  crossTraceAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  false,
  "ordinary equivalent lifecycle shape across different traces must not be mislabeled as structural metadata duplication",
);

const coverage = getMssrLibrarianCoverageInventory(["trace-lifecycle-outcome"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-trace-adapter.ts#librarianRecordFromTraceCheckpoint");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian trace adapter tests passed");
