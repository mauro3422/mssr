import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  auditMssrLearningDataset,
  calibrateMssrLearningPredictions,
  evaluateMssrLearningHoldout,
  evaluateMssrLearningObserveOnly,
  replayMssrLearningDecisions,
  shadowMssrLearningDecisions,
} from "../dist/index.js";

const signature = "stage=verify|d=skill-system|a=analyze,verify|r=code|n=integrity-verification|s=repeated-friction";

function record(index, decision = "accepted", extra = {}) {
  return {
    traceId: `trace-${String(index).padStart(3, "0")}`,
    observedAt: `2026-01-${String(index).padStart(2, "0")}T12:00:00.000Z`,
    source: "strict-learning-digest",
    digest: {
      semanticSignature: signature,
      finalStage: "verify",
      signals: ["repeated-friction"],
      recommendedSkills: ["skill-b"],
      loadedSkills: decision === "accepted" ? ["skill-b"] : [],
      skillDecisions: [{ skillName: "skill-b", decision, reasonCode: decision === "accepted" ? "useful" : "irrelevant-domain", stage: "verify" }],
      skillTransitions: [],
      contextSelections: [],
      findings: [],
      outcome: { status: "success", accepted: decision === "accepted", supportingSkills: [], userCorrections: 0 },
    },
    host: "codex",
    model: "test-model",
    runtime: "test-runtime",
    ...extra,
  };
}

// Twenty independent historical traces give the holdout a non-sparse basis.
const clean = Array.from({ length: 24 }, (_, index) => record(index + 1, index < 19 ? "accepted" : "skipped"));
const options = { minDistinctTraces: 3, minHoldoutRecords: 3, holdoutFraction: 0.2, acceptThreshold: 0.5, skipThreshold: 0.35 };
const audit = auditMssrLearningDataset(clean, options);
assert.equal(audit.mode, "observe-only");
assert.equal(audit.routingInfluence, false);
assert.equal(audit.status, "ready");
assert.equal(audit.strictDigestRecords, 24);
assert.equal(audit.legacyRecords, 0);
assert.deepEqual(audit.duplicateTraceIds, []);

const replay = replayMssrLearningDecisions(clean, options);
assert.equal(replay.mode, "observe-only");
assert.equal(replay.routingInfluence, false);
assert.equal(replay.status, "evaluated");
assert.ok(replay.predictions.some((item) => item.suggestion === "accept"), "support-aware replay should eventually make a counterfactual suggestion");
assert.equal(replay.metrics.requiredLoadMisses.status, "not-measurable");
assert.equal(replay.metrics.requiredLoadMisses.reason.includes("does not encode"), true);

const holdout = evaluateMssrLearningHoldout(clean, options);
assert.equal(holdout.status, "evaluated");
assert.equal(holdout.predictions.length, 5, "the temporal holdout must not leak its own decisions into training");
assert.equal(holdout.predictions.every((item) => item.distinctTraceSupport >= 3), true);
const calibration = calibrateMssrLearningPredictions(holdout.predictions, 3);
assert.equal(calibration.mode, "observe-only");
assert.equal(calibration.routingInfluence, false);
assert.equal(calibration.status, "evaluated");
assert.equal(calibration.method, "beta(1,1)-smoothing + Wilson-95");

const shadow = shadowMssrLearningDecisions(clean, options);
assert.equal(shadow.mode, "observe-only");
assert.equal(shadow.routingInfluence, false);
assert.equal(shadow.status, "evaluated");
assert.equal(shadow.shadowRecordCount, holdout.predictions.length);

const full = evaluateMssrLearningObserveOnly(clean, options);
assert.equal(full.mode, "observe-only");
assert.equal(full.routingInfluence, false);
assert.equal(full.automaticPromotionPerformed, false);
assert.equal(full.shadow.routingInfluence, false);

const problematic = [
  record(1, "accepted", { correlationKey: "retry-a", routingRevision: "old", skillRevisions: { "skill-b": "old" } }),
  record(1, "skipped", { correlationKey: "retry-a", routingRevision: "old", skillRevisions: { "skill-b": "old" } }),
  { ...record(2, "accepted"), source: "legacy-selection-telemetry" },
  { invalid: true },
];
const degraded = auditMssrLearningDataset(problematic, {
  ...options,
  currentRevisions: { routingRevision: "new", skillRevisions: { "skill-b": "new" } },
});
assert.equal(degraded.status, "abstained");
assert.equal(degraded.invalidRecords, 1);
assert.equal(degraded.legacyRecords, 1);
assert.deepEqual(degraded.duplicateTraceIds, ["trace-001"]);
assert.deepEqual(degraded.correlatedAttemptGroups, ["retry-a"]);
assert.deepEqual(degraded.staleRoutingTraceIds, ["trace-001"]);
assert.deepEqual(degraded.staleSkillTraceIds, ["trace-001"]);
assert.equal(degraded.decisionEvidence.notEvaluated, 0, "legacy telemetry must stay outside strict decision evidence");
assert.equal(degraded.decisionEvidence.ambiguous, 1, "conflicting decisions for one trace/skill must be reported, not collapsed");
assert.equal(replayMssrLearningDecisions(problematic, options).status, "abstained");

const source = await readFile(new URL("../src/learning-evaluation.ts", import.meta.url), "utf8");
const router = await readFile(new URL("../src/skill-routing.ts", import.meta.url), "utf8");
assert.equal(source.includes("./skill-routing.js"), false, "learning evaluation must not depend on routing implementation");
assert.equal(router.includes("learning-evaluation"), false, "routing must not consume learning evaluation output");

console.log("MSSR learning gates B-E observe-only evaluation: PASS");
