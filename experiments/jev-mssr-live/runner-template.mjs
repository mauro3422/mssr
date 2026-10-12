// Reusable template: copy this file and both helpers into a new run packet,
// freeze all three hashes in manifest.instrument, then review before live use.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serializeJevEvidenceMetrics, serializeJevSelectionDiagnostics } from "./selection-record.mjs";
import {
  acquireExclusiveRunLock,
  resolveMetadataRunConfig,
  validateEvidencePack,
  validateFetchResult,
  validateLabelHeadingPaths,
  validateProjectContextManifestPreflight,
  validateProjectContextMetadataControls,
  validateRunInputs,
} from "./runner-support.mjs";

async function main() {
const runDir = path.dirname(fileURLToPath(import.meta.url));
const releaseRunLock = await acquireExclusiveRunLock(path.join(runDir, ".runner.lock"));
try {
const manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8"));
const allowNetwork = process.argv.includes("--allow-network");
const cases = JSON.parse(await fs.readFile(path.join(runDir, "inputs/cases.json"), "utf8")).cases;
const bridgeRoot = manifest.source.bridgeRoot;
const projectRoot = manifest.corpus.projectRoot;
const metadataConfig = resolveMetadataRunConfig(manifest, cases);
const projectContextManifest = await validateProjectContextManifestPreflight({ projectRoot });
const frozenMetadataControls = await validateProjectContextMetadataControls({
  manifest,
  runDir,
  projectRoot,
  required: metadataConfig.requiresProjectContextControls,
});
const hash = (data) => createHash("sha256").update(data).digest("hex");
const hashFile = async (file) => hash(await fs.readFile(file));
const json = (value) => JSON.stringify(value) + "\n";
const normalizeHeading = (value) => String(value ?? "").trim().replace(/^#{1,6}\s+/u, "").trim();
const outputs = ["request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json", "SHA256SUMS"];
for (const file of outputs) {
  await fs.access(path.join(runDir, file)).then(
    () => { throw new Error("Refusing to overwrite output: " + file); },
    (error) => { if (error?.code !== "ENOENT") throw error; },
  );
}
assert.equal(manifest.status, "prepared");
assert.equal(cases.length, manifest.plan.expectedRequestCount);
assert.equal(await hashFile(path.join(runDir, "runner.mjs")), manifest.instrument.runnerSha256);
assert.equal(await hashFile(path.join(runDir, "selection-record.mjs")), manifest.instrument.selectionRecordSha256);
assert.equal(await hashFile(path.join(runDir, "runner-support.mjs")), manifest.instrument.runnerSupportSha256);
assert.equal(await hashFile(path.join(runDir, "inputs/cases.json")), manifest.instrument.casesSha256);
assert.equal(await hashFile(path.join(runDir, "inputs/labels.json")), manifest.labels.labelFileSha256);
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(runDir, source.snapshotPath)), source.sha256, "snapshot changed: " + source.sourceRef);
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, "source changed since freeze: " + source.sourceRef);
}
for (const artifact of manifest.source.buildArtifacts) {
  assert.equal(await hashFile(path.join(bridgeRoot, artifact.path)), artifact.sha256, "build artifact changed: " + artifact.path);
}
if (!allowNetwork) {
  console.log(JSON.stringify({
    status: "dry-run",
    networkRequests: 0,
    requestedCalls: cases.length,
    requestedModel: manifest.provider.requestedModel,
    canonicalProjectContextManifest: projectContextManifest,
    metadataControlFiles: frozenMetadataControls,
    sourceDocuments: manifest.corpus.sources.length,
    independentUnits: manifest.plan.independentUnit,
    cases: cases.map(({ id, sourceRef, query }) => ({
      id,
      sourceRef,
      query,
      metadataMode: metadataConfig.byCaseId.get(id).metadataMode,
      metadata: metadataConfig.byCaseId.get(id).metadata,
    })),
    labelsParsed: false,
  }, null, 2));
  return;
}
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.provider.networkOptIn, true);
assert.equal(manifest.provider.networkOptInMethod, "explicit command-line --allow-network plus user authorization recorded in manifest");
const labels = JSON.parse(await fs.readFile(path.join(runDir, "inputs/labels.json"), "utf8"));
validateRunInputs(cases, labels, manifest.corpus.sources.map((source) => source.sourceRef));
const frozenSourceTextByRef = new Map();
for (const source of manifest.corpus.sources) {
  frozenSourceTextByRef.set(source.sourceRef,
    (await fs.readFile(path.join(runDir, source.snapshotPath), "utf8")).replace(/\r\n?/gu, "\n"));
}
validateLabelHeadingPaths(cases, labels, frozenSourceTextByRef);
const frozenManifestHash = await hashFile(path.join(runDir, "manifest.json"));
const registryUrl = pathToFileURL(path.join(bridgeRoot, "dist/tool-registry.js")).href;
const toolsUrl = pathToFileURL(path.join(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href;
const [{ createToolRegistry }, { createMssrJevBridgeDecisionProvider, createMssrSemanticEvidenceToolModule }] = await Promise.all([
  import(registryUrl),
  import(toolsUrl),
]);
const provider = createMssrJevBridgeDecisionProvider({ model: manifest.provider.requestedModel });
const registry = createToolRegistry([createMssrSemanticEvidenceToolModule({ decisionProvider: provider })]);
assert.ok(registry.has("mssr_librarian_search"));
assert.ok(registry.has("mssr_librarian_jev_select"));
assert.ok(registry.has("mssr_librarian_fetch"));
assert.ok(registry.has("mssr_librarian_evidence_pack"));

const appendJsonl = async (file, value) => fs.appendFile(path.join(runDir, file), json(value), "utf8");
const records = [];
for (const testCase of cases) {
  const metadataForCase = metadataConfig.byCaseId.get(testCase.id);
  const request = {
    caseId: testCase.id,
    sourceRefs: [testCase.sourceRef],
    query: testCase.query,
    metadataMode: metadataForCase.metadataMode,
    metadata: metadataForCase.metadata,
    projectContextManifestSha256: projectContextManifest.sha256,
    maxResults: 100,
    maxSnippetChars: 240,
    requestedModel: manifest.provider.requestedModel,
  };
  const requestFingerprint = hash(Buffer.from(JSON.stringify(request), "utf8"));
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  await appendJsonl("request-events.jsonl", {
    event: "request-started",
    caseId: testCase.id,
    requestFingerprint,
    startedAt,
    inputHashes: [manifest.corpus.sources.find((source) => source.sourceRef === testCase.sourceRef).sha256],
    projectContextManifestSha256: projectContextManifest.sha256,
  });
  const record = {
    caseId: testCase.id,
    requestFingerprint,
    startedAt,
    connector: "local Bridge release module",
    toolChain: ["mssr_librarian_search", "mssr_librarian_jev_select", "mssr_librarian_fetch", "mssr_librarian_evidence_pack"],
    sourceRef: testCase.sourceRef,
    sourceSha256: manifest.corpus.sources.find((source) => source.sourceRef === testCase.sourceRef).sha256,
    query: testCase.query,
    metadataMode: metadataForCase.metadataMode,
    metadataFilter: metadataForCase.metadata,
    requestedProvider: manifest.provider.provider,
    requestedModel: manifest.provider.requestedModel,
    status: "failed",
    failureClass: null,
    elapsedMs: null,
    search: null,
    jev: null,
    fetch: null,
    evidencePack: null,
  };
  try {
    const search = await registry.call("mssr_librarian_search", {
      projectRoot,
      sourceRefs: [testCase.sourceRef],
      metadataMode: metadataForCase.metadataMode,
      query: {
        query: testCase.query,
        maxResults: 100,
        maxSnippetChars: 240,
        ...(metadataForCase.metadata ? { metadata: metadataForCase.metadata } : {}),
      },
    });
    const searchResults = search.results ?? [];

    const candidateHandles = searchResults.map((item) => item.handle).filter(Boolean);
    const selected = candidateHandles.length === 0
      ? {
        status: "not-run",
        reason: "no-search-candidates",
        candidateCount: 0,
        jevCallMade: false,
        selectionMode: "not-run",
        selectionPasses: 0,
        providerCalls: 0,
        finalistCount: 0,
        candidateRangeDiagnostics: null,
        rangeOverlapDiagnostics: null,
        batchAssessments: [],
        selected: null,
        choice: null,
        choiceCalls: [],
        provider: null,
        model: null,
        providerRequestId: null,
        requestFingerprint: null,
        elapsedMs: null,
        usage: null,
        advisoryOnly: true,
        truthAuthority: false,
        verification: "unverified",
      }
      : await registry.call("mssr_librarian_jev_select", {
        projectRoot,
        sourceRefs: [testCase.sourceRef],
        query: testCase.query,
        candidateHandles,
        model: manifest.provider.requestedModel,
      });
    record.search = {
      sourceCount: search.sourceCount,
      resultCount: searchResults.length,

      results: searchResults.map((item) => ({
        title: item.title ?? null,
        headingPath: item.headingPath ?? null,
        lexicalScore: item.score ?? null,
        metadataProjectionMatches: item.metadataProjectionMatches ?? [],
        handle: item.handle ?? null,
      })),
      metadataProjectionMatchCount: searchResults.reduce((sum, item) => sum + (item.metadataProjectionMatches?.length ?? 0), 0),
    };
    const candidateSetFingerprint = hash(Buffer.from(JSON.stringify({
      sourceRef: testCase.sourceRef,
      sourceSha256: record.sourceSha256,
      query: testCase.query,
      metadataMode: metadataForCase.metadataMode,
      metadata: metadataForCase.metadata,
      requestedModel: manifest.provider.requestedModel,
      candidateHandles,
    }), "utf8"));
    record.jev = {
      candidateSetFingerprint,
      providerRequestId: selected.providerRequestId ?? null,
      status: selected.status,
      reason: selected.reason ?? null,
      jevCallMade: selected.jevCallMade ?? true,
      provider: selected.provider ?? null,
      returnedModel: selected.model ?? null,
      ...serializeJevEvidenceMetrics(selected),
      ...serializeJevSelectionDiagnostics(selected),
      requestFingerprint: selected.requestFingerprint ?? null,
      elapsedMs: selected.elapsedMs ?? null,
      usage: selected.usage ?? null,
      candidateCount: selected.candidateCount ?? candidateHandles.length,
      choiceCalls: selected.choiceCalls ?? null,
      choice: selected.choice ?? null,
      selected: selected.selected ? {
        title: selected.selected.title ?? null,
        headingPath: selected.selected.headingPath ?? null,
        handle: selected.selected.handle ?? null,
      } : null,
      advisoryOnly: selected.advisoryOnly ?? null,
      truthAuthority: selected.truthAuthority ?? null,
      verification: selected.verification ?? null,
    };
    record.returnedProvider = selected.provider ?? null;
    record.returnedModel = selected.model ?? null;
    if (selected.status === "selected" && selected.choice !== "none" && selected.selected?.handle) {
      const selectedHandle = selected.selected.handle;
      const frozenSourceText = frozenSourceTextByRef.get(selectedHandle.sourceRef);
      assert.equal(typeof frozenSourceText, "string", "selected source is absent from frozen corpus snapshots");
      assert.ok(Number.isSafeInteger(selectedHandle.startOffset)
        && Number.isSafeInteger(selectedHandle.endOffset)
        && selectedHandle.startOffset >= 0
        && selectedHandle.endOffset >= selectedHandle.startOffset
        && selectedHandle.endOffset <= frozenSourceText.length,
      "selected range offsets are outside the normalized frozen source snapshot");
      const expectedFetchText = frozenSourceText.slice(selectedHandle.startOffset, selectedHandle.endOffset);
      const fetched = await registry.call("mssr_librarian_fetch", {
        projectRoot,
        handle: selectedHandle,
      });
      const fetchValidation = validateFetchResult(fetched, selectedHandle, expectedFetchText);
      record.fetch = {
        status: fetchValidation.passed ? "validated" : "invalid",
        projectOwner: fetched.projectOwner ?? null,
        handleId: fetched.handle?.id ?? null,
        revision: fetched.handle?.revision ?? null,
        fingerprint: fetched.handle?.fingerprint ?? null,
        returnedFingerprint: fetched.fingerprint ?? null,
        textSha256: hash(Buffer.from(fetched.text ?? "", "utf8")),
        expectedTextSha256: hash(Buffer.from(expectedFetchText, "utf8")),
        textMatchesFrozenSource: fetched.text === expectedFetchText,
        selectedFingerprint: selectedHandle.fingerprint,
        passed: fetchValidation.passed,
        validationErrors: fetchValidation.errors,
        advisoryOnly: fetched.advisoryOnly ?? null,
        truthAuthority: fetched.truthAuthority ?? null,
        textChars: (fetched.text ?? "").length,
        text: fetched.text ?? null,
      };
      assert.ok(fetchValidation.passed, `Fetch validation failed: ${fetchValidation.errors.join("; ")}`);
      const pack = await registry.call("mssr_librarian_evidence_pack", {
        projectRoot,
        sourceRefs: [testCase.sourceRef],
        handles: [selectedHandle],
        dedupeContainedRanges: false,
      });
      const packValidation = validateEvidencePack(pack, selectedHandle, expectedFetchText);
      record.evidencePack = {
        status: packValidation.passed ? "validated" : "invalid",
        projectOwner: pack.projectOwner ?? null,
        sourceCount: pack.sourceCount ?? null,
        evidenceCount: pack.paragraphs?.length ?? null,
        totalFetchedChars: pack.totalFetchedChars ?? null,
        passed: packValidation.passed,
        validationErrors: packValidation.errors,
        outputSha256: hash(Buffer.from(JSON.stringify(pack), "utf8")),
        rawPack: pack,
      };
      assert.ok(packValidation.passed, `Evidence-pack validation failed: ${packValidation.errors.join("; ")}`);
    }
    record.status = "complete";
  } catch (error) {
    record.status = "failed";
    record.failureClass = error?.name === "AssertionError" ? "validation-error" : "provider-or-tool-chain-error";
    record.safeErrorName = error?.name ?? "Error";
  }
  record.elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  record.completedAt = new Date().toISOString();
  records.push(record);
  await appendJsonl("records.jsonl", record);
  await appendJsonl("request-events.jsonl", {
    event: "request-completed",
    caseId: testCase.id,
    requestFingerprint,
    completedAt: record.completedAt,
    status: record.status,
  });
}
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, "source changed during run: " + source.sourceRef);
}
const finalMetadataControls = await validateProjectContextMetadataControls({
  manifest,
  runDir,
  projectRoot,
  required: metadataConfig.requiresProjectContextControls,
});
assert.deepEqual(finalMetadataControls, frozenMetadataControls, "Project Context metadata controls changed during run");
const labelByCase = new Map(labels.cases.map((label) => [label.caseId, label]));
const scored = records.map((record) => {
  const label = labelByCase.get(record.caseId);
  assert.ok(label, "missing label " + record.caseId);
  const answerability = label.answerability ?? "answerable";
  assert.ok(["answerable", "unanswerable"].includes(answerability), "invalid answerability for " + record.caseId);
  const selected = record.jev?.selected;
  const hasSelectionConflict = (record.jev?.status === "abstained" && selected != null)
    || (record.jev?.status === "selected" && (selected == null || record.jev?.choice === "none"))
    || (record.jev?.status === "abstained" && record.jev?.choice != null && record.jev.choice !== "none")
    || (record.jev?.status == null && record.jev?.choice === "none" && selected != null);
  const hasSelectedDecision = !hasSelectionConflict && record.jev?.status === "selected" && selected != null;
  const hasAbstainedDecision = !hasSelectionConflict && (record.jev?.status === "abstained"
    || (record.jev?.status == null && record.jev?.choice === "none" && selected == null));
  const decisionStatus = hasSelectedDecision ? "selected" : hasAbstainedDecision ? "abstained" : "failed-or-unknown";
  let answerabilityDecisionCorrect = decisionStatus === "failed-or-unknown"
    ? null
    : answerability === "unanswerable"
      ? decisionStatus === "abstained"
      : decisionStatus === "selected";
  if (answerability === "unanswerable") {
    return {
      caseId: record.caseId,
      sourceRef: record.sourceRef,
      answerability,
      expectedHeading: null,
      expectedStartLine: null,
      expectedEndLine: null,
      acceptableRanges: [],
      relevantRanges: [],
      observedHeading: selected?.title ?? null,
      decisionStatus,
      answerabilityCorrect: answerabilityDecisionCorrect,
      answerabilityDecisionCorrect,
      rangeSelectionAssessment: decisionStatus,
      exactHeadingMatch: null,
      exactAcceptedRangeMatch: null,
      relevantRangeMatch: null,
      targetInSearchTop100: null,
      relevantTargetInSearchTop100: null,
      targetRangeContainedInSearchTop100: null,
      targetLinesContainedInSearchTop100: null,
      relevantRangeContainedInSearchTop100: null,
      exactFetchPassed: Boolean(record.fetch?.passed),
      evidencePackBuilt: record.evidencePack?.passed === true,
      status: record.status,
    };
  }
  const acceptedRanges = Array.isArray(label.acceptableRanges) && label.acceptableRanges.length > 0
    ? label.acceptableRanges
    : [{
      sourceRef: label.sourceRef ?? record.sourceRef,
      expectedHeading: label.expectedHeading,
      startLine: label.expectedStartLine,
      endLine: label.expectedEndLine,
    }];
  const relevantRanges = Array.isArray(label.relevantRanges) ? label.relevantRanges : [];
  const matchesRanges = (item, ranges) => ranges.some((range) => {
    const expectedHeading = normalizeHeading(range.expectedHeading);
    const actualSourceRef = item?.sourceRef ?? item?.handle?.sourceRef;
    const sourceMatches = range.sourceRef === record.sourceRef
      && (!actualSourceRef || actualSourceRef === range.sourceRef);
    const headingMatches = Boolean(expectedHeading && (
      normalizeHeading(item?.title) === expectedHeading
        || (Array.isArray(item?.headingPath) && item.headingPath.some((part) => normalizeHeading(part) === expectedHeading))));
    const lineRangeMatches = !Number.isInteger(range.startLine)
      || (item?.handle?.startLine === range.startLine && item?.handle?.endLine === range.endLine);
    return sourceMatches && headingMatches && lineRangeMatches;
  });
  const containsRanges = (item, ranges, requireHeading = true) => ranges.some((range) => {
    const expectedHeading = normalizeHeading(range.expectedHeading);
    const actualSourceRef = item?.sourceRef ?? item?.handle?.sourceRef;
    const sourceMatches = range.sourceRef === record.sourceRef
      && (!actualSourceRef || actualSourceRef === range.sourceRef);
    const headingMatches = Boolean(expectedHeading && (
      normalizeHeading(item?.title) === expectedHeading
        || (Array.isArray(item?.headingPath) && item.headingPath.some((part) => normalizeHeading(part) === expectedHeading))));
    const candidateStartLine = item?.handle?.startLine;
    const candidateEndLine = item?.handle?.endLine;
    const containsLabeledLines = Number.isInteger(range.startLine)
      && Number.isInteger(range.endLine)
      && Number.isInteger(candidateStartLine)
      && Number.isInteger(candidateEndLine)
      && candidateStartLine <= range.startLine
      && candidateEndLine >= range.endLine;
    return sourceMatches && (!requireHeading || headingMatches) && containsLabeledLines;
  });
  const exactAcceptedRangeMatch = Boolean(decisionStatus === "selected" && matchesRanges(selected, acceptedRanges));
  const relevantRangeMatch = Boolean(decisionStatus === "selected" && matchesRanges(selected, relevantRanges));
  const targetInSearchTop100 = Boolean(record.search?.results?.some((item) => matchesRanges(item, acceptedRanges)));
  const relevantTargetInSearchTop100 = Boolean(record.search?.results?.some((item) => matchesRanges(item, relevantRanges)));
  const targetRangeContainedInSearchTop100 = Boolean(record.search?.results?.some((item) => containsRanges(item, acceptedRanges)));
  const targetLinesContainedInSearchTop100 = Boolean(record.search?.results?.some((item) => containsRanges(item, acceptedRanges, false)));
  const relevantRangeContainedInSearchTop100 = Boolean(record.search?.results?.some((item) => containsRanges(item, relevantRanges)));
  answerabilityDecisionCorrect = decisionStatus === "failed-or-unknown"
    ? null
    : decisionStatus === "selected";
  const rangeSelectionAssessment = decisionStatus !== "selected"
    ? decisionStatus
    : exactAcceptedRangeMatch
      ? "exact"
      : relevantRangeMatch
        ? "relevant"
        : "outside-labeled-ranges";
  return {
    caseId: record.caseId,
    sourceRef: record.sourceRef,
    answerability,
    expectedHeading: label.expectedHeading,
    expectedStartLine: label.expectedStartLine ?? null,
    expectedEndLine: label.expectedEndLine ?? null,
    acceptableRanges: acceptedRanges.map((range) => ({
      sourceRef: range.sourceRef,
      expectedHeading: range.expectedHeading,
      startLine: range.startLine ?? null,
      endLine: range.endLine ?? null,
    })),
    relevantRanges: relevantRanges.map((range) => ({
      sourceRef: range.sourceRef,
      expectedHeading: range.expectedHeading,
      startLine: range.startLine,
      endLine: range.endLine,
    })),
    observedHeading: selected?.title ?? null,
    exactHeadingMatch: exactAcceptedRangeMatch,
    exactAcceptedRangeMatch,
    relevantRangeMatch,
    decisionStatus,
    answerabilityCorrect: answerabilityDecisionCorrect,
    answerabilityDecisionCorrect,
    rangeSelectionAssessment,
    targetInSearchTop100,
    relevantTargetInSearchTop100,
    targetRangeContainedInSearchTop100,
    targetLinesContainedInSearchTop100,
    relevantRangeContainedInSearchTop100,
    exactFetchPassed: Boolean(record.fetch?.passed),
    evidencePackBuilt: record.evidencePack?.passed === true,
    status: record.status,
  };
});
const answerableScores = scored.filter((item) => item.answerability === "answerable");
const unanswerableScores = scored.filter((item) => item.answerability === "unanswerable");
const classifiedDecisionCount = scored.filter((item) => item.answerabilityDecisionCorrect !== null).length;
const correctDecisionCount = scored.filter((item) => item.answerabilityDecisionCorrect === true).length;
const incorrectDecisionCount = scored.filter((item) => item.answerabilityDecisionCorrect === false).length;
const sourceDocumentClusters = new Set(records.map((record) => record.sourceRef).filter(Boolean)).size;
const summary = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: records.every((record) => record.status === "complete") ? "complete" : "partial",
  expectedRequests: cases.length,
  attemptedRequests: records.length,
  successfulRequests: records.filter((record) => record.status === "complete").length,
  failedRequests: records.filter((record) => record.status === "failed").length,
  sourceDocumentClusters,
  independentUnits: manifest.plan.independentUnit ?? "sourceRef clusters (descriptive grouping only)",
  clusterInterpretation: "Distinct sourceRef grouping only; it does not establish independent statistical sampling.",
  exactHeadingMatches: answerableScores.filter((item) => item.exactHeadingMatch).length,
  exactHeadingDenominator: answerableScores.length,
  searchTargetRecallAt100: answerableScores.filter((item) => item.targetInSearchTop100).length,
  searchTargetRecallAt100Denominator: answerableScores.length,
  // Backwards-compatible historical key: this is exact range equality, not range containment.
  searchTargetRecallAt100Semantics: "LEGACY strict equality: matching source, heading and exact labeled start/end lines; use the explicit searchExactLabeledRangeAt100 or searchTargetRangeContainedAt100 fields.",
  searchExactLabeledRangeAt100: answerableScores.filter((item) => item.targetInSearchTop100).length,
  searchExactLabeledRangeDenominator: answerableScores.length,
  searchTargetRangeContainedAt100: answerableScores.filter((item) => item.targetRangeContainedInSearchTop100).length,
  searchTargetRangeContainmentDenominator: answerableScores.length,
  searchTargetLinesContainedAt100: answerableScores.filter((item) => item.targetLinesContainedInSearchTop100).length,
  searchTargetLinesContainmentDenominator: answerableScores.length,
  searchRelevantRangeFound: answerableScores.filter((item) => item.relevantTargetInSearchTop100).length,
  searchRelevantRangeDenominator: answerableScores.filter((item) => item.relevantRanges.length > 0).length,
  searchRelevantRangeContainedAt100: answerableScores.filter((item) => item.relevantRangeContainedInSearchTop100).length,
  searchRelevantRangeContainmentDenominator: answerableScores.filter((item) => item.relevantRanges.length > 0).length,
  searchRangeMetricNote: "Range containment requires the same sourceRef and inclusive candidate line bounds that fully contain the labeled range. The heading-constrained variant additionally requires a matching heading/path. These are retrieval coverage metrics, not semantic sufficiency; review fetched text independently.",
  answerabilityMetrics: {
    answerable: {
      cases: answerableScores.length,
      correctAnswerabilityDecisions: answerableScores.filter((item) => item.answerabilityDecisionCorrect === true).length,
      correctExactRangeSelections: answerableScores.filter((item) => item.exactAcceptedRangeMatch === true).length,
      correctRelevantRangeSelections: answerableScores.filter((item) => item.relevantRangeMatch === true).length,
      selectedOutsideLabeledRanges: answerableScores.filter((item) => item.rangeSelectionAssessment === "outside-labeled-ranges").length,
      incorrectDecisions: answerableScores.filter((item) => item.answerabilityDecisionCorrect === false).length,
      failedOrUnknownDecisions: answerableScores.filter((item) => item.answerabilityDecisionCorrect === null).length,
      abstentions: answerableScores.filter((item) => item.decisionStatus === "abstained").length,
    },
    unanswerable: {
      cases: unanswerableScores.length,
      correctAbstentions: unanswerableScores.filter((item) => item.answerabilityDecisionCorrect === true).length,
      falseSelections: unanswerableScores.filter((item) => item.decisionStatus === "selected").length,
      failedOrUnknownDecisions: unanswerableScores.filter((item) => item.answerabilityDecisionCorrect === null).length,
    },
    classifiedDecisions: classifiedDecisionCount,
    correctDecisions: correctDecisionCount,
    incorrectDecisions: incorrectDecisionCount,
    failedOrUnknownDecisions: scored.length - classifiedDecisionCount,
    decisionAccuracy: classifiedDecisionCount > 0 ? correctDecisionCount / classifiedDecisionCount : null,
    decisionAccuracyNote: "This is answerability-status accuracy (select when answerable, abstain when unanswerable); exact/relevant/outside-labeled range quality is separate. Failures/unknown decisions are reported separately; raw Jev scores remain descriptive and uncalibrated.",
  },
  rangeSelectionMetrics: {
    exactMatches: answerableScores.filter((item) => item.rangeSelectionAssessment === "exact").length,
    relevantLabeledMatches: answerableScores.filter((item) => item.rangeSelectionAssessment === "relevant").length,
    outsideLabeledRanges: answerableScores.filter((item) => item.rangeSelectionAssessment === "outside-labeled-ranges").length,
    abstentions: answerableScores.filter((item) => item.rangeSelectionAssessment === "abstained").length,
    failedOrUnknown: answerableScores.filter((item) => item.rangeSelectionAssessment === "failed-or-unknown").length,
    note: "A range outside the exact or explicitly labeled relevant ranges is ungraded for semantic usefulness; it is not automatically irrelevant. Inspect source text and blinded review separately.",
  },
  exactFetchesWithFingerprint: scored.filter((item) => item.exactFetchPassed).length,
  evidencePacksBuilt: scored.filter((item) => item.evidencePackBuilt).length,
  tokenUsage: {
    input: records.reduce((sum, record) => sum + (record.jev?.usage?.input_tokens ?? 0), 0),
    output: records.reduce((sum, record) => sum + (record.jev?.usage?.output_tokens ?? 0), 0),
  },
  records: scored,
  limitations: [
    "Observed " + sourceDocumentClusters + " distinct sourceRef cluster(s); this grouping is descriptive and does not establish statistical independence.",
    "Label/adjudication status: " + (manifest.labels?.adjudication ?? "not declared; see manifest") + ".",
    "Raw Choice confidence and evidence sufficiency are descriptive; this runner makes no calibration claim.",
    "Exact-heading matching is a strict diagnostic; inspect fetched text for completeness and overbreadth.",
    "The local release adapter is identified by manifest metadata; this runner does not prove activation in the separate live MCP server/catalog."
  ],
  runtime: {
    bridgeCommit: manifest.source.bridgeCommit,
    bridgeVersion: manifest.source.bridgeVersion,
    mssrVersion: manifest.source.mssrVersion,
    requestedModel: manifest.provider.requestedModel,
    metadataModes: [...new Set(cases.map((item) => metadataConfig.byCaseId.get(item.id).metadataMode))],
    metadataControlFiles: frozenMetadataControls,
    canonicalProjectContextManifest: projectContextManifest,
    returnedModel: records.find((record) => record.returnedModel)?.returnedModel ?? null,
  },
};
await fs.writeFile(path.join(runDir, "summary.json"), json(summary), "utf8");
await fs.writeFile(path.join(runDir, "run-completion.json"), json({
  schemaVersion: 1,
  runId: manifest.runId,
  manifestSha256: frozenManifestHash,
  status: summary.status,
  completedAt: new Date().toISOString(),
  attemptedRequests: records.length,
  successfulRequests: summary.successfulRequests,
  failedRequests: summary.failedRequests,
  labelsExposedToProvider: false,
  networkOptInAuthorized: allowNetwork && manifest.provider.networkOptIn === true,
  argvContainsAllowNetwork: allowNetwork,
  jevRequestIdsReturned: records.filter((record) => Boolean(record.jev?.providerRequestId)).length,
  providerTransportInvocationsObserved: null,
  metadataModes: [...new Set(cases.map((item) => metadataConfig.byCaseId.get(item.id).metadataMode))],
  metadataControlFiles: frozenMetadataControls,
  canonicalProjectContextManifest: projectContextManifest,
}), "utf8");
const fileList = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name !== "SHA256SUMS" && entry.name !== ".runner.lock") fileList.push(path.relative(runDir, full).replaceAll("\\", "/"));
  }
}
await walk(runDir);
fileList.sort();
const sums = [];
for (const file of fileList) sums.push((await hashFile(path.join(runDir, file))) + "  " + file);
await fs.writeFile(path.join(runDir, "SHA256SUMS"), sums.join("\n") + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
} finally {
  await releaseRunLock();
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
