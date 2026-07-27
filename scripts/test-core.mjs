import assert from "node:assert/strict";
import fs from "node:fs";
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

const bootstrapTemplate = fs.readFileSync(new URL("../templates/AGENTS.mssr.md", import.meta.url), "utf8");
assert.match(bootstrapTemplate, /user-visible host responsive/);
assert.match(bootstrapTemplate, /roughly 8–10/);
assert.match(bootstrapTemplate, /observability-maintenance skill for every ordinary task/);

console.log("core tests passed");
