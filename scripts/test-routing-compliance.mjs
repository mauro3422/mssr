import assert from "node:assert/strict";

import {
  evaluateMssrRoutingComplianceOperationalAttention,
  evaluateMssrToolFrictionOperationalAttention,
} from "../dist/operational-projections.js";

function project(overrides = {}) {
  return evaluateMssrRoutingComplianceOperationalAttention({
    trace: "matched",
    route: "present",
    boundary: "ordinary",
    requiredSkills: [],
    loadedSkills: [],
    requiredPhases: [],
    completedPhases: [],
    ...overrides,
  });
}

const clean = project();
assert.equal(clean.level, "ok");
assert.deepEqual(clean.reasonCodes, []);
assert.deepEqual(clean.recommendedRequiredSkills, []);
assert.deepEqual(clean.recommendedActions, []);

const ordinaryUnrouted = project({ route: "missing" });
assert.equal(ordinaryUnrouted.level, "watch", "an ordinary unrouted observation is low-noise evidence, not proof of a substantial compliance failure");
assert.deepEqual(ordinaryUnrouted.reasonCodes, ["route-missing"]);
assert.equal(ordinaryUnrouted.notifyOnWatch, false);

const substantialUnrouted = project({ route: "missing", boundary: "substantial-tool" });
assert.equal(substantialUnrouted.level, "review");
assert.deepEqual(substantialUnrouted.reasonCodes, ["route-missing", "substantial-tool-without-route"]);
assert.deepEqual(substantialUnrouted.recommendedActions, ["start-route"]);

const missingTrace = project({ trace: "missing", boundary: "skill-load" });
assert.equal(missingTrace.level, "review");
assert.deepEqual(missingTrace.reasonCodes, ["trace-missing"]);
assert.deepEqual(missingTrace.recommendedActions, ["bootstrap-current-phase"]);

const ambiguousTrace = project({ trace: "ambiguous", boundary: "skill-load" });
assert.equal(ambiguousTrace.level, "review");
assert.deepEqual(ambiguousTrace.reasonCodes, ["trace-ambiguous"]);
assert.deepEqual(ambiguousTrace.recommendedActions, ["inspect-traces"]);

const mismatchedTrace = project({ trace: "mismatch", boundary: "substantial-tool" });
assert.equal(mismatchedTrace.level, "error", "trace mismatch can attribute work to the wrong task/agent and must be stronger than a missing recoverable trace");
assert.deepEqual(mismatchedTrace.reasonCodes, ["trace-mismatch"]);
assert.deepEqual(mismatchedTrace.recommendedActions, ["inspect-traces", "replan-current-trace"]);

const missingSkills = project({
  boundary: "phase-boundary",
  requiredSkills: ["z-required", "a-required"],
  loadedSkills: ["z-required", "optional-skill"],
});
assert.equal(missingSkills.level, "review");
assert.deepEqual(missingSkills.reasonCodes, ["required-skill-not-loaded"]);
assert.deepEqual(missingSkills.recommendedRequiredSkills, ["a-required"]);
assert.deepEqual(missingSkills.recommendedActions, ["bootstrap-current-phase", "load-required-skills"]);

const optionalPendingIgnored = project({
  selectedSkills: ["optional-skill"],
  loadedSkills: [],
});
assert.equal(optionalPendingIgnored.level, "ok", "optional selected-but-not-loaded skills are not compliance failures");
assert.deepEqual(optionalPendingIgnored.recommendedRequiredSkills, []);

const outcomeMissingSkills = project({
  boundary: "outcome",
  requiredSkills: ["required-owner"],
  loadedSkills: [],
});
assert.equal(outcomeMissingSkills.level, "error");
assert.deepEqual(outcomeMissingSkills.reasonCodes, ["required-skill-not-loaded"]);

const outcomeMissingPhases = project({
  boundary: "outcome",
  requiredPhases: ["verification", "persistence", "maintenance"],
  completedPhases: ["verification"],
});
assert.equal(outcomeMissingPhases.level, "error");
assert.deepEqual(outcomeMissingPhases.reasonCodes, ["required-phase-incomplete"]);
assert.deepEqual(outcomeMissingPhases.missingRequiredPhases, ["persistence"], "maintenance is a separate close-revision obligation, not a direct outcome phase gate");
assert.deepEqual(outcomeMissingPhases.recommendedActions, ["complete-required-phases"]);

const outcomeHostRepresentedPhases = project({
  boundary: "outcome",
  requiredPhases: ["discovery", "safety", "implementation", "verification", "persistence", "maintenance"],
  completedPhases: ["verification", "persistence"],
});
assert.equal(outcomeHostRepresentedPhases.level, "ok", "host/workflow-represented phases must not contradict the portable objective closure contract");
assert.deepEqual(outcomeHostRepresentedPhases.reasonCodes, []);
assert.deepEqual(outcomeHostRepresentedPhases.missingRequiredPhases, []);

