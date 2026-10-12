import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serializeJevEvidenceMetrics, serializeJevSelectionDiagnostics } from "../experiments/jev-mssr-live/selection-record.mjs";
import {
  acquireExclusiveRunLock,
  validateEvidencePack,
  validateFetchResult,
  validateLabelHeadingPaths,
  validateRunInputs,
} from "../experiments/jev-mssr-live/runner-support.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summarizer = path.join(root, "experiments/jev-mssr-live/summarize-run.mjs");
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-jev-summary-test-"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = async (target, value) => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return bytes;
};
const writeChecksumIndex = async (directory, names) => {
  const rows = [];
  for (const name of names) {
    const bytes = await fs.readFile(path.join(directory, ...name.split("/")));
    rows.push(`${digest(bytes)}  ${name}`);
  }
  await fs.writeFile(path.join(directory, "SHA256SUMS"), `${rows.join("\n")}\n`);
};
const invoke = (directory, args = []) => spawnSync(process.execPath, [summarizer, directory, ...args], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});

const capturedJevMetrics = serializeJevEvidenceMetrics({
  providerConfidence: 0.44,
  confidenceCalibration: "uncalibrated",
  evidenceSufficiency: 0.58,
  noul: 0.91,
});
assert.deepEqual(capturedJevMetrics, {
  rawChoiceConfidence: 0.44,
  confidenceCalibration: "uncalibrated",
  evidenceSufficiency: 0.58,
  noul: 0.91,
});
assert.equal(serializeJevEvidenceMetrics({ sufficiency: 0.88, noul: 0.77 }).evidenceSufficiency, null,
  "unknown aliases must not impersonate canonical evidenceSufficiency");
const hierarchicalDiagnostics = serializeJevSelectionDiagnostics({
  selectionMode: "hierarchical",
  selectionPasses: 2,
  providerCalls: 3,
  finalistCount: 4,
  candidateRangeDiagnostics: { offered: 261, eligible: 260, oversizedOmitted: 1, maxFetchChars: 20_000, lengthUnit: "utf16-code-units" },
  rangeOverlapDiagnostics: { overlappingPairCount: 4, mutationApplied: false },
  batchAssessments: [{ batch: 1, candidateCount: 254, retainedFinalistCount: 2, retainedFinalists: [{ optionId: "h001", sourceRef: "docs/a.md", rangeId: "a-1" }] }],
  providersUsed: ["jev-provider"],
  modelsUsed: ["jev-model"],
});
assert.deepEqual(hierarchicalDiagnostics, {
  selectionMode: "hierarchical",
  selectionPasses: 2,
  providerCalls: 3,
  finalistCount: 4,
  candidateRangeDiagnostics: { offered: 261, eligible: 260, oversizedOmitted: 1, maxFetchChars: 20_000, lengthUnit: "utf16-code-units" },
  rangeOverlapDiagnostics: { overlappingPairCount: 4, mutationApplied: false },
  batchAssessments: [{ batch: 1, candidateCount: 254, retainedFinalistCount: 2, retainedFinalists: [{ optionId: "h001", sourceRef: "docs/a.md", rangeId: "a-1" }] }],
  providersUsed: ["jev-provider"],
  modelsUsed: ["jev-model"],
});
assert.deepEqual(serializeJevSelectionDiagnostics({ jevCallMade: false }), {
  selectionMode: "not-run",
  selectionPasses: 0,
  providerCalls: 0,
  finalistCount: 0,
  candidateRangeDiagnostics: null,
  rangeOverlapDiagnostics: null,
  batchAssessments: [],
  providersUsed: [],
  modelsUsed: [],
}, "a no-call response must report zero provider calls without inventing selector diagnostics");

