#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNS = [
  "../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1",
  "../jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2",
];
const DEFAULT_OUT = "reports/2026-10-04-80k-singlepass-exploratory-source-conditional";
const TRANSFORM_ID = "typesafe-choice-normalized-pmax-v1";
const TRANSFORM_URL = "https://docs.typesafe.ai/confidence";
const SELECTOR_SOURCE_PATH = "src/librarian-jev-selection.ts";
const BIN_EDGES = [0, 0.5, 0.7, 0.85, 1];
const EPSILON = 1e-15;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertProbability(value, label) {
  assert.equal(typeof value, "number", `${label} must be a number`);
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  assert.ok(value >= 0 && value <= 1, `${label} must be within [0, 1]`);
}

/**
 * TypeSafe's normalized Choice confidence is documented as
 * (pmax - 1/n) / (1 - 1/n). This inverse is intentionally restricted to a
 * assumed Choice count; it is not a probability of correctness. Callers must
 * preserve the assumption status when the run-time option count is unknown.
 */
export function normalizedChoiceConfidenceToPmax(confidence, optionCount) {
  assertProbability(confidence, "confidence");
  assert.ok(Number.isInteger(optionCount) && optionCount >= 2, "optionCount must be an integer >= 2");
  return (1 / optionCount) + confidence * (1 - 1 / optionCount);
}

export function verifyCandidateHeadingCount(record, expectedCandidateCount) {
  assert.equal(record.selectionMode, "single-pass", "candidate heading count is only accepted for single-pass Choice");
  assert.ok(Number.isInteger(record.candidateCount) && record.candidateCount >= 2, "candidateCount is missing or invalid");
  assert.ok(Number.isInteger(record.finalistCount) && record.finalistCount >= 2, "finalistCount is missing or invalid");
  assert.equal(record.candidateCount, record.finalistCount, "single-pass candidate and finalist heading counts differ");
  assert.equal(record.finalistCount, expectedCandidateCount, "finalist heading count differs from the frozen catalog count");
  return record.finalistCount;
}

export function assessChoiceCardinality(manifest) {
  const headingCandidateCount = manifest.execution?.headings;
  assert.ok(Number.isInteger(headingCandidateCount) && headingCandidateCount >= 2, "manifest heading candidate count is missing or invalid");
  const repository = manifest.repository ?? {};
  const sourceFingerprint = repository.sourceFileHashesAtManifest?.[SELECTOR_SOURCE_PATH] ?? null;
  const sourceFingerprintValid = sourceFingerprint
    && Number.isInteger(sourceFingerprint.bytes)
    && /^[a-f0-9]{64}$/i.test(sourceFingerprint.sha256 ?? "");
  const sourceIsDirty = repository.workingTreeDirtyAtManifest === true
    || repository.runWasMadeFromUncommittedCandidate === true;
  const scenarios = [
    {
      id: "headings-only",
      optionCount: headingCandidateCount,
      additionalOptionCount: 0,
      assumption: "The final Choice contains only the frozen heading candidates and no extra option.",
    },
    {
      id: "headings-plus-one-none",
      optionCount: headingCandidateCount + 1,
      additionalOptionCount: 1,
      assumption: "The final Choice contains the frozen heading candidates plus exactly one explicit none option.",
    },
  ];
  return {
    status: "unverified-run-source-conditional-sensitivity",
    verifiedOptionCount: null,
    headingCandidateCount,
    sourceIsDirty,
    scenarios,
    scenarioSetExhaustive: false,
    evidence: {
      runWasMadeFromUncommittedCandidate: repository.runWasMadeFromUncommittedCandidate ?? null,
      workingTreeDirtyAtManifest: repository.workingTreeDirtyAtManifest ?? null,
      headAtRunRecorded: repository.headAtRunKnown ?? null,
      sourcePath: SELECTOR_SOURCE_PATH,
      sourceFingerprintCaptured: Boolean(sourceFingerprintValid),
      sourceFingerprint: sourceFingerprintValid
        ? { bytes: sourceFingerprint.bytes, sha256: sourceFingerprint.sha256.toLowerCase() }
        : null,
      exactPreservedSourceMatched: false,
      reason: sourceIsDirty
        ? sourceFingerprintValid
          ? "The manifest records a dirty-run source fingerprint, but no preserved selector source file matching that fingerprint is available; the committed run HEAD is not used as a substitute."
          : "The run used dirty source and did not preserve a selector source fingerprint or matching source file; the committed run HEAD is not used as a substitute."
        : "No exact preserved selector source artifact or explicit final Choice option count is available.",
    },
  };
}

