import assert from "node:assert/strict";
import { canonicalizeSkillEntries, planSkillRoute, structuredSkillIntentSchema } from "../dist/index.js";

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
console.log("core tests passed");
