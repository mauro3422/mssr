import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CapabilityRegistry, FilesystemSkillProvider, canonicalizeSkillEntries } from "../dist/index.js";

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

let unsubscribed = 0;
const removableRegistry = new CapabilityRegistry([{
  id: "removable",
  subscribe() {
    return () => { unsubscribed += 1; };
  },
  async refresh() {
    return { capabilities: [] };
  },
}]);
assert.equal(removableRegistry.removeProvider("removable"), true);
assert.equal(removableRegistry.removeProvider("removable"), false);
assert.equal(unsubscribed, 1, "removing a provider must release its subscription");
assert.equal(removableRegistry.getSnapshot().providers.length, 0);

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
const externalVersions = canonicalizeSkillEntries([
  { name: "plugin-skill", description: "Same contract.", source: "codex-plugin", path: "C:\\cache\\v1\\SKILL.md", origin: "Plugin cache" },
  { name: "plugin-skill", description: "Same contract.", source: "codex-plugin", path: "C:\\cache\\v2\\SKILL.md", origin: "Plugin cache" },
]);
assert.equal(externalVersions.duplicates[0].classification, "external-version-info");
assert.equal(externalVersions.duplicates[0].severity, "info");

const ownedDuplicates = canonicalizeSkillEntries([
  { name: "owned-skill", description: "Owned A.", source: "codex-local", path: "C:\\skills-a\\SKILL.md", origin: "Local" },
  { name: "owned-skill", description: "Owned B.", source: "codex-local", path: "C:\\skills-b\\SKILL.md", origin: "Local" },
]);
assert.equal(ownedDuplicates.duplicates[0].classification, "owned-error");
assert.equal(ownedDuplicates.duplicates[0].severity, "error");

const conflictingSources = canonicalizeSkillEntries([
  { name: "mixed-skill", description: "First external contract.", source: "codex-plugin", path: "C:\\cache\\a\\SKILL.md", origin: "Plugin cache" },
  { name: "mixed-skill", description: "Different external contract.", source: "codex-system", path: "C:\\system\\SKILL.md", origin: "System" },
]);
assert.equal(conflictingSources.duplicates[0].classification, "conflicting-source-warning");
assert.equal(conflictingSources.duplicates[0].severity, "warning");


console.log("registry tests passed");
