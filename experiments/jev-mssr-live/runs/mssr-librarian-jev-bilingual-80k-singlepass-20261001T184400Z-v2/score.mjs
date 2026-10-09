import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const writeJson = (path, value) => writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const scoreOutputs = ["scored-records.json", "score-summary.json"];
if (!process.argv.includes("--overwrite") && scoreOutputs.some((name) => existsSync(resolve(root, name)))) {
  throw new Error("Refusing to overwrite scored outputs; pass --overwrite only for an intentional rescore.");
}
const sha256File = (path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex").toUpperCase();
const currentRunId = "mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2";
const inputNames = ["cases.json", "corpus.json", "labels.json", "target-index.json"];
const run = readJson("responses.json");
const runSummary = readJson("summary.json");
assert.equal(run.status, "complete", "live responses must be complete before labels are read");
assert.equal(runSummary.status, "complete");
assert.equal(run.sourceLabelFileRead, false, "live runner must not read gold labels");
assert.equal(run.records.length, 52);
assert.equal(run.records.every((record) => record.status === "selected" || record.status === "abstained"), true);

const labels = readJson("inputs/labels.json");
const targetIndex = readJson("inputs/target-index.json").targetIndex;
const cases = readJson("inputs/cases.json").cases;
const singlePassResponses = readJson("../mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1/responses.json").records;
const hierarchicalResponses = readJson("../mssr-librarian-jev-bilingual-hierarchical-64k-20261001T181350Z-v1/responses.json").records;
const previousFull = readJson("../mssr-librarian-jev-full-heading-choice-20260930-v1/scored-records.json").records;
const previousShortlist = readJson("../mssr-librarian-jev-candidate-selection-20260930-v1/scored-records.json").records;
const inputHashes = Object.fromEntries(inputNames.map((name) => [name, sha256File(`inputs/${name}`)]));
for (const [name, digest] of Object.entries(inputHashes)) {
  const sameSinglePass = sha256File(`../mssr-librarian-jev-bilingual-hierarchical-20261001T174949Z-v1/inputs/${name}`);
  assert.equal(digest, sameSinglePass, `current and single-pass ${name} must be byte-identical`);
  const sameHierarchical = sha256File(`../mssr-librarian-jev-bilingual-hierarchical-64k-20261001T181350Z-v1/inputs/${name}`);
  assert.equal(digest, sameHierarchical, `current and 64k hierarchical ${name} must be byte-identical`);
}

const keyOf = (row) => `${row.caseId}:${row.language}`;
const responseByKey = new Map(run.records.map((row) => [keyOf(row), row]));
const singlePassByKey = new Map(singlePassResponses.map((row) => [keyOf(row), row]));
const hierarchicalByKey = new Map(hierarchicalResponses.map((row) => [keyOf(row), row]));
const previousFullByKey = new Map(previousFull.map((row) => [keyOf(row), row]));
const previousShortlistByKey = new Map(previousShortlist.map((row) => [keyOf(row), row]));
const scored = [];
for (const item of cases) {
  const target = targetIndex[item.id];
  const label = labels.cases[item.id];
  assert.ok(target && label, `frozen target and label are required for ${item.id}`);
  for (const language of ["en", "es"]) {
    const key = `${item.id}:${language}`;
    const response = responseByKey.get(key);
    const singlePass = singlePassByKey.get(key);
    const hierarchical = hierarchicalByKey.get(key);
    const full = previousFullByKey.get(key);
    const shortlist = previousShortlistByKey.get(key);
    assert.ok(response && singlePass && hierarchical && full && shortlist, `paired outcomes must exist for ${key}`);
    const selected = response.selected;
    const exactTarget = response.status === "selected" && selected?.sourceRef === target.sourceRef
      && JSON.stringify(selected.headingPath) === JSON.stringify(target.targetHeadingPath);
    const priorSingleSelected = singlePass.status === "selected" ? singlePass.selected : null;
    const singlePassExactTarget = !!priorSingleSelected && priorSingleSelected.sourceRef === target.sourceRef
      && JSON.stringify(priorSingleSelected.headingPath) === JSON.stringify(target.targetHeadingPath);
    const hierarchySelected = hierarchical.selected;
    const hierarchicalExactTarget = hierarchical.status === "selected" && hierarchySelected?.sourceRef === target.sourceRef
      && JSON.stringify(hierarchySelected.headingPath) === JSON.stringify(target.targetHeadingPath);
    scored.push({
      caseId: item.id,
      language,
      split: full.split,
      query: item[language],
      targetSourceRef: target.sourceRef,
      targetHeadingPath: target.targetHeadingPath,
      expectedSectionPresentInFullCatalog: true,
      status: response.status,
      exactTarget,
      selectedSourceRef: selected?.sourceRef ?? null,
      selectedHeadingPath: selected?.headingPath ?? null,
      selectedRangeId: selected?.rangeId ?? null,
      exactFetch: response.exactFetch,
      providerConfidence: response.providerConfidence,
      evidenceSufficiency: response.evidenceSufficiency,
      candidateCount: response.candidateCount,
      finalistCount: response.finalistCount,
      selectionMode: response.selectionMode,
      providerCalls: response.providerCalls,
      elapsedMs: response.elapsedMs,
      usage: response.usage,
      pairedPriorDirectExactTarget: singlePassExactTarget,
      paired64kHierarchicalExactTarget: hierarchicalExactTarget,
      priorFullHeadingExactTarget: full.selectedExpectedSection,
      priorTop100JevExactTarget: shortlist.selectedExpectedSection,
      priorTop100TargetPresent: shortlist.targetPresentInCandidateSet,
    });
  }
}

const mean = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : null;
const count = (rows, predicate) => rows.filter(predicate).length;
const byLanguage = Object.fromEntries(["en", "es"].map((language) => {
  const rows = scored.filter((row) => row.language === language);
  const selectedRows = rows.filter((row) => row.status === "selected");
  const confidenceBins = [
    { name: "<0.50", min: 0, max: 0.5 },
    { name: "0.50-0.69", min: 0.5, max: 0.7 },
    { name: "0.70-0.84", min: 0.7, max: 0.85 },
    { name: "0.85-1.00", min: 0.85, max: 1.000001 },
  ].map((bin) => {
    const matches = selectedRows.filter((row) => row.providerConfidence >= bin.min && row.providerConfidence < bin.max);
    return { band: bin.name, selected: matches.length, exactTargets: count(matches, (row) => row.exactTarget) };
  });
  return [language, {
    queries: rows.length,
    exactTargetSelections: count(rows, (row) => row.exactTarget),
    strictExactTargetRate: Number((count(rows, (row) => row.exactTarget) / rows.length).toFixed(4)),
    selected: selectedRows.length,
    abstentions: count(rows, (row) => row.status === "abstained"),
    failed: count(rows, (row) => row.status === "failed"),
    exactFetchChecks: count(rows, (row) => row.exactFetch === "passed"),
    exactFetchFailures: count(rows, (row) => row.exactFetch !== "passed" && row.exactFetch !== "not-selected"),
    finalistCountMean: mean(rows.map((row) => row.finalistCount)),
    providerCalls: rows.reduce((sum, row) => sum + row.providerCalls, 0),
    latencyMeanMs: mean(rows.map((row) => row.elapsedMs)),
    inputTokens: rows.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0),
    choiceConfidenceMeanAllCallsDescriptive: mean(rows.map((row) => row.providerConfidence).filter(Number.isFinite)),
    choiceConfidenceMeanSelectedDescriptive: mean(selectedRows.map((row) => row.providerConfidence).filter(Number.isFinite)),
    evidenceSufficiencyMeanDescriptive: mean(rows.map((row) => row.evidenceSufficiency).filter(Number.isFinite)),
    previousFullHeadingExactTargets: count(rows, (row) => row.priorFullHeadingExactTarget),
    previousTop100JevExactTargets: count(rows, (row) => row.priorTop100JevExactTarget),
    previousTop100TargetPresent: count(rows, (row) => row.priorTop100TargetPresent),
    pairedOutcomes: {
      bothDirectRunsCorrect: count(rows, (row) => row.exactTarget && row.pairedPriorDirectExactTarget),
      currentDirectOnlyCorrect: count(rows, (row) => row.exactTarget && !row.pairedPriorDirectExactTarget),
      priorDirectOnlyCorrect: count(rows, (row) => !row.exactTarget && row.pairedPriorDirectExactTarget),
      neitherStrictTarget: count(rows, (row) => !row.exactTarget && !row.pairedPriorDirectExactTarget),
    },
    paired64kHierarchicalOutcomes: {
      bothCurrentAnd64kHierarchicalCorrect: count(rows, (row) => row.exactTarget && row.paired64kHierarchicalExactTarget),
      currentOnlyCorrect: count(rows, (row) => row.exactTarget && !row.paired64kHierarchicalExactTarget),
      hierarchical64kOnlyCorrect: count(rows, (row) => !row.exactTarget && row.paired64kHierarchicalExactTarget),
      neitherStrictTarget: count(rows, (row) => !row.exactTarget && !row.paired64kHierarchicalExactTarget),
    },
    confidenceBandsAmongSelectionsDescriptiveOnly: confidenceBins,
    strictMisses: rows.filter((row) => !row.exactTarget).map((row) => ({
      caseId: row.caseId,
      status: row.status,
      targetSourceRef: row.targetSourceRef,
      targetHeadingPath: row.targetHeadingPath,
      selectedSourceRef: row.selectedSourceRef,
      selectedHeadingPath: row.selectedHeadingPath,
      pairedPriorDirectExactTarget: row.pairedPriorDirectExactTarget,
      confidence: row.providerConfidence,
      sufficiency: row.evidenceSufficiency,
    })),
  }];
}));
const splitMetrics = Object.fromEntries(["development", "grouped-holdout"].map((split) => {
  const rows = scored.filter((row) => row.split === split);
  return [split, Object.fromEntries(["en", "es"].map((language) => {
    const languageRows = rows.filter((row) => row.language === language);
    return [language, { queries: languageRows.length, exactTargetSelections: count(languageRows, (row) => row.exactTarget) }];
  }))];
}));
const metrics = {
  en: byLanguage.en,
  es: byLanguage.es,
  combined: {
    queries: scored.length,
    exactTargetSelections: count(scored, (row) => row.exactTarget),
    selected: count(scored, (row) => row.status === "selected"),
    abstentions: count(scored, (row) => row.status === "abstained"),
    failed: count(scored, (row) => row.status === "failed"),
    exactFetchChecks: count(scored, (row) => row.exactFetch === "passed"),
    providerCalls: scored.reduce((sum, row) => sum + row.providerCalls, 0),
    inputTokens: scored.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0),
    outputTokens: scored.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0),
    latencyMeanMs: mean(scored.map((row) => row.elapsedMs)),
    finalistCountMean: mean(scored.map((row) => row.finalistCount)),
  },
};
const summary = {
  schemaVersion: 1,
  runId: currentRunId,
  status: "complete-exploratory-score",
  candidateMode: [...new Set(scored.map((row) => row.selectionMode))].join(", "),
  cases: 26,
  corpusDocuments: 21,
  catalogHeadingCandidates: 200,
  expectedExactHeadings: Object.keys(labels.cases).length,
  humanOwnerAdjudication: labels.humanOwnerAdjudication,
  inputHashes,
  baselineComparisons: {
    baselineDeterministicTop100Recall: { en: `18/26`, es: `4/26` },
    priorTop100JevExact: { en: `${metrics.en.previousTop100JevExactTargets}/26`, es: `${metrics.es.previousTop100JevExactTargets}/26` },
    priorFullHeadingSingleChoiceExact: { en: `${metrics.en.previousFullHeadingExactTargets}/26`, es: `${metrics.es.previousFullHeadingExactTargets}/26` },
    pairedSameInputPriorDirectRun: {
      en: metrics.en.pairedOutcomes,
      es: metrics.es.pairedOutcomes,
    },
    paired80kSinglePassAgainst64kHierarchical: {
      en: metrics.en.paired64kHierarchicalOutcomes,
      es: metrics.es.paired64kHierarchicalOutcomes,
    },
  },
  bySplit: splitMetrics,
  metrics,
  limitations: [
    "The live runner did not read labels or target mappings; the scorer opened them only after the run completed.",
    "Exact-target scores use Luna-reviewed single-heading labels, not human-owner adjudication; an alternate section may contain valid evidence.",
    "There are no independent labels for abstention quality or sufficient answer evidence; Noul and Choice values remain descriptive and uncalibrated.",
    "Hierarchical final Noul sees retained finalists while single-pass Noul sees the full offered candidate set; cross-mode sufficiency values are not comparable.",
    "The grouped query holdout retains the same 21 source documents, so it is not unseen-document generalization.",
    "This 80,000-character run keeps a direct full-catalog Choice for the 200-heading corpus; the paired 64,000-character run exercises hierarchy, and neither establishes behavior across unseen-document catalogs.",
    "This evaluates evidence range selection and exact fetch, not automatic iterative grep, contradiction truth, free-form synthesis, citation faithfulness, permissions or production activation.",
  ],
};
writeJson("scored-records.json", { schemaVersion: 1, records: scored });
writeJson("score-summary.json", summary);
process.stdout.write(`${JSON.stringify({ runId: currentRunId, status: summary.status, metrics: summary.metrics, paired: summary.baselineComparisons.pairedSameInputPriorDirectRun })}\n`);
