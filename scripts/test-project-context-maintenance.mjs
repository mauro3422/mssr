import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  auditMssrProjectContextHealth,
  loadProjectContextModules,
  maintainMssrProjectContext,
} from "../dist/index.js";

const intent = {
  summary: "Maintain project context safely.",
  domains: ["coding"],
  actions: ["maintain"],
  artifacts: ["project"],
  needs: [],
  signals: ["warning-observed"],
  risk: "write",
  ambiguity: "low",
};

async function makeRepo(root, name) {
  const repo = path.join(root, name);
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await fs.mkdir(path.join(repo, ".mssr", "knowledge", "decision"), { recursive: true });
  await fs.mkdir(path.join(repo, ".mssr", "runtime"), { recursive: true });
  await fs.writeFile(path.join(repo, ".mssr", "PROJECT_CONTEXT.md"), "# Project Context\n", "utf8");
  await fs.writeFile(path.join(repo, ".mssr", "PROJECT_STATE.md"), "# Project State\n", "utf8");
  return repo;
}

function memoryModule(id, heading, extra = {}) {
  return {
    id,
    kind: "memory",
    topic: "decision",
    area: "routing",
    description: `${id} memory.`,
    source: { path: ".mssr/PROJECT_MEMORY.md", sections: [heading] },
    domains: ["coding"],
    actions: ["maintain"],
    artifacts: ["project"],
    signals: ["warning-observed"],
    priority: 20,
    maxChars: 2000,
    ...extra,
  };
}