export function binaryBrier(probabilities, labels) {
  assert.equal(probabilities.length, labels.length, "probability and label lengths must match");
  assert.ok(probabilities.length > 0, "at least one outcome is required");
  return probabilities.reduce((sum, probability, index) => {
    assertProbability(probability, `probabilities[${index}]`);
    assert.ok(labels[index] === 0 || labels[index] === 1, `labels[${index}] must be binary`);
    return sum + (probability - labels[index]) ** 2;
  }, 0) / probabilities.length;
}

export function binaryLogLoss(probabilities, labels) {
  assert.equal(probabilities.length, labels.length, "probability and label lengths must match");
  assert.ok(probabilities.length > 0, "at least one outcome is required");
  return -probabilities.reduce((sum, probability, index) => {
    assertProbability(probability, `probabilities[${index}]`);
    assert.ok(labels[index] === 0 || labels[index] === 1, `labels[${index}] must be binary`);
    const clipped = Math.min(1 - EPSILON, Math.max(EPSILON, probability));
    return sum + (labels[index] === 1 ? Math.log(clipped) : Math.log1p(-clipped));
  }, 0) / probabilities.length;
}

export function multiclassScores(distributions, targets) {
  assert.equal(distributions.length, targets.length, "distribution and target lengths must match");
  assert.ok(distributions.length > 0, "at least one distribution is required");
  const briers = [];
  const losses = [];
  for (let rowIndex = 0; rowIndex < distributions.length; rowIndex += 1) {
    const distribution = distributions[rowIndex];
    const targetKey = targets[rowIndex];
    assert.ok(Array.isArray(distribution) && distribution.length >= 2, `distribution ${rowIndex} must contain >= 2 alternatives`);
    const seen = new Set();
    let total = 0;
    let targetProbability = null;
    let squaredError = 0;
    for (let optionIndex = 0; optionIndex < distribution.length; optionIndex += 1) {
      const option = distribution[optionIndex];
      assert.ok(typeof option.key === "string" && option.key.length > 0, `distribution ${rowIndex} option ${optionIndex} lacks key`);
      assert.ok(!seen.has(option.key), `distribution ${rowIndex} repeats option key ${option.key}`);
      seen.add(option.key);
      assertProbability(option.probability, `distribution ${rowIndex} option ${optionIndex} probability`);
      total += option.probability;
      const isTarget = option.key === targetKey;
      if (isTarget) targetProbability = option.probability;
      squaredError += (option.probability - Number(isTarget)) ** 2;
    }
    assert.ok(Math.abs(total - 1) <= 1e-6, `distribution ${rowIndex} probabilities must sum to 1`);
    assert.notEqual(targetProbability, null, `target ${targetKey} is absent from distribution ${rowIndex}`);
    briers.push(squaredError);
    losses.push(-Math.log(Math.max(EPSILON, targetProbability)));
  }
  return { brier: mean(briers), logLoss: mean(losses), decisions: distributions.length };
}