try {
  const fixtureText = "\nExact fixture evidence.\n";
  const fixtureFingerprint = digest(Buffer.from(fixtureText.trim(), "utf8"));
  const fixtureHandle = {
    id: "fixture-handle-01",
    version: 1,
    owner: "D:\\Dev\\mssr",
    sourceRef: "docs/one.md",
    revision: "fixture-revision-01",
    rangeId: "sample-heading",
    rangeKind: "section",
    startLine: 1,
    endLine: 3,
    startOffset: 0,
    endOffset: fixtureText.length,
    fingerprint: fixtureFingerprint,
    privacyClass: "project-metadata",
  };
  const fixtureCase = { id: "fixture-01", sourceRef: fixtureHandle.sourceRef, query: "What is the exact fixture evidence?" };
  const fixtureLabel = { caseId: fixtureCase.id, sourceRef: fixtureCase.sourceRef, expectedHeading: "Sample" };
  assert.equal(validateRunInputs([fixtureCase], { cases: [fixtureLabel] }, [fixtureCase.sourceRef]), true);
  assert.equal(validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, expectedHeading: "Sample" }] }, [fixtureCase.sourceRef]), true,
    "legacy labels may infer sourceRef from their matching case");
  assert.equal(validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, answerability: "unanswerable" }] }, [fixtureCase.sourceRef]), true,
    "explicit unanswerable labels do not require a positive target range");
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, answerability: "unknown" }] }, [fixtureCase.sourceRef]), /answerability must be answerable or unanswerable/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, answerability: "unanswerable", expectedHeading: "Sample" }] }, [fixtureCase.sourceRef]), /must not define expectedHeading/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, answerability: "answerable" }] }, [fixtureCase.sourceRef]), /needs an expectedHeading/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ ...fixtureLabel, sourceRef: "docs/other.md" }] }, [fixtureCase.sourceRef]), /sourceRef must match its case/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ ...fixtureLabel, acceptableRanges: [{ sourceRef: "docs/other.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }] }] }, [fixtureCase.sourceRef]), /acceptable range must use its case sourceRef/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ ...fixtureLabel, acceptableRanges: [{ sourceRef: fixtureCase.sourceRef, expectedHeading: "Different", startLine: 1, endLine: 3 }] }] }, [fixtureCase.sourceRef]), /primary heading\/range must appear in acceptableRanges/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ ...fixtureLabel, relevantRanges: [{ sourceRef: "docs/other.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }] }] }, [fixtureCase.sourceRef]), /relevant range must use its case sourceRef/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [{ caseId: fixtureCase.id, answerability: "unanswerable", relevantRanges: [] }] }, [fixtureCase.sourceRef]), /must not define relevantRanges/u);
  assert.throws(() => validateRunInputs([fixtureCase, fixtureCase], { cases: [fixtureLabel, fixtureLabel] }, [fixtureCase.sourceRef]), /duplicate case id/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [] }, [fixtureCase.sourceRef]), /one-to-one mapping/u);
  assert.throws(() => validateRunInputs([fixtureCase], { cases: [fixtureLabel] }, []), /absent from the frozen corpus/u);

  const headingFixtureSource = [
    "# Root",
    "Introductory text.",
    "## Capabilities",
    "Capability overview.",
    "## Exact metadata filters",
    "Host composition is described here.",
  ].join("\n");
  const headingFixtureLabel = {
    cases: [{
      caseId: "heading-scope",
      sourceRef: "docs/heading-fixture.md",
      answerability: "answerable",
      expectedHeading: "Exact metadata filters",
      expectedStartLine: 6,
      expectedEndLine: 6,
      acceptableRanges: [{
        sourceRef: "docs/heading-fixture.md",
        expectedHeading: "Exact metadata filters",
        startLine: 6,
        endLine: 6,
      }],
    }],
  };
  const headingFixtureCase = { id: "heading-scope", sourceRef: "docs/heading-fixture.md" };
  assert.equal(validateLabelHeadingPaths([headingFixtureCase], headingFixtureLabel, new Map([[
    "docs/heading-fixture.md", headingFixtureSource,
  ]])), true, "labels may target a heading's own line");
  assert.throws(() => validateLabelHeadingPaths([headingFixtureCase], { cases: [{
    ...headingFixtureLabel.cases[0],
    expectedHeading: "Capabilities",
    acceptableRanges: [{
      ...headingFixtureLabel.cases[0].acceptableRanges[0],
      expectedHeading: "Capabilities",
    }],
  }] }, new Map([["docs/heading-fixture.md", headingFixtureSource]])), /not in the heading path/u,
  "a label must not bind a range to an unrelated sibling heading");
  assert.throws(() => validateLabelHeadingPaths([headingFixtureCase], headingFixtureLabel, new Map()), /source text is missing/u);
  assert.throws(() => validateLabelHeadingPaths([headingFixtureCase], { cases: [{
    ...headingFixtureLabel.cases[0],
    expectedStartLine: 4,
    expectedEndLine: 99,
    acceptableRanges: [{ ...headingFixtureLabel.cases[0].acceptableRanges[0], startLine: 4, endLine: 99 }],
  }] }, new Map([["docs/heading-fixture.md", headingFixtureSource]])), /endLine 99 exceeds/u,
  "a label range must not extend past the frozen source");
  const fencedHeadingSource = "# Root\n```md\n## Fake heading\n```\n## Real heading\nText.";
  assert.throws(() => validateLabelHeadingPaths([headingFixtureCase], { cases: [{
    ...headingFixtureLabel.cases[0],
    expectedHeading: "Fake heading",
    expectedStartLine: 3,
    acceptableRanges: [{ ...headingFixtureLabel.cases[0].acceptableRanges[0], expectedHeading: "Fake heading", startLine: 3 }],
  }] }, new Map([["docs/heading-fixture.md", fencedHeadingSource]])), /not in the heading path/u,
  "Markdown-like headings inside fenced examples must not authorize labels");

  const fixtureFetch = {
    handle: fixtureHandle,
    text: fixtureText,
    fingerprint: fixtureFingerprint,
    projectOwner: fixtureHandle.owner,
    advisoryOnly: true,
    truthAuthority: false,
  };
  assert.deepEqual(validateFetchResult(fixtureFetch, fixtureHandle, fixtureText), { passed: true, errors: [] });
  const missingSnapshotRange = validateFetchResult(fixtureFetch, fixtureHandle);
  assert.equal(missingSnapshotRange.passed, false, "exact fetch verification must require the frozen source-range text");
  const wrongFetchFingerprint = validateFetchResult({ ...fixtureFetch, fingerprint: digest(Buffer.from(fixtureText, "utf8")) }, fixtureHandle, fixtureText);
  assert.equal(wrongFetchFingerprint.passed, false, "section fingerprints cover trimmed range content, not outer range whitespace");
  const fixtureBlockText = "Exact fixture block evidence.";
  const blockHandle = {
    ...fixtureHandle,
    rangeKind: "block",
    startOffset: 0,
    endOffset: fixtureBlockText.length,
    fingerprint: digest(Buffer.from(fixtureBlockText, "utf8")),
  };
  const blockFetch = {
    ...fixtureFetch,
    handle: blockHandle,
    text: fixtureBlockText,
    fingerprint: blockHandle.fingerprint,
  };
  assert.deepEqual(validateFetchResult(blockFetch, blockHandle, fixtureBlockText),
    { passed: true, errors: [] }, "normal block fingerprints cover their exact trimmed offsets");
  const fixtureListItemText = "  - Exact fixture list item.";
  const listItemHandle = {
    ...blockHandle,
    rangeId: "sample-list/item-1",
    startOffset: 0,
    endOffset: fixtureListItemText.length,
    fingerprint: digest(Buffer.from(fixtureListItemText, "utf8")),
  };
  assert.deepEqual(validateFetchResult({
    ...blockFetch,
    handle: listItemHandle,
    text: fixtureListItemText,
    fingerprint: listItemHandle.fingerprint,
  }, listItemHandle, fixtureListItemText), { passed: true, errors: [] },
  "list-item block fingerprints preserve indentation in their exact indexed slice");
  assert.equal(validateFetchResult({
    ...blockFetch,
    handle: listItemHandle,
    text: fixtureListItemText,
    fingerprint: digest(Buffer.from(fixtureListItemText.trim(), "utf8")),
  }, listItemHandle, fixtureListItemText).passed, false,
  "list-item fingerprints must not trim indexed indentation");
  const missingFetchFingerprint = validateFetchResult({ ...fixtureFetch, fingerprint: undefined }, fixtureHandle, fixtureText);
  assert.equal(missingFetchFingerprint.passed, false, "missing fetch fingerprints must not count as a successful exact fetch");
  const wrongFetchText = validateFetchResult({ ...fixtureFetch, text: " Exact fixture evidence.\n" }, fixtureHandle, fixtureText);
  assert.equal(wrongFetchText.passed, false, "trim-equivalent text must still match the frozen source range byte-for-byte");

  const fixturePack = {
    schemaVersion: 1,
    kind: "mssr-librarian-evidence-pack",
    assembly: "verbatim-source-ranges",
    projectOwner: fixtureHandle.owner,
    sourceCount: 1,
    paragraphs: [{
      ordinal: 1,
      exactText: fixtureText,
      citation: {
        display: "docs/one.md:L1-L3",
        handleId: fixtureHandle.id,
        owner: fixtureHandle.owner,
        sourceRef: fixtureHandle.sourceRef,
        revision: fixtureHandle.revision,
        rangeId: fixtureHandle.rangeId,
        rangeKind: fixtureHandle.rangeKind,
        startLine: fixtureHandle.startLine,
        endLine: fixtureHandle.endLine,
        fingerprint: fixtureFingerprint,
        privacyClass: fixtureHandle.privacyClass,
      },
    }],
    totalFetchedChars: fixtureText.length,
    advisoryOnly: true,
    truthAuthority: false,
    canonicalRewriteAllowed: false,
  };
  assert.deepEqual(validateEvidencePack(fixturePack, fixtureHandle, fixtureText), { passed: true, errors: [] });
  assert.equal(validateEvidencePack({
    ...fixturePack,
    paragraphs: [{ ...fixturePack.paragraphs[0], citation: {
      ...fixturePack.paragraphs[0].citation,
      fingerprint: digest(Buffer.from(fixtureText, "utf8")),
    } }],
  }, fixtureHandle, fixtureText).passed, false,
  "section evidence-pack citations must use the selected section fingerprint contract");
  assert.equal(validateEvidencePack({ ...fixturePack, kind: "failed", paragraphs: [] }, fixtureHandle, fixtureText).passed, false,
    "a malformed or empty pack must not count as built");

  const lockDirectory = path.join(scratch, "exclusive-lock-test");
  await fs.mkdir(lockDirectory, { recursive: true });
  const lockPath = path.join(lockDirectory, ".runner.lock");
  const lockResults = await Promise.allSettled([
    acquireExclusiveRunLock(lockPath),
    acquireExclusiveRunLock(lockPath),
  ]);
  const acquired = lockResults.filter((result) => result.status === "fulfilled");
  const refused = lockResults.filter((result) => result.status === "rejected");
  assert.equal(acquired.length, 1, "only one runner may acquire a packet lock");
  assert.equal(refused.length, 1);
  assert.match(String(refused[0].reason), /exclusive run lock already exists/u);
  await acquired[0].value();
  await assert.rejects(fs.access(lockPath), "released run locks must be removed");

  const generic = path.join(scratch, "generic");
  const genericCases = [
    { id: "heading-one", sourceRef: "docs/a.md", expectedHeading: "# Overview", expectedStartLine: 2, expectedEndLine: 3 },
    { id: "heading-three", sourceRef: "docs/b.md", expectedHeading: "### History", expectedStartLine: 10, expectedEndLine: 11 },
    { id: "abstain", sourceRef: "docs/c.md", expectedHeading: "# Missing", expectedStartLine: 30, expectedEndLine: 30 },
  ];
  const genericManifest = {
    schemaVersion: 1,
    runId: "generic-test-v1",
    createdAt: "2026-10-11T00:00:00Z",
    plan: { expectedRequestCount: 3, independentUnit: "source-document clusters; 5 only" },
  };
  const genericManifestBytes = await writeJson(path.join(generic, "manifest.json"), genericManifest);
  await writeJson(path.join(generic, "run-completion.json"), {
    runId: genericManifest.runId,
    manifestSha256: digest(genericManifestBytes),
    status: "complete",
    attemptedRequests: 3,
  });
  await writeJson(path.join(generic, "inputs/cases.json"), { schemaVersion: 1, cases: genericCases });
  await writeJson(path.join(generic, "inputs/labels.json"), {
    source: "frozen-offline-fixture",
    adjudication: "independent fixture labels",
    cases: genericCases.map(({ id, sourceRef, expectedHeading, expectedStartLine, expectedEndLine }) => ({
      caseId: id,
      sourceRef,
      expectedHeading,
      expectedStartLine,
      expectedEndLine,
      acceptableRanges: [{ sourceRef, expectedHeading, startLine: expectedStartLine, endLine: expectedEndLine }],
      ...(id === "heading-three" ? { relevantRanges: [{ sourceRef, expectedHeading, startLine: 9, endLine: 12 }] } : {}),
    })),
  });
  const genericRecords = [
    {
      caseId: "heading-one", sourceRef: "docs/a.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "A section", headingPath: ["Root", "## Overview"], handle: { sourceRef: "docs/a.md", startLine: 2, endLine: 3 } }] },
      jev: { status: "selected", ...capturedJevMetrics, usage: { input_tokens: 10, output_tokens: 2 }, selected: { title: "Overview", handle: { rangeId: "heading-1", startLine: 2, endLine: 3 } } },
      fetch: { passed: true }, evidencePack: { status: "validated", passed: true }, startedAt: "2026-10-11T00:00:01Z", completedAt: "2026-10-11T00:00:02Z",
    },
    {
      caseId: "heading-three", sourceRef: "docs/b.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "Historical overview", headingPath: ["Parent", "### History"], handle: { sourceRef: "docs/b.md", startLine: 9, endLine: 12 } }] },
      jev: { status: "selected", rawChoiceConfidence: 0.72, noul: 0.33, usage: { input_tokens: 20, output_tokens: 3 }, selected: { title: " History ", handle: { rangeId: "heading-2", startLine: 9, endLine: 12 } } },
      fetch: { passed: true }, evidencePack: { status: "complete", passed: true }, startedAt: "2026-10-11T00:00:03Z", completedAt: "2026-10-11T00:00:04Z",
    },
    {
      caseId: "abstain", sourceRef: "docs/c.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "Missing details", headingPath: ["Archive", "Missing context"] }] },
      jev: { status: "abstained", rawChoiceConfidence: 0.21, usage: { input_tokens: 30, output_tokens: 1 }, selected: null },
      fetch: { passed: false }, evidencePack: { status: "not-built", passed: false }, startedAt: "2026-10-11T00:00:05Z", completedAt: "2026-10-11T00:00:06Z",
    },
  ];
  const genericRecordsPath = path.join(generic, "records.jsonl");
  const genericRecordsBytes = Buffer.from(`${genericRecords.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);
  const genericChecksumFiles = ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl", "inputs/labels.json"];
  await writeChecksumIndex(generic, genericChecksumFiles);
  const genericResult = invoke(generic);
  assert.equal(genericResult.status, 0, genericResult.stderr);
  const genericSummary = JSON.parse(genericResult.stdout);
  assert.equal(genericSummary.schemaProfile, "generic-librarian-run-v1");
  assert.equal(genericSummary.sourceDocumentClusters, 3);
  assert.match(genericSummary.clusterInterpretation, /does not establish independent statistical sampling/u);
  assert.equal(genericSummary.independentUnit, "source-document cluster (descriptive grouping only)");
  assert.equal(genericSummary.declaredIndependentUnitUnverified, "source-document clusters; 5 only");
  assert.match(genericSummary.independentUnitDeclarationInterpretation, /not verified/u);
  assert.equal(genericSummary.labelMetrics.normalizedExactHeadingMatches, 2);
  assert.equal(genericSummary.labelMetrics.exactAcceptedRangeMatches, 1,
    "heading match must not be confused with an exact accepted source-range match");
  assert.equal(genericSummary.labelMetrics.exactAcceptedRangeDenominator, 3);
  assert.equal(genericSummary.labelMetrics.records[0].exactAcceptedRangeMatch, true);
  assert.equal(genericSummary.labelMetrics.records[1].normalizedExactHeadingMatch, true);
  assert.equal(genericSummary.labelMetrics.records[1].exactAcceptedRangeMatch, false,
    "a broader selected section must not count as the exact expected line range");
  assert.equal(genericSummary.labelMetrics.records[1].relevantRangeMatch, true,
    "a broader selected section may count only when its exact range is independently labeled relevant");
  assert.equal(genericSummary.labelMetrics.records[1].decisionCorrect, true,
    "an answerable selection in a pre-labeled relevant range counts as useful retrieval");
  assert.equal(genericSummary.labelMetrics.answerabilityMetrics.answerable.correctExactRangeSelections, 1);
  assert.equal(genericSummary.labelMetrics.answerabilityMetrics.answerable.correctRelevantRangeSelections, 1);
  assert.equal(genericSummary.labelMetrics.searchExactAcceptedRangeFound, 1,
    "exact search-range matching must remain separate from broad candidate containment");
  assert.equal(genericSummary.labelMetrics.searchTargetRangeContainedAt100, 2,
    "a search candidate may contain the complete target without matching its exact boundaries");
  assert.equal(genericSummary.labelMetrics.searchTargetRangeContainmentDenominator, 3);
  assert.equal(genericSummary.labelMetrics.searchTargetLinesContainedAt100, 2);
  assert.equal(genericSummary.labelMetrics.searchRelevantRangeContainedAt100, 1,
    "relevant-range containment is reported separately from exact relevant-range equality");
  assert.match(genericSummary.labelMetrics.searchRangeMetricNote, /not semantic sufficiency/u);
  assert.equal(genericSummary.labelMetrics.searchTargetFound, 2);
  assert.equal(genericSummary.labelMetrics.records[0].searchTargetFound, true, "headingPath should count an exact normalized heading");
  assert.equal(genericSummary.labelMetrics.records[1].searchTargetFound, true, "headingPath component should count even if title differs");
  assert.equal(genericSummary.labelMetrics.records[2].searchTargetFound, false, "partial title/path matches must not count");
  assert.equal(genericSummary.evidenceSufficiencyCapture.recorded, 1);
  assert.equal(genericSummary.rawNoulCapture.recorded, 2);
  assert.equal(genericSummary.records[0].evidenceSufficiency, 0.58);
  assert.equal(genericSummary.records[0].providerNoul, 0.91);
  assert.equal(genericSummary.evidencePacksBuilt, 2,
    "validated evidence packs must count alongside legacy complete packs");
  assert.equal(genericSummary.records[0].evidencePackBuilt, true);
  assert.equal(genericSummary.calibrationClaim, false);
  assert.deepEqual(genericSummary.checksumFile.requiredFiles, genericChecksumFiles);
  await assert.rejects(fs.access(path.join(generic, "summary-calculated.json")), "stdout mode must not write run artifacts");

  const answerabilityRun = path.join(scratch, "answerability");
  const answerabilityCases = [
    { id: "answerable-exact", sourceRef: "docs/source.md", query: "Which exact range answers this?" },
    { id: "answerable-abstained", sourceRef: "docs/source.md", query: "Find the known answer." },
    { id: "answerable-wrong-range", sourceRef: "docs/source.md", query: "Find the exact child range." },
    { id: "answerable-relevant-range", sourceRef: "docs/source.md", query: "Find the answer with its surrounding section context." },
    { id: "answerable-conflicted", sourceRef: "docs/source.md", query: "Check a contradictory selected result." },
    { id: "unanswerable-abstained", sourceRef: "docs/source.md", query: "Which absent detail is stated?" },
    { id: "unanswerable-selected", sourceRef: "docs/source.md", query: "Find a fact this source does not contain." },
    { id: "unanswerable-failed", sourceRef: "docs/source.md", query: "Check an unavailable provider result." },
    { id: "unanswerable-conflicted", sourceRef: "docs/source.md", query: "Check a contradictory provider record." },
  ];
  const answerableLabel = (caseId) => ({
    caseId,
    sourceRef: "docs/source.md",
    answerability: "answerable",
    expectedHeading: "Target",
    expectedStartLine: 2,
    expectedEndLine: 3,
    acceptableRanges: [{ sourceRef: "docs/source.md", expectedHeading: "Target", startLine: 2, endLine: 3 }],
  });
  const answerabilityLabels = {
    source: "fixture-only",
    adjudication: "fixture-only; not owner-gold",
    cases: [
      answerableLabel("answerable-exact"),
      answerableLabel("answerable-abstained"),
      answerableLabel("answerable-wrong-range"),
      { ...answerableLabel("answerable-relevant-range"), relevantRanges: [{ sourceRef: "docs/source.md", expectedHeading: "Target", startLine: 1, endLine: 4 }] },
      answerableLabel("answerable-conflicted"),
      { caseId: "unanswerable-abstained", sourceRef: "docs/source.md", answerability: "unanswerable" },
      { caseId: "unanswerable-selected", sourceRef: "docs/source.md", answerability: "unanswerable" },
      { caseId: "unanswerable-failed", sourceRef: "docs/source.md", answerability: "unanswerable" },
      { caseId: "unanswerable-conflicted", sourceRef: "docs/source.md", answerability: "unanswerable" },
    ],
  };
  const answerabilityManifest = {
    schemaVersion: 1,
    runId: "answerability-diagnostic-v1",
    plan: { expectedRequestCount: answerabilityCases.length, independentUnit: "one fixture source cluster" },
  };
  const answerabilityManifestBytes = await writeJson(path.join(answerabilityRun, "manifest.json"), answerabilityManifest);
  await writeJson(path.join(answerabilityRun, "run-completion.json"), {
    runId: answerabilityManifest.runId,
    manifestSha256: digest(answerabilityManifestBytes),
    status: "complete",
    attemptedRequests: answerabilityCases.length,
  });
  await writeJson(path.join(answerabilityRun, "inputs/cases.json"), { schemaVersion: 1, cases: answerabilityCases });
  await writeJson(path.join(answerabilityRun, "inputs/labels.json"), answerabilityLabels);
  const exactSelected = { title: "Target", handle: { sourceRef: "docs/source.md", startLine: 2, endLine: 3, rangeId: "target" } };
  const answerabilityRecords = [
    { caseId: "answerable-exact", sourceRef: "docs/source.md", status: "complete", jev: { status: "selected", selected: exactSelected }, fetch: { passed: true } },
    { caseId: "answerable-abstained", sourceRef: "docs/source.md", status: "complete", jev: { status: "abstained", selected: null } },
    { caseId: "answerable-wrong-range", sourceRef: "docs/source.md", status: "complete", search: { results: [{ title: "Target", headingPath: ["Root", "Target"], handle: { sourceRef: "docs/source.md", startLine: 3, endLine: 4 } }] }, jev: { status: "selected", selected: { ...exactSelected, handle: { ...exactSelected.handle, startLine: 1, endLine: 4 } } } },
    { caseId: "answerable-relevant-range", sourceRef: "docs/source.md", status: "complete", jev: { status: "selected", selected: { ...exactSelected, handle: { ...exactSelected.handle, startLine: 1, endLine: 4 } } } },
    { caseId: "answerable-conflicted", sourceRef: "docs/source.md", status: "complete", search: { results: [{ title: "Nearby", headingPath: ["Root", "Other"], handle: { sourceRef: "docs/source.md", startLine: 2, endLine: 3 } }] }, jev: { status: "selected", choice: "none", selected: exactSelected } },
    { caseId: "unanswerable-abstained", sourceRef: "docs/source.md", status: "complete", jev: { choice: "none", selected: null } },
    { caseId: "unanswerable-selected", sourceRef: "docs/source.md", status: "complete", jev: { status: "selected", selected: { title: "Nearby", handle: { sourceRef: "docs/source.md", startLine: 8, endLine: 9 } } } },
    { caseId: "unanswerable-failed", sourceRef: "docs/source.md", status: "failed", jev: { status: "failed" } },
    { caseId: "unanswerable-conflicted", sourceRef: "docs/source.md", status: "complete", jev: { status: "abstained", choice: "none", selected: exactSelected } },
  ];
  const answerabilityRecordsBytes = Buffer.from(`${answerabilityRecords.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(path.join(answerabilityRun, "records.jsonl"), answerabilityRecordsBytes);
  await writeChecksumIndex(answerabilityRun, ["manifest.json", "run-completion.json", "inputs/cases.json", "inputs/labels.json", "records.jsonl"]);
  const answerabilityResult = invoke(answerabilityRun);
  assert.equal(answerabilityResult.status, 0, answerabilityResult.stderr);
  const answerabilitySummary = JSON.parse(answerabilityResult.stdout);
  const answerabilityMetrics = answerabilitySummary.labelMetrics.answerabilityMetrics;
  assert.deepEqual(answerabilityMetrics.answerable, {
    cases: 5,
    correctAnswerabilityDecisions: 3,
    correctExactRangeSelections: 1,
    correctRelevantRangeSelections: 1,
    selectedOutsideLabeledRanges: 1,
    incorrectDecisions: 1,
    failedOrUnknownDecisions: 1,
    abstentions: 1,
  });
  assert.deepEqual(answerabilityMetrics.unanswerable, {
    cases: 4,
    correctAbstentions: 1,
    falseSelections: 1,
    failedOrUnknownDecisions: 2,
  });
  assert.equal(answerabilityMetrics.classifiedDecisions, 6);
  assert.equal(answerabilityMetrics.correctDecisions, 4);
  assert.equal(answerabilityMetrics.incorrectDecisions, 2);
  assert.equal(answerabilityMetrics.failedOrUnknownDecisions, 3,
    "provider/tool failure and contradictory selector records must not count as correct abstentions");
  assert.equal(answerabilityMetrics.decisionAccuracy, 4 / 6,
    "answerability-status accuracy is independent of selected-range precision");
  assert.equal(answerabilitySummary.labelMetrics.exactAcceptedRangeDenominator, 5,
    "negative labels must not inflate positive exact-range denominators");
  assert.equal(answerabilitySummary.labelMetrics.relevantRangeMatches, 1);
  assert.equal(answerabilitySummary.labelMetrics.relevantRangeDenominator, 1);
  assert.equal(answerabilitySummary.labelMetrics.records[3].exactAcceptedRangeMatch, false);
  assert.equal(answerabilitySummary.labelMetrics.records[3].relevantRangeMatch, true);
  assert.equal(answerabilitySummary.labelMetrics.records[3].decisionCorrect, true);
  assert.equal(answerabilitySummary.labelMetrics.records[2].decisionCorrect, true,
    "selecting a range does not make an answerability-status decision wrong merely because the range missed strict labels");
  assert.equal(answerabilitySummary.labelMetrics.records[2].rangeSelectionAssessment, "outside-labeled-ranges");
  assert.equal(answerabilitySummary.labelMetrics.records[2].searchTargetFound, true,
    "heading discovery remains an explicitly separate search signal");
  assert.equal(answerabilitySummary.labelMetrics.records[2].searchExactAcceptedRangeFound, false);
  assert.equal(answerabilitySummary.labelMetrics.records[2].searchTargetRangeContainedAt100, false,
    "a partial overlap must not count as full labeled-range containment");
  assert.equal(answerabilitySummary.labelMetrics.records[4].searchTargetRangeContainedAt100, false,
    "same line bounds under an unrelated heading must not count as heading-scoped containment");
  assert.equal(answerabilitySummary.labelMetrics.records[4].searchTargetLinesContainedAt100, true,
    "source-bound line coverage is reported separately from heading-scoped coverage");
  assert.deepEqual(answerabilitySummary.labelMetrics.rangeSelectionMetrics, {
    exactMatches: 1,
    relevantLabeledMatches: 1,
    outsideLabeledRanges: 1,
    abstentions: 1,
    failedOrUnknown: 1,
    note: "A range outside the exact or explicitly labeled relevant ranges is ungraded for semantic usefulness; it is not automatically irrelevant. Inspect source text and blinded review separately.",
  });
  assert.equal(answerabilitySummary.labelMetrics.records[4].decisionStatus, "failed-or-unknown");
  assert.equal(answerabilitySummary.labelMetrics.records[4].exactAcceptedRangeMatch, false,
    "a contradictory selected-plus-none record must not count as an exact range hit");
  assert.equal(answerabilitySummary.labelMetrics.records[4].decisionCorrect, null);
  assert.equal(answerabilitySummary.labelMetrics.records[5].decisionStatus, "abstained",
    "choice=none is an abstention only when the canonical status is absent");
  assert.equal(answerabilitySummary.labelMetrics.records[5].decisionCorrect, true);
  assert.equal(answerabilitySummary.labelMetrics.records[7].decisionCorrect, null,
    "failed decisions remain unclassified, not correct or incorrect abstentions");
  assert.equal(answerabilitySummary.labelMetrics.records[8].decisionStatus, "failed-or-unknown",
    "a selected result paired with abstained status is contradictory, not a correct abstention");
  assert.equal(answerabilitySummary.labelMetrics.records[8].decisionCorrect, null);
  assert.equal(answerabilitySummary.labelMetrics.records[5].searchTargetFound, null);
  assert.equal(answerabilitySummary.calibrationClaim, false);

  const templateRun = path.join(scratch, "template run with spaces");
  const templateProject = path.join(templateRun, "project");
  const templateBridge = path.join(templateRun, "bridge");
  const templateRunnerPath = path.join(templateRun, "runner.mjs");
  const runnerTemplate = path.join(root, "experiments/jev-mssr-live/runner-template.mjs");
  const selectionRecordModule = path.join(root, "experiments/jev-mssr-live/selection-record.mjs");
  const runnerSupportModule = path.join(root, "experiments/jev-mssr-live/runner-support.mjs");
  await fs.mkdir(templateRun, { recursive: true });
  await fs.copyFile(runnerTemplate, templateRunnerPath);
  await fs.copyFile(selectionRecordModule, path.join(templateRun, "selection-record.mjs"));
  await fs.copyFile(runnerSupportModule, path.join(templateRun, "runner-support.mjs"));
  const templateRunnerBytes = await fs.readFile(templateRunnerPath);
  const templateSelectionRecordBytes = await fs.readFile(path.join(templateRun, "selection-record.mjs"));
  const templateRunnerSupportBytes = await fs.readFile(path.join(templateRun, "runner-support.mjs"));
  const templateSourceBytes = Buffer.from("# Sample\n\nExact fixture evidence.\n");
  await fs.mkdir(path.join(templateProject, "docs"), { recursive: true });
  await fs.writeFile(path.join(templateProject, "docs/one.md"), templateSourceBytes);
  await fs.mkdir(path.join(templateRun, "inputs/sources"), { recursive: true });
  await fs.writeFile(path.join(templateRun, "inputs/sources/source-01.md"), templateSourceBytes);
  const templateArtifactPath = "dist/tool-registry.js";
  const templateArtifactBytes = Buffer.from("fixture Bridge artifact\n");
  await fs.mkdir(path.join(templateBridge, "dist"), { recursive: true });
  await fs.writeFile(path.join(templateBridge, templateArtifactPath), templateArtifactBytes);
  const templateCasesBytes = await writeJson(path.join(templateRun, "inputs/cases.json"), {
    schemaVersion: 1,
    cases: [{ id: "template-smoke", sourceRef: "docs/one.md", query: "What is the exact fixture evidence?" }],
  });
  const templateLabelsBytes = Buffer.from("not parsed during dry-run\n", "utf8");
  await fs.writeFile(path.join(templateRun, "inputs/labels.json"), templateLabelsBytes);
  const templateManifest = {
    schemaVersion: 1,
    status: "prepared",
    runId: "runner-template-dry-run",
    source: {
      bridgeRoot: templateBridge,
      bridgeVersion: "fixture-bridge",
      mssrVersion: "fixture-mssr",
      buildArtifacts: [{ path: templateArtifactPath, sha256: digest(templateArtifactBytes) }],
    },
    corpus: {
      projectRoot: templateProject,
      sources: [{
        sourceRef: "docs/one.md",
        sha256: digest(templateSourceBytes),
        snapshotPath: "inputs/sources/source-01.md",
      }],
    },
    provider: { requestedModel: "jev-fixture-no-network" },
    plan: { expectedRequestCount: 1, independentUnit: "one descriptive sourceRef cluster" },
    instrument: {
      runnerSha256: digest(templateRunnerBytes),
      selectionRecordSha256: digest(templateSelectionRecordBytes),
      runnerSupportSha256: digest(templateRunnerSupportBytes),
      casesSha256: digest(templateCasesBytes),
    },
    labels: { adjudication: "fixture-only", labelFileSha256: digest(templateLabelsBytes) },
  };
  await writeJson(path.join(templateRun, "manifest.json"), templateManifest);
  const templateDryRun = spawnSync(process.execPath, [templateRunnerPath], {
    cwd: templateRun,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(templateDryRun.status, 0, templateDryRun.stderr);
  const templateDryRunSummary = JSON.parse(templateDryRun.stdout);
  assert.equal(templateDryRunSummary.status, "dry-run");
  assert.equal(templateDryRunSummary.networkRequests, 0);
  assert.equal(templateDryRunSummary.requestedCalls, 1);
  assert.equal(templateDryRunSummary.sourceDocuments, 1);
  assert.equal(templateDryRunSummary.labelsParsed, false);
  await assert.rejects(fs.access(path.join(templateRun, ".runner.lock")), "dry-run must release its exclusive packet lock");
  await assert.rejects(fs.access(path.join(templateRun, "records.jsonl")), "dry-run must not write provider records");
  const partialRecordsPath = path.join(templateRun, "records.jsonl");
  const partialRecordBytes = Buffer.from("partial evidence must be preserved\n", "utf8");
  await fs.writeFile(partialRecordsPath, partialRecordBytes);
  const refusedPartialReplay = spawnSync(process.execPath, [templateRunnerPath], {
    cwd: templateRun,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(refusedPartialReplay.status, 0, "a packet with partial output must not be replayed");
  assert.match(refusedPartialReplay.stderr, /Refusing to overwrite output: records\.jsonl/u);
  assert.deepEqual(await fs.readFile(partialRecordsPath), partialRecordBytes, "partial evidence must remain unchanged after a refused replay");
  await assert.rejects(fs.access(path.join(templateRun, ".runner.lock")), "failed preflight must release the run lock");

  const mockRun = path.join(scratch, "mock live run with spaces");
  const mockProject = path.join(mockRun, "project");
  const mockBridge = path.join(mockRun, "bridge");
  const mockSourceText = "# Sample\n\nExact fixture evidence.\n";
  const mockSourceBytes = Buffer.from(mockSourceText, "utf8");
  const mockRunnerPath = path.join(mockRun, "runner.mjs");
  await fs.mkdir(path.join(mockProject, "docs"), { recursive: true });
  await fs.mkdir(path.join(mockRun, "inputs/sources"), { recursive: true });
  await fs.mkdir(path.join(mockBridge, "dist/tools"), { recursive: true });
  await fs.writeFile(path.join(mockProject, "docs/one.md"), mockSourceBytes);
  await fs.writeFile(path.join(mockRun, "inputs/sources/source-01.md"), mockSourceBytes);
  await writeJson(path.join(mockBridge, "package.json"), { type: "module" });
  const mockRegistrySource = [
    "export function createToolRegistry(modules) {",
    "  const [module] = modules;",
    "  return { has: (name) => module.has(name), call: (name, args) => module.call(name, args) };",
    "}",
  ].join("\n");
  const mockToolsSource = [
    'import { createHash } from "node:crypto";',
    'const text = "# Sample\\n\\nExact fixture evidence.\\n";',
    'const fingerprint = createHash("sha256").update(Buffer.from(text.trim(), "utf8")).digest("hex");',
    'const owner = process.env.MSSR_TEST_OWNER;',
    'let failNextFetch = false;',
    'const handle = { id: "fixture-handle-01", version: 1, owner, sourceRef: "docs/one.md", revision: "fixture-revision-01", rangeId: "sample-heading", rangeKind: "section", startLine: 1, endLine: 3, startOffset: 0, endOffset: text.length, fingerprint, privacyClass: "project-metadata" };',
    'const names = new Set(["mssr_librarian_search", "mssr_librarian_jev_select", "mssr_librarian_fetch", "mssr_librarian_evidence_pack"]);',
    'export function createMssrJevBridgeDecisionProvider() { return { choose() { throw new Error("mock run must never invoke Jev transport"); } }; }',
    'export function createMssrSemanticEvidenceToolModule() {',
    '  return {',
    '    has: (name) => names.has(name),',
    '    async call(name, args) {',
    '      if (name === "mssr_librarian_search") { if (args.query.query.includes("empty-search")) return { sourceCount: 1, results: [] }; return { sourceCount: 1, results: [{ title: "Sample", headingPath: ["Sample"], score: 1, handle }] }; }',
    '      if (name === "mssr_librarian_jev_select") { if (args.query.includes("empty-search")) throw new Error("selector must not run when search returns no candidates"); const labelKeys = ["answerability", "expectedHeading", "expectedStartLine", "expectedEndLine", "acceptableRanges", "relevantRanges"]; const requestText = JSON.stringify(args); if (labelKeys.some((key) => key in args) || requestText.includes("LABEL_ONLY_SENTINEL") || requestText.includes("97831") || requestText.includes("unanswerable")) throw new Error("labels must not be sent to Jev"); if (args.query.includes("absent")) return { status: "abstained", choice: "none", provider: "fixture-mock", model: "fixture-no-network", providerConfidence: 0.11, confidenceCalibration: "uncalibrated", evidenceSufficiency: 0.13, noul: 0.65, usage: { input_tokens: 4, output_tokens: 1 }, selected: null }; failNextFetch = args.query.includes("fetch-failure"); const choice = args.query.includes("conflict") ? "none" : "fixture-handle-01"; return { status: "selected", choice, provider: "fixture-mock", model: "fixture-no-network", providerConfidence: 0.91, confidenceCalibration: "uncalibrated", evidenceSufficiency: 0.87, noul: 0.65, usage: { input_tokens: 4, output_tokens: 2 }, candidateCount: 1, selectionMode: "single-pass", selectionPasses: 1, providerCalls: 1, finalistCount: 1, candidateRangeDiagnostics: { offered: 1, eligible: 1, oversizedOmitted: 0, maxFetchChars: 20000, lengthUnit: "utf16-code-units" }, rangeOverlapDiagnostics: { sameSourceRevisionPairs: 0, overlappingPairCount: 0, nestedPairCount: 0, exactRangePairCount: 0, partialOverlapPairCount: 0, pairs: [], truncated: false, mutationApplied: false }, batchAssessments: [], providersUsed: ["fixture-mock"], modelsUsed: ["fixture-no-network"], selected: { title: "Sample", headingPath: ["Sample"], handle } }; }',
    '      if (name === "mssr_librarian_fetch") { if (failNextFetch) { failNextFetch = false; throw new Error("fixture fetch failure"); } return { handle, text, fingerprint, projectOwner: owner, advisoryOnly: true, truthAuthority: false }; }',
    '      if (name === "mssr_librarian_evidence_pack") {',
    '        const citation = { display: "docs/one.md:L1-L3", handleId: handle.id, owner, sourceRef: handle.sourceRef, revision: handle.revision, rangeId: handle.rangeId, rangeKind: handle.rangeKind, startLine: 1, endLine: 3, fingerprint, privacyClass: handle.privacyClass };',
    '        return { schemaVersion: 1, kind: "mssr-librarian-evidence-pack", assembly: "verbatim-source-ranges", projectOwner: owner, sourceCount: 1, paragraphs: [{ ordinal: 1, exactText: text, citation }], totalFetchedChars: text.length, advisoryOnly: true, truthAuthority: false, canonicalRewriteAllowed: false };',
    '      }',
    '      throw new Error("unexpected mock tool " + name);',
    '    },',
    '  };',
    '}',
  ].join("\n");
  await fs.writeFile(path.join(mockBridge, "dist/tool-registry.js"), mockRegistrySource);
  await fs.writeFile(path.join(mockBridge, "dist/tools/mssr-semantic-evidence-tools.js"), mockToolsSource);
  await fs.copyFile(runnerTemplate, mockRunnerPath);
  await fs.copyFile(selectionRecordModule, path.join(mockRun, "selection-record.mjs"));
  await fs.copyFile(runnerSupportModule, path.join(mockRun, "runner-support.mjs"));
  const mockRunnerBytes = await fs.readFile(mockRunnerPath);
  const mockSelectionBytes = await fs.readFile(path.join(mockRun, "selection-record.mjs"));
  const mockSupportBytes = await fs.readFile(path.join(mockRun, "runner-support.mjs"));
  const mockRegistryBytes = await fs.readFile(path.join(mockBridge, "dist/tool-registry.js"));
  const mockToolsBytes = await fs.readFile(path.join(mockBridge, "dist/tools/mssr-semantic-evidence-tools.js"));
  const mockCasesBytes = await writeJson(path.join(mockRun, "inputs/cases.json"), {
    schemaVersion: 1,
    cases: [
      { id: "mock-case-01", sourceRef: "docs/one.md", query: "What is the exact fixture evidence?" },
      { id: "mock-unanswerable", sourceRef: "docs/one.md", query: "What absent fact is not in this fixture?" },
      { id: "mock-conflicted", sourceRef: "docs/one.md", query: "Check this conflict fixture." },
      { id: "mock-fetch-failure", sourceRef: "docs/one.md", query: "Select the exact fixture despite a fetch-failure." },
      { id: "mock-contained-target", sourceRef: "docs/one.md", query: "Select the contained target range." },
      { id: "mock-empty-search", sourceRef: "docs/one.md", query: "empty-search exact fixture evidence." },
    ],
  });
  const mockLabelsBytes = await writeJson(path.join(mockRun, "inputs/labels.json"), {
    schemaVersion: 1,
    adjudication: "fixture-only",
    cases: [
      {
        caseId: "mock-case-01",
        sourceRef: "docs/one.md",
        expectedHeading: "Sample",
        expectedStartLine: 1,
        expectedEndLine: 3,
        adjudicationNote: "LABEL_ONLY_SENTINEL_PRIMARY_4387; historical source line 97831",
        acceptableRanges: [
          { sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 },
          { sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 2, endLine: 3 },
        ],
      },
      { caseId: "mock-unanswerable", sourceRef: "docs/one.md", answerability: "unanswerable", reason: "LABEL_ONLY_SENTINEL_NEGATIVE_4387" },
      {
        caseId: "mock-conflicted",
        sourceRef: "docs/one.md",
        expectedHeading: "Sample",
        expectedStartLine: 1,
        expectedEndLine: 3,
        acceptableRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }],
      },
      {
        caseId: "mock-fetch-failure",
        sourceRef: "docs/one.md",
        expectedHeading: "Sample",
        expectedStartLine: 1,
        expectedEndLine: 3,
        acceptableRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }],
        relevantRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }],
      },
      {
        caseId: "mock-contained-target",
        sourceRef: "docs/one.md",
        expectedHeading: "Sample",
        expectedStartLine: 2,
        expectedEndLine: 3,
        acceptableRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 2, endLine: 3 }],
        relevantRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }],
      },
      {
        caseId: "mock-empty-search",
        sourceRef: "docs/one.md",
        expectedHeading: "Sample",
        expectedStartLine: 1,
        expectedEndLine: 3,
        acceptableRanges: [{ sourceRef: "docs/one.md", expectedHeading: "Sample", startLine: 1, endLine: 3 }],
      },
    ],
  });
  const mockManifest = {
    schemaVersion: 1,
    status: "prepared",
    runId: "runner-template-mock-live-path",
    source: {
      bridgeRoot: mockBridge,
      bridgeVersion: "fixture-bridge",
      bridgeCommit: "fixture-commit",
      mssrVersion: "fixture-mssr",
      buildArtifacts: [
        { path: "dist/tool-registry.js", sha256: digest(mockRegistryBytes) },
        { path: "dist/tools/mssr-semantic-evidence-tools.js", sha256: digest(mockToolsBytes) },
      ],
    },
    corpus: {
      projectRoot: mockProject,
      sources: [{ sourceRef: "docs/one.md", sha256: digest(mockSourceBytes), snapshotPath: "inputs/sources/source-01.md" }],
    },
    provider: {
      provider: "fixture-mock",
      requestedModel: "fixture-no-network",
      mode: "live",
      networkOptIn: true,
      networkOptInMethod: "explicit command-line --allow-network plus user authorization recorded in manifest",
    },
    plan: { expectedRequestCount: 6, independentUnit: "fixture sourceRef only; no statistical claim" },
    instrument: {
      runnerSha256: digest(mockRunnerBytes),
      selectionRecordSha256: digest(mockSelectionBytes),
      runnerSupportSha256: digest(mockSupportBytes),
      casesSha256: digest(mockCasesBytes),
    },
    labels: { adjudication: "fixture-only", labelFileSha256: digest(mockLabelsBytes) },
  };
  await writeJson(path.join(mockRun, "manifest.json"), mockManifest);
  const mockLiveRun = spawnSync(process.execPath, [mockRunnerPath, "--allow-network"], {
    cwd: mockRun,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, MSSR_TEST_OWNER: mockProject },
  });
  assert.equal(mockLiveRun.status, 0, mockLiveRun.stderr);
  const mockSummary = JSON.parse(mockLiveRun.stdout);
  assert.equal(mockSummary.status, "partial");
  assert.equal(mockSummary.successfulRequests, 5);
  assert.equal(mockSummary.failedRequests, 1);
  assert.equal(mockSummary.exactHeadingMatches, 2);
  assert.equal(mockSummary.exactHeadingDenominator, 5);
  assert.deepEqual(mockSummary.answerabilityMetrics.answerable, {
    cases: 5,
    correctAnswerabilityDecisions: 3,
    correctExactRangeSelections: 2,
    correctRelevantRangeSelections: 2,
    selectedOutsideLabeledRanges: 0,
    incorrectDecisions: 0,
    failedOrUnknownDecisions: 2,
    abstentions: 0,
  });
  assert.equal(mockSummary.answerabilityMetrics.unanswerable.correctAbstentions, 1);
  assert.equal(mockSummary.answerabilityMetrics.decisionAccuracy, 1);
  assert.equal(mockSummary.searchTargetRecallAt100, 3);
  assert.equal(mockSummary.searchExactLabeledRangeAt100, 3);
  assert.equal(mockSummary.searchTargetRangeContainedAt100, 4,
    "the live runner must count a broad candidate that fully contains the labeled target");
  assert.equal(mockSummary.searchTargetRangeContainmentDenominator, 5);
  assert.equal(mockSummary.searchTargetLinesContainedAt100, 4);
  assert.match(mockSummary.searchTargetRecallAt100Semantics, /LEGACY strict equality/u);
  const containedTargetRecord = mockSummary.records.find((item) => item.caseId === "mock-contained-target");
  assert.equal(containedTargetRecord.targetInSearchTop100, false,
    "legacy strict search matching must not silently become containment");
  assert.equal(containedTargetRecord.targetRangeContainedInSearchTop100, true);
  assert.equal(mockSummary.records[0].acceptableRanges.length, 2,
    "summary must expose every accepted range used by the scorer");
  assert.equal(mockSummary.records[0].relevantRanges.length, 0,
    "precise acceptable ranges must remain distinct from broad relevant ranges");
  assert.equal(mockSummary.records[2].decisionStatus, "failed-or-unknown");
  assert.equal(mockSummary.records[2].exactAcceptedRangeMatch, false,
    "the live runner must not score a selected-plus-none conflict as an exact hit");
  assert.equal(mockSummary.records[3].decisionStatus, "selected");
  assert.equal(mockSummary.records[3].exactAcceptedRangeMatch, true,
    "a valid exact selector decision remains scoreable when exact fetch fails downstream");
  assert.equal(mockSummary.records[3].relevantRangeMatch, true,
    "a valid relevant-range selector decision remains scoreable when exact fetch fails downstream");
  assert.equal(mockSummary.records[3].exactFetchPassed, false,
    "downstream exact-fetch integrity remains an independent metric");
  assert.equal(mockSummary.records[3].evidencePackBuilt, false,
    "a failed exact fetch must prevent evidence-pack construction");
  assert.equal(mockSummary.exactFetchesWithFingerprint, 2,
    "the live runner must not fetch a contradictory selection");
  assert.equal(mockSummary.evidencePacksBuilt, 2,
    "the live runner must not pack a contradictory selection");
  const mockRecordLines = (await fs.readFile(path.join(mockRun, "records.jsonl"), "utf8")).trim().split(/\r?\n/u);
  const mockRecord = JSON.parse(mockRecordLines[0]);
  const mockAbstentionRecord = JSON.parse(mockRecordLines[1]);
  const mockConflictedRecord = JSON.parse(mockRecordLines[2]);
  const mockFetchFailureRecord = JSON.parse(mockRecordLines[3]);
  const mockContainedRecord = JSON.parse(mockRecordLines[4]);
  const mockEmptySearchRecord = JSON.parse(mockRecordLines[5]);
  assert.equal(mockRecord.jev.evidenceSufficiency, 0.87);
  assert.equal(mockRecord.jev.choice, "fixture-handle-01");
  assert.equal(mockRecord.jev.noul, 0.65);
  assert.equal(mockRecord.jev.selectionMode, "single-pass");
  assert.equal(mockRecord.jev.selectionPasses, 1);
  assert.equal(mockRecord.jev.providerCalls, 1,
    "selection-internal provider calls must be recorded separately from benchmark cases");
  assert.equal(mockRecord.jev.finalistCount, 1);
  assert.deepEqual(mockRecord.jev.candidateRangeDiagnostics, {
    offered: 1,
    eligible: 1,
    oversizedOmitted: 0,
    maxFetchChars: 20000,
    lengthUnit: "utf16-code-units",
  });
  assert.equal(mockRecord.jev.rangeOverlapDiagnostics.mutationApplied, false);
  assert.deepEqual(mockRecord.jev.batchAssessments, []);
  assert.deepEqual(mockRecord.jev.providersUsed, ["fixture-mock"]);
  assert.deepEqual(mockRecord.jev.modelsUsed, ["fixture-no-network"]);
  assert.equal(mockRecord.fetch.passed, true);
  assert.equal(mockRecord.evidencePack.passed, true);
  assert.equal(mockEmptySearchRecord.search.resultCount, 0);
  assert.equal(mockEmptySearchRecord.jev.status, "not-run");
  assert.equal(mockEmptySearchRecord.jev.candidateCount, 0);
  assert.equal(mockEmptySearchRecord.jev.jevCallMade, false);
  assert.equal(mockEmptySearchRecord.jev.reason, "no-search-candidates");
  assert.equal(mockEmptySearchRecord.jev.selectionMode, "not-run");
  assert.equal(mockEmptySearchRecord.jev.selectionPasses, 0);
  assert.equal(mockEmptySearchRecord.jev.providerCalls, 0);
  assert.equal(mockAbstentionRecord.jev.choice, "none");
  assert.equal(mockAbstentionRecord.fetch, null, "a recorded abstention must not trigger exact fetch or evidence packing");
  assert.equal(mockConflictedRecord.jev.choice, "none");
  assert.equal(mockConflictedRecord.fetch, null, "a contradictory selection must not trigger exact fetch or evidence packing");
  assert.equal(mockFetchFailureRecord.status, "failed");
  assert.equal(mockFetchFailureRecord.jev.status, "selected");
  assert.equal(mockFetchFailureRecord.fetch, null, "failed fetch must not produce a validated fetch record");
  assert.equal(mockFetchFailureRecord.evidencePack, null, "failed fetch must stop before evidence-pack construction");
  assert.equal(mockContainedRecord.fetch.passed, true, "a contained broader span must remain fetchable and verifiable");
  const mockCompletion = JSON.parse(await fs.readFile(path.join(mockRun, "run-completion.json"), "utf8"));
  assert.equal(mockCompletion.labelsExposedToProvider, false);
  assert.equal(mockCompletion.networkOptInAuthorized, true);
  assert.equal(mockCompletion.argvContainsAllowNetwork, true);
  assert.equal(mockCompletion.jevRequestIdsReturned, 0, "fake provider flow must not claim returned Jev request IDs");
  assert.equal(mockCompletion.providerTransportInvocationsObserved, null,
    "runner cannot observe network transport calls below the Bridge adapter");
  assert.equal("networkOptInUsed" in mockCompletion, false,
    "authorization must not be mislabeled as observed network use");
  await assert.rejects(fs.access(path.join(mockRun, ".runner.lock")), "mock live path must release its exclusive packet lock");
  const mockSumsText = await fs.readFile(path.join(mockRun, "SHA256SUMS"), "utf8");
  assert.doesNotMatch(mockSumsText, /\\.runner\.lock/u, "transient lock must not be included in packet checksums");
  for (const line of mockSumsText.trim().split(/\r?\n/u)) {
    const [, expectedHash, relativePath] = line.match(/^([0-9a-f]{64})  (.+)$/u) ?? [];
    assert.ok(expectedHash && relativePath, `malformed mock-run checksum line: ${line}`);
    assert.equal(digest(await fs.readFile(path.join(mockRun, ...relativePath.split("/")))), expectedHash, `mock-run checksum mismatch: ${relativePath}`);
  }

  const duplicateRecords = [genericRecords[0], genericRecords[0], genericRecords[2]];
  await fs.writeFile(genericRecordsPath, `${duplicateRecords.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await writeChecksumIndex(generic, genericChecksumFiles);
  const duplicateResult = invoke(generic);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /duplicate record for case/u);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);
  await writeChecksumIndex(generic, genericChecksumFiles);

  const genericChecksumPath = path.join(generic, "SHA256SUMS");
  const validGenericSums = await fs.readFile(genericChecksumPath, "utf8");
  await fs.rename(genericChecksumPath, `${genericChecksumPath}.missing`);
  const missingSumsResult = invoke(generic);
  assert.notEqual(missingSumsResult.status, 0);
  assert.match(missingSumsResult.stderr, /SHA256SUMS is required/u);
  await fs.rename(`${genericChecksumPath}.missing`, genericChecksumPath);

  await fs.writeFile(genericChecksumPath, validGenericSums.split(/\r?\n/u).filter((row) => !row.endsWith("  records.jsonl")).join("\n") + "\n");
  const uncoveredResult = invoke(generic);
  assert.notEqual(uncoveredResult.status, 0);
  assert.match(uncoveredResult.stderr, /does not cover required frozen artifacts.*records\.jsonl/u);
  await fs.writeFile(genericChecksumPath, validGenericSums);

  await fs.writeFile(genericRecordsPath, Buffer.concat([genericRecordsBytes, Buffer.from(" ")]));
  const mismatchResult = invoke(generic);
  assert.notEqual(mismatchResult.status, 0);
  assert.match(mismatchResult.stderr, /checksum mismatch: records\.jsonl/u);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);

  await fs.writeFile(genericChecksumPath, `${validGenericSums.trimEnd()}\n${"a".repeat(64)}  ../outside.json\n`);
  const traversalResult = invoke(generic);
  assert.notEqual(traversalResult.status, 0);
  assert.match(traversalResult.stderr, /checksum path escapes run directory/u);
  await fs.writeFile(genericChecksumPath, validGenericSums);

  const paired = path.join(scratch, "paired");
  const pairedCases = [
    { id: "case-a", sourceRef: "docs/decision-a.md" },
    { id: "case-b", sourceRef: "docs/decision-b.md" },
  ];
  const pairedManifest = {
    schemaVersion: 1,
    runId: "paired-test-v1",
    study: "paired-excerpt-cap-diagnostic",
    preRegistered: true,
    labelsPreparedBeforeProviderCalls: true,
    ownerGold: false,
    providerCallsExpected: 4,
    independentSourceClusters: 2,
    arms: [260, 780],
    independentVariable: "maxExcerptChars",
  };
  const pairedManifestBytes = await writeJson(path.join(paired, "manifest.json"), pairedManifest);
  const pairedCompletion = {
    schemaVersion: 1,
    runId: pairedManifest.runId,
    status: "complete",
    expectedPairs: 2,
    completedPairs: 2,
    providerCalls: 4,
  };
  const pairedCompletionBytes = await writeJson(path.join(paired, "run-completion.json"), pairedCompletion);
  const pairedCasesBytes = await writeJson(path.join(paired, "inputs/cases.json"), { schemaVersion: 1, cases: pairedCases });
  const pairedRows = [];
  for (const [index, item] of pairedCases.entries()) {
    for (const cap of pairedManifest.arms) {
      const selected = !(item.id === "case-b" && cap === 780);
      pairedRows.push({
        caseId: item.id,
        cap,
        elapsedWallMs: 100 + index,
        selector: {
          status: selected ? "selected" : "abstained",
          selected: selected ? { title: "Decision", handle: { sourceRef: item.sourceRef, rangeId: "heading-1" } } : null,
          providerConfidence: selected ? 0.8 : 0.2,
          evidenceSufficiency: selected ? 0.7 : null,
          usage: { input_tokens: 10, output_tokens: 2 },
        },
        exactFetch: selected ? { fingerprintMatched: true } : null,
        safeError: null,
      });
    }
  }
  const pairedRecordsBytes = Buffer.from(`${pairedRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(path.join(paired, "records.jsonl"), pairedRecordsBytes);
  const sums = [
    ["manifest.json", pairedManifestBytes],
    ["run-completion.json", pairedCompletionBytes],
    ["inputs/cases.json", pairedCasesBytes],
    ["records.jsonl", pairedRecordsBytes],
  ].map(([name, bytes]) => `${digest(bytes)}  ${name}`).join("\n") + "\n";
  await fs.writeFile(path.join(paired, "SHA256SUMS"), sums);

  const pairedResult = invoke(paired, ["--write"]);
  assert.equal(pairedResult.status, 0, pairedResult.stderr);
  const pairedSummaryPath = path.join(paired, "summary-calculated.json");
  const pairedSummary = JSON.parse(await fs.readFile(pairedSummaryPath, "utf8"));
  assert.equal(pairedSummary.schemaProfile, "paired-excerpt-cap-v1");
  assert.equal(pairedSummary.pairedCases, 2);
  assert.equal(pairedSummary.attemptedRequests, 4);
  assert.equal(pairedSummary.sourceDocumentClusters, 2);
  assert.equal(pairedSummary.selected, 3);
  assert.equal(pairedSummary.abstained, 1);
  assert.equal(pairedSummary.exactFetchesWithFingerprint, 3);
  assert.equal(pairedSummary.checksumFile.verified, 4);
  assert.deepEqual(pairedSummary.checksumFile.requiredFiles, ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"]);
  assert.equal(pairedSummary.labelMetrics, null);
  assert.equal(pairedSummary.calibrationClaim, false);
  for (const name of ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"]) {
    const current = await fs.readFile(path.join(paired, ...name.split("/")));
    const expected = sums.split(/\r?\n/u).find((row) => row.endsWith(`  ${name}`)).slice(0, 64);
    assert.equal(digest(current), expected, `--write changed frozen input ${name}`);
  }
  const pairedSumsPath = path.join(paired, "SHA256SUMS");
  const validPairedSums = await fs.readFile(pairedSumsPath, "utf8");
  await fs.writeFile(pairedSumsPath, validPairedSums.split(/\r?\n/u).filter((row) => !row.endsWith("  records.jsonl")).join("\n") + "\n");
  const pairedCoverageResult = invoke(paired);
  assert.notEqual(pairedCoverageResult.status, 0);
  assert.match(pairedCoverageResult.stderr, /does not cover required frozen artifacts.*records\.jsonl/u);

  const unsupported = path.join(scratch, "unsupported");
  await writeJson(path.join(unsupported, "manifest.json"), { schemaVersion: 1, runId: "unknown" });
  await writeJson(path.join(unsupported, "run-completion.json"), { runId: "unknown" });
  await writeJson(path.join(unsupported, "inputs/cases.json"), { cases: [] });
  await fs.writeFile(path.join(unsupported, "records.jsonl"), "");
  const unsupportedResult = invoke(unsupported);
  assert.notEqual(unsupportedResult.status, 0);
  assert.match(unsupportedResult.stderr, /Unsupported Jev run schema/u);

  console.log("PASS: generic and paired Jev run summaries preserve answerability, abstention/failure distinctions, exact and relevant range scores, source clusters, schema gates, and frozen inputs.");
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
