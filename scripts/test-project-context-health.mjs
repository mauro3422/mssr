import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeMssrProject } from "../dist/project-initialization.js";
import { auditMssrProjectContextHealth } from "../dist/project-context-health.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-context-health-"));
try {
  const repo = path.join(root, "repo");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await initializeMssrProject(repo);
  const healthy = await auditMssrProjectContextHealth(repo);
  assert.equal(healthy.manifestStatus, "valid");
  assert.equal(healthy.findings.some((item) => item.code === "missing-manifest"), false);

  const manifestPath = path.join(repo, ".mssr", "project-context.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const initializedMemoryPath = path.join(repo, ".mssr", "PROJECT_MEMORY.md");
  const initializedMemory = await fs.readFile(initializedMemoryPath, "utf8");
  await fs.writeFile(
    initializedMemoryPath,
    `${initializedMemory.trimEnd()}\n\n## Decision A\n\nKeep A.\n\n## Decision B\n\nKeep B.\n`,
    "utf8",
  );
  manifest.modules.push(
    {
      id: "decision-a",
      kind: "memory",
      topic: "decision",
      description: "Decision A.",
      source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Decision A"] },
      actions: ["maintain"],
      maxChars: 1000,
    },
    {
      id: "decision-b",
      kind: "memory",
      topic: "decision",
      description: "Decision B.",
      source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Decision B"] },
      actions: ["maintain"],
      maxChars: 1000,
    },
  );
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const memoryFanout = await auditMssrProjectContextHealth(repo);
  const memoryFanoutFinding = memoryFanout.findings.find((item) => item.code === "root-backed-memory-fanout");
  assert.ok(memoryFanoutFinding);
  assert.equal(memoryFanoutFinding.level, "watch");
  assert.equal(memoryFanoutFinding.target, ".mssr/PROJECT_MEMORY.md");
  assert.equal(memoryFanoutFinding.recommendation, "EXTRACT_MEMORY_REFS");

  await fs.mkdir(path.join(repo, ".mssr", "knowledge", "design"), { recursive: true });
  await fs.writeFile(path.join(repo, ".mssr", "knowledge", "design", "unindexed.md"), "# Design\n\nNot indexed yet.\n", "utf8");
  const unindexed = await auditMssrProjectContextHealth(repo);
  assert.equal(unindexed.level, "watch");
  assert.equal(unindexed.findings.some((item) => item.code === "unindexed-knowledge"), true);

  await fs.mkdir(path.join(repo, ".bridge"), { recursive: true });
  await fs.writeFile(path.join(repo, ".bridge", "PROJECT_STATE.md"), "legacy", "utf8");
  const legacy = await auditMssrProjectContextHealth(repo);
  assert.equal(legacy.level, "review");
  assert.equal(legacy.findings.some((item) => item.code === "legacy-mssr-artifact"), true);

  await fs.rm(path.join(repo, ".bridge", "PROJECT_STATE.md"), { force: true });
  await fs.writeFile(path.join(repo, ".mssr", "PROJECT_CONTEXT.md"), `# Project Context\n\n## Project identity\n\n- Repository: repo\n\n## Architecture\n\n${"A".repeat(33_000)}\n`, "utf8");
  const oversized = await auditMssrProjectContextHealth(repo);
  assert.equal(oversized.level, "review");
  assert.equal(oversized.findings.some((item) => item.code === "oversized-authority"), true);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("project context health tests passed");
