import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  evaluateProjectContextEntryBudget,
  preflightMssrProjectContextWrite,
} from "../dist/project-context-budget.js";
import { auditMssrProjectContextHealth } from "../dist/project-context-health.js";
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
  assert.equal(preflightReview.contractValid, true);
  assert.equal(preflightReview.replanBeforeWrite, true);
  assert.equal(preflightReview.recommendedAction, "project_context_modularization_plan");
  assert.deepEqual(preflightReview.recommendedSkills, ["skill-maintenance-loop"]);

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
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project context budget preflight tests PASS");