async function writeManifest(repo, modules) {
  const manifestPath = path.join(repo, ".mssr", "project-context.json");
  await fs.writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, core: [], modules }, null, 2)}\n`, "utf8");
  return manifestPath;
}

async function writeSegmentSidecar(repo, modules) {
  const sidecarPath = path.join(repo, ".mssr", "project-context-segments.json");
  await fs.writeFile(sidecarPath, `${JSON.stringify({ schemaVersion: 1, modules }, null, 2)}\n`, "utf8");
  return sidecarPath;
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-context-maintenance-"));
try {
  // Safe exact-section relocation preserves logical selection and clears root-memory fanout.
  const safeRepo = await makeRepo(root, "safe");
  const decisionA = "## Decision A\n\nKeep A as durable project memory.";
  const decisionB = "## Decision B\n\nKeep B as durable project memory.";
  await fs.writeFile(path.join(safeRepo, ".mssr", "PROJECT_MEMORY.md"), `# Project Memory\n\n${decisionA}\n\n${decisionB}\n`, "utf8");
  await writeManifest(safeRepo, [
    memoryModule("decision-a", "## Decision A"),
    memoryModule("decision-b", "## Decision B"),
  ]);

  const before = await loadProjectContextModules({ projectRoot: safeRepo, intent, stage: "implement", includeCore: false, maxChars: 5000 });
  const beforeById = new Map(before.selected.map((item) => [item.ref, item.content]));
  assert.deepEqual([...beforeById.keys()].sort(), ["decision-a", "decision-b"]);
  const beforeHealth = await auditMssrProjectContextHealth(safeRepo);
  assert.equal(beforeHealth.findings.some((item) => item.code === "root-backed-memory-fanout"), true);

  const maintained = await maintainMssrProjectContext({ projectRoot: safeRepo });
  assert.equal(maintained.status, "maintained");
  assert.equal(maintained.semanticRewrite, false);
  assert.equal(maintained.automaticScope, "exact-indexed-section-only");
  assert.deepEqual(maintained.applied.map((item) => item.entryId).sort(), ["decision-a", "decision-b"]);
  assert.equal(maintained.blockers.length, 0);

  const after = await loadProjectContextModules({ projectRoot: safeRepo, intent, stage: "implement", includeCore: false, maxChars: 5000 });
  const afterById = new Map(after.selected.map((item) => [item.ref, item.content]));
  assert.deepEqual([...afterById.keys()].sort(), [...beforeById.keys()].sort());
  for (const [id, content] of beforeById) assert.equal(afterById.get(id), content, `${id} selection changed after structural maintenance`);
  const afterHealth = await auditMssrProjectContextHealth(safeRepo);
  assert.equal(afterHealth.findings.some((item) => item.code === "root-backed-memory-fanout"), false);
  await fs.access(path.join(safeRepo, ".mssr", "knowledge", "decision", "decision-a.md"));
  await fs.access(path.join(safeRepo, ".mssr", "knowledge", "decision", "decision-b.md"));

  // A whole-file consumer makes removing any child section unsafe.
  const wholeRepo = await makeRepo(root, "whole-file-consumer");
  await fs.writeFile(path.join(wholeRepo, ".mssr", "PROJECT_MEMORY.md"), `# Project Memory\n\n${decisionA}\n\n${decisionB}\n`, "utf8");
  const wholeModules = [
    memoryModule("decision-a", "## Decision A"),
    memoryModule("decision-b", "## Decision B"),
    {
      id: "whole-memory",
      kind: "memory",
      topic: "decision",
      area: "routing",
      description: "Whole memory consumer.",
      source: { path: ".mssr/PROJECT_MEMORY.md" },
      domains: ["coding"],
      actions: ["maintain"],
      artifacts: ["project"],
      signals: ["warning-observed"],
      priority: 5,
      maxChars: 4000,
    },
  ];
  const wholeManifestPath = await writeManifest(wholeRepo, wholeModules);
  const wholeMemoryPath = path.join(wholeRepo, ".mssr", "PROJECT_MEMORY.md");
  const wholeMemoryBefore = await fs.readFile(wholeMemoryPath, "utf8");
  const wholeManifestBefore = await fs.readFile(wholeManifestPath, "utf8");
  const blockedWhole = await maintainMssrProjectContext({ projectRoot: wholeRepo });
  assert.equal(blockedWhole.status, "review-required");
  assert.equal(blockedWhole.applied.length, 0);
  assert.equal(blockedWhole.blockers.some((item) => item.reason === "source-has-whole-file-consumer"), true);
  assert.equal(await fs.readFile(wholeMemoryPath, "utf8"), wholeMemoryBefore);
  assert.equal(await fs.readFile(wholeManifestPath, "utf8"), wholeManifestBefore);

  // Parent/child selectors overlap in bytes; automatic extraction must abstain.
  const overlapRepo = await makeRepo(root, "overlap");
  const overlapMemory = "# Project Memory\n\n## Parent\n\nParent facts.\n\n### Child\n\nChild facts.\n\n## Sibling\n\nSibling facts.\n";
  await fs.writeFile(path.join(overlapRepo, ".mssr", "PROJECT_MEMORY.md"), overlapMemory, "utf8");
  const overlapManifestPath = await writeManifest(overlapRepo, [
    memoryModule("parent", "## Parent"),
    memoryModule("child", "### Child"),
  ]);
  const overlapMemoryPath = path.join(overlapRepo, ".mssr", "PROJECT_MEMORY.md");
  const overlapManifestBefore = await fs.readFile(overlapManifestPath, "utf8");
  const blockedOverlap = await maintainMssrProjectContext({ projectRoot: overlapRepo });
  assert.equal(blockedOverlap.status, "review-required");
  assert.equal(blockedOverlap.applied.length, 0);
  assert.equal(blockedOverlap.blockers.some((item) => item.reason === "section-overlaps-another-logical-consumer"), true);
  assert.equal(await fs.readFile(overlapMemoryPath, "utf8"), overlapMemory);
  assert.equal(await fs.readFile(overlapManifestPath, "utf8"), overlapManifestBefore);
  // Whole-file pressure is visible but never semantically segmented automatically.
  const pressuredRepo = await makeRepo(root, "whole-file-pressure");
  const pressuredPath = path.join(pressuredRepo, ".mssr", "knowledge", "decision", "history.md");
  await fs.writeFile(path.join(pressuredRepo, ".mssr", "PROJECT_MEMORY.md"), "# Project Memory\n", "utf8");
  await fs.writeFile(pressuredPath, `# History\n\n${"h".repeat(1980)}\n`, "utf8");
  const pressuredManifestPath = await writeManifest(pressuredRepo, [{
    id: "history",
    kind: "memory",
    topic: "reference",
    area: "history",
    description: "Whole-file history under budget pressure.",
    source: { path: ".mssr/knowledge/decision/history.md" },
    actions: ["maintain"],
    artifacts: ["project"],
    priority: 10,
    maxChars: 2200,
  }]);
  const pressuredBefore = await fs.readFile(pressuredPath, "utf8");
  const pressuredManifestBefore = await fs.readFile(pressuredManifestPath, "utf8");
  const pressured = await maintainMssrProjectContext({ projectRoot: pressuredRepo });
  assert.equal(pressured.status, "review-required");
  assert.equal(pressured.applied.length, 0);
  assert.equal(pressured.blockers.some((item) => item.entryId === "history" && item.reason === "whole-file-module-requires-semantic-segmentation"), true);
  assert.equal(await fs.readFile(pressuredPath, "utf8"), pressuredBefore);
  assert.equal(await fs.readFile(pressuredManifestPath, "utf8"), pressuredManifestBefore);

  // A module that is already semantically segmented may still grow under pressure.
  // MSSR must surface a semantic re-segmentation review blocker rather than inventing
  // new terms/headings or falling back to the legacy whole-file blocker.
  const segmentedPressureRepo = await makeRepo(root, "segmented-pressure");
  const segmentedPressurePath = path.join(segmentedPressureRepo, ".mssr", "knowledge", "decision", "segmented-history.md");
  await fs.writeFile(path.join(segmentedPressureRepo, ".mssr", "PROJECT_MEMORY.md"), "# Project Memory\n", "utf8");
  await fs.writeFile(segmentedPressurePath, `# History\n\n## Baseline\n${"b".repeat(300)}\n\n## Deep A\n${"a".repeat(1800)}\n\n## Deep B\n${"c".repeat(400)}\n`, "utf8");
  const segmentedPressureManifestPath = await writeManifest(segmentedPressureRepo, [{
    id: "segmented-history",
    kind: "memory",
    topic: "reference",
    area: "history",
    description: "Already segmented history under single-target budget pressure.",
    source: { path: ".mssr/knowledge/decision/segmented-history.md" },
    actions: ["maintain"],
    artifacts: ["project"],
    priority: 10,
    maxChars: 2200,
  }]);
  const segmentedPressureSidecarPath = await writeSegmentSidecar(segmentedPressureRepo, [{
    moduleId: "segmented-history",
    segments: [
      { id: "baseline", sections: ["## Baseline"], baseline: true },
      { id: "deep-a", sections: ["## Deep A"], terms: ["deep a"] },
      { id: "deep-b", sections: ["## Deep B"], terms: ["deep b"] },
    ],
  }]);
  const segmentedPressureBefore = await fs.readFile(segmentedPressurePath, "utf8");
  const segmentedPressureManifestBefore = await fs.readFile(segmentedPressureManifestPath, "utf8");
  const segmentedPressureSidecarBefore = await fs.readFile(segmentedPressureSidecarPath, "utf8");
  const segmentedPressure = await maintainMssrProjectContext({ projectRoot: segmentedPressureRepo });
  assert.equal(segmentedPressure.status, "review-required");
  assert.equal(segmentedPressure.applied.length, 0);
  assert.equal(segmentedPressure.blockers.some((item) => item.entryId === "segmented-history" && item.reason === "semantic-segment-budget-pressure-requires-review"), true);
  assert.equal(segmentedPressure.blockers.some((item) => item.reason === "whole-file-module-requires-semantic-segmentation"), false);
  assert.equal(await fs.readFile(segmentedPressurePath, "utf8"), segmentedPressureBefore);
  assert.equal(await fs.readFile(segmentedPressureManifestPath, "utf8"), segmentedPressureManifestBefore);
  assert.equal(await fs.readFile(segmentedPressureSidecarPath, "utf8"), segmentedPressureSidecarBefore);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project context maintenance tests PASS");
