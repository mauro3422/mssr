import assert from "node:assert/strict";

import {
  analyzeMssrTelemetry,
  mssrTelemetryEnvelopeSchema,
  routeTelemetrySummary,
} from "../dist/index.js";

const intent = {
  summary: "private bounded task summary",
  domains: ["coding", "skill-system"],
  actions: ["analyze", "verify"],
  artifacts: ["code"],
  needs: ["integrity-verification"],
  signals: ["repeated-friction"],
  risk: "read-only",
  ambiguity: "low",
  capabilityNeeds: ["private capability prose"],
};

const summarized = routeTelemetrySummary({
  caller: "opencode-local",
  stage: "start",
  classificationMode: "structured-semantic",
  agentProfile: { model: "unknown", reasoningEffort: "unknown" },
  contextUsed: true,
  contextCharacters: 120,
  workflows: [],
  activeSkills: [{ name: "skill-a", required: true }, { name: "skill-b", required: false }],
  deferredSkills: [],
  loadOrder: ["skill-a", "skill-b"],
  deferredLoadOrder: [],
  intent,
  coverage: { requiredPhases: ["verification", "persistence"], completedPhases: [], missingRequiredPhases: ["verification", "persistence"] },
  task: "raw private task",
  context: "raw private context",
});
assert.deepEqual(summarized.intent?.domains, ["coding", "skill-system"]);
const serializedSummary = JSON.stringify(summarized);
for (const privateValue of [intent.summary, intent.capabilityNeeds[0], "raw private task", "raw private context"]) {
  assert.equal(serializedSummary.includes(privateValue), false, `telemetry leaked ${privateValue}`);
}

const at = (second) => `2026-08-09T00:00:${String(second).padStart(2, "0")}.000Z`;
const envelope = (eventId, traceId, second, event) => mssrTelemetryEnvelopeSchema.parse({
  protocolVersion: "mssr-telemetry-v1",
  eventId,
  emittedAt: at(second),
  source: "test",
  traceId,
  caller: "opencode-local",
  event,
});
const routeEvent = (eventId, traceId, second, route) => envelope(eventId, traceId, second, {
  kind: "route",
  action: "plan",
  taskHash: "a".repeat(64),
  route,
});
const loadEvent = (eventId, traceId, second, skillName) => envelope(eventId, traceId, second, {
  kind: "skill_load",
  skillName,
  required: false,
  loaded: true,
  via: "skill_load",
});
const decisionEvent = (eventId, traceId, second, decision) => envelope(eventId, traceId, second, {
  kind: "skill_decision",
  decision,
});
const checkpointEvent = (eventId, traceId, second, checkpoint) => envelope(eventId, traceId, second, {
  kind: "checkpoint",
  checkpoint,
});
const learningDigestEvent = (eventId, traceId, second, digest) => envelope(eventId, traceId, second, {
  kind: "learning_digest",
  digest,
});

const baseRoute = {
  caller: "opencode-local",
  stage: "start",
  classificationMode: "structured-semantic",
  agentProfile: { model: "unknown", reasoningEffort: "unknown" },
  contextUsed: false,
  contextCharacters: 0,
  workflows: [],
  activeSkills: [{ name: "skill-a", required: true }, { name: "skill-b", required: false }],
  deferredSkills: [],
  loadOrder: ["skill-a", "skill-b"],
  deferredLoadOrder: [],
  intent: summarized.intent,
  signals: ["repeated-friction"],
  ambiguity: "low",
  requiredPhases: ["verification", "persistence"],
  completedPhases: [],
  missingRequiredPhases: ["verification", "persistence"],
};

const legacyRoute = {
  ...baseRoute,
  classificationMode: "lexical-fallback",
  activeSkills: [{ name: "skill-a", required: true }],
  loadOrder: ["skill-a"],
  intent: undefined,
  requiredPhases: [],
  missingRequiredPhases: [],
};

const events = [
  routeEvent("event-0001", "trace-01", 1, baseRoute),
  loadEvent("event-0002", "trace-01", 2, "skill-b"),
  decisionEvent("event-0009", "trace-01", 2, { skillName: "skill-b", decision: "accepted", reasonCode: "useful", stage: "start" }),
  decisionEvent("event-0010", "trace-01", 2, { skillName: "skill-c", decision: "skipped", reasonCode: "irrelevant-domain", stage: "start" }),
  checkpointEvent("event-0003", "trace-01", 3, { eventType: "verification", status: "success", verificationPassed: true }),
  checkpointEvent("event-0004", "trace-01", 4, { eventType: "persistence", status: "success", persisted: true }),
  checkpointEvent("event-0005", "trace-01", 5, { eventType: "outcome", status: "success", primarySkill: "skill-a", accepted: true }),
  checkpointEvent("event-0006", "trace-01", 6, { eventType: "outcome", status: "failed", primarySkill: "skill-a", accepted: false }),
  routeEvent("event-0007", "trace-02", 7, legacyRoute),
  routeEvent("event-0008", "trace-03", 8, { ...baseRoute, activeSkills: [{ name: "skill-a", required: true }], loadOrder: ["skill-a"], requiredPhases: [], missingRequiredPhases: [] }),
];
events.push(events[1]); // duplicate eventId must not inflate coverage
events.push({ invalid: true });

