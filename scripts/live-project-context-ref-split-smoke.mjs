import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyMssrProjectContextReferencePlan,
  loadProjectContextModules,
  planMssrProjectContextReferenceSplit,
} from "../dist/index.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-live-ref-split-"));
const projectRoot = path.join(root, "project");
const stateRoot = path.join(root, "state");
const sourceRef = ".mssr/knowledge/phase/project-current-phase.md";
const sourcePath = path.join(projectRoot, ".mssr", "knowledge", "phase", "project-current-phase.md");

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
  const source = [
    "# Project Current Phase",
    "",
    "## Current Operational State",
    "",
    "This is the current compact operational truth. Keep it directly available as the parent baseline.",
    "The active implementation is stable, current gates pass, and the next action is to continue the present phase.",
    ...Array.from({ length: 12 }, (_, i) => `Current invariant ${i + 1}: only active truth and immediate blockers belong in this section.`),
    "",
    "## Historical Migration Record",
    "",
    "This section is historical evidence about an older migration. It is useful for recovery but is not current state.",
    ...Array.from({ length: 34 }, (_, i) => `Historical migration note ${i + 1}: prior implementation evidence retained only when someone asks about migration history.`),
    "",
    "## Historical Performance Archive",
    "",
    "This section is an archive of older benchmark observations. It is useful deep context, not current operational state.",
    ...Array.from({ length: 32 }, (_, i) => `Archived performance observation ${i + 1}: old benchmark evidence retained for selective historical inspection.`),
    "",
  ].join("\n");
  await fs.writeFile(sourcePath, source, "utf8");
  await fs.writeFile(path.join(projectRoot, ".mssr", "project-context.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "project-current-phase",
      kind: "state",
      topic: "phase",
      description: "Current phase baseline plus historical evidence pending semantic ref extraction.",
      source: { path: sourceRef },
      domains: ["coding"],
      actions: ["recover"],
      needs: ["history-recovery"],
      priority: 20,
      maxChars: 6500,
    }],
  }, null, 2)}\n`, "utf8");

  const plan = await planMssrProjectContextReferenceSplit({
    projectRoot,
    moduleId: "project-current-phase",
    stateRoot,
    persist: true,
  });
  const before = await fs.readFile(sourcePath, "utf8");
  let applied = null;
  let historicalLoaded = null;
  if (plan.status === "auto-safe") {
    applied = await applyMssrProjectContextReferencePlan({ planId: plan.planId, confirmPlanId: plan.planId, stateRoot });
    historicalLoaded = await loadProjectContextModules({
      projectRoot,
      intent: intent("Recover historical migration record"),
      stage: "implement",
      includeCore: false,
    });
    assert.equal(historicalLoaded.selected.length, 1);
    assert.match(historicalLoaded.selected[0].content, /Current Operational State/);
    assert.match(historicalLoaded.selected[0].content, /Historical Migration Record/);
    assert.equal((await fs.readFile(sourcePath, "utf8")).length < before.length, true);
  } else {
    assert.equal(await fs.readFile(sourcePath, "utf8"), before, "review-required planning must not mutate canonical source");
  }

  console.log(JSON.stringify({
    ok: true,
    status: plan.status,
    planId: plan.planId,
    sourceBytes: plan.sourceBytes,
    moves: plan.moves.map((move) => ({ heading: move.heading, topic: move.topic, bytes: move.bytes, targetRef: move.targetRef, terms: move.terms })),
    decisions: plan.decisions.map((decision) => ({
      heading: decision.heading,
      protectedHeading: decision.protectedHeading,
      role: decision.role,
      destination: decision.destination,
      topic: decision.topic,
      protectedProbability: decision.protectedProbability,
      action: decision.action,
      reasons: decision.reasons,
    })),
    reviewReasons: plan.reviewReasons,
    projected: plan.projected,
    jev: plan.jev,
    applied,
    loadedRefs: historicalLoaded?.selected[0]?.referenceDecisions?.filter((item) => item.selected).map((item) => item.sourcePath) ?? [],
  }, null, 2));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
