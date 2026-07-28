import assert from "node:assert/strict";
import fs from "node:fs";
import { selectSkillContextModules, skillContextManifestSchema, structuredSkillIntentSchema } from "../dist/index.js";

const fixturePath = new URL("../config/skill-context/skill-context-fixtures.json", import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.schemaVersion, 1);

for (const testCase of fixture.cases) {
  const intent = structuredSkillIntentSchema.parse(testCase.intent);
  const modules = testCase.modules.map(({ chars, ...module }) => ({
    ...skillContextManifestSchema.parse({ schemaVersion: 1, core: { sections: ["## Core"] }, modules: [module] }).modules[0],
    chars,
  }));
  const result = selectSkillContextModules({
    modules,
    intent,
    stage: testCase.stage,
    maxModuleChars: testCase.maxModuleChars,
  });
  if (testCase.expectAmbiguousGroups) {
    assert.deepEqual(
      result.ambiguousGroups.map(({ group, candidates }) => ({ group, candidates })),
      testCase.expectAmbiguousGroups,
      `${testCase.id}: ambiguous groups`,
    );
  }
  assert.deepEqual(result.selected.map((module) => module.id), testCase.expectSelected, `${testCase.id}: selected modules`);
  for (const [id, expectedReason] of Object.entries(testCase.expectReasons ?? {})) {
    assert.equal(result.decisions.find((decision) => decision.id === id)?.reason, expectedReason, `${testCase.id}: reason for ${id}`);
  }
}

console.log(`skill context fixtures passed: ${fixture.cases.length}/${fixture.cases.length}`);
