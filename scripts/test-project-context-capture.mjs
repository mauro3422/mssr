import assert from "node:assert/strict";
import { planMssrProjectKnowledgeCapture } from "../dist/project-context-capture.js";

const design = planMssrProjectKnowledgeCapture({
  id: "routing-layout-law",
  topic: "law",
  area: "atlas",
  title: "Routing layout law",
  content: "Connections choose geometry from verified relationships rather than a fixed cardinal direction.",
  domains: ["coding"],
  actions: ["design", "review"],
  artifacts: ["project", "code"],
  signals: ["reusable-pattern"],
  priority: 40,
});
assert.equal(design.relativePath, ".mssr/knowledge/law/routing-layout-law.md");
assert.equal(design.module.kind, "context");
assert.equal(design.module.topic, "law");
assert.equal(design.module.area, "atlas");
assert.match(design.markdown, /^# Routing layout law/);

const decision = planMssrProjectKnowledgeCapture({
  id: "canonical-owner-decision",
  topic: "decision",
  title: "Canonical owner decision",
  content: "MSSR portable core owns project-context selection semantics; hosts own delivery and filesystem mutation.",
  actions: ["design", "maintain"],
});
assert.equal(decision.module.kind, "memory");
assert.equal(decision.relativePath, ".mssr/knowledge/decision/canonical-owner-decision.md");
assert.match(decision.policy, /reference-backed by default/);
assert.match(decision.policy, /Keep PROJECT_MEMORY\.md for compact core\/cross-area memory/);

const phase = planMssrProjectKnowledgeCapture({
  id: "current-repair-phase",
  topic: "phase",
  title: "Current repair phase",
  content: "Gameplay repair loop is in reassembly verification.",
  stages: ["start", "resume"],
});
assert.equal(phase.module.kind, "state");

const criticalRuntime = planMssrProjectKnowledgeCapture({
  id: "critical-runtime-localization",
  topic: "operations",
  kind: "directive",
  title: "Critical runtime localization",
  content: "Payload text must preserve UTF-8 regardless of the subsystem-specific task classification.",
  requiredWhen: { mutation: true, artifacts: ["code"] },
  priority: 80,
});
assert.deepEqual(criticalRuntime.module.requiredWhen, { mutation: true, artifacts: ["code"] });
assert.deepEqual(criticalRuntime.module.domains, []);
assert.deepEqual(criticalRuntime.module.actions, []);

assert.throws(
  () => planMssrProjectKnowledgeCapture({
    id: "unsafe-directive",
    topic: "operations",
    kind: "directive",
    title: "Unsafe directive",
    content: "Do something conditionally.",
  }),
  /requires at least one selector/,
);

console.log("project context capture tests passed");