function fixedReliabilityBins(rows) {
  return BIN_EDGES.slice(0, -1).map((lower, index) => {
    const upper = BIN_EDGES[index + 1];
    const members = rows.filter((row) => row.pmax >= lower
      && (index === BIN_EDGES.length - 2 ? row.pmax <= upper : row.pmax < upper));
    return {
      interval: index === BIN_EDGES.length - 2 ? `[${lower}, ${upper}]` : `[${lower}, ${upper})`,
      support: members.length,
      meanTopChoiceProbability: members.length ? mean(members.map((row) => row.pmax)) : null,
      exactTargetRateAmongSelected: members.length ? mean(members.map((row) => row.correct)) : null,
      correct: members.filter((row) => row.correct === 1).length,
    };
  });
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function round(value, digits = 6) {
  return value === null ? null : Number(value.toFixed(digits));
}

function stableRows(rows) {
  return [...rows].sort((a, b) => a.caseId.localeCompare(b.caseId) || a.language.localeCompare(b.language));
}

function exactTarget(response, target) {
  return response.status === "selected"
    && response.selected?.sourceRef === target.sourceRef
    && JSON.stringify(response.selected.headingPath) === JSON.stringify(target.targetHeadingPath);
}

function targetKey(sourceRef, headingPath) {
  return JSON.stringify([sourceRef, headingPath]);
}

function getMulticlassEvaluation(responses, targets) {
  const rawDistributions = responses.map((response) => response.choiceDistribution ?? null);
  const present = rawDistributions.filter(Boolean).length;
  if (present !== responses.length) {
    return {
      status: "unavailable",
      completeDistributions: present,
      requiredDistributions: responses.length,
      reason: "The frozen responses do not persist choiceDistribution for every decision; complete per-option probability vectors are required.",
    };
  }
  const distributions = responses.map((response, rowIndex) => {
    const items = response.choiceDistribution;
    assert.equal(items.length, response.finalistCount, `multiclass vector length differs from final Choice count for ${response.caseId}:${response.language}`);
    return items.map((item) => ({
      key: targetKey(item.sourceRef, item.headingPath),
      probability: item.probability,
    }));
  });
  const labels = responses.map((response) => targetKey(targets[response.caseId].sourceRef, targets[response.caseId].targetHeadingPath));
  const result = multiclassScores(distributions, labels);
  return { status: "computed", ...result };
}

function verifyHashes(runDir, manifest) {
  for (const relativePath of ["cases.json", "corpus.json", "labels.json", "target-index.json"]) {
    const expected = manifest.inputs?.[relativePath]?.sha256;
    assert.match(expected ?? "", /^[a-f0-9]{64}$/i, `manifest hash missing for ${relativePath}`);
    const actual = sha256(readFileSync(resolve(runDir, "inputs", relativePath)));
    assert.equal(actual, expected.toLowerCase(), `${relativePath} does not match frozen manifest hash`);
  }
}

function verifyRunInventory(runDir) {
  const inventoryPath = resolve(runDir, "SHA256SUMS");
  assert.ok(existsSync(inventoryPath), "run SHA256SUMS inventory is required");
  const entries = new Map();
  for (const line of readFileSync(inventoryPath, "utf8").split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/i);
    assert.ok(match, `malformed SHA256SUMS line: ${line}`);
    const [, expected, relativePath] = match;
    assert.ok(!relativePath.startsWith("/") && !relativePath.split(/[\\/]/).includes(".."), `unsafe inventory path: ${relativePath}`);
    assert.ok(!entries.has(relativePath), `duplicate inventory path: ${relativePath}`);
    const path = resolve(runDir, relativePath);
    assert.ok(path.startsWith(`${resolve(runDir)}\\`) || path.startsWith(`${resolve(runDir)}/`), `inventory path escapes run: ${relativePath}`);
    assert.ok(existsSync(path), `inventory file is missing: ${relativePath}`);
    assert.equal(sha256(readFileSync(path)), expected.toLowerCase(), `inventory hash mismatch: ${relativePath}`);
    entries.set(relativePath, expected.toLowerCase());
  }
  for (const required of ["manifest.json", "summary.json", "responses.json", "inputs/cases.json", "inputs/corpus.json", "inputs/labels.json", "inputs/target-index.json"]) {
    assert.ok(entries.has(required), `required run file absent from SHA256SUMS: ${required}`);
  }
  return Object.fromEntries(entries);
}