const outcomeWithoutRoute = project({ route: "missing", trace: "missing", boundary: "outcome" });
assert.equal(outcomeWithoutRoute.level, "error");
assert.deepEqual(outcomeWithoutRoute.reasonCodes, ["outcome-without-route", "route-missing", "trace-missing"]);
assert.deepEqual(outcomeWithoutRoute.recommendedActions, ["bootstrap-current-phase", "start-route"]);

const replacedTrace = project({ activeTraceReplacedBeforeOutcome: true, boundary: "route-replacement" });
assert.equal(replacedTrace.level, "review");
assert.deepEqual(replacedTrace.reasonCodes, ["active-trace-replaced-before-outcome"]);
assert.deepEqual(replacedTrace.recommendedActions, ["inspect-traces", "record-or-resume-outcome"]);

const incompleteEvidence = project({ routingEvidenceComplete: false });
assert.equal(incompleteEvidence.level, "watch");
assert.deepEqual(incompleteEvidence.reasonCodes, ["routing-evidence-incomplete"]);

const deterministicA = project({
  boundary: "phase-boundary",
  requiredSkills: ["b", "a"],
  loadedSkills: [],
});
const deterministicB = project({
  boundary: "phase-boundary",
  requiredSkills: ["a", "b"],
  loadedSkills: [],
});
assert.equal(deterministicA.fingerprint, deterministicB.fingerprint, "semantic identity must not depend on caller array ordering");

const frictionEvaluatedAt = "2026-08-20T06:00:00.000Z";
const repeatedWorkOnce = Array.from({ length: 44 }, (_, index) => ({
  toolName: "work_once",
  signature: "schema:timeoutMs:maximum",
  observedAt: `2026-08-20T05:${String(index % 60).padStart(2, "0")}:00.000Z`,
  workflowKey: `workflow-${index % 8}`,
  traceId: `trace-work-once-${index}`,
  severity: "error",
}));
const clusteredFriction = evaluateMssrToolFrictionOperationalAttention(repeatedWorkOnce, { evaluatedAt: frictionEvaluatedAt });
assert.equal(clusteredFriction.length, 1, "identical tool failure signatures must collapse into one maintenance item");
assert.deepEqual({
  level: clusteredFriction[0].level,
  occurrenceCount: clusteredFriction[0].occurrenceCount,
  distinctWorkflowCount: clusteredFriction[0].distinctWorkflowCount,
  distinctTraceCount: clusteredFriction[0].distinctTraceCount,
  priorityScore: clusteredFriction[0].priorityScore,
  signal: clusteredFriction[0].signal,
  owner: clusteredFriction[0].recommendedOwner,
}, {
  level: "error",
  occurrenceCount: 44,
  distinctWorkflowCount: 8,
  distinctTraceCount: 44,
  priorityScore: 100,
  signal: "repeated-friction",
  owner: "skill-maintenance-loop",
});
assert.deepEqual(clusteredFriction[0].reasonCodes, ["cross-workflow", "error-severity", "high-recurrence", "recent-friction", "repeated-signature"]);
assert.deepEqual(clusteredFriction[0].recommendedActions, ["inspect-tool-contract", "inspect-tool-guidance", "route-maintenance-review"]);

const isolatedFriction = evaluateMssrToolFrictionOperationalAttention([{
  toolName: "rare_tool",
  signature: "runtime:transient",
  observedAt: "2026-08-20T05:50:00.000Z",
  workflowKey: "workflow-one",
  traceId: "trace-one",
  severity: "error",
}], { evaluatedAt: frictionEvaluatedAt });
assert.equal(isolatedFriction[0].level, "watch", "one isolated failure must not compete with repeated cross-workflow friction");
assert.equal(isolatedFriction[0].signal, "error-observed");
assert.deepEqual(isolatedFriction[0].recommendedActions, ["inspect-tool-contract"]);

const reversedFriction = evaluateMssrToolFrictionOperationalAttention([...repeatedWorkOnce].reverse(), { evaluatedAt: frictionEvaluatedAt });
assert.equal(reversedFriction[0].fingerprint, clusteredFriction[0].fingerprint, "friction identity and priority must not depend on input order");
assert.throws(() => evaluateMssrToolFrictionOperationalAttention(repeatedWorkOnce, { evaluatedAt: "not-a-date" }), /valid timestamp/);

console.log("MSSR routing compliance and tool-friction projections: PASS");
