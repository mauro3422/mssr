import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  binaryBrier,
  binaryLogLoss,
  evaluateRun,
  multiclassScores,
  normalizedChoiceConfidenceToPmax,
  verifyFinalChoiceOptionCount,
  verifyHistoricalSelectorSource,
  validateRun,
} from "./evaluate.mjs";

test("normalized Choice confidence inverse restores the documented top mass", () => {
  const n = 4;
  const expectedPmax = 0.7;
  const confidence = (expectedPmax - 1 / n) / (1 - 1 / n);
  assert.ok(Math.abs(normalizedChoiceConfidenceToPmax(confidence, n) - expectedPmax) < 1e-12);
});

test("binary proper-score calculations are deterministic", () => {
  const probabilities = [0.8, 0.4];
  const labels = [1, 0];
  assert.equal(binaryBrier(probabilities, labels), 0.1);
  assert.ok(Math.abs(binaryLogLoss(probabilities, labels) - (-(Math.log(0.8) + Math.log(0.6)) / 2)) < 1e-12);
});

test("log-loss clips exact endpoints and rejects malformed probabilities", () => {
  assert.ok(Number.isFinite(binaryLogLoss([0, 1], [1, 0])));
  assert.throws(() => normalizedChoiceConfidenceToPmax(1.01, 4), /within \[0, 1\]/);
  assert.throws(() => normalizedChoiceConfidenceToPmax(0.5, 1), /integer >= 2/);
  assert.throws(() => binaryBrier([0.5], [2]), /binary/);
});

test("final Choice count includes the explicit none option beyond single-pass heading candidates", () => {
  const response = { selectionMode: "single-pass", candidateCount: 200, finalistCount: 200 };
  assert.equal(verifyFinalChoiceOptionCount(response, 200), 201);
  assert.throws(() => verifyFinalChoiceOptionCount({ ...response, finalistCount: 4 }, 200), /heading counts differ/);
  assert.throws(() => verifyFinalChoiceOptionCount({ ...response, candidateCount: null }, 200), /candidateCount is missing/);
  assert.throws(() => verifyFinalChoiceOptionCount({ ...response, selectionMode: "hierarchical" }, 200), /single-pass/);
});

test("historical run source commit explicitly adds the none Choice option", () => {
  const verified = validateRun(fileURLToPath(new URL("../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2/", import.meta.url)));
  const source = verifyHistoricalSelectorSource(verified.manifest);
  assert.deepEqual(source.additionalOptions, ["none"]);
  assert.equal(source.commit, "5163dce31f3912aca4500cbd2fb58453d6ee7203");
  assert.ok(verified.records.every((row) => row.finalChoiceOptionCount === 201));
});

test("multiclass metrics are only available from a complete normalized vector", () => {
  const result = multiclassScores([
    [
      { key: "target", probability: 0.8 },
      { key: "other", probability: 0.2 },
    ],
  ], ["target"]);
  assert.equal(result.decisions, 1);
  assert.ok(Math.abs(result.brier - 0.08) < 1e-12);
  assert.ok(Math.abs(result.logLoss - -Math.log(0.8)) < 1e-12);
  assert.throws(() => multiclassScores([[{ key: "target", probability: 0.6 }, { key: "other", probability: 0.2 }]], ["target"]), /sum to 1/);
});

test("the historical v2 run verifies its final Choice option count and frozen inputs", () => {
  const runDir = fileURLToPath(new URL("../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2/", import.meta.url));
  const verified = validateRun(runDir);
  assert.equal(verified.records.length, 52);
  assert.equal(verified.records.filter((row) => row.status === "selected").length, 50);
  assert.ok(verified.records.every((row) => row.finalChoiceOptionCount === 201));
  assert.ok(verified.runInventory["responses.json"]);
  assert.ok(verified.responses.records.every((row) => !row.choiceDistribution));
});

test("both frozen 80k runs report multiclass scores unavailable without full vectors", () => {
  for (const folder of [
    "mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1",
    "mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2",
  ]) {
    const runDir = fileURLToPath(new URL(`../jev-mssr-live/runs/${folder}/`, import.meta.url));
    const report = evaluateRun(runDir);
    assert.equal(report.multiclass.status, "unavailable");
    assert.equal(report.multiclass.completeDistributions, 0);
    assert.equal(report.multiclass.requiredDistributions, 52);
  }
});