export function validateRun(runDirInput) {
  const runDir = resolve(runDirInput);
  const manifest = readJson(resolve(runDir, "manifest.json"));
  const [cases, corpus, labels, targetIndex, responses, summary] = [
    "inputs/cases.json", "inputs/corpus.json", "inputs/labels.json", "inputs/target-index.json", "responses.json", "summary.json",
  ].map((relativePath) => readJson(resolve(runDir, relativePath)));
  const runInventory = verifyRunInventory(runDir);
  verifyHashes(runDir, manifest);
  const choiceCardinality = assessChoiceCardinality(manifest);

  assert.equal(manifest.execution?.provider, "typesafe-jev", "unexpected provider");
  assert.equal(manifest.execution?.mode, "single-pass", "only single-pass runs are supported");
  assert.equal(manifest.execution?.selectionModesObserved?.["single-pass"], 52, "manifest must identify 52 single-pass decisions");
  assert.equal(manifest.execution?.queries, 52, "manifest decision count must be 52");
  assert.equal(manifest.execution?.headings, 200, "manifest must identify the frozen 200-heading catalog");
  assert.equal(manifest.execution?.sourceLabelFileReadByRunner, false, "runner must not read labels during inference");
  assert.equal(responses.status, "complete", "responses must be complete");
  assert.equal(responses.sourceLabelFileRead, false, "responses must confirm labels were not read by the runner");
  assert.equal(responses.runId, manifest.runId, "response and manifest run IDs differ");
  assert.equal(summary.status, "complete", "run summary must be complete");
  assert.equal(summary.successfulCalls, 52, "all 52 provider calls must have succeeded");
  assert.equal(summary.failedCalls, 0, "failed-call runs are outside this evaluator");
  assert.equal(cases.cases.length, 26, "expected 26 bilingual cases");
  assert.equal(corpus.documents.length, 21, "expected the frozen 21-document corpus");
  assert.equal(labels.humanOwnerAdjudication, false, "this report is scoped to non-owner labels");
  assert.equal(labels.exposedToSearchEngine, false, "frozen labels must not have been exposed to search");

  const expectedIds = new Set(cases.cases.map((item) => item.id));
  assert.equal(expectedIds.size, cases.cases.length, "case IDs must be unique");
  assert.deepEqual(new Set(Object.keys(labels.cases)), expectedIds, "label IDs must exactly match case IDs");
  assert.deepEqual(new Set(Object.keys(targetIndex.targetIndex)), expectedIds, "target IDs must exactly match case IDs");
  for (const caseItem of cases.cases) {
    const label = labels.cases[caseItem.id];
    const target = targetIndex.targetIndex[caseItem.id];
    assert.ok(label.sourceRef && label.targetHeading, `missing frozen label for ${caseItem.id}`);
    assert.equal(label.sourceRef, target.sourceRef, `label/source target mismatch for ${caseItem.id}`);
    assert.equal(label.targetHeading, target.targetHeading, `label/heading target mismatch for ${caseItem.id}`);
    assert.ok(Array.isArray(target.targetHeadingPath) && target.targetHeadingPath.length > 0, `missing full target path for ${caseItem.id}`);
    assert.ok(caseItem.en && caseItem.es, `both language queries are required for ${caseItem.id}`);
  }

  assert.equal(responses.records.length, 52, "expected exactly one output per case and language");
  const seenKeys = new Set();
  const records = [];
  for (const response of responses.records) {
    assert.ok(expectedIds.has(response.caseId), `unknown response case ${response.caseId}`);
    assert.ok(["en", "es"].includes(response.language), `unknown language ${response.language}`);
    const key = `${response.caseId}:${response.language}`;
    assert.ok(!seenKeys.has(key), `duplicate response ${key}`);
    seenKeys.add(key);
    assert.equal(response.selectionMode, "single-pass", `${key} is not single-pass`);
    assert.ok(["selected", "abstained"].includes(response.status), `${key} has an unsupported status`);
    const headingCandidateCount = verifyCandidateHeadingCount(response, manifest.execution.headings);
    assert.equal(response.providerCalls, 1, `${key} must represent exactly one provider call`);
    assert.equal(response.model, manifest.execution.model, `${key} returned an unexpected model`);
    assertProbability(response.providerConfidence, `${key} providerConfidence`);
    if (response.status === "selected") {
      assert.ok(response.selected?.sourceRef, `${key} selected record lacks sourceRef`);
      assert.ok(Array.isArray(response.selected?.headingPath), `${key} selected record lacks headingPath`);
      assert.equal(response.exactFetch, "passed", `${key} selected evidence lacks a passing exact fetch`);
    } else {
      assert.equal(response.selected, null, `${key} abstention must not contain a selected range`);
    }
    const target = targetIndex.targetIndex[response.caseId];
    records.push({
      caseId: response.caseId,
      language: response.language,
      sourceDocument: target.sourceRef,
      status: response.status,
      confidence: response.providerConfidence,
      headingCandidateCount,
      correct: response.status === "selected" ? Number(exactTarget(response, target)) : null,
    });
  }
  assert.equal(seenKeys.size, 52, "some case/language pairs are missing");
  assert.equal(records.filter((row) => row.status === "selected").length, 50, "selected count differs from frozen run summary");
  assert.equal(records.filter((row) => row.status === "abstained").length, 2, "abstention count differs from frozen run summary");
  return { runDir, manifest, cases, corpus, labels, targetIndex, responses, runInventory, choiceCardinality, records: stableRows(records) };
}

