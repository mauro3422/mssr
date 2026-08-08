import assert from "node:assert/strict";
import {
  projectContextManifestSchema,
  selectProjectContextModules,
  structuredSkillIntentSchema,
  upsertMarkdownSection,
  upsertProjectContextManifestModule,
} from "../dist/index.js";

const manifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [
    {
      id: "architecture-core",
      kind: "context",
      description: "Minimal architecture facts.",
      source: { path: ".bridge/PROJECT_CONTEXT.md", sections: ["## Architecture"] },
    },
  ],
  modules: [
    {
      id: "write-safety",
      kind: "directive",
      description: "Extra checks for repository writes.",
      source: { path: ".bridge/PROJECT_MEMORY.md", sections: ["## Write safety"] },
      domains: ["coding"],
      actions: ["edit"],
      needs: ["integrity-verification"],
      stages: ["implement"],
      priority: 30,
    },
    {
      id: "roblox-state",
      kind: "state",
      description: "Roblox-only mutable state.",
      source: { path: ".bridge/PROJECT_STATE.md", sections: ["## Roblox"] },
      domains: ["roblox"],
      actions: ["review"],
      stages: ["implement"],
    },
  ],
});

const intent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["edit"],
  needs: ["integrity-verification"],
  signals: ["nominal"],
  risk: "write",
});

const selection = selectProjectContextModules({
  modules: manifest.modules.map((module) => ({ ...module, chars: 420 })),
  intent,
  stage: "implement",
  maxModuleChars: 1000,
});

assert.deepEqual(selection.selected.map((module) => module.id), ["write-safety"]);
assert.equal(selection.decisions.find((item) => item.id === "roblox-state")?.reason, "intent-mismatch");
assert.equal(selection.selected[0].kind, "directive");

const duplicate = projectContextManifestSchema.safeParse({
  schemaVersion: 1,
  core: [{ id: "same-id", kind: "context", description: "core", source: { path: "a.md" } }],
  modules: [{ id: "same-id", kind: "state", description: "module", source: { path: "b.md" }, domains: ["coding"] }],
});
assert.equal(duplicate.success, false);

const firstWrite = upsertMarkdownSection("# Memory\n", "## Write safety", "Create a snapshot first.");
assert.equal(firstWrite.created, true);
assert.equal(firstWrite.text.includes("## Write safety\nCreate a snapshot first."), true);
const secondWrite = upsertMarkdownSection(firstWrite.text, "## Write safety", "Create and verify a snapshot first.");
assert.equal(secondWrite.replaced, true);
assert.equal((secondWrite.text.match(/## Write safety/g) ?? []).length, 1);
assert.equal(secondWrite.text.includes("Create and verify a snapshot first."), true);

const moduleUpdate = upsertProjectContextManifestModule({
  manifest,
  module: {
    id: "write-safety",
    kind: "directive",
    description: "Updated write safety checks.",
    source: { path: ".bridge/PROJECT_MEMORY.md", sections: ["## Write safety"] },
    domains: ["coding"],
    actions: ["edit"],
    stages: ["implement"],
    priority: 50,
  },
});
assert.equal(moduleUpdate.replaced, true);
assert.equal(moduleUpdate.manifest.modules.filter((item) => item.id === "write-safety").length, 1);
assert.equal(moduleUpdate.manifest.modules.find((item) => item.id === "write-safety")?.priority, 50);

console.log("project context tests passed");
