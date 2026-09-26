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

  // Generic navigation docs and nested area roadmaps remain visible candidates but do not create
  // project-wide attention by themselves.
  await fs.writeFile(path.join(repo, "README.md"), "# Repo\n", "utf8");
  await fs.mkdir(path.join(repo, "docs", "feature"), { recursive: true });
  await fs.writeFile(path.join(repo, "docs", "feature", "ROADMAP.md"), "# Feature roadmap\n", "utf8");
  const lowNoise = await auditMssrProjectContextHealth(repo);
  assert.ok(lowNoise.referenceAudit);
  assert.equal(lowNoise.referenceAudit.highPriorityCount, 0);
  assert.equal(lowNoise.referenceAudit.candidates.some((item) => item.path === "README.md" && item.reviewPriority === "low"), true);
  assert.equal(lowNoise.referenceAudit.candidates.some((item) => item.path === "docs/feature/ROADMAP.md" && item.reviewPriority === "medium"), true);
  assert.equal(lowNoise.findings.some((item) => item.code === "unreviewed-project-doc-references"), false);

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

  // Retroactive document discoverability is candidate-only: a strong project doc is surfaced,
  // but health never invents a module or canonical owner for it.
  await fs.mkdir(path.join(repo, "docs"), { recursive: true });
  await fs.writeFile(path.join(repo, "docs", "ARCHITECTURE.md"), "# Architecture\n\nCurrent architecture.\n", "utf8");
  const architectureCandidate = await auditMssrProjectContextHealth(repo);
  assert.ok(architectureCandidate.referenceAudit);
  assert.equal(architectureCandidate.referenceAudit.highPriorityCount, 1);
  assert.equal(architectureCandidate.referenceAudit.candidates.some((item) => item.path === "docs/ARCHITECTURE.md" && item.reviewPriority === "high"), true);
  assert.equal(architectureCandidate.findings.some((item) => item.code === "unreviewed-project-doc-references"), true);
  const manifestAfterCandidate = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert.equal(manifestAfterCandidate.modules.some((item) => item.source?.path === "docs/ARCHITECTURE.md"), false);

  // An explicit pointer from already-selectable .mssr context is enough to make a large canonical
  // doc discoverable without injecting the whole document into every context assembly.
  const projectContextPath = path.join(repo, ".mssr", "PROJECT_CONTEXT.md");
  const projectContext = await fs.readFile(projectContextPath, "utf8");
  await fs.writeFile(projectContextPath, `${projectContext.trimEnd()}\n\n## Architecture references\n\n- Canonical detail: \`docs/ARCHITECTURE.md\`.\n`, "utf8");
  const architectureConnected = await auditMssrProjectContextHealth(repo);
  assert.ok(architectureConnected.referenceAudit);
  assert.equal(architectureConnected.referenceAudit.candidates.some((item) => item.path === "docs/ARCHITECTURE.md"), false);
  assert.equal(architectureConnected.referenceAudit.connectedCount >= 1, true);

  // Direct manifest ownership remains exact. A rename yields both a missing declared source and a
  // new review candidate; deleting the renamed file removes the candidate but not the stale owner.
  await fs.writeFile(path.join(repo, "docs", "ROADMAP.md"), "# Roadmap\n\nCurrent roadmap.\n", "utf8");
  const manifestWithRoadmap = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifestWithRoadmap.modules.push({
    id: "project-roadmap",
    kind: "context",
    topic: "reference",
    description: "Current project roadmap.",
    source: { path: "docs/ROADMAP.md" },
    actions: ["review", "maintain"],
    maxChars: 2000,
  });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifestWithRoadmap, null, 2)}\n`, "utf8");
  const roadmapConnected = await auditMssrProjectContextHealth(repo);
  assert.equal(roadmapConnected.referenceAudit.candidates.some((item) => item.path === "docs/ROADMAP.md"), false);

  await fs.mkdir(path.join(repo, "docs", "v2"), { recursive: true });
  await fs.rename(path.join(repo, "docs", "ROADMAP.md"), path.join(repo, "docs", "v2", "ROADMAP.md"));
  const renamedRoadmap = await auditMssrProjectContextHealth(repo);
  assert.equal(renamedRoadmap.findings.some((item) => item.code === "missing-module-source" && item.target === "docs/ROADMAP.md"), true);
  assert.equal(renamedRoadmap.referenceAudit.candidates.some((item) => item.path === "docs/v2/ROADMAP.md" && item.reviewPriority === "medium"), true);

  await fs.rm(path.join(repo, "docs", "v2", "ROADMAP.md"), { force: true });
  const deletedRoadmap = await auditMssrProjectContextHealth(repo);
  assert.equal(deletedRoadmap.findings.some((item) => item.code === "missing-module-source" && item.target === "docs/ROADMAP.md"), true);
  assert.equal(deletedRoadmap.referenceAudit.candidates.some((item) => item.path === "docs/v2/ROADMAP.md"), false);

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
