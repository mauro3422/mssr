import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { planMssrProjectContextModularization } from "../dist/index.js";

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
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project context modularization tests PASS");
