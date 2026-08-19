import assert from "node:assert/strict";

import {
  applyMssrProjectKnowledgeMaintenanceToLifecycle,
  evaluateMssrProjectKnowledgeMaintenance,
} from "../dist/project-knowledge-maintenance.js";

const ordinary = evaluateMssrProjectKnowledgeMaintenance({
  stage: "implement",
  changedPaths: ["src/ordinary-feature.ts"],
  materialWrites: 1,
});
assert.equal(ordinary.level, "none");
assert.equal(ordinary.due, false);

const architecture = evaluateMssrProjectKnowledgeMaintenance({
  stage: "persist",
  changedPaths: ["src/host-adapter-contract.ts", "package.json", "changelogs/0.2.17.md"],
  packageChanged: true,
  runtimeChanged: true,
  materialWrites: 7,
  intent: {
    summary: "Change the portable host adapter contract.",
    domains: ["agent-orchestration", "skill-system"],
    actions: ["design", "edit", "maintain", "version"],
    artifacts: ["mcp", "repository"],
    needs: ["integrity-verification"],
    signals: ["reusable-pattern"],
    risk: "write",
    ambiguity: "low",
  },
});
assert.equal(architecture.due, true);
assert.equal(architecture.targets.some((target) => target.target === "agents" && target.level === "review"), true);
assert.equal(architecture.targets.some((target) => target.target === "context" && target.level === "review"), true);
assert.equal(architecture.targets.some((target) => target.target === "state" && target.level === "review"), true);
assert.equal(architecture.recommendedSkills.includes("skill-maintenance-loop"), true);

const alreadyUpdated = evaluateMssrProjectKnowledgeMaintenance({
  changedPaths: ["src/project-home.ts", ".mssr/PROJECT_CONTEXT.md"],
  materialWrites: 2,
});
assert.equal(alreadyUpdated.targets.some((target) => target.target === "context" && target.level === "review"), false);

const stale = evaluateMssrProjectKnowledgeMaintenance({
  stage: "close",
  changedPaths: [],
  contextFreshnessIssues: 1,
});
assert.equal(stale.level, "required");
assert.equal(stale.targets.some((target) => target.target === "context" && target.level === "required"), true);

const skillChange = evaluateMssrProjectKnowledgeMaintenance({
  changedPaths: ["skills/example/SKILL.md", "skills/example/references/recovery.md", "config/skill-routing/skill-routing-overrides.json"],
  routingChanged: true,
  skillStructureChanged: true,
});
assert.equal(skillChange.due, true);
assert.equal(skillChange.recommendedSkills.includes("skill-routing-maintainer"), true);

const notInitialized = evaluateMssrProjectKnowledgeMaintenance({
  projectInitialized: false,
  projectContextHealth: "review",
  changedPaths: [],
});
assert.equal(notInitialized.due, true);
assert.equal(notInitialized.level, "review");
assert.equal(notInitialized.targets.some((target) => target.target === "context" && target.reasons.includes("project-context-not-initialized")), true);
assert.equal(notInitialized.recommendedSkills.includes("skill-maintenance-loop"), true);

const contextWatch = evaluateMssrProjectKnowledgeMaintenance({
  projectInitialized: true,
  projectContextHealth: "watch",
  changedPaths: [],
});
assert.equal(contextWatch.level, "watch");
assert.equal(contextWatch.due, false);
assert.equal(contextWatch.targets.some((target) => target.target === "context" && target.reasons.includes("project-context-health-watch")), true);

const contextReview = evaluateMssrProjectKnowledgeMaintenance({
  projectInitialized: true,
  projectContextHealth: "review",
  changedPaths: [],
});
assert.equal(contextReview.level, "review");
assert.equal(contextReview.due, true);

const bridgeLegacyIsNotAuthority = evaluateMssrProjectKnowledgeMaintenance({
  changedPaths: [".bridge/PROJECT_STATE.md", "src/project-home.ts"],
  materialWrites: 2,
});
const legacyContextTarget = bridgeLegacyIsNotAuthority.targets.find((target) => target.target === "context");
assert.equal(legacyContextTarget?.reasons.includes("authority-already-touched") ?? false, false);

const baseLifecycle = {
  stage: "close",
  requiredSkills: [],
  selectedSkills: [],
  loadedSkills: [],
  requiredPhases: ["maintenance"],
  completedPhases: ["maintenance"],
  routeCount: 2,
  closed: false,
  maintenanceRequired: true,
  lifecycleRevision: 4,
  closeRevision: 4,
  maintenanceRevision: 4,
};
const invalidated = applyMssrProjectKnowledgeMaintenanceToLifecycle(baseLifecycle, architecture);
assert.equal(invalidated.maintenanceRequired, true);
assert.equal(invalidated.lifecycleRevision, 5);
assert.equal(invalidated.closeRevision, 4);
assert.equal(invalidated.maintenanceRevision, 4);
const stillPending = applyMssrProjectKnowledgeMaintenanceToLifecycle({ ...baseLifecycle, maintenanceRevision: 3 }, architecture);
assert.equal(stillPending.lifecycleRevision, 4);
const noMaintenance = applyMssrProjectKnowledgeMaintenanceToLifecycle(baseLifecycle, ordinary);
assert.equal(noMaintenance.lifecycleRevision, 4);

console.log("MSSR project knowledge maintenance tests PASS");
