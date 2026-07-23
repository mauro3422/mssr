import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CapabilityRegistry, FilesystemSkillProvider } from "../dist/index.js";

let calls = 0;
let fail = false;
const provider = {
  id: "test",
  async refresh() {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (fail) throw new Error("offline");
    return { capabilities: [{ id: "test:one", name: "one", description: "first", kind: "tool", providerId: "test", source: "test" }] };
  },
};
const registry = new CapabilityRegistry([provider]);
const [first, second] = await Promise.all([registry.refresh(), registry.refresh()]);
assert.equal(calls, 1, "concurrent refresh must be single-flight");
assert.equal(first.capabilities.length, 1);
assert.equal(second.capabilities.length, 1);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.capabilities), true);
fail = true;
const degraded = await registry.refresh();
assert.equal(degraded.providers[0].status, "degraded");
assert.equal(degraded.providers[0].usingCachedCapabilities, true);
assert.equal(degraded.capabilities.length, 1);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-registry-"));
const sourceRoot = path.join(tempRoot, "source");
const runtimeRoot = path.join(tempRoot, "runtime");
const sourceSkill = path.join(sourceRoot, "fixture-linked-skill");
const runtimeLink = path.join(runtimeRoot, "fixture-linked-skill");
try {
  await fs.mkdir(sourceSkill, { recursive: true });
  await fs.mkdir(runtimeRoot, { recursive: true });
  await fs.writeFile(path.join(sourceSkill, "SKILL.md"), "---\nname: fixture-linked-skill\ndescription: Junction discovery regression.\n---\n", "utf8");
  await fs.symlink(sourceSkill, runtimeLink, process.platform === "win32" ? "junction" : "dir");
  const linkedRegistry = new CapabilityRegistry([new FilesystemSkillProvider({ roots: [runtimeRoot] })]);
  const linked = await linkedRegistry.refresh();
  assert.equal(linked.capabilities.some((item) => item.name === "fixture-linked-skill"), true, "filesystem provider must follow a skill junction");
} finally {
  // Unlink the reparse point itself before recursively removing its parent.
  // This is the cleanup invariant recorded in MSSR-008.
  await fs.unlink(runtimeLink).catch(() => undefined);
  await fs.rm(tempRoot, { recursive: true, force: true });
}

console.log("registry tests passed");