const analysis = analyzeMssrTelemetry(events);
assert.deepEqual(analysis.counters, {
  inputEvents: 12,
  validEvents: 10,
  invalidEvents: 1,
  duplicateEvents: 1,
  routedTraces: 3,
  tracesWithOutcome: 1,
  learningDigests: 0,
});
assert.equal(analysis.rates.structuredRouteRate.value, 2 / 3);
assert.deepEqual(analysis.rates.requiredLoadCompliance, { numerator: 0, denominator: 3, value: 0 });
assert.deepEqual(analysis.rates.selectedRouteToLoadCoverage, { numerator: 1, denominator: 4, value: 0.25 });
assert.deepEqual(analysis.rates.verificationCoverage, { numerator: 1, denominator: 1, value: 1 });
assert.deepEqual(analysis.rates.persistenceCoverage, { numerator: 1, denominator: 1, value: 1 });
assert.deepEqual(analysis.rates.outcomeAttributionCoverage, { numerator: 1, denominator: 1, value: 1 });
assert.deepEqual(analysis.rates.successRate, { numerator: 0, denominator: 1, value: 0 });
assert.deepEqual(analysis.rates.acceptanceRate, { numerator: 0, denominator: 1, value: 0 });
assert.equal(analysis.intentDimensions.domains.coding, 2, "legacy routes must remain valid but cannot invent missing intent dimensions");
assert.equal(analysis.selectionFeedback.length, 2);
const skillBFeedback = analysis.selectionFeedback.find((item) => item.skillName === "skill-b");
assert.deepEqual({ accepted: skillBFeedback.accepted, skipped: skillBFeedback.skipped, total: skillBFeedback.total, acceptanceRate: skillBFeedback.acceptanceRate }, {
  accepted: 1, skipped: 0, total: 1, acceptanceRate: 1,
});
assert.equal(skillBFeedback.reasonCounts.useful, 1);
assert.equal(skillBFeedback.signatures[0].signature.includes("d=coding,skill-system"), true);
const skillCFeedback = analysis.selectionFeedback.find((item) => item.skillName === "skill-c");
assert.equal(skillCFeedback.skipped, 1);
assert.equal(skillCFeedback.reasonCounts["irrelevant-domain"], 1);
assert.deepEqual(analysis.maintenanceCandidates.map(({ kind, signal, skillName, distinctTraceCount }) => ({ kind, signal, skillName, distinctTraceCount })), [
  { kind: "recurring-signal", signal: "repeated-friction", skillName: undefined, distinctTraceCount: 3 },
  { kind: "required-load-gap", signal: undefined, skillName: "skill-a", distinctTraceCount: 3 },
]);

assert.equal(analyzeMssrTelemetry(events, { minDistinctTraces: 4 }).maintenanceCandidates.length, 0);

const learningSignature = "stage=verify|d=coding,skill-system|a=analyze,verify|r=code|n=integrity-verification|s=repeated-friction";
const learningEvents = Array.from({ length: 5 }, (_, index) => learningDigestEvent(
  `learn-000${index + 1}`,
  `learn-trace-${index + 1}`,
  20 + index,
  {
    semanticSignature: learningSignature,
    finalStage: "verify",
    signals: ["repeated-friction", "reusable-pattern"],
    recommendedSkills: ["skill-b"],
    loadedSkills: index < 4 ? ["skill-b"] : [],
    skillDecisions: [{
      skillName: "skill-b",
      decision: index < 4 ? "accepted" : "skipped",
      reasonCode: index < 4 ? "useful" : "irrelevant-domain",
      stage: "verify",
    }],
    skillTransitions: [{ fromStage: "implement", toStage: "verify", skillName: "skill-b" }],
    contextSelections: [{
      scope: "skill",
      owner: "skill-b",
      module: "verification",
      selected: index < 4,
      reasonCode: index < 4 ? "selected" : "intent-mismatch",
    }],
    findings: [{
      summary: "Verification module was evidence-backed.",
      status: "supported",
      evidenceRef: `test:${index + 1}`,
      signals: ["reusable-pattern"],
    }],
    outcome: {
      status: index < 4 ? "success" : "partial",
      accepted: index < 4,
      primarySkill: "skill-b",
      supportingSkills: [],
      verificationPassed: index < 4,
      persisted: true,
      userCorrections: 0,
    },
  },
));
const learning = analyzeMssrTelemetry(learningEvents, { minLearningTraces: 5 });
assert.equal(learning.counters.learningDigests, 5);
assert.equal(learning.learning.mode, "observe-only");
assert.equal(learning.learning.routingInfluence, false);
assert.equal(learning.learning.digestCount, 5);
assert.equal(learning.learning.minEvidence, 5);
const skillPrior = learning.learning.skillPriors.find((item) => item.skillName === "skill-b");
assert.ok(skillPrior);
assert.equal(skillPrior.evidenceCount, 5);
assert.equal(skillPrior.acceptanceRate, 0.8);
assert.equal(skillPrior.activationRate, 0.8);
assert.equal(skillPrior.successRateWhenLoaded, 1);
assert.equal(skillPrior.eligible, true);
assert.equal(skillPrior.recommendation, "prefer");
const transitionPrior = learning.learning.transitions.find((item) => item.skillName === "skill-b");
assert.equal(transitionPrior?.count, 5);
assert.equal(transitionPrior?.eligible, true);
const contextPrior = learning.learning.contextPriors.find((item) => item.module === "verification");
assert.equal(contextPrior?.selectionRate, 0.8);
assert.equal(contextPrior?.recommendation, "prefer");
assert.throws(() => learningDigestEvent("learn-private", "learn-private-trace", 30, {
  semanticSignature: learningSignature,
  finalStage: "verify",
  workingSummary: "must never become durable learning data",
  outcome: { status: "success", supportingSkills: [], userCorrections: 0 },
}));

const empty = analyzeMssrTelemetry([]);
for (const metric of Object.values(empty.rates)) assert.equal(metric.value, null);
assert.throws(() => analyzeMssrTelemetry([], { minDistinctTraces: 1 }));

console.log("MSSR telemetry intent analysis and maintenance candidates: PASS");
