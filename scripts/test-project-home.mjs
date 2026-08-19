import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  MSSR_PROJECT_AUTHORITY_FILES,
  MSSR_PROJECT_CONTROL_FILES,
  mssrProjectRelativePath,
  resolveMssrProjectFile,
} from "../dist/project-home.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-project-home-"));
try {
  const fileName = MSSR_PROJECT_AUTHORITY_FILES.context;
  const missing = await resolveMssrProjectFile(root, fileName);
  assert.equal(missing.source, "missing");
  assert.equal(missing.relativePath, ".mssr/PROJECT_CONTEXT.md");

  // Historical .bridge project-control files are invisible to MSSR 0.2.18+.
  await fs.mkdir(path.join(root, ".bridge"), { recursive: true });
  await fs.writeFile(path.join(root, ".bridge", fileName), "stale legacy", "utf8");
  const stillMissing = await resolveMssrProjectFile(root, fileName);
  assert.equal(stillMissing.source, "missing");
  assert.equal(stillMissing.relativePath, ".mssr/PROJECT_CONTEXT.md");

  await fs.mkdir(path.join(root, ".mssr"), { recursive: true });
  await fs.writeFile(path.join(root, ".mssr", fileName), "canonical", "utf8");
  const canonical = await resolveMssrProjectFile(root, fileName);
  assert.equal(canonical.source, "canonical");
  assert.equal(canonical.relativePath, mssrProjectRelativePath(fileName));

  const inbox = await resolveMssrProjectFile(root, MSSR_PROJECT_CONTROL_FILES.contextInbox);
  assert.equal(inbox.relativePath, ".mssr/runtime/context-inbox.json");
  assert.equal(inbox.source, "missing");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR canonical project home tests PASS");