function summarizeCardinalityScenario(records, scenario) {
  const selected = records.filter((row) => row.status === "selected");
  const probabilities = selected.map((row) => normalizedChoiceConfidenceToPmax(row.confidence, scenario.optionCount));
  const outcomes = selected.map((row) => row.correct);
  const scoredRows = selected.map((row, index) => ({ ...row, pmax: probabilities[index] }));
  const riskCoverage = [];
  const eligible = records.length;
  for (let thresholdIndex = 0; thresholdIndex <= 20; thresholdIndex += 1) {
    const threshold = thresholdIndex / 20;
    const accepted = scoredRows.filter((row) => row.pmax >= threshold);
    const errors = accepted.filter((row) => row.correct === 0).length;
    riskCoverage.push({
      threshold: round(threshold),
      accepted: accepted.length,
      eligibleDecisions: eligible,
      coverage: round(accepted.length / eligible),
      errors,
      selectiveRisk: accepted.length ? round(errors / accepted.length) : null,
    });
  }
  const bins = fixedReliabilityBins(scoredRows).map((bin) => ({
    ...bin,
    meanTopChoiceProbability: round(bin.meanTopChoiceProbability),
    exactTargetRateAmongSelected: round(bin.exactTargetRateAmongSelected),
  }));
  const byLanguage = Object.fromEntries(["en", "es"].map((language) => {
    const languageRows = records.filter((row) => row.language === language);
    const languageSelected = languageRows.filter((row) => row.status === "selected");
    const languageProbabilities = languageSelected.map((row) => normalizedChoiceConfidenceToPmax(row.confidence, scenario.optionCount));
    const languageOutcomes = languageSelected.map((row) => row.correct);
    const languageScored = languageSelected.map((row, index) => ({ ...row, pmax: languageProbabilities[index] }));
    return [language, {
      decisions: languageRows.length,
      selected: languageSelected.length,
      abstentions: languageRows.length - languageSelected.length,
      strictExactTargetCorrect: languageOutcomes.reduce((sum, value) => sum + value, 0),
      binaryBrier: round(binaryBrier(languageProbabilities, languageOutcomes)),
      binaryLogLoss: round(binaryLogLoss(languageProbabilities, languageOutcomes)),
      reliabilityBins: fixedReliabilityBins(languageScored).map((bin) => ({
        ...bin,
        meanTopChoiceProbability: round(bin.meanTopChoiceProbability),
        exactTargetRateAmongSelected: round(bin.exactTargetRateAmongSelected),
      })),
    }];
  }));

  return {
    id: scenario.id,
    optionCount: scenario.optionCount,
    additionalOptionCount: scenario.additionalOptionCount,
    assumption: scenario.assumption,
    binaryBrier: round(binaryBrier(probabilities, outcomes)),
    binaryLogLoss: round(binaryLogLoss(probabilities, outcomes)),
    byLanguage,
    reliabilityBins: bins,
    riskCoverage,
  };
}

