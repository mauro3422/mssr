import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromSkillTelemetry,
} from "../dist/index.js";

const baseEnvelope = {
  protocolVersion: "mssr-telemetry-v1",
  emittedAt: "2026-09-29T17:20:00.000Z",
  source: "chatgpt-web",
  traceId: "mssr-skill-adapter-001",
  caller: "chatgpt-web",
};

const loadEnvelope = {
  ...baseEnvelope,
  eventId: "mssr-ext-skill-load-001",
  event: {
    kind: "skill_load",
    skillName: "mssr-agent-routing",
    source: "mssr-first-party",
    stage: "start",
    required: true,
    loaded: true,
    via: "skill_bootstrap",
    warning: "FREE FORM LOAD WARNING MUST NOT ENTER LIBRARIAN",
  },
};

const loadRecord = librarianRecordFromSkillTelemetry(loadEnvelope);
assert.equal(loadRecord.namespace, "skill");
assert.equal(loadRecord.kind, "load");
assert.equal(loadRecord.identity, "mssr-skill-adapter-001:mssr-ext-skill-load-001");
assert.equal(loadRecord.metadata.skillName, "mssr-agent-routing");
assert.equal(loadRecord.metadata.loaded, true);
assert.equal(loadRecord.metadata.required, true);
assert.equal(loadRecord.metadata.warningPresent, true);
assert.equal(JSON.stringify(loadRecord).includes("FREE FORM LOAD WARNING MUST NOT ENTER LIBRARIAN"), false);

const loadCatalog = catalogMssrLibrarianRecord(loadRecord);
assert.equal(loadCatalog.contractKey, "skill:load:mssr-skill-adapter-001:mssr-ext-skill-load-001");

const decisionEnvelope = {
  ...baseEnvelope,
  eventId: "mssr-ext-skill-decision-001",
  event: {
    kind: "skill_decision",
    decision: {
      skillName: "systematic-debugging",
      decision: "skipped",
      reasonCode: "redundant",
      reasonSummary: "FREE FORM DECISION SUMMARY MUST NOT ENTER LIBRARIAN",
      relatedSkillName: "mssr-agent-routing",
      stage: "verify",
    },
  },
};

const decisionRecord = librarianRecordFromSkillTelemetry(decisionEnvelope);
assert.equal(decisionRecord.namespace, "skill");
assert.equal(decisionRecord.kind, "decision");
assert.equal(decisionRecord.metadata.skillName, "systematic-debugging");
assert.equal(decisionRecord.metadata.decision, "skipped");
assert.equal(decisionRecord.metadata.reasonCode, "redundant");
assert.equal(decisionRecord.metadata.relatedSkillName, "mssr-agent-routing");
assert.equal(decisionRecord.metadata.reasonSummaryPresent, true);
assert.equal(JSON.stringify(decisionRecord).includes("FREE FORM DECISION SUMMARY MUST NOT ENTER LIBRARIAN"), false);

assert.throws(
  () => librarianRecordFromSkillTelemetry({
    ...loadEnvelope,
    rawPrompt: "RAW PROMPT MUST BE REJECTED",
  }),
  /Unrecognized key|unrecognized/i,
  "strict telemetry must reject raw prompt/task additions",
);

assert.throws(
  () => librarianRecordFromSkillTelemetry({
    ...baseEnvelope,
    eventId: "mssr-ext-route-skill-adapter",
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
  /requires skill_load or skill_decision telemetry/,
);

const duplicateLoad = librarianRecordFromSkillTelemetry({
  ...loadEnvelope,
  eventId: "mssr-ext-skill-load-002",
});
const duplicateAudit = auditMssrLibrarianCatalog([loadRecord, duplicateLoad]);
assert.ok(
  duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  "same trace + same bounded skill-load metadata under different event ids should be visible",
);

const otherTraceLoad = librarianRecordFromSkillTelemetry({
  ...loadEnvelope,
  eventId: "mssr-ext-skill-load-003",
  traceId: "mssr-skill-adapter-002",
});
const crossTraceAudit = auditMssrLibrarianCatalog([loadRecord, otherTraceLoad]);
assert.equal(
  crossTraceAudit.audit.duplicateGroups.some((group) => group.classification === "same-metadata"),
  false,
  "ordinary same skill load shape across traces must not be mislabeled as structural duplication",
);

const coverage = getMssrLibrarianCoverageInventory(["skill-selection-load"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-skill-adapter.ts#librarianRecordFromSkillTelemetry");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian skill adapter tests passed");
