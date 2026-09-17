import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  evaluateProjectContextEntryBudget,
  preflightMssrProjectContextWrite,
} from "../dist/project-context-budget.js";
import { auditMssrProjectContextHealth } from "../dist/project-context-health.js";
import { MAX_PROJECT_CONTEXT_CHARS, MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES } from "../dist/project-context-loader.js";
import { planMssrProjectContextModularization } from "../dist/project-context-modularization.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-context-budget-"));
const modulePath = path.join(root, ".mssr", "knowledge", "architecture", "budgeted.md");

try {
  const watch = evaluateProjectContextEntryBudget({
    entryId: "budgeted-module", core: false, sourcePath: ".mssr/knowledge/architecture/budgeted.md", selectedBytes: 1650, maxChars: 2200,
  });
  assert.equal(watch.level, "watch");
  assert.equal(watch.exceeded, false);

  const review = evaluateProjectContextEntryBudget({
    entryId: "budgeted-module", core: false, sourcePath: ".mssr/knowledge/architecture/budgeted.md", selectedBytes: 1980, maxChars: 2200,
  });
  assert.equal(review.level, "review");
  assert.deepEqual(review.recommendedSkills, ["skill-maintenance-loop"]);

  const exceeded = evaluateProjectContextEntryBudget({
    entryId: "budgeted-module", core: false, sourcePath: ".mssr/knowledge/architecture/budgeted.md", selectedBytes: 2201, maxChars: 2200,
  });
  assert.equal(exceeded.level, "review");
  assert.equal(exceeded.exceeded, true);

  await fs.mkdir(path.dirname(modulePath), { recursive: true });
  await fs.writeFile(path.join(root, ".mssr", "PROJECT_CONTEXT.md"), "# Context\n\n## Core\n\nStable.\n", "utf8");
  await fs.writeFile(modulePath, `# Budgeted\n\n## Stable invariant\n\n${"a".repeat(1200)}\n\n## Operational detail\n\n${"b".repeat(500)}\n`, "utf8");
  await fs.writeFile(path.join(root, ".mssr", "project-context.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: [{
      id: "core-context",
      kind: "context",
      description: "Compact core.",
      source: { path: ".mssr/PROJECT_CONTEXT.md", sections: ["## Core"] },
      maxChars: 1000,
    }],
    modules: [{
      id: "budgeted-module",
      kind: "context",
      description: "Budgeted architecture module.",
      source: { path: ".mssr/knowledge/architecture/budgeted.md" },
      topic: "architecture",
      area: "budget",
      maxChars: 2200,
    }],
  }, null, 2)}\n`, "utf8");

  const health = await auditMssrProjectContextHealth(root);
  const pressure = health.findings.find((finding) => finding.target === "budgeted-module" && finding.code === "module-entry-budget-pressure");
  assert.ok(pressure, "health should use the declared 2200-byte entry budget instead of coarse global thresholds");
  assert.equal(pressure.level, "watch");
  assert.equal(pressure.budget?.budgetBytes, 2200);
  assert.equal(pressure.recommendation, "REVIEW_MODULE_SPLIT");

  const plan = await planMssrProjectContextModularization(root);
  const budgetInspection = plan.authoritySections.find((item) => item.authority === ".mssr/knowledge/architecture/budgeted.md");
  assert.ok(budgetInspection, "whole-file budget pressure should expose section-level split guidance");
  assert.equal(budgetInspection.pressureSource, "entry-budget");
  assert.equal(budgetInspection.requiresSelectorReview, true);
  assert.equal(budgetInspection.largestSections.some((item) => item.recommendation === "REVIEW_FOR_MODULE_SPLIT"), true);
  assert.equal(plan.candidates.some((item) => item.entryId === "budgeted-module"), false, "whole-file module split must remain reviewed rather than auto-proposed as an exact indexed move");

  const projectedReviewText = `# Budgeted\n\n${"b".repeat(2000)}\n`;
  const preflightReview = await preflightMssrProjectContextWrite({ projectRoot: root, targetPath: modulePath, nextText: projectedReviewText });
  assert.equal(preflightReview.level, "review");
  assert.equal(preflightReview.contractValid, false, "growth into REVIEW must be blocked before the write lands");
  assert.equal(preflightReview.replanBeforeWrite, true);
  assert.equal(preflightReview.maintenanceRequiredBeforeWrite, true);
  assert.deepEqual(preflightReview.growthBlockedEntries, ["budgeted-module"]);
  assert.equal(preflightReview.recommendedAction, "mssr_project_maintain");
  assert.deepEqual(preflightReview.recommendedSkills, ["skill-maintenance-loop"]);

  const projectedShrinkText = `# Budgeted\n\n${"s".repeat(1000)}\n`;
  const preflightShrink = await preflightMssrProjectContextWrite({ projectRoot: root, targetPath: modulePath, nextText: projectedShrinkText });
  assert.equal(preflightShrink.contractValid, true, "shrinking a pressured module must remain allowed");
  assert.equal(preflightShrink.maintenanceRequiredBeforeWrite, false);

  const projectedOverflowText = `# Budgeted\n\n${"c".repeat(2300)}\n`;
  const preflightOverflow = await preflightMssrProjectContextWrite({ projectRoot: root, targetPath: modulePath, nextText: projectedOverflowText });
  assert.equal(preflightOverflow.contractValid, false);
  assert.equal(preflightOverflow.affectedEntries[0]?.exceeded, true);

  const unrelated = await preflightMssrProjectContextWrite({ projectRoot: root, targetPath: path.join(root, "README.md"), nextText: "# Unrelated\n" });
  assert.equal(unrelated.affectedEntries.length, 0);
  assert.equal(unrelated.level, "ok");

  const before = await fs.readFile(modulePath, "utf8");
  await preflightMssrProjectContextWrite({ projectRoot: root, targetPath: modulePath, nextText: projectedOverflowText });
  assert.equal(await fs.readFile(modulePath, "utf8"), before, "preflight must never mutate the proposed target");

  // Segmented history is budgeted by the worst payload MSSR can deliver in one selection:
  // baseline + largest optional segment, not by the entire backing history file.
  const segmentedRepo = path.join(root, "segmented-repo");
  const segmentedPath = path.join(segmentedRepo, ".mssr", "knowledge", "history.md");
  await fs.mkdir(path.dirname(segmentedPath), { recursive: true });
  const segmentedText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(500)}\n\n## Beta\n${"c".repeat(400)}\n`;
  await fs.writeFile(segmentedPath, segmentedText, "utf8");
  await fs.writeFile(path.join(segmentedRepo, ".mssr", "project-context.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "segmented-history",
      kind: "memory",
      description: "On-demand segmented history.",
      source: { path: ".mssr/knowledge/history.md" },
      maxChars: 1000,
    }],
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(segmentedRepo, ".mssr", "project-context-segments.json"), `${JSON.stringify({
    schemaVersion: 1,
    modules: [{
      moduleId: "segmented-history",
      segments: [
        { id: "baseline", sections: ["## Baseline"], baseline: true },
        { id: "alpha", sections: ["## Alpha"], terms: ["alpha"] },
        { id: "beta", sections: ["## Beta"], terms: ["beta"] },
      ],
    }],
  }, null, 2)}\n`, "utf8");
  const segmentedHealth = await auditMssrProjectContextHealth(segmentedRepo);
  assert.equal(segmentedHealth.findings.some((finding) => finding.target === "segmented-history" && finding.code === "module-entry-budget-pressure"), false);
  assert.equal(segmentedHealth.findings.some((finding) => finding.target === "segmented-history" && finding.code === "whole-file-module"), false);

  const grownSegmentedText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(850)}\n\n## Beta\n${"c".repeat(400)}\n`;
  const segmentedPreflight = await preflightMssrProjectContextWrite({ projectRoot: segmentedRepo, targetPath: segmentedPath, nextText: grownSegmentedText });
  assert.equal(segmentedPreflight.level, "review");
  assert.equal(segmentedPreflight.contractValid, false);
  assert.deepEqual(segmentedPreflight.growthBlockedEntries, ["segmented-history"]);

  // Selected-payload and physical-source pressure are separate contracts. A large
  // unselected archive must not inflate the semantic payload, but growth into the
  // physical REVIEW band is blocked before persistence so the source never hits a
  // surprise loader cliff.
  const physicalReviewText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(500)}\n\n## Beta\n${"c".repeat(400)}\n\n## Archive\n${"p".repeat(Math.ceil(MAX_PROJECT_CONTEXT_CHARS * 0.91))}\n`;
  const physicalReviewPreflight = await preflightMssrProjectContextWrite({ projectRoot: segmentedRepo, targetPath: segmentedPath, nextText: physicalReviewText });
  assert.equal(physicalReviewPreflight.affectedEntries[0]?.level, "ok", "semantic payload should remain below its own maxChars");
  assert.equal(physicalReviewPreflight.physicalSources[0]?.level, "review");
  assert.equal(physicalReviewPreflight.physicalSources[0]?.exceededBudget, false);
  assert.equal(physicalReviewPreflight.contractValid, false, "physical growth into REVIEW must be blocked before persistence");
  assert.deepEqual(physicalReviewPreflight.growthBlockedEntries, ["segmented-history"]);

  const recoverableOversizeText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(500)}\n\n## Beta\n${"c".repeat(400)}\n\n## Archive\n${"o".repeat(MAX_PROJECT_CONTEXT_CHARS + 1_024)}\n`;
  assert.ok(Buffer.byteLength(recoverableOversizeText, "utf8") < MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES);
  await fs.writeFile(segmentedPath, recoverableOversizeText, "utf8");
  const recoverableHealth = await auditMssrProjectContextHealth(segmentedRepo);
  assert.equal(recoverableHealth.findings.some((finding) => finding.target === "segmented-history" && finding.code === "segmented-source-budget-exceeded"), true);
  assert.equal(recoverableHealth.findings.some((finding) => finding.code === "invalid-segment-contract"), false, "recoverable physical pressure must remain diagnosable rather than appearing corrupt");

  const physicalShrinkText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(500)}\n\n## Beta\n${"c".repeat(400)}\n\n## Archive\n${"s".repeat(20_000)}\n`;
  const physicalShrink = await preflightMssrProjectContextWrite({ projectRoot: segmentedRepo, targetPath: segmentedPath, nextText: physicalShrinkText });
  assert.equal(physicalShrink.contractValid, true, "shrinking a physically pressured segmented source must remain allowed");
  assert.equal(physicalShrink.maintenanceRequiredBeforeWrite, false);

  const hardLimitText = `# History\n\n## Baseline\n${"b".repeat(100)}\n\n## Alpha\n${"a".repeat(500)}\n\n## Beta\n${"c".repeat(400)}\n\n## Archive\n${"h".repeat(MAX_SEGMENTED_PROJECT_CONTEXT_SOURCE_BYTES + 1)}\n`;
  const hardLimitPreflight = await preflightMssrProjectContextWrite({ projectRoot: segmentedRepo, targetPath: segmentedPath, nextText: hardLimitText });
  assert.equal(hardLimitPreflight.physicalSources[0]?.exceededHardLimit, true);
  assert.equal(hardLimitPreflight.contractValid, false);
  assert.deepEqual(hardLimitPreflight.growthBlockedEntries, ["segmented-history"]);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project context budget preflight tests PASS");
