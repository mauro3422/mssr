import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assembleCodexSkillContext, planCodexSkillContexts, structuredSkillIntentSchema } from "../dist/index.js";

const intent = structuredSkillIntentSchema.parse({
  domains: ["coding"], actions: ["edit"], artifacts: ["code"], needs: [],
  signals: ["skill-gap"], risk: "write", ambiguity: "low",
});
const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-loader-"));
async function fixture(name, markdown, modules) {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  const skillPath = path.join(dir, "SKILL.md");
  await fs.writeFile(skillPath, markdown, "utf8");
  if (modules) await fs.writeFile(path.join(dir, "context-modules.json"), JSON.stringify({ schemaVersion: 1, core: { sections: ["## Core"] }, modules }), "utf8");
  return { name, description: name, source: "codex-local", path: skillPath };
}
try {
  const selective = await fixture("selective", "# Skill\n\n## Core\n\nCore.\n\n## Edit\n\nChosen once.\n", [{ id: "edit", description: "Edit guidance.", source: { sections: ["## Edit"] }, actions: ["edit"], signals: ["skill-gap"], priority: 5 }]);
  const assembled = await assembleCodexSkillContext({ skill: selective, intent, stage: "implement", mode: "selective", references: "auto", remainingChars: 10_000 });
  assert.equal(assembled.contextAssembly.manifestStatus, "loaded");
  assert.deepEqual(assembled.contextAssembly.selectedModules, ["edit"]);
  assert.equal(assembled.content.includes("Chosen once."), true);
  assert.equal(assembled.content.match(/Chosen once\./g)?.length, 1);

  const coreOnly = await assembleCodexSkillContext({ skill: selective, intent, stage: "implement", mode: "selective", references: "none", remainingChars: 10_000 });
  assert.deepEqual(coreOnly.contextAssembly.selectedModules, []);
  assert.equal(coreOnly.content.includes("Chosen once."), false);

  const full = await assembleCodexSkillContext({ skill: selective, intent, stage: "implement", mode: "full", references: "auto", remainingChars: 10_000 });
  assert.equal(full.content, await fs.readFile(selective.path, "utf8"));

  const fallback = await fixture("fallback", "# Fallback\n", null);
  const fallbackResult = await assembleCodexSkillContext({ skill: fallback, intent, stage: "implement", mode: "selective", references: "auto", remainingChars: 10_000 });
  assert.equal(fallbackResult.contextAssembly.fallbackFull, true);

  const first = await fixture("first", `# First\n\n## Core\n\nOne.\n\n## Low\n\n${"low ".repeat(200)}`, [{ id: "low", description: "Low", source: { sections: ["## Low"] }, actions: ["edit"], signals: ["skill-gap"], priority: 1 }]);
  const second = await fixture("second", `# Second\n\n## Core\n\nTwo.\n\n## High\n\n${"high ".repeat(80)}`, [{ id: "high", description: "High", source: { sections: ["## High"] }, actions: ["edit"], signals: ["skill-gap"], priority: 90 }]);
  const all = await planCodexSkillContexts({ skills: [{ skill: first, required: true, routeIndex: 0, routeScore: 50 }, { skill: second, required: true, routeIndex: 1, routeScore: 1 }], intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 50_000 });
  const requiredCores = all.skills.reduce((sum, item) => sum + item.contextAssembly.coreCharsLoaded, 0);
  const highChars = all.skills.find((item) => item.skill.name === "second").contextAssembly.moduleDecisions.find((item) => item.id === "high").chars;
  const constrained = await planCodexSkillContexts({ skills: [{ skill: first, required: true, routeIndex: 0, routeScore: 50 }, { skill: second, required: true, routeIndex: 1, routeScore: 1 }], intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: requiredCores + highChars + 4 });
  assert.deepEqual(constrained.skills.find((item) => item.skill.name === "second").contextAssembly.selectedModules, ["high"]);
  assert.deepEqual(constrained.skills.find((item) => item.skill.name === "first").contextAssembly.selectedModules, []);
  assert.equal(constrained.optionalContextOmitted, true);

  const unsafe = await fixture("unsafe", "# Unsafe\n\n## Core\n\nCore.\n", [{ id: "escape", description: "Escape", source: { path: "../secret.md" }, actions: ["edit"], signals: ["skill-gap"] }]);
  await assert.rejects(() => assembleCodexSkillContext({ skill: unsafe, intent, stage: "implement", mode: "selective", references: "auto", remainingChars: 10_000 }), /escapes its skill directory/);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
console.log("skill-context-loader: ok");
