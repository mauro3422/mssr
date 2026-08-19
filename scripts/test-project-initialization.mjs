import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeMssrProject, initializeMssrWorkspace } from "../dist/project-initialization.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-init-"));
try {
  const repo = path.join(root, "repo-a");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  const first = await initializeMssrProject(repo, { initializeMissing: true, cleanupLegacyArtifacts: true });
  assert.equal(first.initialized, true);
  assert.equal(first.manifestStatus, "valid");
  assert.equal(first.created.includes(".mssr/project-context.json"), true);
  assert.match(await fs.readFile(path.join(repo, ".mssr", ".gitignore"), "utf8"), /\/runtime\//);
  assert.equal(await fs.stat(path.join(repo, ".mssr", "runtime")).then((s) => s.isDirectory()), true);

  const second = await initializeMssrProject(repo, { initializeMissing: true, cleanupLegacyArtifacts: true });
  assert.equal(second.initialized, true);
  assert.equal(second.idempotent, true);

  // Pre-0.2.18 runtime inbox is discarded rather than migrated because it may
  // contain stale .bridge-derived receipts. The canonical runtime inbox is rebuilt
  // later by the Context Plane from current canonical evidence.
  const oldInbox = path.join(repo, ".mssr", "mssr-context-inbox.json");
  await fs.writeFile(oldInbox, "{}", "utf8");
  const inboxCleanup = await initializeMssrProject(repo, { initializeMissing: true, cleanupLegacyArtifacts: true });
  assert.equal(inboxCleanup.updated.includes("removed:.mssr/mssr-context-inbox.json"), true);
  assert.equal(await fs.stat(oldInbox).then(() => true).catch(() => false), false);
  assert.equal(await fs.stat(path.join(repo, ".mssr", "runtime")).then((s) => s.isDirectory()), true);

  // Known .bridge artifacts are cleanup debt, never runtime sources.
  await fs.mkdir(path.join(repo, ".bridge"), { recursive: true });
  await fs.writeFile(path.join(repo, ".bridge", "PROJECT_CONTEXT.md"), "legacy", "utf8");
  const cleaned = await initializeMssrProject(repo, { initializeMissing: true, cleanupLegacyArtifacts: true });
  assert.deepEqual(cleaned.legacy.removed, [".bridge/PROJECT_CONTEXT.md"]);
  assert.equal(await fs.stat(path.join(repo, ".bridge", "PROJECT_CONTEXT.md")).then(() => true).catch(() => false), false);

  // Never erase a durable legacy authority if canonical data is absent.
  const blockedRepo = path.join(root, "repo-blocked");
  await fs.mkdir(path.join(blockedRepo, ".git"), { recursive: true });
  await fs.mkdir(path.join(blockedRepo, ".bridge"), { recursive: true });
  await fs.writeFile(path.join(blockedRepo, ".bridge", "PROJECT_MEMORY.md"), "legacy decision", "utf8");
  const blocked = await initializeMssrProject(blockedRepo, { initializeMissing: false, cleanupLegacyArtifacts: true });
  assert.equal(blocked.initialized, false);
  assert.deepEqual(blocked.legacy.blocked, [".bridge/PROJECT_MEMORY.md"]);

  // initializeMissing must not manufacture an empty canonical counterpart and
  // then erase a durable historical authority. This remains review-blocked.
  const blockedAuto = await initializeMssrProject(blockedRepo, { initializeMissing: true, cleanupLegacyArtifacts: true });
  assert.equal(blockedAuto.initialized, false);
  assert.equal(await fs.stat(path.join(blockedRepo, ".bridge", "PROJECT_MEMORY.md")).then(() => true).catch(() => false), true);
  assert.equal(await fs.stat(path.join(blockedRepo, ".mssr", "PROJECT_MEMORY.md")).then(() => true).catch(() => false), false);
  assert.deepEqual(blockedAuto.legacy.blocked, [".bridge/PROJECT_MEMORY.md"]);

  // Generated migration/audit containers are discovery exclusions, not managed projects.
  await fs.mkdir(path.join(root, "_migration-backups", "ignored", ".git"), { recursive: true });
  await fs.mkdir(path.join(root, "godot-mcp-audit", "ignored", ".git"), { recursive: true });

  const workspace = await initializeMssrWorkspace(root, { initializeMissing: true, cleanupLegacyArtifacts: true, maxDepth: 2 });
  assert.equal(workspace.projectCount, 2);
  assert.equal(workspace.initialized, 1);
  assert.deepEqual(workspace.blocked, [blockedRepo]);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("project initialization tests passed");