export function summarizeRun(verified) {
  const { records, manifest, choiceCardinality } = verified;
  const selected = records.filter((row) => row.status === "selected");
  const outcomes = selected.map((row) => row.correct);
  const cardinalityScenarios = choiceCardinality.scenarios.map((scenario) => summarizeCardinalityScenario(records, scenario));

  return {
    schemaVersion: 2,
    runId: manifest.runId,
    runDirectory: basename(verified.runDir),
    sourceHashes: Object.fromEntries(["cases.json", "corpus.json", "labels.json", "target-index.json"]
      .map((name) => [name, manifest.inputs[name].sha256.toLowerCase()])),
    runInventoryHashes: verified.runInventory,
    sourceProvenance: {
      packageVersion: manifest.repository?.packageVersionAtRun ?? null,
      headAtRunKnown: manifest.repository?.headAtRunKnown ?? null,
      workingTreeDirtyAtManifest: manifest.repository?.workingTreeDirtyAtManifest ?? null,
      buildId: manifest.repository?.buildReceiptAtRun?.id ?? null,
      branchAtManifest: manifest.repository?.branchAtManifest ?? null,
    },
    evaluationClass: "exploratory-top-label-confidence-diagnostic",
    choiceProbability: {
      status: choiceCardinality.status,
      transformId: TRANSFORM_ID,
      formula: "pmax = 1/n + confidence * (1 - 1/n)",
      source: TRANSFORM_URL,
      candidateCountField: "responses.records[].candidateCount (also copied to finalistCount by runner fallback)",
      headingCandidateCount: choiceCardinality.headingCandidateCount,
      verifiedOptionCount: choiceCardinality.verifiedOptionCount,
      sourceEvidence: choiceCardinality.evidence,
      scenarios: choiceCardinality.scenarios,
      scenarioSetExhaustive: choiceCardinality.scenarioSetExhaustive,
      caveat: "Every reconstructed pmax and metric is conditional on an explicit option-count scenario. No final Choice count is verified for these dirty historical runs; the committed run HEAD is not treated as evidence of the dirty runtime source.",
    },
    counts: {
      decisions: records.length,
      selected: selected.length,
      abstentions: records.length - selected.length,
      strictExactTargetCorrect: outcomes.reduce((sum, value) => sum + value, 0),
      strictExactTargetIncorrect: outcomes.reduce((sum, value) => sum + (1 - value), 0),
      scoredSelectedDecisions: selected.length,
      independentUnits: new Set(records.map((row) => row.sourceDocument)).size,
      documentsInFrozenCorpus: verified.corpus.documents.length,
      languagesPerCase: 2,
    },
    topLabelMetrics: {
      status: "conditional-on-assumed-option-count-scenario",
      interpretation: "Exploratory binary top-label proper scores: reconstructed Choice mass on the selected option versus strict single-heading exact-match among selected answers. Results vary with the assumed option count and are not independent calibration evidence or a measure of evidence sufficiency.",
      scenarios: cardinalityScenarios.map(({ id, optionCount, assumption, binaryBrier: brier, binaryLogLoss: logLoss }) => ({
        id, optionCount, assumption, binaryBrier: brier, binaryLogLoss: logLoss,
      })),
    },
    byLanguage: Object.fromEntries(["en", "es"].map((language) => [language, {
      decisions: records.filter((row) => row.language === language).length,
      selected: records.filter((row) => row.language === language && row.status === "selected").length,
      abstentions: records.filter((row) => row.language === language && row.status === "abstained").length,
      strictExactTargetCorrect: records.filter((row) => row.language === language && row.status === "selected" && row.correct === 1).length,
      scenarios: cardinalityScenarios.map((scenario) => ({ id: scenario.id, optionCount: scenario.optionCount, ...scenario.byLanguage[language] })),
    }])),
    reliabilityBins: {
      status: "conditional-on-assumed-option-count-scenario",
      scenarios: cardinalityScenarios.map(({ id, optionCount, assumption, reliabilityBins }) => ({ id, optionCount, assumption, bins: reliabilityBins })),
    },
    riskCoverage: {
      status: "exploratory-only-conditional-on-assumed-option-count-scenario",
      denominator: "all 52 decisions; abstentions are not accepted at any threshold",
      scenarios: cardinalityScenarios.map(({ id, optionCount, assumption, riskCoverage: thresholds }) => ({ id, optionCount, assumption, thresholds })),
      noThresholdRecommendation: true,
    },
    multiclass: getMulticlassEvaluation(verified.responses.records, verified.targetIndex.targetIndex),
    limitations: [
      "Labels are Luna-reviewed and were not exposed during inference, but they were not adjudicated by the document owner and are not independent human ground truth.",
      `The run was captured from a dirty source tree (package ${manifest.repository?.packageVersionAtRun ?? "unknown"}, build ${manifest.repository?.buildReceiptAtRun?.id ?? "not recorded"}); consult the manifest's source hashes before replay or comparison.`,
      "The single expected heading per query is strict; multiple semantically acceptable evidence ranges have not been independently adjudicated.",
      "The query-level split reuses the same 21 source documents; this does not test generalization to unseen documents or projects.",
      "Each language pair shares a concept and source document; 52 decisions are not 52 independent units.",
      `The run-time selector source is not preserved at a fingerprint matching the dirty run. The ${manifest.execution.headings} headings-only and ${manifest.execution.headings}+1 (one none option) cardinalities are sensitivity assumptions, not verified facts; the recorded run HEAD is not used to infer them.`,
      "Abstention quality has no independent labels; abstentions are reported and excluded from top-label proper scores.",
      "This report does not select a production threshold or authorize any production behavior change.",
    ],
    records: records.map((row) => ({
      ...row,
      conditionalTopChoiceMassByOptionCount: row.status === "selected"
        ? Object.fromEntries(choiceCardinality.scenarios.map((scenario) => [
          String(scenario.optionCount),
          round(normalizedChoiceConfidenceToPmax(row.confidence, scenario.optionCount)),
        ]))
        : null,
    })),
    cardinalityScenarios,
  };
}

