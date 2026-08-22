import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CapabilityRegistry,
  FilesystemSkillProvider,
  MSSR_FIRST_PARTY_SKILL_MANIFEST,
  MssrFirstPartySkillProvider,
  auditSkillRouting,
  buildSkillRoutingRegistry,
  canonicalizeSkillEntries,
  isMssrFirstPartySkillName,
} from "../dist/index.js";

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

const observableRegistry = new CapabilityRegistry();
const observedChanges = [];
const unsubscribeSnapshot = observableRegistry.subscribe((snapshot) => observedChanges.push(snapshot.lastChange?.kind));
observableRegistry.addProvider({ id: "dynamic", async refresh() { return { capabilities: [] }; } });
assert.equal(observableRegistry.getSnapshot().lastChange?.kind, "provider-added");
assert.equal(observedChanges.at(-1), "provider-added", "dynamic registration must publish an observable snapshot");
assert.equal(observableRegistry.removeProvider("dynamic"), true);
assert.equal(observableRegistry.getSnapshot().lastChange?.kind, "provider-removed");
assert.equal(observedChanges.at(-1), "provider-removed", "dynamic removal must publish an observable snapshot");
unsubscribeSnapshot();

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

assert.equal(isMssrFirstPartySkillName("mssr-agent-routing"), true);
assert.equal(isMssrFirstPartySkillName("external-skill"), false);
assert.equal(MSSR_FIRST_PARTY_SKILL_MANIFEST.skills.length, 5);

const bundledRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-first-party-"));
const bundledSkill = path.join(bundledRoot, "mssr-agent-routing");
const mountedRoot = path.join(bundledRoot, "runtime");
const mountedSkill = path.join(mountedRoot, "mssr-agent-routing");
const copiedRoot = path.join(bundledRoot, "copied-runtime");
const copiedSkill = path.join(copiedRoot, "mssr-agent-routing");
const divergentRoot = path.join(bundledRoot, "divergent");
const divergentSkill = path.join(divergentRoot, "mssr-agent-routing");
try {
  await fs.mkdir(bundledSkill, { recursive: true });
  await fs.mkdir(mountedRoot, { recursive: true });
  await fs.writeFile(path.join(bundledSkill, "SKILL.md"), "---\nname: mssr-agent-routing\ndescription: Bundled first-party routing.\n---\n", "utf8");

  const manifest = { schemaVersion: 1, skills: [{ name: "mssr-agent-routing" }] };
  const directProvider = new MssrFirstPartySkillProvider({ root: bundledRoot, manifest });
  const directRegistry = new CapabilityRegistry([directProvider]);
  const direct = await directRegistry.refresh();
  assert.deepEqual(direct.capabilities.map((item) => [item.name, item.source]), [["mssr-agent-routing", "mssr-first-party"]]);
  const directRouting = await buildSkillRoutingRegistry([{ name: "first-party-inferred", description: "No explicit metadata.", source: "mssr-first-party" }]);
  assert.equal(directRouting.entries[0].priority, 60, "first-party inferred routing must rank above local inferred skills");
  const ownedFirstPartyAudit = await auditSkillRouting(direct.capabilities.flatMap((item) => item.skill ? [item.skill] : []));
  assert.equal(ownedFirstPartyAudit.counts.ownedSkills, 1, "first-party skills must be audited as owned");
  assert.equal(ownedFirstPartyAudit.unconfiguredOwnedSkills.length, 0, "configured first-party skills must not be treated as external inferred metadata");
  const missingDescriptionAudit = await auditSkillRouting([{ name: "mssr-agent-routing", description: "", source: "mssr-first-party", path: path.join(bundledSkill, "SKILL.md") }]);
  assert.equal(missingDescriptionAudit.missingDescriptions.some((item) => item.name === "mssr-agent-routing"), true, "missing descriptions on first-party skills must be health findings");
  const structuralSkill = path.join(bundledRoot, "complex-system-design");
  await fs.mkdir(structuralSkill, { recursive: true });
  const structuralBody = "# Structural review fixture\n\n" + "Situational recipe guidance without a manifest.\n".repeat(230);
  await fs.writeFile(path.join(structuralSkill, "SKILL.md"), `---\nname: complex-system-design\ndescription: Synthetic structural-health fixture.\n---\n\n${structuralBody}`, "utf8");
  const structuralAudit = await auditSkillRouting([{
    name: "complex-system-design",
    description: "Synthetic structural-health fixture.",
    source: "codex-local",
    path: path.join(structuralSkill, "SKILL.md"),
  }]);
  const structuralHealth = structuralAudit.structuralHealth.find((item) => item.name === "complex-system-design");
  assert.ok(structuralHealth && structuralHealth.status !== "ok", "large manifest-less owned skill must receive an advisory structural review");
  assert.ok(structuralHealth.reasonCodes.includes("full-fallback-risk"));
  assert.equal(structuralAudit.healthReviewRecommended, true);
  assert.equal(structuralAudit.maintenanceReasons.some((reason) => reason.includes("complex-system-design")), false, "structural advisory debt must not become a blocking routing maintenance reason");


  await fs.symlink(bundledSkill, mountedSkill, process.platform === "win32" ? "junction" : "dir");
  const aliasRegistry = new CapabilityRegistry([
    new MssrFirstPartySkillProvider({ root: bundledRoot, manifest }),
    new FilesystemSkillProvider({ roots: [mountedRoot] }),
  ]);
  const aliasSnapshot = await aliasRegistry.refresh();
  const aliasEntries = canonicalizeSkillEntries(aliasSnapshot.capabilities.flatMap((item) => item.skill ? [item.skill] : []));
  assert.equal(aliasEntries.entries.length, 1, "A mounted first-party skill must be canonicalized once");
  assert.equal(aliasEntries.entries[0].source, "mssr-first-party");
  assert.equal(aliasEntries.duplicates[0].classification, "first-party-alias-info");
  assert.equal(aliasEntries.duplicates[0].severity, "info");

  await fs.mkdir(copiedSkill, { recursive: true });
  await fs.copyFile(path.join(bundledSkill, "SKILL.md"), path.join(copiedSkill, "SKILL.md"));
  const copiedRegistry = new CapabilityRegistry([
    new MssrFirstPartySkillProvider({ root: bundledRoot, manifest }),
    new FilesystemSkillProvider({ roots: [copiedRoot] }),
  ]);
  const copiedSnapshot = await copiedRegistry.refresh();
  const copiedEntries = canonicalizeSkillEntries(copiedSnapshot.capabilities.flatMap((item) => item.skill ? [item.skill] : []));
  assert.equal(copiedEntries.duplicates[0].classification, "first-party-alias-info", "a byte-identical packaged/runtime copy must not be treated as a reserved shadow conflict");
  assert.equal((await auditSkillRouting(copiedSnapshot.capabilities.flatMap((item) => item.skill ? [item.skill] : []))).ok, true);

  await fs.mkdir(divergentSkill, { recursive: true });
  await fs.writeFile(path.join(divergentSkill, "SKILL.md"), "---\nname: mssr-agent-routing\ndescription: Divergent shadow source.\n---\n", "utf8");
  const conflictRegistry = new CapabilityRegistry([
    new MssrFirstPartySkillProvider({ root: bundledRoot, manifest }),
    new FilesystemSkillProvider({ roots: [divergentRoot] }),
  ]);
  const conflictSnapshot = await conflictRegistry.refresh();
  const conflictEntries = canonicalizeSkillEntries(conflictSnapshot.capabilities.flatMap((item) => item.skill ? [item.skill] : []));
  assert.equal(conflictEntries.entries[0].source, "mssr-first-party");
  assert.equal(conflictEntries.duplicates[0].classification, "reserved-first-party-conflict");
  assert.equal(conflictEntries.duplicates[0].severity, "error");
  const conflictAudit = await auditSkillRouting(conflictSnapshot.capabilities.flatMap((item) => item.skill ? [item.skill] : []));
  assert.equal(conflictAudit.ok, false, "A divergent reserved name must block the routing audit");
  assert.equal(conflictAudit.errors.some((error) => error.includes("Reserved first-party skill name is shadowed: mssr-agent-routing")), true);

  const mismatchedRoot = path.join(bundledRoot, "mismatched");
  const mismatchedSkill = path.join(mismatchedRoot, "directory-name");
  await fs.mkdir(mismatchedSkill, { recursive: true });
  await fs.writeFile(path.join(mismatchedSkill, "SKILL.md"), "---\nname: declared-name\ndescription: Mismatched identity.\n---\n", "utf8");
  const mismatched = await new FilesystemSkillProvider({ roots: [mismatchedRoot] }).refresh();
  assert.equal(mismatched.capabilities[0].name, "declared-name", "filesystem discovery must use frontmatter identity rather than the directory basename");

  await fs.writeFile(path.join(bundledSkill, "SKILL.md"), "---\nname: wrong-bundled-name\ndescription: Invalid bundled identity.\n---\n", "utf8");
  await assert.rejects(() => new MssrFirstPartySkillProvider({ root: bundledRoot, manifest }).refresh(), /declares frontmatter name wrong-bundled-name/);
} finally {
  await fs.unlink(mountedSkill).catch(() => undefined);
  await fs.rm(bundledRoot, { recursive: true, force: true });
}


console.log("registry tests passed");
