import assert from "node:assert/strict";

import {
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
} from "../dist/index.js";

let state = reduceMssrRouteLifecycle(null, {
  stage: "implement",
  activeSkills: [
    { name: "skill-a", required: true },
    { name: "skill-b", required: true },
  ],
  phasePlan: [{ phase: "maintenance", required: true }],
});

assert.equal(state.routeCount, 1);
assert.equal(state.lifecycleRevision, 1);
assert.equal(state.maintenanceRequired, true);

state = reduceMssrSkillLoadLifecycle(state, "skill-a");

let violations = validateMssrCheckpointLifecycle(state, {
  eventType: "outcome",
  status: "success",
  stage: "close",
});

assert.equal(violations.length, 2);
assert.equal(
  violations.some((item) => item.code === "mssr-success-outcome-blocked-required-skills"),
  true,
);

state = reduceMssrSkillLoadLifecycle(state, "skill-b");

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

console.log("trace-contract: ok");
