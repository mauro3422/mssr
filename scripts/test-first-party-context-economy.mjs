import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planSkillContextPage, structuredSkillIntentSchema } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const measureOnly = process.argv.includes("--measure");
const sourceArg = process.argv.find((arg) => arg.startsWith("--skill-root="));
const skillRoot = sourceArg ? path.resolve(sourceArg.slice("--skill-root=".length)) : path.join(root, "skills");
const fixture = JSON.parse(await fs.readFile(path.join(root, "config/skill-routing/first-party-context-fixtures.json"), "utf8"));
assert.equal(fixture.schemaVersion, 1);
const cases = fixture.cases;
assert.ok(cases.length > 0 && new Set(cases.map((item) => item.id)).size === cases.length);

const results = [];
for (const testCase of cases) {
  const page = await planSkillContextPage({
    skills: testCase.names.map((name, routeIndex) => ({
      skill: { name, description: "First-party context contract", source: "mssr-first-party", path: path.join(skillRoot, name, "SKILL.md") },
      obligation: "required", routeIndex, routeScore: 100,
    })),
    intent: structuredSkillIntentSchema.parse({ domains: ["skill-system", "agent-orchestration"],
      actions: testCase.actions, artifacts: testCase.artifacts, needs: [], signals: testCase.signals,
      risk: "read-only", ambiguity: "low" }),
    stage: testCase.stage, mode: "selective", references: "auto", maxContextChars: 100_000,
  });
  const modules = page.skills.flatMap((entry) => entry.contextAssembly.selectedModules);
  const chars = page.skills.reduce((sum, entry) => sum + entry.contextAssembly.totalCharsLoaded, 0);
  results.push({ id: testCase.id, chars, modules });
  if (measureOnly) continue;
  assert.equal(page.status, "complete", `${testCase.id}: all selected guidance must be measurable`);
  if (testCase.maxChars) {
    assert.ok(chars <= testCase.maxChars, `${testCase.id}: ${chars} chars exceeds ${testCase.maxChars}`);
    const bounded = await planSkillContextPage({
      skills: testCase.names.map((name, routeIndex) => ({
        skill: { name, description: "Bounded context regression", source: "mssr-first-party", path: path.join(skillRoot, name, "SKILL.md") },
        obligation: "required", routeIndex, routeScore: 100,
      })),
      intent: structuredSkillIntentSchema.parse({ domains: ["skill-system", "agent-orchestration"],
        actions: testCase.actions, artifacts: testCase.artifacts, needs: [], signals: testCase.signals,
        risk: "read-only", ambiguity: "low" }),
      stage: testCase.stage, mode: "selective", references: "auto", maxContextChars: testCase.maxChars,
    });
    assert.equal(bounded.status, "complete", `${testCase.id}: must fit a single procedural page`);
    assert.equal(bounded.blocked.length, 0);
  }
  for (const id of testCase.includes ?? []) assert.ok(modules.includes(id), `${testCase.id}: missing ${id}`);
  for (const id of testCase.excludes ?? []) assert.ok(!modules.includes(id), `${testCase.id}: unexpected ${id}`);
}

if (!measureOnly) {
  const promotion = await fs.readFile(path.join(skillRoot, "skill-maintenance-loop/references/learning-review-promotion.md"), "utf8");
  for (const invariant of ["no-learning-change", "insufficient-evidence", "proposal-ready", "datasetAudit", "replayHoldout", "calibration", "shadow", "featureFlagRollback", "routingInfluence=false", "automaticPromotionPerformed=false"])
    assert.ok(promotion.includes(invariant), `compact review must preserve ${invariant}`);
  const close = await fs.readFile(path.join(skillRoot, "mssr-agent-routing/references/context-and-lifecycle.md"), "utf8");
  assert.ok(close.indexOf("phase_completed") >= 0 && close.indexOf("phase_completed") < close.indexOf("eventType=outcome"), "close guidance must record phase completion before outcome");
  assert.ok(close.includes("completedPhases") && close.includes("maintenance"), "close guidance must name the required phase evidence");
}
console.log(JSON.stringify({ kind: "deterministic-context-economy", measuresAgentQuality: false, results }, null, 2));
if (!measureOnly) console.log("first-party context economy tests passed");
