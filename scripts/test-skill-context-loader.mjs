import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assembleCodexSkillContext, continueSkillContextPage, planCodexSkillContexts, planSkillContextPage, structuredSkillIntentSchema } from "../dist/index.js";

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
  assert.equal(constrained.optionalContextOmitted, false, "selected context must be deferred explicitly instead of silently omitted");

  // Regression: 23,310 selected required-core characters must page under an
  // 18,000-character delivery budget, with every unit delivered exactly once.
  const pagingA = await fixture("paging-a", "# A\n\n## Core\n\n", []);
  const pagingB = await fixture("paging-b", "# B\n\n## Core\n\n", []);
  const pagingC = await fixture("paging-c", "# C\n\n## Core\n\n", []);
  const pagingSkills = [pagingA, pagingB, pagingC].map((skill, routeIndex) => ({ skill, obligation: "required", routeIndex, routeScore: 10 - routeIndex }));
  const seed = await planSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 50_000 });
  const coreOverhead = seed.skills.reduce((sum, item) => sum + item.contextAssembly.coreCharsLoaded, 0);
  const payload = 23_310 - coreOverhead;
  assert.ok(payload > 0);
  const pieces = [7_700, 7_700, payload - 15_400];
  for (const [index, item] of [pagingA, pagingB, pagingC].entries()) {
    await fs.writeFile(item.path, `# ${"ABC"[index]}\n\n## Core\n\n${"x".repeat(pieces[index])}`, "utf8");
  }
  const measured = await planSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 50_000 });
  const correction = 23_310 - measured.requiredCoreReservedChars;
  assert.ok(pieces[2] + correction > 0);
  pieces[2] += correction;
  await fs.writeFile(pagingC.path, `# C\n\n## Core\n\n${"x".repeat(pieces[2])}`, "utf8");
  const firstPage = await planSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 18_000 });
  assert.equal(firstPage.requiredCoreReservedChars, 23_310);
  assert.equal(firstPage.status, "partial");
  assert.equal(firstPage.mustContinue, true);
  assert.ok(firstPage.cursor);
  assert.ok(firstPage.deliveredChars <= 18_000);
  assert.ok(firstPage.remaining.required.length > 0);
  const secondPage = await continueSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 18_000, cursor: firstPage.cursor });
  assert.equal(secondPage.status, "complete");
  assert.equal(secondPage.mustContinue, false);
  const deliveredIds = [...firstPage.units, ...secondPage.units].map((unit) => unit.id);
  assert.equal(new Set(deliveredIds).size, deliveredIds.length, "a continued page must not replay selected units");
  assert.deepEqual(deliveredIds.sort(), ["paging-a:core", "paging-b:core", "paging-c:core"].sort());

  const tampered = `${firstPage.cursor.slice(0, -1)}${firstPage.cursor.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => continueSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 18_000, cursor: tampered }), /cursor/i);
  await fs.appendFile(pagingC.path, "changed", "utf8");
  await assert.rejects(() => continueSkillContextPage({ skills: pagingSkills, intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 18_000, cursor: firstPage.cursor }), /Stale skill context cursor/);

  const oversized = await fixture("oversized", `# Oversized\n\n## Core\n\n${"x".repeat(4_500)}`, []);
  const blocked = await planSkillContextPage({ skills: [{ skill: oversized, obligation: "required", routeIndex: 0, routeScore: 1 }], intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 4_000 });
  assert.equal(blocked.status, "partial");
  assert.equal(blocked.mustContinue, true);
  assert.equal(blocked.cursor, undefined, "an indivisible oversize unit must not produce a non-progressing cursor");
  assert.deepEqual(blocked.blocked.map((unit) => unit.id), ["oversized:core"]);
  assert.equal(blocked.requiredBudgetExceeded, true);

  // A selected module whose material is already in its skill core must not
  // consume a second unit or be emitted again on any continuation page.
  const dedupe = await fixture("dedupe", "# Dedup\n\n## Core\n\nCore guidance.\n\n## Repeated\n\nRepeated procedure.\n", [{ id: "repeated-procedure", description: "Repeated procedure", source: { sections: ["## Repeated"] }, actions: ["edit"], signals: ["skill-gap"] }]);
  await fs.writeFile(path.join(path.dirname(dedupe.path), "context-modules.json"), JSON.stringify({
    schemaVersion: 1,
    core: { sections: ["# Dedup"] },
    modules: [{ id: "repeated-procedure", description: "Repeated procedure", source: { sections: ["## Repeated"] }, actions: ["edit"], signals: ["skill-gap"] }],
  }), "utf8");
  const deduped = await planSkillContextPage({ skills: [{ skill: dedupe, obligation: "required", routeIndex: 0, routeScore: 1 }], intent, stage: "implement", mode: "selective", references: "auto", maxContextChars: 10_000 });
  assert.equal(deduped.status, "complete");
  assert.deepEqual(deduped.units.map((unit) => unit.id), ["dedupe:core"]);
  assert.ok(deduped.duplicateCharsAvoided > 0);
  assert.equal(deduped.skills[0].content.match(/Repeated procedure\./g)?.length, 1);
  assert.equal(deduped.skills[0].contextAssembly.moduleDecisions.find((item) => item.id === "repeated-procedure")?.reason, "already-covered-by-loaded-context");

  const unsafe = await fixture("unsafe", "# Unsafe\n\n## Core\n\nCore.\n", [{ id: "escape", description: "Escape", source: { path: "../secret.md" }, actions: ["edit"], signals: ["skill-gap"] }]);
  await assert.rejects(() => assembleCodexSkillContext({ skill: unsafe, intent, stage: "implement", mode: "selective", references: "auto", remainingChars: 10_000 }), /escapes its skill directory/);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
console.log("skill-context-loader: ok");
