import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  binaryBrier,
  binaryLogLoss,
  evaluateRun,
  multiclassScores,
  normalizedChoiceConfidenceToPmax,
  assessChoiceCardinality,
  renderMarkdown,
  verifyCandidateHeadingCount,
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

test("candidate heading count is not mislabeled as final Choice option count", () => {
  const response = { selectionMode: "single-pass", candidateCount: 200, finalistCount: 200 };
  assert.equal(verifyCandidateHeadingCount(response, 200), 200);
  assert.throws(() => verifyCandidateHeadingCount({ ...response, finalistCount: 4 }, 200), /heading counts differ/);
  assert.throws(() => verifyCandidateHeadingCount({ ...response, candidateCount: null }, 200), /candidateCount is missing/);
  assert.throws(() => verifyCandidateHeadingCount({ ...response, selectionMode: "hierarchical" }, 200), /single-pass/);
});

test("dirty run source without an exact preserved file leaves Choice cardinality unverified", () => {
  for (const folder of [
    "mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1",
    "mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2",
  ]) {
    const runDir = fileURLToPath(new URL(`../jev-mssr-live/runs/${folder}/`, import.meta.url));
    const verified = validateRun(runDir);
    const assessment = assessChoiceCardinality(verified.manifest);
    assert.equal(assessment.status, "unverified-run-source-conditional-sensitivity");
    assert.equal(assessment.verifiedOptionCount, null);
    assert.equal(assessment.sourceIsDirty, true);
    assert.equal(assessment.evidence.exactPreservedSourceMatched, false);
    assert.deepEqual(assessment.scenarios.map((scenario) => scenario.optionCount), [200, 201]);
    assert.equal(verified.choiceCardinality.verifiedOptionCount, null);
    assert.ok(verified.records.every((row) => row.headingCandidateCount === 200));
    assert.ok(verified.records.every((row) => !Object.hasOwn(row, "finalChoiceOptionCount")));
  }
});

test("candidate commit metadata cannot establish run-time Choice cardinality", () => {
  const base = {
    execution: { headings: 200 },
    repository: {
      workingTreeDirtyAtManifest: true,
      runWasMadeFromUncommittedCandidate: true,
      headAtRunKnown: "5163dce31f3912aca4500c0bd2fb58453d6ee7203",
      sourceFileHashesAtManifest: {},
    },
  };
  const withAuditedHead = assessChoiceCardinality(base);
  const withOtherHead = assessChoiceCardinality({
    ...base,
    repository: { ...base.repository, headAtRunKnown: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  });
  assert.equal(withAuditedHead.verifiedOptionCount, null);
  assert.deepEqual(withAuditedHead.scenarios, withOtherHead.scenarios);
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

test("the historical v2 run verifies its frozen inputs and heading candidate counts", () => {
  const runDir = fileURLToPath(new URL("../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2/", import.meta.url));
  const verified = validateRun(runDir);
  assert.equal(verified.records.length, 52);
  assert.equal(verified.records.filter((row) => row.status === "selected").length, 50);
  assert.equal(verified.choiceCardinality.verifiedOptionCount, null);
  assert.deepEqual(verified.choiceCardinality.scenarios.map((scenario) => scenario.optionCount), [200, 201]);
  assert.ok(verified.records.every((row) => row.headingCandidateCount === 200));
  assert.ok(verified.runInventory["responses.json"]);
  assert.ok(verified.responses.records.every((row) => !row.choiceDistribution));
});

test("scores and reliability outputs remain conditional under both cardinality scenarios", () => {
  const runDir = fileURLToPath(new URL("../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2/", import.meta.url));
  const report = evaluateRun(runDir);
  assert.equal(report.choiceProbability.verifiedOptionCount, null);
  assert.equal(report.topLabelMetrics.status, "conditional-on-assumed-option-count-scenario");
  assert.deepEqual(report.topLabelMetrics.scenarios.map((scenario) => scenario.optionCount), [200, 201]);
  assert.equal(report.reliabilityBins.status, "conditional-on-assumed-option-count-scenario");
  assert.equal(report.reliabilityBins.scenarios.length, 2);
  assert.equal(report.riskCoverage.status, "exploratory-only-conditional-on-assumed-option-count-scenario");
  assert.equal(report.cardinalityScenarios.length, 2);
  assert.equal(report.byLanguage.en.strictExactTargetCorrect, 17);
  assert.equal(report.byLanguage.es.strictExactTargetCorrect, 17);
  const markdown = renderMarkdown([report]);
  assert.doesNotMatch(markdown, /undefined/);
  assert.match(markdown, /17\/25/);
  const selected = report.records.filter((row) => row.status === "selected");
  assert.ok(selected.every((row) => Object.keys(row.conditionalTopChoiceMassByOptionCount).join(",") === "200,201"));
  assert.ok(selected.some((row) => row.conditionalTopChoiceMassByOptionCount["200"] !== row.conditionalTopChoiceMassByOptionCount["201"]));
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

test("persisted reports label every option-count-derived value as conditional", () => {
  const reportDir = new URL("./reports/", import.meta.url);
  const current = JSON.parse(readFileSync(new URL("2026-10-04-80k-singlepass-exploratory-source-conditional.json", reportDir), "utf8"));
  assert.equal(current.status, "conditional-exploratory-report");
  assert.ok(current.reports.every((report) => report.choiceProbability.verifiedOptionCount === null));
  assert.ok(current.reports.every((report) => report.topLabelMetrics.status === "conditional-on-assumed-option-count-scenario"));
  assert.ok(current.reports.every((report) => report.topLabelMetrics.scenarios.map((scenario) => scenario.optionCount).join(",") === "200,201"));
  const currentMarkdown = renderMarkdown(current.reports);
  assert.equal(currentMarkdown.endsWith("\n\n"), false, "generated Markdown has no extra blank line at EOF");
  assert.equal(readFileSync(new URL("2026-10-04-80k-singlepass-exploratory-source-conditional.md", reportDir), "utf8"), currentMarkdown);

  for (const [filename, assumedOptionCount] of [
    ["2026-10-04-80k-singlepass-exploratory.json", 200],
    ["2026-10-04-80k-singlepass-exploratory-corrected.json", 201],
  ]) {
    const historical = JSON.parse(readFileSync(new URL(filename, reportDir), "utf8"));
    assert.equal(historical.status, "superseded-conditional-scenario");
    assert.equal(historical.supersededBy, "2026-10-04-80k-singlepass-exploratory-source-conditional");
    for (const report of historical.reports) {
      assert.equal(report.choiceProbability.verifiedOptionCount, null);
      assert.equal(report.choiceProbability.assumedOptionCount, assumedOptionCount);
      assert.equal(report.topLabelMetrics.status, "conditional-on-assumed-option-count-scenario");
      assert.ok(report.records.every((record) => record.assumedOptionCount === assumedOptionCount));
      assert.ok(report.records.every((record) => !Object.hasOwn(record, "finalChoiceOptionCount")));
    }
  }
});
