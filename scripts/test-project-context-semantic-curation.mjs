import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyMssrProjectContextReferencePlan,
  planMssrProjectContextReferenceSplit,
} from "../dist/project-context-semantic-curation.js";
import { loadProjectContextModules } from "../dist/project-context-loader.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-ref-plan-"));
const projectRoot = path.join(root, "project");
const stateRoot = path.join(root, "state");
const sourceRef = ".mssr/knowledge/phase/current-phase.md";
const sourcePath = path.join(projectRoot, ".mssr", "knowledge", "phase", "current-phase.md");

const fakeProvider = {
  async curate({ blocks }) {
    return {
      schemaVersion: 1,
      provider: "test-jev",
      modelId: "jev-fixture",
      blockJudgments: blocks.map((block) => {
        const current = /^## Current\b/.test(block.text);
        const alpha = /^## Historical Alpha\b/.test(block.text);
        return {
          blockId: block.id,
          role: { value: current ? "current-state" : "history", confidence: 0.99 },
          destination: { value: current ? "state" : "knowledge-ref", confidence: 0.99 },
          protectedProbability: current ? 0.99 : 0.01,
          topic: { value: current ? "phase" : alpha ? "reference" : "operations", confidence: current || alpha ? 0.4 : 0.99 },
        };
      }),
      pairJudgments: [],
    };
  },
};

const intent = (summary) => ({
  summary,
  domains: ["coding"],
  actions: ["recover"],
  artifacts: [],
  needs: ["history-recovery"],
  signals: [],
  risk: "read-only",
  ambiguity: "low",
});

