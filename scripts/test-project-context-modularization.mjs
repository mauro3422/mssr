import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadProjectContextModules, planMssrProjectContextModularization } from "../dist/index.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-context-modularization-"));
try {
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.mkdir(path.join(root, ".mssr", "knowledge"), { recursive: true });
  await fs.mkdir(path.join(root, ".mssr", "runtime"), { recursive: true });

  const current = `## Current phase\n\n${"core-state-line\n".repeat(850)}`;
  const history = `## Completed history\n\n${"historical-state-line\n".repeat(850)}`;
  const unindexed = `## Unindexed architecture notes\n\n${"architecture-note-line\n".repeat(260)}`;
  const state = `# Project State\n\n${current}\n\n${history}\n\n${unindexed}\n`;
  await fs.writeFile(path.join(root, ".mssr", "PROJECT_STATE.md"), state, "utf8");
  await fs.writeFile(path.join(root, ".mssr", "PROJECT_CONTEXT.md"), "# Project Context\n\n## Architecture\n\nStable.\n", "utf8");
  await fs.writeFile(path.join(root, ".mssr", "PROJECT_MEMORY.md"), "# Project Memory\n", "utf8");

  const manifest = {
    schemaVersion: 1,
    core: [{
      id: "current-phase",
      kind: "state",
      topic: "phase",
      area: "runtime",
      description: "Current phase core.",
      source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Current phase"] },
      maxChars: 20000,
    }],
    modules: [{
      id: "completed-history",
      kind: "state",
      topic: "state",
      area: "history",
      description: "Completed history.",
      source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Completed history"] },
      stages: ["resume"],
      domains: ["coding"],
      actions: ["review"],
      artifacts: ["project"],
      needs: ["history-recovery"],
      signals: [],
      required: false,
      priority: 10,
      maxChars: 20000,
    }],
  };
  await fs.writeFile(path.join(root, ".mssr", "project-context.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const beforeState = await fs.readFile(path.join(root, ".mssr", "PROJECT_STATE.md"), "utf8");
  const beforeManifest = await fs.readFile(path.join(root, ".mssr", "project-context.json"), "utf8");
  const plan = await planMssrProjectContextModularization(root);

  assert.equal(plan.status, "review");
  assert.equal(plan.advisoryOnly, true);

  const nonCore = plan.candidates.find((item) => item.entryId === "completed-history");
  assert.ok(nonCore);
  assert.equal(nonCore.core, false);
  assert.equal(nonCore.requiresCoreDecision, false);
  assert.equal(nonCore.topic, "state");
  assert.equal(nonCore.area, "history");
  assert.match(nonCore.suggestedPath, /^\.mssr\/knowledge\/state\//);
  assert.equal(nonCore.sha256, createHash("sha256").update(history.trim(), "utf8").digest("hex"));

  const core = plan.candidates.find((item) => item.entryId === "current-phase");
  assert.ok(core);
  assert.equal(core.core, true);
  assert.equal(core.requiresCoreDecision, true);
  assert.equal(core.topic, "phase");

  const authority = plan.authoritySections.find((item) => item.authority === ".mssr/PROJECT_STATE.md");
  assert.ok(authority);
  const unindexedFinding = authority.largestSections.find((item) => item.heading === "## Unindexed architecture notes");
  assert.ok(unindexedFinding);
  assert.equal(unindexedFinding.indexed, false);
  assert.equal(unindexedFinding.recommendation, "REVIEW_FOR_KNOWLEDGE_CAPTURE");

  assert.equal(await fs.readFile(path.join(root, ".mssr", "PROJECT_STATE.md"), "utf8"), beforeState);
  assert.equal(await fs.readFile(path.join(root, ".mssr", "project-context.json"), "utf8"), beforeManifest);
  const knowledgeEntries = await fs.readdir(path.join(root, ".mssr", "knowledge"));
  assert.deepEqual(knowledgeEntries, []);

  const memoryRepo = path.join(root, "memory-repo");
  await fs.mkdir(path.join(memoryRepo, ".git"), { recursive: true });
  await fs.mkdir(path.join(memoryRepo, ".mssr", "knowledge", "decision"), { recursive: true });
  const memoryA = "## Decision A\n\nKeep A as durable project memory.";
  const memoryB = "## Decision B\n\nKeep B as durable project memory.";
  await fs.writeFile(path.join(memoryRepo, ".mssr", "PROJECT_CONTEXT.md"), "# Project Context\n", "utf8");
  await fs.writeFile(path.join(memoryRepo, ".mssr", "PROJECT_STATE.md"), "# Project State\n", "utf8");
  await fs.writeFile(path.join(memoryRepo, ".mssr", "PROJECT_MEMORY.md"), `# Project Memory\n\n${memoryA}\n\n${memoryB}\n`, "utf8");
  const memoryManifest = {
    schemaVersion: 1,
    core: [],
    modules: [
      {
        id: "decision-a",
        kind: "memory",
        topic: "decision",
        area: "routing",
        description: "Decision A.",
        source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Decision A"] },
        domains: ["coding"],
        actions: ["maintain"],
        artifacts: ["project"],
        priority: 20,
        maxChars: 1000,
      },
      {
        id: "decision-b",
        kind: "memory",
        topic: "decision",
        area: "routing",
        description: "Decision B.",
        source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Decision B"] },
        domains: ["coding"],
        actions: ["maintain"],
        artifacts: ["project"],
        priority: 20,
        maxChars: 1000,
      },
    ],
  };
  const memoryManifestPath = path.join(memoryRepo, ".mssr", "project-context.json");
  await fs.writeFile(memoryManifestPath, `${JSON.stringify(memoryManifest, null, 2)}\n`, "utf8");
  const intent = {
    summary: "Maintain project memory refs.",
    domains: ["coding"],
    actions: ["maintain"],
    artifacts: ["project"],
    needs: [],
    signals: ["warning-observed"],
    risk: "write",
    ambiguity: "low",
  };
  const beforeSelection = await loadProjectContextModules({ projectRoot: memoryRepo, intent, stage: "implement", includeCore: false, maxChars: 4000 });
  const memoryPlan = await planMssrProjectContextModularization(memoryRepo);
  assert.equal(memoryPlan.status, "watch");
  assert.equal(memoryPlan.health.findings.some((item) => item.code === "root-backed-memory-fanout"), true);
  const decisionACandidate = memoryPlan.candidates.find((item) => item.entryId === "decision-a");
  const decisionBCandidate = memoryPlan.candidates.find((item) => item.entryId === "decision-b");
  assert.ok(decisionACandidate);
  assert.ok(decisionBCandidate);
  assert.equal(decisionACandidate.preserveModuleId, true);
  assert.equal(decisionACandidate.suggestedModuleId, "decision-a");
  assert.equal(decisionACandidate.preserveKind, "memory");
  assert.equal(decisionACandidate.chars < 1000, true);
  assert.equal(decisionACandidate.suggestedPath, ".mssr/knowledge/decision/decision-a.md");

  for (const candidate of [decisionACandidate, decisionBCandidate]) {
    const selectedText = candidate.entryId === "decision-a" ? memoryA : memoryB;
    await fs.writeFile(path.join(memoryRepo, candidate.suggestedPath), `${selectedText}\n`, "utf8");
    const module = memoryManifest.modules.find((item) => item.id === candidate.entryId);
    module.source = { path: candidate.suggestedPath };
  }
  await fs.writeFile(path.join(memoryRepo, ".mssr", "PROJECT_MEMORY.md"), "# Project Memory\n", "utf8");
  await fs.writeFile(memoryManifestPath, `${JSON.stringify(memoryManifest, null, 2)}\n`, "utf8");

  const afterSelection = await loadProjectContextModules({ projectRoot: memoryRepo, intent, stage: "implement", includeCore: false, maxChars: 4000 });
  const beforeById = new Map(beforeSelection.selected.map((item) => [item.id, item.content]));
  const afterById = new Map(afterSelection.selected.map((item) => [item.id, item.content]));
  assert.deepEqual([...afterById.keys()].sort(), [...beforeById.keys()].sort());
  for (const [id, content] of beforeById) assert.equal(afterById.get(id), content);
  const afterPlan = await planMssrProjectContextModularization(memoryRepo);
  assert.equal(afterPlan.health.findings.some((item) => item.code === "root-backed-memory-fanout"), false);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project context modularization tests PASS");