export function evaluateRun(runDir) {
  return summarizeRun(validateRun(runDir));
}

function parseArgs(argv) {
  const args = { runs: [], out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--run") args.runs.push(argv[++index]);
    else if (flag === "--out") args.out = argv[++index];
    else if (flag === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  assert.ok(args.runs.every(Boolean), "--run requires a directory value");
  return args;
}

export function renderMarkdown(reports) {
  const lines = [
    "# Jev 80k single-pass confidence diagnostic",
    "",
    "Conditional exploratory offline report from frozen historical runs. It supersedes the earlier n=200 report and the n=201 source-verified report: both runs were captured from dirty trees, and neither has a preserved selector source file matched to the run-time fingerprint. No actual final Choice option count is verified. This is not production calibration.",
    "",
    "## Method",
    "",
    `Both frozen manifests record 200 heading candidates and dirty run source. The v2 manifest captures a selector-source hash, but the matching source file is not preserved in the archive; v1 captured no selector-source hash. The recorded Git run HEAD is not proof of the code in those dirty working trees. Accordingly, this report shows conditional sensitivity scenarios: n=200 if the final Choice consisted only of headings, and n=201 if it added exactly one \`none\` option. These scenarios are not exhaustive if the dirty source added a different number of options. The runner copied \`finalistCount\` from \`candidateCount\` when absent, so neither field independently establishes final Choice cardinality. For each assumed n, the evaluator applies the documented TypeSafe normalized Choice confidence inverse (${TRANSFORM_ID}): pmax = 1/n + confidence * (1 - 1/n) ([documentation](${TRANSFORM_URL})). Resulting pmax is the conditional mass assigned to the chosen option. Binary top-label scores compare that mass with strict heading match among selected answers; they do not establish independent calibration or evidence sufficiency. Full multiclass scores are unavailable because no complete candidate probability vectors were persisted.`,
    "",
    "## Results",
    "",
    "Every Brier/log-loss value and every probability-derived curve below is conditional on the column's assumed option count; none is based on a verified final Choice count.",
    "",
    "| Run | Version / build | Dirty source | Selected | Abstained | Strict target matches | Brier n=200 | Brier n=201 | Log-loss n=200 | Log-loss n=201 | Distinct source documents |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const report of reports) {
    const provenance = report.sourceProvenance;
    const scoreFor = (optionCount) => report.topLabelMetrics.scenarios.find((scenario) => scenario.optionCount === optionCount);
    const n200 = scoreFor(200);
    const n201 = scoreFor(201);
    lines.push(`| ${report.runId} | ${provenance.packageVersion ?? "unknown"} / ${provenance.buildId ?? "no receipt"} | ${provenance.workingTreeDirtyAtManifest} | ${report.counts.selected} | ${report.counts.abstentions} | ${report.counts.strictExactTargetCorrect}/${report.counts.scoredSelectedDecisions} | ${n200?.binaryBrier ?? "—"} | ${n201?.binaryBrier ?? "—"} | ${n200?.binaryLogLoss ?? "—"} | ${n201?.binaryLogLoss ?? "—"} | ${report.counts.independentUnits} |`);
    for (const language of ["en", "es"]) {
      const metrics = report.byLanguage[language];
      const langScore = (optionCount) => metrics.scenarios.find((scenario) => scenario.optionCount === optionCount);
      lines.push(`| ↳ ${language} | same run | — | ${metrics.selected} | ${metrics.abstentions} | ${metrics.strictExactTargetCorrect}/${metrics.selected} | ${langScore(200)?.binaryBrier ?? "—"} | ${langScore(201)?.binaryBrier ?? "—"} | ${langScore(200)?.binaryLogLoss ?? "—"} | ${langScore(201)?.binaryLogLoss ?? "—"} | — |`);
    }
  }
  for (const report of reports) {
    for (const scenario of report.cardinalityScenarios) {
      lines.push("", `### Conditional reliability bins — ${report.runId}, n=${scenario.optionCount} assumed`, "", `Assumption: ${scenario.assumption}`, "", "| Assumed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |", "|---|---:|---:|---:|---:|");
      for (const bin of scenario.reliabilityBins) {
        lines.push(`| ${bin.interval} | ${bin.support} | ${bin.meanTopChoiceProbability ?? "—"} | ${bin.exactTargetRateAmongSelected ?? "—"} | ${bin.correct} |`);
      }
      lines.push("", `### Exploratory conditional risk-coverage — ${report.runId}, n=${scenario.optionCount} assumed`, "", "| Minimum assumed top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |", "|---:|---:|---:|---:|---:|");
      for (const row of scenario.riskCoverage.filter((item) => [0, 0.5, 0.7, 0.85, 0.9].includes(item.threshold))) {
        lines.push(`| ${row.threshold} | ${row.accepted}/52 | ${row.coverage} | ${row.errors}/${row.accepted} | ${row.selectiveRisk ?? "—"} |`);
      }
      lines.push("", "Risk-coverage is an exploratory sweep over strict labels and selected outputs under this assumed n; it is not a reliable risk guarantee or threshold recommendation.");
    }
  }
  lines.push(
    "",
    "## Limits",
    "",
    "- Labels were hidden from inference and reviewed by Luna, but there is no independent document-owner ground truth.",
    "- Each query has one strict target heading. Alternative valid ranges have not been adjudicated.",
    "- The grouped query split reuses all 21 source documents; the two languages and repeated runs are paired, not independent samples.",
    "- Both runs came from dirty source trees. v1 has no selector source hash; v2 has a selector source fingerprint but not the exact matching source file. The recorded Git run HEAD does not establish dirty run-time contents.",
    "- n=200 and n=201 are sensitivity assumptions, not verified final Choice cardinalities. Other option counts are possible if the unpreserved selector source added a different number of options.",
    "- Abstention correctness is unlabeled. Abstentions are visible and excluded from top-label Brier/log-loss.",
    "- Multiclass Brier/log-loss are unavailable because complete per-option probability vectors are absent.",
    "- No production threshold is recommended. The data are too small and not owner-adjudicated for a production claim.",
    "",
  );
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node evaluate.mjs [--run <run-dir>]... [--out <new-output-stem>]\n");
    return;
  }
  const runDirs = args.runs.length ? args.runs : DEFAULT_RUNS.map((path) => resolve(here, path));
  const reports = runDirs.map((runDir) => evaluateRun(runDir));
  if (reports.length > 1) {
    for (const report of reports.slice(1)) {
      assert.deepEqual(report.sourceHashes, reports[0].sourceHashes, "paired run inputs differ; report them separately instead of comparing as repeats");
    }
  }
  const outStem = resolve(here, args.out ?? DEFAULT_OUT);
  const jsonPath = `${outStem}.json`;
  const markdownPath = `${outStem}.md`;
  assert.ok(!existsSync(jsonPath) && !existsSync(markdownPath), `refusing to overwrite report output: ${outStem}`);
  mkdirSync(dirname(outStem), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify({
    schemaVersion: 2,
    status: "conditional-exploratory-report",
    supersedes: [
      "2026-10-04-80k-singlepass-exploratory",
      "2026-10-04-80k-singlepass-exploratory-corrected",
    ],
    correction: "The prior report's n=200 and corrected report's n=201 are both conditional scenarios. Neither run has a verified final Choice count because the run-time selector source is dirty and no exact matching source file is preserved.",
    reports,
  }, null, 2)}\n`, { flag: "wx" });
  writeFileSync(markdownPath, renderMarkdown(reports), { flag: "wx" });
  process.stdout.write(`Wrote ${jsonPath}\nWrote ${markdownPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