try {
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  const currentSection = `## Current\n\n${"Current verified state stays in the baseline. ".repeat(14)}\n\n`;
  const alphaSection = `## Historical Alpha\n\n${"Alpha migration evidence and prior gate history. ".repeat(22)}\n\n`;
  const runtimeSection = `## Runtime Archive\n\n${"Older runtime diagnostics retained for selective recovery. ".repeat(18)}\n\n`;
  const historicalInvariantSection = `## Derived invariants and reviewed-current receipts (0.2.41-0.2.43)\n\n${"Historical invariant evidence from superseded releases. ".repeat(10)}\n`;
  const source = `# Current Phase\n\n${currentSection}${alphaSection}${runtimeSection}${historicalInvariantSection}`;
  assert.ok(Buffer.byteLength(source, "utf8") > 1_800);
  await fs.writeFile(sourcePath, source, "utf8");
  await fs.writeFile(path.join(projectRoot, ".mssr", "project-context.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "project-current-phase",
      kind: "state",
      topic: "phase",
      description: "Current phase baseline with historical detail that should become selective refs.",
      source: { path: sourceRef },
      domains: ["coding"],
      actions: ["recover"],
      needs: ["history-recovery"],
      priority: 20,
      maxChars: 2400,
    }],
  }, null, 2)}\n`, "utf8");

  const plan = await planMssrProjectContextReferenceSplit({
    projectRoot,
    moduleId: "project-current-phase",
    provider: fakeProvider,
    persist: true,
    stateRoot,
  });
  assert.equal(plan.status, "auto-safe");
  assert.equal(plan.moves.length, 3);
  assert.equal(plan.decisions.length, 4);
  const currentDecision = plan.decisions.find((item) => item.heading === "## Current");
  const historicalDecision = plan.decisions.find((item) => item.heading === "## Historical Alpha");
  const historicalInvariantDecision = plan.decisions.find((item) => item.heading === "## Derived invariants and reviewed-current receipts (0.2.41-0.2.43)");
  assert.equal(currentDecision?.action, "keep");
  assert.equal(currentDecision?.protectedHeading, true);
  assert.equal(currentDecision?.reasons.includes("current-state-role"), true);
  assert.equal(historicalDecision?.action, "move");
  assert.equal(historicalDecision?.destination.value, "knowledge-ref");
  assert.equal(historicalDecision?.role.value, "history");
  assert.equal(historicalDecision?.reasons.includes("low-topic-confidence"), true);
  assert.equal(historicalDecision?.reasons.includes("topic-fallback:reference"), true);
  assert.equal(historicalInvariantDecision?.action, "move");
  assert.equal(historicalInvariantDecision?.protectedHeading, false);
  assert.deepEqual(plan.keptHeadings, ["## Current"]);
  assert.equal(plan.reviewReasons.length, 0);
  assert.equal(plan.exactSourceTextOnly, true);
  assert.ok(plan.projected.baselineBytes < plan.sourceBytes);
  assert.ok(plan.projected.worstSelectedBytes <= plan.maxChars);
  const experienceStorePath = path.join(stateRoot, "semantic-experience", "observations-v1.json");
  const experienceStore = JSON.parse(await fs.readFile(experienceStorePath, "utf8"));
  assert.equal(experienceStore.observations.length, 8, "Ref-split should emit document-role + placement shadows for each semantic decision");
  assert.equal(experienceStore.observations.filter((item) => item.decisionKind === "document-role").length, 4);
  assert.equal(experienceStore.observations.filter((item) => item.decisionKind === "placement").length, 4);
  assert.ok(experienceStore.observations.every((item) => item.verification.status === "unknown"));
  assert.ok(experienceStore.observations.every((item) => item.authorityInfluence === false && item.autoApplyAllowed === false));
  assert.ok(experienceStore.observations.every((item) => !JSON.stringify(item).includes("Historical detail alpha")));

  await assert.rejects(
    () => applyMssrProjectContextReferencePlan({ planId: plan.planId, confirmPlanId: "wrong-plan", stateRoot }),
    /confirmPlanId/,
  );

  await fs.appendFile(sourcePath, "\n", "utf8");
  await assert.rejects(
    () => applyMssrProjectContextReferencePlan({ planId: plan.planId, confirmPlanId: plan.planId, stateRoot }),
    /stale.*SHA-256/i,
  );
  await fs.writeFile(sourcePath, source, "utf8");

  const applied = await applyMssrProjectContextReferencePlan({ planId: plan.planId, confirmPlanId: plan.planId, stateRoot });
  assert.equal(applied.applied, true);
  assert.equal(applied.referenceFiles.length, 3);

  const compacted = await fs.readFile(sourcePath, "utf8");
  assert.match(compacted, /## Current/);
  assert.doesNotMatch(compacted, /## Historical Alpha/);
  assert.doesNotMatch(compacted, /## Runtime Archive/);
  assert.doesNotMatch(compacted, /## Derived invariants and reviewed-current receipts/);
  assert.equal(compacted.includes(currentSection), true);

  const sidecar = JSON.parse(await fs.readFile(path.join(projectRoot, ".mssr", "project-context-refs.json"), "utf8"));
  assert.equal(sidecar.modules.length, 1);
  assert.equal(sidecar.modules[0].moduleId, "project-current-phase");
  assert.equal(sidecar.modules[0].references.length, 3);

  const alphaMove = plan.moves.find((move) => move.heading === "## Historical Alpha");
  const runtimeMove = plan.moves.find((move) => move.heading === "## Runtime Archive");
  const historicalInvariantMove = plan.moves.find((move) => move.heading === "## Derived invariants and reviewed-current receipts (0.2.41-0.2.43)");
  assert.ok(alphaMove && runtimeMove && historicalInvariantMove);
  assert.equal(await fs.readFile(path.join(projectRoot, alphaMove.targetRef), "utf8"), alphaSection);
  assert.equal(await fs.readFile(path.join(projectRoot, runtimeMove.targetRef), "utf8"), runtimeSection);
  assert.equal(await fs.readFile(path.join(projectRoot, historicalInvariantMove.targetRef), "utf8"), historicalInvariantSection);

  const alphaLoaded = await loadProjectContextModules({ projectRoot, intent: intent("Recover historical alpha evidence"), stage: "implement", includeCore: false });
  assert.equal(alphaLoaded.selected.length, 1);
  assert.match(alphaLoaded.selected[0].content, /## Current/);
  assert.match(alphaLoaded.selected[0].content, /## Historical Alpha/);
  assert.doesNotMatch(alphaLoaded.selected[0].content, /## Runtime Archive/);

  const runtimeLoaded = await loadProjectContextModules({ projectRoot, intent: intent("Recover runtime archive diagnostics"), stage: "implement", includeCore: false });
  assert.match(runtimeLoaded.selected[0].content, /## Current/);
  assert.match(runtimeLoaded.selected[0].content, /## Runtime Archive/);
  assert.doesNotMatch(runtimeLoaded.selected[0].content, /## Historical Alpha/);

  const tinyRoot = path.join(root, "tiny");
  await fs.mkdir(path.join(tinyRoot, ".mssr", "knowledge"), { recursive: true });
  await fs.writeFile(path.join(tinyRoot, ".mssr", "knowledge", "tiny.md"), `# Tiny\n\n## Current\n\n${"Only one pressured section. ".repeat(9)}\n`, "utf8");
  await fs.writeFile(path.join(tinyRoot, ".mssr", "project-context.json"), JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{ id: "tiny-module", kind: "memory", description: "Tiny fixture.", source: { path: ".mssr/knowledge/tiny.md" }, maxChars: 200 }],
  }), "utf8");
  const tiny = await planMssrProjectContextReferenceSplit({ projectRoot: tinyRoot, moduleId: "tiny-module", provider: fakeProvider, persist: false });
  assert.equal(tiny.status, "review-required");
  assert.equal(tiny.reviewReasons.includes("insufficient-safe-markdown-sections"), true);
  assert.equal(tiny.jev.used, false);

  console.log("project-context semantic curation tests passed");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
