import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MAX_PROJECT_CONTEXT_CHARS,
  loadProjectContextModuleManifest,
  loadProjectContextModules,
  readBoundedMarkdown,
  safeMarkdownPath,
} from "../dist/project-context-loader.js";
import { structuredSkillIntentSchema } from "../dist/index.js";

const base = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-project-context-loader-"));

function mod(id, overrides = {}) {
  return { id, path: `${id}.md`, priority: 0, required: false, estimatedChars: 256, ...overrides };
}

async function writeFixture(name, { modules = [], core = [], files = {}, withManifest = true }) {
  const root = path.join(base, name);
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, ".mssr"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  if (withManifest) {
    const toRich = (module) => ({
      id: module.id,
      kind: "context",
      description: `Fixture ${module.id}`,
      source: { path: module.path },
      stages: module.stages ?? [],
      domains: module.domains ?? [],
      actions: module.actions ?? [],
      artifacts: module.artifacts ?? [],
      needs: module.needs ?? [],
      signals: module.signals ?? [],
      priority: module.priority ?? 0,
      required: module.required ?? false,
      ...(module.requiredWhen ? { requiredWhen: module.requiredWhen } : {}),
      ...(module.exclusiveGroup ? { exclusiveGroup: module.exclusiveGroup } : {}),
    });
    const coreSet = new Set(core);
    await fs.writeFile(
      path.join(root, ".mssr", "project-context.json"),
      JSON.stringify({
        schemaVersion: 1,
        core: modules.filter((module) => coreSet.has(module.id)).map((module) => {
          const rich = toRich(module);
          return { id: rich.id, kind: rich.kind, description: rich.description, source: rich.source };
        }),
        modules: modules.filter((module) => !coreSet.has(module.id)).map(toRich),
      }),
      "utf8",
    );
  }
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(root, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
  return root;
}

function intent(overrides = {}) {
  return structuredSkillIntentSchema.parse({
    domains: ["coding"],
    actions: ["edit"],
    needs: [],
    signals: ["nominal"],
    risk: "write",
    ambiguity: "low",
    ...overrides,
  });
}

const intentEdit = intent({ domains: ["coding"], actions: ["edit"] });
const intentBlender = intent({ domains: ["blender"], actions: ["discover"], risk: "read-only" });

try {
  const filesA = {
    "core-a.md": "# Core\n\nAlways loaded.\n",
    "opt-edit.md": "# Edit\n\nChosen when editing.\n",
    "opt-verify-stage.md": "# Verify stage\n\nOnly in verify stage.\n",
    "opt-unrelated.md": "# Unrelated\n\nThemed for roblox review.\n",
  };
  const modulesA = [
    mod("core-a", { estimatedChars: 64 }),
    mod("opt-edit", { domains: ["coding"], actions: ["edit"], stages: ["implement"], estimatedChars: 128 }),
    mod("opt-verify-stage", { domains: ["coding"], actions: ["edit"], stages: ["verify"], estimatedChars: 128 }),
    mod("opt-unrelated", { domains: ["roblox"], actions: ["review"], estimatedChars: 128 }),
  ];
  const rootA = await writeFixture("a-basic", { modules: modulesA, core: ["core-a"], files: filesA });

  const resA = await loadProjectContextModules({ projectRoot: rootA, intent: intentEdit, stage: "implement" });
  assert.equal(resA.advisoryOnly, true);
  assert.deepEqual(resA.core.map((r) => r.ref), ["core-a"]);
  assert.deepEqual(resA.selected.map((r) => r.ref), ["opt-edit"]);
  assert.equal(resA.decisions.length, 3);
  assert.equal(resA.decisions.find((d) => d.id === "opt-verify-stage").selected, false);
  assert.equal(resA.decisions.find((d) => d.id === "opt-unrelated").selected, false);
  assert.equal(typeof resA.remainingChars, "number");
  assert.ok(resA.remainingChars >= 0);

  const resAWithoutCore = await loadProjectContextModules({ projectRoot: rootA, intent: intentEdit, stage: "implement", includeCore: false });
  assert.deepEqual(resAWithoutCore.core, []);
  assert.deepEqual(resAWithoutCore.selected.map((r) => r.ref), ["opt-edit"]);
  assert.ok(resAWithoutCore.remainingChars > resA.remainingChars);

  const resUnrelated = await loadProjectContextModules({ projectRoot: rootA, intent: intentBlender, stage: "close" });
  assert.deepEqual(resUnrelated.core.map((r) => r.ref), ["core-a"]);
  assert.deepEqual(resUnrelated.selected.map((r) => r.ref), []);
  assert.equal(resUnrelated.decisions.every((d) => d.selected === false), true);

  const filesB = { "core-a.md": "Core.", "opt-req.md": "# Req\nTiny.\n", "opt-free.md": "# Free\nTiny.\n" };
  const modulesB = [
    mod("core-a", { estimatedChars: 64 }),
    mod("opt-req", { domains: ["coding"], actions: ["edit"], stages: ["implement"], required: true, estimatedChars: 256 }),
    mod("opt-free", { domains: ["coding"], actions: ["edit"], stages: ["implement"], estimatedChars: 256 }),
  ];
  const rootB = await writeFixture("b-budget", { modules: modulesB, core: ["core-a"], files: filesB });
  const resB = await loadProjectContextModules({ projectRoot: rootB, intent: intentEdit, stage: "implement", maxChars: 5, maxModules: 1 });
  assert.deepEqual(resB.selected.map((r) => r.ref), ["opt-req"]);
  assert.deepEqual(resB.requiredBudgetExceeded.sort(), ["opt-req"]);
  assert.equal(resB.decisions.find((d) => d.id === "opt-free").reason, "budget-exceeded");
  assert.equal(resB.decisions.find((d) => d.id === "opt-free").selected, false);

  // Cross-cutting mutation contracts are materialized before semantic ranking. This
  // reproduces the failure mode where a UTF-8/runtime rule exists durably but the
  // task intent is narrowly classified around an unrelated subsystem.
  const filesB1 = {
    "critical-utf8.md": "# UTF-8 runtime invariant\nPayload text must remain UTF-8.\n",
    "semantic-map.md": "# Map sync\nSubsystem-specific implementation notes.\n",
  };
  const modulesB1 = [
    mod("critical-utf8", {
      domains: ["other"],
      actions: ["review"],
      requiredWhen: { mutation: true, artifacts: ["code"] },
      priority: -80,
    }),
    mod("semantic-map", { domains: ["coding"], actions: ["edit"], artifacts: ["code"], priority: 90 }),
  ];
  const rootB1 = await writeFixture("b1-cross-cutting", { modules: modulesB1, files: filesB1 });
  const mutationB1 = await loadProjectContextModules({
    projectRoot: rootB1,
    intent: intent({ domains: ["coding"], actions: ["edit"], artifacts: ["code"], risk: "write" }),
    stage: "implement",
    maxChars: 40,
    maxModules: 1,
  });
  assert.deepEqual(mutationB1.selected.map((record) => record.ref), ["critical-utf8"]);
  assert.deepEqual(mutationB1.requiredBudgetExceeded, ["critical-utf8"]);
  assert.equal(mutationB1.decisions.find((d) => d.id === "critical-utf8").required, true);
  assert.deepEqual(mutationB1.decisions.find((d) => d.id === "critical-utf8").requiredBy, ["mutation", "artifact:code"]);
  assert.equal(mutationB1.decisions.find((d) => d.id === "semantic-map").selected, false);

  const readOnlyB1 = await loadProjectContextModules({
    projectRoot: rootB1,
    intent: intent({ domains: ["coding"], actions: ["review"], artifacts: ["code"], risk: "read-only" }),
    stage: "implement",
  });
  assert.equal(readOnlyB1.selected.some((record) => record.ref === "critical-utf8"), false);
  assert.equal(readOnlyB1.decisions.find((d) => d.id === "critical-utf8").required, false);
  assert.equal(readOnlyB1.decisions.find((d) => d.id === "critical-utf8").reason, "intent-mismatch");

  const filesB2 = {
    "core-big.md": "C".repeat(30_000),
    "req-big.md": "R".repeat(25_000),
    "notreq-big.md": "N".repeat(25_000),
  };
  const modulesB2 = [
    mod("core-big", { estimatedChars: 30_000 }),
    mod("req-big", { required: true, estimatedChars: 25_000, domains: ["coding"], actions: ["edit"] }),
    mod("notreq-big", { required: false, estimatedChars: 25_000, domains: ["coding"], actions: ["edit"] }),
  ];
  const rootB2 = await writeFixture("b-overflow", { modules: modulesB2, core: ["core-big"], files: filesB2 });
  const resB2 = await loadProjectContextModules({ projectRoot: rootB2, intent: intentEdit, stage: "implement" });
  assert.deepEqual(resB2.requiredOverflow.sort(), ["core-big", "req-big"]);
  assert.equal(resB2.requiredOverflow.includes("notreq-big"), false);

  const dirC = path.join(base, "c-safety");
  await fs.rm(dirC, { recursive: true, force: true });
  await fs.mkdir(path.join(dirC, ".mssr"), { recursive: true });
  assert.throws(() => safeMarkdownPath(dirC, "../evil.md"), /traverse/);
  assert.throws(() => safeMarkdownPath(dirC, path.join("sub", "..", "..", "escape.md")), /traverse/);
  assert.throws(() => safeMarkdownPath(dirC, "notes.txt"), /markdown/);
  assert.throws(() => safeMarkdownPath(dirC, path.join(dirC, "abs.md")), /absolute/);
  assert.equal(
    path.resolve(safeMarkdownPath(dirC, "docs/good.md")),
    path.resolve(path.join(dirC, "docs", "good.md")),
  );

  const tooBig = path.join(dirC, "big.md");
  await fs.writeFile(tooBig, "x".repeat(MAX_PROJECT_CONTEXT_CHARS + 1), "utf8");
  await assert.rejects(() => readBoundedMarkdown(tooBig), /exceeds/);

  const small = path.join(dirC, "small.md");
  await fs.writeFile(small, "hi", "utf8");
  const rawSmall = await readBoundedMarkdown(small);
  assert.equal(rawSmall.content, "hi");
  assert.equal(rawSmall.bytes, 2);
  await assert.rejects(() => readBoundedMarkdown(small, 1), /exceeds/);

  // A per-entry maxChars limit applies after section extraction. The backing
  // authority may be larger as long as it stays under the global source cap.
  const rootSectionMax = path.join(base, "c-section-max");
  await fs.rm(rootSectionMax, { recursive: true, force: true });
  await fs.mkdir(path.join(rootSectionMax, ".mssr"), { recursive: true });
  const sectionPayload = "r".repeat(215);
  const sectionAuthority = `# History\n${"x".repeat(3_000)}\n\n## Current release\n${sectionPayload}\n\n## Other\n${"y".repeat(500)}\n`;
  await fs.writeFile(path.join(rootSectionMax, "authority.md"), sectionAuthority, "utf8");
  const sectionManifest = (maxChars) => ({
    schemaVersion: 1,
    core: [{
      id: "section-core",
      kind: "state",
      description: "Small selected section from a larger authority",
      source: { path: "authority.md", sections: ["## Current release"] },
      maxChars,
    }],
    modules: [],
  });
  await fs.writeFile(path.join(rootSectionMax, ".mssr", "project-context.json"), JSON.stringify(sectionManifest(256)), "utf8");
  const sectionLimited = await loadProjectContextModules({ projectRoot: rootSectionMax, intent: intentEdit, stage: "start" });
  assert.equal(sectionLimited.core[0].content, `## Current release\n${sectionPayload}`);
  assert.ok(sectionLimited.core[0].bytes > 200 && sectionLimited.core[0].bytes < 256);

  await fs.writeFile(path.join(rootSectionMax, ".mssr", "project-context.json"), JSON.stringify(sectionManifest(200)), "utf8");
  await assert.rejects(
    () => loadProjectContextModules({ projectRoot: rootSectionMax, intent: intentEdit, stage: "start" }),
    /selection exceeds 200 bytes/,
  );

  const filesC2 = { "core-safe.md": "safe", "evil.md": "evil" };
  const rootC2 = await writeFixture("c-traverse", {
    modules: [mod("core-safe", { estimatedChars: 16 }), mod("evil", { path: "../evil.md", estimatedChars: 16 })],
    core: ["evil"],
    files: filesC2,
  });
  await assert.rejects(
    () => loadProjectContextModules({ projectRoot: rootC2, intent: intentEdit, stage: "implement" }),
    /traverse/,
  );

  const rootC3 = await writeFixture("c-nonmd", {
    modules: [mod("core-safe", { estimatedChars: 16 }), mod("txt", { path: "core.txt", estimatedChars: 16 })],
    core: ["txt"],
    files: { "core-safe.md": "safe", "core.txt": "not markdown" },
  });
  await assert.rejects(
    () => loadProjectContextModules({ projectRoot: rootC3, intent: intentEdit, stage: "implement" }),
    /markdown/,
  );

  const rootC4 = await writeFixture("c-oversize", {
    modules: [mod("huge", { path: "huge.md", estimatedChars: MAX_PROJECT_CONTEXT_CHARS })],
    core: ["huge"],
    files: { "huge.md": "x".repeat(MAX_PROJECT_CONTEXT_CHARS + 1) },
  });
  await assert.rejects(
    () => loadProjectContextModules({ projectRoot: rootC4, intent: intentEdit, stage: "implement" }),
    /exceeds/,
  );

  const filesD = { "core-x.md": "x", "g-a.md": "alpha\n", "g-b.md": "beta\n", "g-c.md": "gamma\n" };
  const modulesD = [
    mod("core-x", { estimatedChars: 16 }),
    mod("g-a", { exclusiveGroup: "pair", domains: ["coding"], actions: ["edit"], stages: ["implement"], estimatedChars: 128 }),
    mod("g-b", { exclusiveGroup: "pair", domains: ["coding"], actions: ["edit"], stages: ["implement"], estimatedChars: 128 }),
    mod("g-c", { exclusiveGroup: "solo", domains: ["coding"], actions: ["edit"], stages: ["implement"], estimatedChars: 128 }),
  ];
  const rootD = await writeFixture("d-exclusive", { modules: modulesD, core: ["core-x"], files: filesD });
  const resD = await loadProjectContextModules({ projectRoot: rootD, intent: intentEdit, stage: "implement" });
  assert.equal(resD.ambiguousExclusiveGroups.length, 1);
  const ambiguous = resD.ambiguousExclusiveGroups[0];
  assert.equal(ambiguous.group, "pair");
  assert.deepEqual(ambiguous.candidates, ["g-a", "g-b"]);
  assert.equal(typeof ambiguous.score, "number");
  assert.deepEqual(resD.selected.map((r) => r.ref), ["g-c"]);
  assert.equal(resD.decisions.find((d) => d.id === "g-a").reason, "ambiguous-candidate");
  assert.equal(resD.decisions.find((d) => d.id === "g-a").selected, false);
  assert.equal(resD.decisions.find((d) => d.id === "g-b").reason, "ambiguous-candidate");
  assert.equal(resD.decisions.find((d) => d.id === "g-b").selected, false);
  assert.equal(resD.decisions.find((d) => d.id === "g-c").selected, true);

  const rootE1 = await writeFixture("e-empty", { withManifest: false });
  const missingManifest = await loadProjectContextModuleManifest(rootE1);
  assert.equal(missingManifest.found, false);
  const resE1 = await loadProjectContextModules({ projectRoot: rootE1, intent: intentEdit, stage: "start" });
  assert.equal(resE1.manifestStatus, "missing");
  assert.deepEqual(resE1.core, []);
  assert.deepEqual(resE1.selected, []);
  assert.deepEqual(resE1.decisions, []);
  assert.equal(resE1.remainingChars, 6000);

  // Docs or PROJECT_* files alone never bypass explicit MSSR initialization.
  const rootE2 = await writeFixture("e-docs", { files: { "docs/PROJECT_CONTEXT.md": "# Docs context\n" }, withManifest: false });
  const resE2 = await loadProjectContextModules({ projectRoot: rootE2, intent: intentEdit, stage: "start" });
  assert.equal(resE2.manifestStatus, "missing");
  assert.deepEqual(resE2.core, []);

  const rootE3 = await writeFixture("e-authority-without-contract", {
    files: { ".mssr/PROJECT_CONTEXT.md": "# Canonical context\n", "docs/PROJECT_CONTEXT.md": "# Docs context\n" },
    withManifest: false,
  });
  const resE3 = await loadProjectContextModules({ projectRoot: rootE3, intent: intentEdit, stage: "start" });
  assert.equal(resE3.manifestStatus, "missing");
  assert.deepEqual(resE3.core, []);
  assert.deepEqual(resE3.selected, []);

  const shaFile = path.join(dirC, "sha.md");
  await fs.writeFile(shaFile, "alpha beta gamma", "utf8");
  const sha1 = await readBoundedMarkdown(shaFile);
  const sha2 = await readBoundedMarkdown(shaFile);
  assert.equal(sha1.sha256, sha2.sha256);
  assert.equal(sha1.sha256, createHash("sha256").update("alpha beta gamma").digest("hex"));

  const resA2 = await loadProjectContextModules({ projectRoot: rootA, intent: intentEdit, stage: "implement" });
  assert.equal(resA.core[0].sha256, resA2.core[0].sha256);
  assert.equal(resA.selected[0].sha256, resA2.selected[0].sha256);
  assert.equal(resA.advisoryOnly, true);

  console.log("project-context-loader tests passed");
} finally {
  await fs.rm(base, { recursive: true, force: true });
}