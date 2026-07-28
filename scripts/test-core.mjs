import assert from "node:assert/strict";
import fs from "node:fs";
import { canonicalizeSkillEntries, planSkillRoute, selectSkillContextModules, skillContextManifestSchema, structuredSkillIntentSchema } from "../dist/index.js";

const entries = canonicalizeSkillEntries([
  { name: "alpha", description: "Create code", source: "codex-local" },
  { name: "alpha", description: "Old copy", source: "codex-plugin" },
]);
assert.equal(entries.entries.length, 1);
assert.equal(entries.entries[0].source, "codex-local");
const intent = structuredSkillIntentSchema.parse({ domains: ["coding"], actions: ["create"], signals: ["nominal"] });
const route = await planSkillRoute({ task: "Create code", skills: entries.entries, intent });
assert.equal(route.classificationMode, "structured-semantic");
assert.equal(route.canReplan, true);
assert.equal(route.permissionInvariant.includes("never grants"), true);

const contextManifest = skillContextManifestSchema.parse({
  schemaVersion: 1,
  core: { sections: ["## Core"] },
  modules: [
    {
      id: "routing-recovery",
      description: "Recovery procedure for routing gaps.",
      source: { path: "references/routing-recovery.md" },
      stages: ["start", "implement"],
      domains: ["skill-system"],
      actions: ["debug"],
      signals: ["skill-gap"],
      priority: 20,
    },
    {
      id: "visual-only",
      description: "Visual review procedure.",
      source: { path: "references/visual.md" },
      domains: ["roblox"],
      actions: ["review"],
      signals: ["nominal"],
    },
    {
      id: "required-contract",
      description: "Always-on contract for this phase.",
      source: { sections: ["## Required"] },
      stages: ["start"],
      required: true,
      priority: 100,
    },
  ],
});
const contextIntent = structuredSkillIntentSchema.parse({
  domains: ["skill-system"],
  actions: ["debug"],
  artifacts: ["skill"],
  needs: ["integrity-verification"],
  signals: ["skill-gap"],
});
const contextSelection = selectSkillContextModules({
  modules: contextManifest.modules.map((module, index) => ({ ...module, chars: index === 2 ? 300 : 500 })),
  intent: contextIntent,
  stage: "start",
  maxModuleChars: 700,
});
assert.deepEqual(contextSelection.selected.map((module) => module.id), ["required-contract"]);
assert.equal(contextSelection.decisions.find((item) => item.id === "routing-recovery")?.reason, "budget-exceeded");
assert.equal(contextSelection.decisions.find((item) => item.id === "visual-only")?.reason, "intent-mismatch");
const roomySelection = selectSkillContextModules({
  modules: contextManifest.modules.map((module, index) => ({ ...module, chars: index === 2 ? 300 : 500 })),
  intent: contextIntent,
  stage: "start",
  maxModuleChars: 900,
});
assert.deepEqual(roomySelection.selected.map((module) => module.id), ["required-contract", "routing-recovery"]);

const bootstrapTemplate = fs.readFileSync(new URL("../templates/AGENTS.mssr.md", import.meta.url), "utf8");
assert.match(bootstrapTemplate, /user-visible host responsive/);
assert.match(bootstrapTemplate, /roughly 8–10/);
assert.match(bootstrapTemplate, /observability-maintenance skill for every ordinary task/);

console.log("core tests passed");
