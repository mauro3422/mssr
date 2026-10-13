import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inspectSelectedDecision } from "./selection-record.mjs";

const [runArgument, writeArgument, ...extraArguments] = process.argv.slice(2);
if (!runArgument || (writeArgument && writeArgument !== "--write") || extraArguments.length) {
  console.error("Usage: node summarize-run.mjs <run-directory> [--write]");
  process.exit(2);
}

const runDir = path.resolve(runArgument);
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(runDir, file), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const finite = (value) => Number.isFinite(value);
const isSha256 = (value) => typeof value === "string" && /^[a-f\d]{64}$/iu.test(value);
const normalizeHeading = (value) => String(value ?? "").trim().replace(/^#{1,6}\s+/u, "").trim();

function exactFetchBoundToHandle(fetch, handle) {
  return fetch?.passed === true
    && handle != null
    && typeof handle.id === "string"
    && typeof handle.revision === "string"
    && isSha256(handle.fingerprint)
    && fetch.handleId === handle.id
    && fetch.revision === handle.revision
    && fetch.selectedFingerprint === handle.fingerprint
    && fetch.fingerprint === handle.fingerprint
    && (fetch.returnedFingerprint == null || fetch.returnedFingerprint === handle.fingerprint)
    && (fetch.textMatchesFrozenSource == null || fetch.textMatchesFrozenSource === true)
    && (fetch.expectedTextSha256 == null || fetch.textSha256 === fetch.expectedTextSha256);
}

function evidencePackBuilt(record) {
  const pack = record.evidencePack;
  if (!pack || pack.status === "invalid" || pack.status === "not-built") return false;
  if (typeof pack.passed === "boolean") return pack.passed;
  return pack.status === "complete" || pack.status === "validated";
}

function evidencePackBoundToHandle(record, handle) {
  const packRecord = record.evidencePack;
  if (!evidencePackBuilt(record) || !handle) return false;
  if (typeof packRecord.passed === "boolean") return packRecord.passed;
  const pack = packRecord.rawPack;
  if (!Array.isArray(pack?.paragraphs)) return false;
  return pack.paragraphs.some((paragraph) => {
    const citation = paragraph?.citation;
    const identityMatches = citation?.handleId === handle.id
      && citation?.owner === handle.owner
      && citation?.sourceRef === handle.sourceRef
      && citation?.revision === handle.revision
      && citation?.rangeId === handle.rangeId
      && citation?.rangeKind === handle.rangeKind
      && citation?.startLine === handle.startLine
      && citation?.endLine === handle.endLine
      && citation?.fingerprint === handle.fingerprint
      && citation?.privacyClass === handle.privacyClass;
    const textMatchesFetch = typeof record.fetch?.text !== "string"
      || paragraph?.exactText === record.fetch.text;
    return identityMatches && textMatchesFetch;
  });
}

function matchesRanges(record, label, item, selectedRanges) {
  const ranges = selectedRanges ?? (Array.isArray(label.acceptableRanges) && label.acceptableRanges.length > 0
    ? label.acceptableRanges
    : [{
        sourceRef: label.sourceRef ?? record.sourceRef,
        expectedHeading: label.expectedHeading,
        startLine: label.expectedStartLine,
        endLine: label.expectedEndLine,
      }]);
  const itemSourceRef = item?.sourceRef ?? item?.handle?.sourceRef ?? record.sourceRef;
  return ranges.some((range) => {
    const expectedHeading = normalizeHeading(range.expectedHeading);
    const headingMatches = Boolean(expectedHeading && (
      normalizeHeading(item?.title) === expectedHeading
        || (Array.isArray(item?.headingPath) && item.headingPath.some((part) => normalizeHeading(part) === expectedHeading))));
    return range.sourceRef === record.sourceRef
      && itemSourceRef === range.sourceRef
      && headingMatches
      && Number.isInteger(range.startLine)
      && Number.isInteger(range.endLine)
      && item?.handle?.startLine === range.startLine
      && item?.handle?.endLine === range.endLine;
  });
}

function containsRanges(record, label, item, selectedRanges, requireHeading = true) {
  const ranges = selectedRanges ?? (Array.isArray(label.acceptableRanges) && label.acceptableRanges.length > 0
    ? label.acceptableRanges
    : [{
        sourceRef: label.sourceRef ?? record.sourceRef,
        expectedHeading: label.expectedHeading,
        startLine: label.expectedStartLine,
        endLine: label.expectedEndLine,
      }]);
  const itemSourceRef = item?.sourceRef ?? item?.handle?.sourceRef ?? record.sourceRef;
  const candidateStartLine = item?.handle?.startLine;
  const candidateEndLine = item?.handle?.endLine;
  return ranges.some((range) => {
    const expectedHeading = normalizeHeading(range.expectedHeading);
    const headingMatches = Boolean(expectedHeading && (
      normalizeHeading(item?.title) === expectedHeading
        || (Array.isArray(item?.headingPath) && item.headingPath.some((part) => normalizeHeading(part) === expectedHeading))));
    return range.sourceRef === record.sourceRef
      && itemSourceRef === range.sourceRef
      && (!requireHeading || headingMatches)
      && Number.isInteger(range.startLine)
      && Number.isInteger(range.endLine)
      && Number.isInteger(candidateStartLine)
      && Number.isInteger(candidateEndLine)
      && candidateStartLine <= range.startLine
      && candidateEndLine >= range.endLine;
  });
}

function matchesAcceptedRange(record, label, item) {
  return matchesRanges(record, label, item);
}

function matchesRelevantRange(record, label, item) {
  return matchesRanges(record, label, item, label.relevantRanges ?? []);
}

function containsAcceptedRange(record, label, item) {
  return containsRanges(record, label, item);
}

function containsAcceptedLines(record, label, item) {
  return containsRanges(record, label, item, undefined, false);
}

function containsRelevantRange(record, label, item) {
  return containsRanges(record, label, item, label.relevantRanges ?? []);
}

async function verifyChecksums(requiredFiles) {
  let contents;
  try {
    contents = await fs.readFile(path.join(runDir, "SHA256SUMS"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("SHA256SUMS is required to summarize a frozen Jev run");
    throw error;
  }

  const rows = contents.split(/\r?\n/u).filter(Boolean);
  assert.ok(rows.length > 0, "SHA256SUMS is empty");
  const indexedFiles = new Set();
  for (const row of rows) {
    const match = /^([a-f\d]{64})\s{2}(.+)$/iu.exec(row);
    assert.ok(match, `invalid SHA256SUMS row: ${row}`);
    const relativePath = match[2].replace(/\\/gu, "/");
    assert.ok(!path.isAbsolute(relativePath) && !/^[a-z]:/iu.test(relativePath) && !relativePath.startsWith("//"), `absolute checksum path refused: ${relativePath}`);
    const absolutePath = path.resolve(runDir, ...relativePath.split("/"));
    const pathFromRun = path.relative(runDir, absolutePath);
    assert.ok(pathFromRun && pathFromRun !== ".." && !pathFromRun.startsWith(`..${path.sep}`) && !path.isAbsolute(pathFromRun), `checksum path escapes run directory: ${relativePath}`);
    const key = relativePath.toLocaleLowerCase("en-US");
    assert.ok(!indexedFiles.has(key), `duplicate checksum path: ${relativePath}`);
    indexedFiles.add(key);
    const bytes = await fs.readFile(absolutePath);
    assert.equal(hash(bytes), match[1].toLowerCase(), `checksum mismatch: ${relativePath}`);
  }
  const missingFiles = requiredFiles.filter((file) => !indexedFiles.has(file.toLocaleLowerCase("en-US")));
  assert.deepEqual(missingFiles, [], `SHA256SUMS does not cover required frozen artifacts: ${missingFiles.join(", ")}`);
  return { present: true, verified: rows.length, requiredFiles };
}

function usageFor(records, valueAt) {
  return records.reduce((total, record) => {
    const usage = valueAt(record) ?? {};
    return {
      input: total.input + (usage.input_tokens ?? 0),
      output: total.output + (usage.output_tokens ?? 0),
    };
  }, { input: 0, output: 0 });
}

function pairedExcerptCapSummary({ manifest, completion, cases, records, checksums }) {
  assert.equal(manifest.schemaVersion, 1, "unsupported paired-excerpt-cap manifest version");
  assert.equal(completion.runId, manifest.runId, "run ID mismatch");
  assert.equal(completion.status, "complete", "paired run is not complete");
  assert.equal(completion.expectedPairs, cases.length, "completion/case pair count mismatch");
  assert.equal(completion.completedPairs, cases.length, "not all preregistered pairs completed");
  assert.equal(completion.providerCalls, records.length, "completion/record count mismatch");
  assert.equal(records.length, manifest.providerCallsExpected, "manifest/record call count mismatch");

  const caseById = new Map(cases.map((item) => [item.id, item]));
  assert.equal(caseById.size, cases.length, "duplicate paired case IDs");
  const allowedArms = new Set(manifest.arms);
  const rowsByCase = new Map();
  const seenPairs = new Set();
  for (const record of records) {
    assert.ok(caseById.has(record.caseId), `unexpected paired record ${record.caseId}`);
    assert.ok(allowedArms.has(record.cap), `unexpected excerpt cap ${record.cap}`);
    const pairKey = `${record.caseId}\u0000${record.cap}`;
    assert.ok(!seenPairs.has(pairKey), `duplicate case/cap pair ${record.caseId}/${record.cap}`);
    seenPairs.add(pairKey);
    const rows = rowsByCase.get(record.caseId) ?? [];
    rows.push(record);
    rowsByCase.set(record.caseId, rows);
  }
  for (const item of cases) {
    const rows = rowsByCase.get(item.id) ?? [];
    assert.equal(rows.length, allowedArms.size, `incomplete arm set for ${item.id}`);
    for (const arm of allowedArms) assert.ok(rows.some((row) => row.cap === arm), `missing ${item.id}/${arm} arm`);
  }

  const sourceRefs = [...new Set(cases.map((item) => item.sourceRef).filter(Boolean))].sort();
  const providerReportedSelected = records.filter((record) => record.selector?.status === "selected");
  const selected = providerReportedSelected.filter((record) => inspectSelectedDecision(
    record.selector,
    caseById.get(record.caseId)?.sourceRef,
  ).valid);
  const malformedSelected = providerReportedSelected.filter((record) => !inspectSelectedDecision(
    record.selector,
    caseById.get(record.caseId)?.sourceRef,
  ).valid);
  const abstained = records.filter((record) => record.selector?.status === "abstained");
  const failed = records.filter((record) => record.safeError != null
    || !["selected", "abstained"].includes(record.selector?.status)
    || (record.selector?.status === "selected" && !inspectSelectedDecision(
      record.selector,
      caseById.get(record.caseId)?.sourceRef,
    ).valid));
  const exactFetchReportedMatched = records.filter((record) => record.exactFetch?.fingerprintMatched === true);
  const exactFetchIntegrityErrors = exactFetchReportedMatched.filter((record) => {
    const integrity = inspectSelectedDecision(record.selector, caseById.get(record.caseId)?.sourceRef);
    const fingerprint = record.selector?.selected?.handle?.fingerprint;
    return !integrity.valid
      || !isSha256(fingerprint)
      || record.exactFetch?.fingerprint !== fingerprint
      || record.exactFetch?.handleFingerprint !== fingerprint;
  });
  const exactFetches = exactFetchReportedMatched.filter((record) => !exactFetchIntegrityErrors.includes(record));
  const evidenceSufficiencyRecorded = records.filter((record) => finite(record.selector?.evidenceSufficiency));
  const confidenceRecorded = records.filter((record) => finite(record.selector?.providerConfidence));
  const tokenUsage = usageFor(records, (record) => record.selector?.usage);

  return {
    schemaVersion: 2,
    schemaProfile: "paired-excerpt-cap-v1",
    reportType: "mechanically-derived paired diagnostic; no semantic adjudication",
    runId: manifest.runId,
    completionStatus: completion.status,
    frozenManifestSha256: null,
    checksumFile: checksums,
    preRegistered: manifest.preRegistered === true,
    labelsPreparedBeforeProviderCalls: manifest.labelsPreparedBeforeProviderCalls === true,
    ownerGold: manifest.ownerGold === true,
    independentVariable: manifest.independentVariable ?? null,
    arms: manifest.arms,
    pairedCases: cases.length,
    expectedPairs: completion.expectedPairs,
    completedPairs: completion.completedPairs,
    expectedProviderCalls: manifest.providerCallsExpected,
    attemptedRequests: records.length,
    selected: selected.length,
    providerReportedSelected: providerReportedSelected.length,
    selectionIntegrityStatus: malformedSelected.length === 0 && exactFetchIntegrityErrors.length === 0 ? "passed" : "issues",
    malformedSelectedDecisions: malformedSelected.map((record) => ({
      caseId: record.caseId,
      reason: inspectSelectedDecision(record.selector, caseById.get(record.caseId)?.sourceRef).reason,
    })),
    abstained: abstained.length,
    failedRequests: failed.length,
    sourceDocumentClusters: sourceRefs.length,
    sourceRefs,
    clusterInterpretation: "Distinct sourceRef grouping only; it does not establish independent statistical sampling.",
    exactFetchesWithFingerprint: exactFetches.length,
    exactFetchesReportedMatched: exactFetchReportedMatched.length,
    exactFetchIntegrityErrors: exactFetchIntegrityErrors.map((record) => record.caseId),
    providerConfidenceCapture: { recorded: confidenceRecorded.length, missing: records.length - confidenceRecorded.length },
    evidenceSufficiencyCapture: { recorded: evidenceSufficiencyRecorded.length, missing: records.length - evidenceSufficiencyRecorded.length },
    tokenUsage,
    calibrationClaim: false,
    labelMetrics: null,
    records: records.map((record) => ({
      caseId: record.caseId,
      sourceRef: caseById.get(record.caseId)?.sourceRef ?? null,
      cap: record.cap,
      status: record.selector?.status ?? "failed",
      selectedRangeId: record.selector?.selected?.handle?.rangeId ?? null,
      selectedTitle: record.selector?.selected?.title ?? null,
      rawChoiceConfidence: record.selector?.providerConfidence ?? null,
      evidenceSufficiency: record.selector?.evidenceSufficiency ?? null,
      exactFetchPassed: exactFetchReportedMatched.includes(record) && !exactFetchIntegrityErrors.includes(record),
      selectedDecisionValid: inspectSelectedDecision(record.selector, caseById.get(record.caseId)?.sourceRef).valid,
      elapsedMs: record.elapsedWallMs ?? null,
    })),
  };
}

function genericSummary({ manifest, completion, cases, labels, records, checksums }) {
  assert.ok(manifest.plan && Number.isInteger(manifest.plan.expectedRequestCount), "generic run manifest.plan.expectedRequestCount is required");
  assert.equal(completion.runId, manifest.runId, "run ID mismatch");
  assert.equal(completion.status, "complete", "generic run is not complete");
  assert.equal(completion.attemptedRequests, records.length, "completion/record count mismatch");
  assert.equal(records.length, cases.length, "case/record count mismatch");
  assert.equal(cases.length, manifest.plan.expectedRequestCount, "manifest/case count mismatch");

  const expectedIds = new Set(cases.map((item) => item.id));
  assert.equal(expectedIds.size, cases.length, "duplicate case IDs");
  const recordIds = new Set();
  for (const record of records) {
    assert.ok(expectedIds.has(record.caseId), `unexpected record ${record.caseId}`);
    assert.ok(!recordIds.has(record.caseId), `duplicate record for case ${record.caseId}`);
    recordIds.add(record.caseId);
  }
  assert.deepEqual([...recordIds].sort(), [...expectedIds].sort(), "records do not cover every case exactly once");

  const successful = records.filter((record) => record.status === "complete");
  const failed = records.filter((record) => record.status !== "complete");
  const providerReportedSelected = records.filter((record) => record.jev?.status === "selected");
  const selectionIntegrity = new Map(records.map((record) => [
    record.caseId,
    inspectSelectedDecision(record.jev, record.sourceRef),
  ]));
  const selected = records.filter((record) => selectionIntegrity.get(record.caseId).valid);
  const malformedSelected = providerReportedSelected.filter((record) => !selectionIntegrity.get(record.caseId).valid);
  const abstained = records.filter((record) => record.jev?.status === "abstained");
  const fetchLinkageErrors = records.filter((record) => {
    if (record.fetch?.passed !== true || !selectionIntegrity.get(record.caseId).valid) return false;
    const handle = record.jev.selected.handle;
    return !exactFetchBoundToHandle(record.fetch, handle);
  });
  const fetched = records.filter((record) => record.fetch?.passed === true
    && selectionIntegrity.get(record.caseId).valid
    && exactFetchBoundToHandle(record.fetch, record.jev.selected.handle));
  const packs = records.filter((record) => selectionIntegrity.get(record.caseId).valid
    && exactFetchBoundToHandle(record.fetch, record.jev?.selected?.handle)
    && evidencePackBoundToHandle(record, record.jev?.selected?.handle));
  const fetchPassedForRecord = (record) => record.fetch?.passed === true
    && selectionIntegrity.get(record.caseId).valid
    && exactFetchBoundToHandle(record.fetch, record.jev.selected.handle);
  const evidencePackBuiltForRecord = (record) => fetchPassedForRecord(record)
    && evidencePackBoundToHandle(record, record.jev?.selected?.handle);
  const evidenceSufficiencyRecorded = records.filter((record) => finite(record.jev?.evidenceSufficiency));
  const rawNoulRecorded = records.filter((record) => finite(record.jev?.noul));
  const sourceRefs = [...new Set(records.map((record) => record.sourceRef).filter(Boolean))].sort();
  const labelsByCase = new Map((labels?.cases ?? []).map((label) => [label.caseId, label]));
  if (labels) {
    assert.equal(labels.cases?.length, records.length, "label/record count mismatch");
    assert.equal(new Set(labels.cases.map((label) => label.caseId)).size, labels.cases.length, "duplicate label case IDs");
  }

  const started = records.map((record) => record.startedAt).filter(Boolean).sort();
  const completed = records.map((record) => record.completedAt).filter(Boolean).sort();
  const manifestTime = Date.parse(manifest.createdAt);
  const firstRequestTime = started.length ? Date.parse(started[0]) : Number.NaN;
  const createdAtDeltaMs = Number.isFinite(manifestTime) && Number.isFinite(firstRequestTime)
    ? firstRequestTime - manifestTime
    : null;
  const labelScores = labels
    ? records.map((record) => {
        const label = labelsByCase.get(record.caseId);
        assert.ok(label, `missing label for record ${record.caseId}`);
        const answerability = label.answerability ?? "answerable";
        assert.ok(["answerable", "unanswerable"].includes(answerability), `invalid answerability for ${record.caseId}`);
        const selectedIntegrity = selectionIntegrity.get(record.caseId);
        const hasSelectionConflict = (record.jev?.status === "abstained" && record.jev?.selected != null)
          || (record.jev?.status === "selected" && !selectedIntegrity.valid)
          || (record.jev?.status === "abstained" && record.jev?.choice != null && record.jev.choice !== "none")
          || (record.jev?.status == null && record.jev?.choice === "none" && record.jev?.selected != null);
        const hasSelectedDecision = !hasSelectionConflict && selectedIntegrity.valid;
        const hasAbstainedDecision = !hasSelectionConflict && (record.jev?.status === "abstained"
          || (record.jev?.status == null && record.jev?.choice === "none" && record.jev?.selected == null));
        const decisionStatus = hasSelectedDecision ? "selected" : hasAbstainedDecision ? "abstained" : "failed-or-unknown";
        const exactAcceptedRangeMatch = decisionStatus === "selected"
          && matchesAcceptedRange(record, label, record.jev.selected);
        const relevantRangeMatch = decisionStatus === "selected"
          && matchesRelevantRange(record, label, record.jev.selected);
        const answerabilityDecisionCorrect = decisionStatus === "failed-or-unknown"
          ? null
          : answerability === "unanswerable"
            ? decisionStatus === "abstained"
            : decisionStatus === "selected";
        const rangeSelectionAssessment = decisionStatus !== "selected"
          ? decisionStatus
          : exactAcceptedRangeMatch
            ? "exact"
            : relevantRangeMatch
              ? "relevant"
              : "outside-labeled-ranges";
        if (answerability === "unanswerable") {
          return {
            caseId: record.caseId,
            sourceRef: record.sourceRef,
            answerability,
            expectedHeading: null,
            observedHeading: record.jev?.selected?.title ?? null,
            decisionStatus,
            decisionCorrect: answerabilityDecisionCorrect,
            answerabilityDecisionCorrect,
            rangeSelectionAssessment,
            normalizedExactHeadingMatch: null,
            exactAcceptedRangeMatch: null,
            relevantRangeMatch: null,
            relevantRanges: [],
            searchTargetFound: null,
            searchExactAcceptedRangeFound: null,
            searchTargetRangeContainedAt100: null,
            searchTargetLinesContainedAt100: null,
            searchRelevantRangeFound: null,
            searchRelevantRangeContainedAt100: null,
            exactFetchPassed: fetchPassedForRecord(record),
            pipelineStatus: record.status,
          };
        }
        const expectedHeading = normalizeHeading(label.expectedHeading);
        const observedHeading = normalizeHeading(record.jev?.selected?.title);
        const searchTargetFound = (record.search?.results ?? [])
          .some((result) => normalizeHeading(result.title) === expectedHeading
            || (Array.isArray(result.headingPath)
              && result.headingPath.some((part) => normalizeHeading(part) === expectedHeading)));
        const searchExactAcceptedRangeFound = (record.search?.results ?? [])
          .some((result) => matchesAcceptedRange(record, label, result));
        const searchTargetRangeContainedAt100 = (record.search?.results ?? [])
          .some((result) => containsAcceptedRange(record, label, result));
        const searchTargetLinesContainedAt100 = (record.search?.results ?? [])
          .some((result) => containsAcceptedLines(record, label, result));
        const searchRelevantRangeFound = (record.search?.results ?? [])
          .some((result) => matchesRelevantRange(record, label, result));
        const searchRelevantRangeContainedAt100 = (record.search?.results ?? [])
          .some((result) => containsRelevantRange(record, label, result));
        return {
          caseId: record.caseId,
          sourceRef: record.sourceRef,
          answerability,
          expectedHeading: label.expectedHeading,
          observedHeading: record.jev?.selected?.title ?? null,
          normalizedExactHeadingMatch: hasSelectedDecision && observedHeading === expectedHeading,
          exactAcceptedRangeMatch,
          relevantRangeMatch,
          relevantRanges: label.relevantRanges ?? [],
          searchTargetFound,
          searchExactAcceptedRangeFound,
          searchTargetRangeContainedAt100,
          searchTargetLinesContainedAt100,
          searchRelevantRangeFound,
          searchRelevantRangeContainedAt100,
          decisionStatus,
          decisionCorrect: answerabilityDecisionCorrect,
          answerabilityDecisionCorrect,
          rangeSelectionAssessment,
          exactFetchPassed: fetchPassedForRecord(record),
          pipelineStatus: record.status,
        };
      })
    : null;
  const answerableLabelScores = labelScores?.filter((item) => item.answerability === "answerable") ?? [];
  const unanswerableLabelScores = labelScores?.filter((item) => item.answerability === "unanswerable") ?? [];
  const decisionCorrectCount = labelScores?.filter((item) => item.answerabilityDecisionCorrect === true).length ?? 0;
  const decisionIncorrectCount = labelScores?.filter((item) => item.answerabilityDecisionCorrect === false).length ?? 0;
  const decisionUnclassifiedCount = labelScores?.filter((item) => item.answerabilityDecisionCorrect === null).length ?? 0;

  return {
    schemaVersion: 2,
    schemaProfile: "generic-librarian-run-v1",
    reportType: "mechanically-derived run summary; no semantic adjudication",
    runId: manifest.runId,
    parentRunId: manifest.parentRunId ?? null,
    frozenManifestSha256: completion.manifestSha256,
    completionStatus: completion.status,
    checksumFile: checksums,
    sourceDocumentClusters: sourceRefs.length,
    sourceRefs,
    clusterInterpretation: "Distinct sourceRef grouping only; it does not establish independent statistical sampling.",
    expectedRequests: manifest.plan.expectedRequestCount,
    attemptedRequests: records.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    selected: selected.length,
    providerReportedSelected: providerReportedSelected.length,
    selectionIntegrityStatus: malformedSelected.length === 0 && fetchLinkageErrors.length === 0 ? "passed" : "issues",
    malformedSelectedDecisions: malformedSelected.map((record) => ({
      caseId: record.caseId,
      reason: selectionIntegrity.get(record.caseId).reason,
    })),
    abstained: abstained.length,
    exactFetchesWithFingerprint: fetched.length,
    fetchesReportedPassed: records.filter((record) => record.fetch?.passed === true).length,
    fetchesWithoutValidSelection: records.filter((record) => record.fetch?.passed === true
      && !selectionIntegrity.get(record.caseId).valid).map((record) => record.caseId),
    fetchSelectionLinkageErrors: fetchLinkageErrors.map((record) => record.caseId),
    evidencePacksBuilt: packs.length,
    evidencePacksReportedBuilt: records.filter(evidencePackBuilt).length,
    evidenceSufficiencyCapture: {
      recorded: evidenceSufficiencyRecorded.length,
      missingFromRecords: records.length - evidenceSufficiencyRecorded.length,
      note: "Only the explicit jev.evidenceSufficiency field is counted; raw Noul and other aliases are reported separately.",
    },
    rawNoulCapture: {
      recorded: rawNoulRecorded.length,
      missingFromRecords: records.length - rawNoulRecorded.length,
      note: "Provider Noul is descriptive and is not treated as an evidence-sufficiency alias.",
    },
    tokenUsage: usageFor(records, (record) => record.jev?.usage),
    firstRequestStartedAt: started[0] ?? null,
    lastRequestCompletedAt: completed.at(-1) ?? null,
    manifestCreatedAt: manifest.createdAt ?? null,
    createdAtDeltaMs,
    timestampWarning: createdAtDeltaMs !== null && createdAtDeltaMs < 0
      ? "manifest createdAt is future-dated relative to the first request; use request events as execution time"
      : null,
    declaredIndependentUnitUnverified: manifest.plan.independentUnit ?? null,
    independentUnitDeclarationInterpretation: "Manifest text is retained for audit; it is not verified against observed sourceRef clusters.",
    independentUnit: "source-document cluster (descriptive grouping only)",
    calibrationClaim: false,
    labelMetrics: labelScores
      ? {
          reportType: "answerability disposition and independently labeled range-selection diagnostics; not semantic adjudication or calibration",
          labelSource: labels.source ?? null,
          adjudication: labels.adjudication ?? null,
          answerabilityMetrics: {
            answerable: {
              cases: answerableLabelScores.length,
              correctAnswerabilityDecisions: answerableLabelScores.filter((item) => item.answerabilityDecisionCorrect === true).length,
              correctExactRangeSelections: answerableLabelScores.filter((item) => item.exactAcceptedRangeMatch === true).length,
              correctRelevantRangeSelections: answerableLabelScores.filter((item) => item.relevantRangeMatch === true).length,
              selectedOutsideLabeledRanges: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "outside-labeled-ranges").length,
              incorrectDecisions: answerableLabelScores.filter((item) => item.answerabilityDecisionCorrect === false).length,
              failedOrUnknownDecisions: answerableLabelScores.filter((item) => item.answerabilityDecisionCorrect === null).length,
              abstentions: answerableLabelScores.filter((item) => item.decisionStatus === "abstained").length,
            },
            unanswerable: {
              cases: unanswerableLabelScores.length,
              correctAbstentions: unanswerableLabelScores.filter((item) => item.answerabilityDecisionCorrect === true).length,
              falseSelections: unanswerableLabelScores.filter((item) => item.decisionStatus === "selected").length,
              failedOrUnknownDecisions: unanswerableLabelScores.filter((item) => item.answerabilityDecisionCorrect === null).length,
            },
            classifiedDecisions: decisionCorrectCount + decisionIncorrectCount,
            correctDecisions: decisionCorrectCount,
            incorrectDecisions: decisionIncorrectCount,
            failedOrUnknownDecisions: decisionUnclassifiedCount,
            decisionAccuracy: decisionCorrectCount + decisionIncorrectCount > 0
              ? decisionCorrectCount / (decisionCorrectCount + decisionIncorrectCount)
              : null,
            decisionAccuracyNote: "This is answerability-status accuracy (select when answerable, abstain when unanswerable); exact/relevant/outside-labeled range quality is reported separately. Failures/unknown decisions stay separate; raw Jev scores remain descriptive and uncalibrated.",
          },
          rangeSelectionMetrics: {
            exactMatches: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "exact").length,
            relevantLabeledMatches: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "relevant").length,
            outsideLabeledRanges: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "outside-labeled-ranges").length,
            abstentions: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "abstained").length,
            failedOrUnknown: answerableLabelScores.filter((item) => item.rangeSelectionAssessment === "failed-or-unknown").length,
            note: "A range outside the exact or explicitly labeled relevant ranges is ungraded for semantic usefulness; it is not automatically irrelevant. Inspect source text and blinded review separately.",
          },
          normalizedExactHeadingMatches: answerableLabelScores.filter((item) => item.normalizedExactHeadingMatch).length,
          exactHeadingDenominator: answerableLabelScores.length,
          exactAcceptedRangeMatches: answerableLabelScores.filter((item) => item.exactAcceptedRangeMatch).length,
          exactAcceptedRangeDenominator: answerableLabelScores.length,
          relevantRangeMatches: answerableLabelScores.filter((item) => item.relevantRangeMatch).length,
          relevantRangeDenominator: answerableLabelScores.filter((item) => Array.isArray(labelsByCase.get(item.caseId)?.relevantRanges)
            && labelsByCase.get(item.caseId).relevantRanges.length > 0).length,
          searchTargetFound: answerableLabelScores.filter((item) => item.searchTargetFound).length,
          searchTargetDenominator: answerableLabelScores.length,
          searchExactAcceptedRangeFound: answerableLabelScores.filter((item) => item.searchExactAcceptedRangeFound).length,
          searchExactAcceptedRangeDenominator: answerableLabelScores.length,
          searchTargetRangeContainedAt100: answerableLabelScores.filter((item) => item.searchTargetRangeContainedAt100).length,
          searchTargetRangeContainmentDenominator: answerableLabelScores.length,
          searchTargetLinesContainedAt100: answerableLabelScores.filter((item) => item.searchTargetLinesContainedAt100).length,
          searchTargetLinesContainmentDenominator: answerableLabelScores.length,
          searchRelevantRangeFound: answerableLabelScores.filter((item) => item.searchRelevantRangeFound).length,
          searchRelevantRangeDenominator: answerableLabelScores.filter((item) => Array.isArray(labelsByCase.get(item.caseId)?.relevantRanges)
            && labelsByCase.get(item.caseId).relevantRanges.length > 0).length,
          searchRelevantRangeContainedAt100: answerableLabelScores.filter((item) => item.searchRelevantRangeContainedAt100).length,
          searchRelevantRangeContainmentDenominator: answerableLabelScores.filter((item) => Array.isArray(labelsByCase.get(item.caseId)?.relevantRanges)
            && labelsByCase.get(item.caseId).relevantRanges.length > 0).length,
          searchRangeMetricNote: "Range containment requires the same sourceRef and inclusive candidate line bounds that fully contain the labeled range. The heading-constrained variant additionally requires a matching heading/path. These are retrieval coverage metrics, not semantic sufficiency; review fetched text independently.",
          records: labelScores,
        }
      : null,
    records: records.map((record) => ({
      caseId: record.caseId,
      sourceRef: record.sourceRef,
      status: record.status,
      searchResultCount: record.search?.resultCount ?? null,
      jevStatus: record.jev?.status ?? null,
      selectedRangeId: record.jev?.selected?.handle?.rangeId ?? null,
      rawChoiceConfidence: record.jev?.rawChoiceConfidence ?? null,
      evidenceSufficiency: record.jev?.evidenceSufficiency ?? null,
      providerNoul: record.jev?.noul ?? null,
      exactFetchPassed: fetchPassedForRecord(record),
      selectedDecisionValid: selectionIntegrity.get(record.caseId).valid,
      evidencePackBuilt: evidencePackBuiltForRecord(record),
      elapsedMs: record.elapsedMs ?? null,
    })),
  };
}

