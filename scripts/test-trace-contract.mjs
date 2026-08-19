import assert from "node:assert/strict";

import {
  evaluateMssrRouteClosureObligations,
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
} from "../dist/index.js";

assert.deepEqual(
  validateMssrCheckpointLifecycle(null, {
    eventType: "outcome",
    status: "success",
    stage: "close",
  }),
  [{ code: "mssr-outcome-without-route", blocking: true }],
);

let state = reduceMssrRouteLifecycle(null, {
  stage: "implement",
  activeSkills: [
    { name: "skill-a", required: true },
    { name: "skill-b", required: true },
  ],
  phasePlan: [{ phase: "maintenance", required: true }],
  coverage: { requiredPhases: ["verification", "persistence", "maintenance"] },
});

assert.equal(state.routeCount, 1);
assert.equal(state.lifecycleRevision, 1);
assert.equal(state.maintenanceRequired, true);

let closure = evaluateMssrRouteClosureObligations(state);
assert.deepEqual(
  closure.obligations.map((item) => [item.kind, item.required, item.status]),
  [
    ["required-skills", true, "pending"],
    ["verification", true, "pending"],
    ["persistence", true, "pending"],
    ["close", true, "pending"],
    ["maintenance", true, "pending"],
    ["outcome", true, "pending"],
  ],
);

state = reduceMssrSkillLoadLifecycle(state, "skill-a");

let violations = validateMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});

assert.equal(violations.length, 4);
assert.equal(
  violations.some((item) => item.code === "mssr-success-outcome-blocked-required-skills"),
  true,
);
assert.equal(
  violations.some((item) => item.code === "mssr-success-outcome-blocked-required-phases"),
  true,
);
assert.equal(
  violations.some((item) => item.code === "mssr-success-outcome-blocked-close"),
  true,
);

state = reduceMssrSkillLoadLifecycle(state, "skill-b");

state = reduceMssrCheckpointLifecycle(state, {
  eventType: "verification",
  stage: "verify",
  status: "success",
  verificationPassed: true,
});

state = reduceMssrCheckpointLifecycle(state, {
  eventType: "persistence",
  stage: "persist",
  status: "success",
  persisted: true,
});

// A close replan does not increment lifecycleRevision.
state = reduceMssrRouteLifecycle(state, {
  stage: "close",
  activeSkills: [
    { name: "skill-a", required: true },
    { name: "skill-b", required: true },
  ],
});

assert.equal(state.closeRevision, state.lifecycleRevision);

state = reduceMssrCheckpointLifecycle(state, {
  eventType: "phase_completed",
  stage: "close",
  status: "success",
  completedPhases: [
    "discovery",
    "implementation",
    "verification",
    "persistence",
    "maintenance",
  ],
});

violations = validateMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});
assert.deepEqual(violations, []);

closure = evaluateMssrRouteClosureObligations(state);
assert.equal(closure.canCloseSuccess, true);
assert.deepEqual(
  closure.obligations.map((item) => [item.kind, item.status]),
  [
    ["required-skills", "complete"],
    ["verification", "complete"],
    ["persistence", "complete"],
    ["close", "complete"],
    ["maintenance", "complete"],
    ["outcome", "ready"],
  ],
);

// A post-close persistence checkpoint makes close evidence stale.
state = reduceMssrCheckpointLifecycle(state, {
  eventType: "persistence",
  stage: "persist",
  status: "success",
  persisted: true,
});

violations = validateMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});
assert.equal(
  violations.some((item) => item.code === "mssr-success-outcome-blocked-stale-close"),
  true,
);

state = reduceMssrRouteLifecycle(state, {
  stage: "close",
  activeSkills: [
    { name: "skill-a", required: true },
    { name: "skill-b", required: true },
  ],
});

// Bridge phase_completed checkpoints may omit status when completion itself is the evidence.
// This exact shape previously left maintenanceRevision stale and blocked a valid success outcome.
state = reduceMssrCheckpointLifecycle(state, {
  eventType: "phase_completed",
  stage: "close",
  completedPhases: [
    "discovery",
    "implementation",
    "verification",
    "persistence",
    "maintenance",
  ],
});

assert.equal(state.maintenanceRevision, state.lifecycleRevision);

violations = validateMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});
assert.deepEqual(violations, []);

state = reduceMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});
assert.equal(state.closed, true);
closure = evaluateMssrRouteClosureObligations(state);
assert.equal(closure.canCloseSuccess, false, "canCloseSuccess is a prospective pre-outcome gate only");
assert.equal(closure.nextRequiredAction, "none");
assert.equal(
  closure.obligations.find((item) => item.kind === "outcome")?.status,
  "complete",
  "a persisted outcome on a closed trace must never project as pending",
);

console.log("trace-contract: ok");
