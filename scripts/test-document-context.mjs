import assert from "node:assert/strict";
import {
  assembleDocumentContext,
  documentContextManifestPath,
  documentContextManifestSchema,
  structuredSkillIntentSchema,
} from "../dist/index.js";

assert.equal(documentContextManifestPath("AGENTS.md"), "AGENTS.md.context.json");

const markdown = [
  "# Repository instructions",
  "",
  "Intro that should not be loaded by the selective manifest.",
  "",
  "## Safety",
  "",
  "Never weaken verification.",
  "",
  "## Implementation",
  "",
  "Use bounded edits and verify observable writes.",
  "",
  "## Release",
  "",
  "Run the release gate and verify package-byte parity.",
  "",
  "## Long manual",
  "",
  "Deep manual payload. ".repeat(600),
].join("\n");

const manifest = documentContextManifestSchema.parse({
  schemaVersion: 1,
  sourceClass: "instruction",
  core: { sections: ["## Safety"] },
  modules: [
    {
      id: "implementation",
      description: "Implementation rules selected only for edits.",
      sections: ["## Implementation"],
      tier: "relevant",
      actions: ["edit"],
      priority: 20,
    },
    {
      id: "release",
      description: "Deep release procedure selected only for publication.",
      sections: ["## Release"],
      tier: "deep",
      actions: ["publish"],
      priority: 30,
    },
    {
      id: "long-manual",
      description: "Large optional deep manual.",
      sections: ["## Long manual"],
      tier: "deep",
      actions: ["edit"],
      priority: 1,
    },
  ],
});

const editIntent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["edit"],
  artifacts: ["code"],
  needs: ["integrity-verification"],
  signals: ["nominal"],
  risk: "write",
});

const coreOnlyPlan = assembleDocumentContext({
  markdown,
  manifest,
  stage: "start",
  maxChars: 12_000,
});
assert.equal(coreOnlyPlan.selectionMode, "core-only");
assert.equal(coreOnlyPlan.intentRequired, true);
assert.ok(coreOnlyPlan.content.includes("Never weaken verification."));
assert.equal(coreOnlyPlan.content.includes("Use bounded edits"), false);
assert.equal(coreOnlyPlan.content.includes("Run the release gate"), false);
assert.deepEqual(coreOnlyPlan.selectedModules, []);
assert.equal(coreOnlyPlan.decisions.every((item) => item.deliveryReason === "intent-required"), true);

const editPlan = assembleDocumentContext({
  markdown,
  manifest,
  intent: editIntent,
  stage: "implement",
  maxChars: 12_000,
});
assert.equal(editPlan.mode, "compact");
assert.ok(editPlan.content.includes("Never weaken verification."));
assert.ok(editPlan.content.includes("Use bounded edits"));
assert.equal(editPlan.content.includes("Run the release gate"), false);
assert.equal(editPlan.content.includes("Deep manual payload"), false);
assert.deepEqual(editPlan.selectedModules, ["implementation"]);
assert.deepEqual(editPlan.omittedModules, ["long-manual"]);
assert.equal(editPlan.decisions.find((item) => item.id === "long-manual")?.deliveryReason, "budget-exceeded");
assert.ok(editPlan.loadedChars <= 6_000, "compact mode must enforce the portable 6K document budget");
assert.ok(editPlan.estimatedCharsSaved > 0);
assert.equal(editPlan.requiredBudgetExceeded, false);

const publishIntent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["publish"],
  artifacts: ["repository"],
  needs: ["integrity-verification"],
  signals: ["nominal"],
  risk: "write",
});
const publishPlan = assembleDocumentContext({ markdown, manifest, intent: publishIntent, stage: "persist", maxChars: 12_000 });
assert.ok(publishPlan.content.includes("Never weaken verification."));
assert.ok(publishPlan.content.includes("Run the release gate"));
assert.equal(publishPlan.content.includes("Use bounded edits"), false);
assert.deepEqual(publishPlan.selectedModules, ["release"]);
assert.equal(publishPlan.decisions.find((item) => item.id === "release")?.deliveryReason, "deep-matched");

const invalidAuthority = documentContextManifestSchema.safeParse({
  schemaVersion: 1,
  sourceClass: "instruction",
  core: { sections: ["## Safety"] },
  modules: [{
    id: "implicit-authority",
    description: "Authority cannot be optional.",
    sections: ["## Release"],
    tier: "authority",
    actions: ["publish"],
  }],
});
assert.equal(invalidAuthority.success, false);

const requiredManifest = documentContextManifestSchema.parse({
  schemaVersion: 1,
  sourceClass: "documentation",
  core: { sections: ["## Safety"] },
  modules: [{
    id: "required-manual",
    description: "Explicitly required material stays visible even over compact budget.",
    sections: ["## Long manual"],
    tier: "deep",
    actions: ["edit"],
    required: true,
  }],
});
const requiredPlan = assembleDocumentContext({ markdown, manifest: requiredManifest, intent: editIntent, stage: "implement", maxChars: 4_000 });
assert.deepEqual(requiredPlan.selectedModules, ["required-manual"]);
assert.equal(requiredPlan.content.includes("Deep manual payload"), true);
assert.equal(requiredPlan.requiredBudgetExceeded, true);
assert.equal(requiredPlan.budgetExceeded, true);

console.log("document context tests passed");