const manifestBytes = await fs.readFile(path.join(runDir, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const isPairedExcerptCap = manifest.study === "paired-excerpt-cap-diagnostic";
const isGenericRun = manifest.plan?.expectedRequestCount !== undefined;
assert.ok(
  isPairedExcerptCap || isGenericRun,
  `Unsupported Jev run schema; expected generic-librarian-run-v1 or paired-excerpt-cap-diagnostic. Manifest keys: ${Object.keys(manifest).sort().join(", ")}`,
);
const completion = await readJson("run-completion.json");
const casesDocument = await readJson("inputs/cases.json");
const cases = casesDocument.cases;
assert.ok(Array.isArray(cases), "inputs/cases.json must contain a cases array");
const requiredChecksumFiles = ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"];
if (!isPairedExcerptCap) {
  try {
    await fs.access(path.join(runDir, "inputs/labels.json"));
    requiredChecksumFiles.push("inputs/labels.json");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const checksums = await verifyChecksums(requiredChecksumFiles);
let labels = null;
if (manifest.study !== "paired-excerpt-cap-diagnostic") {
  try {
    labels = await readJson("inputs/labels.json");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const records = (await fs.readFile(path.join(runDir, "records.jsonl"), "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

let report;
if (isPairedExcerptCap) {
  report = pairedExcerptCapSummary({ manifest, completion, cases, records, checksums });
} else if (manifest.plan?.expectedRequestCount !== undefined) {
  assert.equal(completion.manifestSha256, hash(manifestBytes), "frozen manifest hash mismatch");
  report = genericSummary({ manifest, completion, cases, labels, records, checksums });
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (writeArgument === "--write") {
  await fs.writeFile(path.join(runDir, "summary-calculated.json"), serialized, "utf8");
} else {
  process.stdout.write(serialized);
}
