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
      source: { path: ".mssr/PROJECT_CONTEXT.md", sections: ["## Architecture"] },
    },
  ],
  modules: [
    {
      id: "write-safety",
      kind: "directive",
      description: "Extra checks for repository writes.",
      source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Write safety"] },
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
      source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Roblox"] },
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

const criticalManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  modules: [{
    id: "critical-utf8-runtime",
    kind: "directive",
    description: "UTF-8/runtime payload invariant that must survive narrow semantic routing.",
    source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## UTF-8 runtime invariant"] },
    domains: ["other"],
    actions: ["review"],
    requiredWhen: { mutation: true, artifacts: ["code"] },
    priority: -50,
  }],
});
const mutationIntent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["edit"],
  artifacts: ["code"],
  needs: [],
  signals: ["nominal"],
  risk: "write",
});
const criticalMutation = selectProjectContextModules({
  modules: criticalManifest.modules.map((module) => ({ ...module, chars: 300 })),
  intent: mutationIntent,
  stage: "implement",
  maxModuleChars: 1000,
});
assert.deepEqual(criticalMutation.selected.map((module) => module.id), ["critical-utf8-runtime"]);
assert.deepEqual(criticalMutation.requiredIds, ["critical-utf8-runtime"]);
assert.equal(criticalMutation.decisions[0].required, true);
assert.deepEqual(criticalMutation.decisions[0].requiredBy, ["mutation", "artifact:code"]);

const readOnlyCritical = selectProjectContextModules({
  modules: criticalManifest.modules.map((module) => ({ ...module, chars: 300 })),
  intent: structuredSkillIntentSchema.parse({
    domains: ["coding"], actions: ["review"], artifacts: ["code"], needs: [], signals: ["nominal"], risk: "read-only",
  }),
  stage: "implement",
  maxModuleChars: 1000,
});
assert.deepEqual(readOnlyCritical.selected, []);
assert.equal(readOnlyCritical.decisions[0].required, false);
assert.equal(readOnlyCritical.decisions[0].reason, "intent-mismatch");

const wrongArtifactCritical = selectProjectContextModules({
  modules: criticalManifest.modules.map((module) => ({ ...module, chars: 300 })),
  intent: structuredSkillIntentSchema.parse({
    domains: ["coding"], actions: ["edit"], artifacts: ["document"], needs: [], signals: ["nominal"], risk: "write",
  }),
  stage: "implement",
  maxModuleChars: 1000,
});
assert.deepEqual(wrongArtifactCritical.selected, []);
assert.equal(wrongArtifactCritical.decisions[0].required, false);

const stagedCriticalManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  modules: [{
    id: "critical-utf8-close-only",
    kind: "directive",
    description: "Mutation rule scoped to close only.",
    source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## UTF-8 runtime invariant"] },
    stages: ["close"],
    requiredWhen: { mutation: true, artifacts: ["code"] },
  }],
});
const wrongStageCritical = selectProjectContextModules({
  modules: stagedCriticalManifest.modules.map((module) => ({ ...module, chars: 300 })),
  intent: mutationIntent,
  stage: "implement",
  maxModuleChars: 1000,
});
assert.deepEqual(wrongStageCritical.requiredIds, []);
assert.equal(wrongStageCritical.decisions[0].required, false);
assert.equal(wrongStageCritical.decisions[0].reason, "stage-mismatch");

const invalidConditionalExclusive = projectContextManifestSchema.safeParse({
  schemaVersion: 1,
  modules: [{
    id: "invalid-conditional-exclusive",
    kind: "directive",
    description: "Invalid conditional/exclusive combination.",
    source: { path: "rule.md" },
    requiredWhen: { mutation: true },
    exclusiveGroup: "alternatives",
  }],
});
assert.equal(invalidConditionalExclusive.success, false);

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
    source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Write safety"] },
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
