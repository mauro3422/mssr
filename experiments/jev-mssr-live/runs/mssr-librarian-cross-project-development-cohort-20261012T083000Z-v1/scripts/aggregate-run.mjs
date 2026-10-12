import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const derivedRoot = path.join(runRoot, 'derived');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(runRoot, relativePath), 'utf8'));
const optionalJson = (relativePath) => {
  const absolutePath = path.join(runRoot, relativePath);
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
};
const writeJson = (filePath, value) => fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
const round = (number, digits = 3) => Number(number.toFixed(digits));
const rate = (count, total) => ({ count, total, percent: total ? round(100 * count / total, 1) : null });
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2, 1);
};
const textOf = (value) => value == null ? '' : String(value);
const normalizeHeading = (value) => textOf(value).replace(/^#+\s*/, '').normalize('NFKC').trim().toLocaleLowerCase('en');
const resultOf = (document) => document?.envelope?.result ?? document?.result ?? document?.envelope?.result?.result ?? null;
const rangeOf = (candidate) => candidate?.handle ?? candidate?.range ?? candidate ?? {};
const headingPathOf = (candidate) => candidate?.headingPath ?? candidate?.metadata?.headingPath ?? candidate?.handle?.headingPath ?? [];
const covers = (candidate, startLine, endLine) => {
  const range = rangeOf(candidate);
  return Number.isInteger(range.startLine) && Number.isInteger(range.endLine)
    && range.startLine <= startLine && range.endLine >= endLine;
};
const hasExpectedHeading = (candidate, expectedHeading) => headingPathOf(candidate).some((heading) => normalizeHeading(heading) === normalizeHeading(expectedHeading));
const meetsAcceptedRange = (candidate, acceptedRange) => hasExpectedHeading(candidate, acceptedRange.expectedHeading)
  && covers(candidate, acceptedRange.startLine, acceptedRange.endLine);
const uniqueLineSet = (spans) => {
  const lines = new Set();
  for (const span of spans ?? []) {
    if (!Number.isInteger(span.startLine) || !Number.isInteger(span.endLine) || span.endLine < span.startLine) continue;
    for (let line = span.startLine; line <= span.endLine; line += 1) lines.add(line);
  }
  return lines;
};
const countCoveredSupportLines = (handle, spans) => {
  const support = uniqueLineSet(spans);
  const range = rangeOf(handle);
  const covered = [...support].filter((line) => Number.isInteger(range.startLine)
    && Number.isInteger(range.endLine) && line >= range.startLine && line <= range.endLine);
  return { covered: covered.length, total: support.size, percent: support.size ? round(100 * covered.length / support.size, 1) : null };
};
const safeRead = (relativePath) => {
  const absolutePath = path.join(runRoot, relativePath);
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
};
const listFilesRecursively = (directory, prefix) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const relativePath = path.posix.join(prefix, entry.name);
  const absolutePath = path.join(runRoot, relativePath);
  if (entry.isDirectory()) return listFilesRecursively(absolutePath, relativePath);
  return entry.isFile() ? [relativePath] : [];
});
const confidenceBucket = (rows) => {
  const values = rows.map((row) => row.jev?.providerConfidence).filter(Number.isFinite);
  return {
    n: values.length,
    min: values.length ? round(Math.min(...values), 3) : null,
    max: values.length ? round(Math.max(...values), 3) : null,
    mean: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 3) : null
  };
};

const manifest = readJson('manifest.json');
const caseDocument = readJson('inputs/cases.json');
const labelDocument = readJson('inputs/labels.json');
const cases = caseDocument.cases;
const labels = new Map(labelDocument.cases.map((label) => [label.caseId, label]));
if (!Array.isArray(cases) || cases.length !== 16 || labels.size !== cases.length) {
  throw new Error('Frozen cohort case/label cardinality mismatch.');
}
if (labelDocument.exposedToProvider !== false || manifest.limits?.providerLabelsExposed !== false) {
  throw new Error('Frozen labels do not assert provider isolation.');
}

const sourceIntegrity = manifest.sources.map((source) => {
  const bytes = fs.readFileSync(path.join(runRoot, source.snapshot));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  return {
    sourceId: source.sourceId,
    sourceRef: source.sourceRef,
    expectedSha256: source.snapshotSha256,
    actualSha256: sha256,
    bytes: bytes.length,
    passed: sha256 === source.snapshotSha256 && bytes.length === source.bytes
  };
});
if (sourceIntegrity.some((source) => !source.passed)) {
  throw new Error('Frozen source snapshot hash/size mismatch.');
}

fs.mkdirSync(derivedRoot, { recursive: true });
const frozenEvidencePaths = ['inputs', 'sources', 'raw'].flatMap((directory) =>
  listFilesRecursively(path.join(runRoot, directory), directory)).sort();
const frozenEvidenceFiles = frozenEvidencePaths.map((relativePath) => {
  const bytes = fs.readFileSync(path.join(runRoot, relativePath));
  return {
    path: relativePath,
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')
  };
});
const frozenEvidenceDigest = crypto.createHash('sha256')
  .update(JSON.stringify(frozenEvidenceFiles), 'utf8').digest('hex');
const frozenEvidenceIndexPath = path.join(derivedRoot, 'frozen-evidence-sha256.json');
if (fs.existsSync(frozenEvidenceIndexPath)) {
  const priorIndex = JSON.parse(fs.readFileSync(frozenEvidenceIndexPath, 'utf8'));
  if (JSON.stringify(priorIndex.files) !== JSON.stringify(frozenEvidenceFiles)) {
    throw new Error('A frozen input/source/raw receipt changed after the post-call checksum checkpoint.');
  }
} else {
  writeJson(frozenEvidenceIndexPath, {
    schema: 'mssr-jev-frozen-evidence-sha256-v1',
    createdAt: new Date().toISOString(),
    checkpoint: 'post-call integrity lock; not a pre-call or provider-isolation attestation',
    files: frozenEvidenceFiles,
    inventorySha256: frozenEvidenceDigest
  });
}

const rows = cases.map((testCase) => {
  const label = labels.get(testCase.id);
  if (!label || label.sourceId !== testCase.sourceId) throw new Error('Missing or misbound label for ' + testCase.id);
  const searchDocument = safeRead('raw/' + testCase.id + '.search.json');
  if (!searchDocument || searchDocument.caseId !== testCase.id) throw new Error('Missing/misbound search receipt for ' + testCase.id);
  const searchResult = resultOf(searchDocument);
  const candidates = Array.isArray(searchResult?.results) ? searchResult.results : [];
  const acceptableRanks = candidates.flatMap((candidate, index) => (label.acceptableRanges ?? [])
    .filter((acceptedRange) => meetsAcceptedRange(candidate, acceptedRange))
    .map(() => index + 1));
  const exactTargetRank = acceptableRanks.length ? Math.min(...acceptableRanks) : null;
  const supportCandidateRanks = candidates.flatMap((candidate, index) => {
    const requiredLines = uniqueLineSet(label.supportingSpans);
    const range = rangeOf(candidate);
    const allSupportLinesCovered = requiredLines.size > 0 && [...requiredLines].every((line) =>
      Number.isInteger(range.startLine) && Number.isInteger(range.endLine)
      && line >= range.startLine && line <= range.endLine);
    return allSupportLinesCovered ? [index + 1] : [];
  });
  const searchTarget = {
    rank: exactTargetRank,
    at1: exactTargetRank != null && exactTargetRank <= 1,
    at5: exactTargetRank != null && exactTargetRank <= 5,
    at10: exactTargetRank != null && exactTargetRank <= 10,
    fullSupportSpanRank: supportCandidateRanks.length ? Math.min(...supportCandidateRanks) : null
  };

  const jevDocument = safeRead('raw/' + testCase.id + '.jev.json');
  const jevResult = resultOf(jevDocument);
  const selected = jevResult?.selected ?? null;
  const selectedHandle = selected?.handle ?? null;
  const jevCandidateIds = Array.isArray(jevDocument?.candidateHandleIds) ? jevDocument.candidateHandleIds : [];
  const selectedUnderExpectedSection = selected
    ? (label.acceptableRanges ?? []).some((acceptedRange) => hasExpectedHeading(selected, acceptedRange.expectedHeading))
    : false;
  const selectedWithinFullAcceptedRange = selected
    ? (label.acceptableRanges ?? []).some((acceptedRange) => meetsAcceptedRange(selected, acceptedRange))
    : false;
  const supportCoverage = selectedHandle ? countCoveredSupportLines(selectedHandle, label.supportingSpans) : null;
  const searchCandidateIds = candidates.map((candidate) => rangeOf(candidate).id).filter(Boolean);
  const selectedInCandidatePool = Boolean(selectedHandle?.id && searchCandidateIds.includes(selectedHandle.id));
  const providerPoolMatchesFrozenSearch = jevResult ? (jevCandidateIds.length === searchCandidateIds.length
    && searchCandidateIds.every((handleId) => jevCandidateIds.includes(handleId))) : null;
  const selectedRange = selectedHandle ? {
    id: selectedHandle.id,
    rangeId: selectedHandle.rangeId,
    rangeKind: selectedHandle.rangeKind,
    startLine: selectedHandle.startLine,
    endLine: selectedHandle.endLine,
    title: selected?.title ?? null,
    headingPath: headingPathOf(selected)
  } : null;

  const fetchDocument = safeRead('raw/' + testCase.id + '.fetch.json');
  const fetchResult = resultOf(fetchDocument);
  const fetchHandle = fetchResult?.handle ?? null;
  const fetchOk = selectedHandle ? Boolean(fetchResult?.text
    && fetchHandle?.id === selectedHandle.id
    && fetchHandle?.fingerprint === selectedHandle.fingerprint
    && fetchHandle?.revision === selectedHandle.revision
    && fetchHandle?.sourceRef === selectedHandle.sourceRef
    && fetchResult.fingerprint === selectedHandle.fingerprint) : null;

  const packDocument = safeRead('raw/' + testCase.id + '.pack.json');
  const packResult = resultOf(packDocument);
  const paragraphs = Array.isArray(packResult?.paragraphs) ? packResult.paragraphs : [];
  const citation = paragraphs[0]?.citation ?? null;
  const packOk = selectedHandle ? Boolean(fetchOk && paragraphs.length === 1
    && paragraphs[0]?.exactText === fetchResult?.text
    && citation?.handleId === selectedHandle?.id
    && citation?.fingerprint === selectedHandle?.fingerprint
    && citation?.revision === selectedHandle?.revision
    && citation?.sourceRef === selectedHandle?.sourceRef) : null;

  const decision = selected ? 'selected' : jevResult?.status === 'abstained' ? 'abstained'
    : jevResult ? textOf(jevResult.status || 'other') : candidates.length ? 'not-called' : 'no-candidates';
  if (jevResult && jevDocument.caseId !== testCase.id) throw new Error('Misbound Jev receipt for ' + testCase.id);
  if (jevResult && !providerPoolMatchesFrozenSearch) throw new Error('Jev candidate pool differs from the frozen search results: ' + testCase.id);
  if (selected && !selectedInCandidatePool) throw new Error('Jev selected a handle outside the frozen pool: ' + testCase.id);
  if (selected && (!fetchDocument || !packDocument)) throw new Error('Selected case is missing fetch/pack receipt: ' + testCase.id);

  return {
    caseId: testCase.id,
    sourceId: testCase.sourceId,
    family: testCase.family,
    facet: testCase.facet,
    language: testCase.language,
    answerability: label.answerability,
    expectedDisposition: label.expectedDisposition,
    search: {
      candidateCount: candidates.length,
      truncated: searchResult?.truncated ?? null,
      exactAcceptedRangeRank: searchTarget.rank,
      fullSupportSpanRank: searchTarget.fullSupportSpanRank,
      targetAt1: searchTarget.at1,
      targetAt5: searchTarget.at5,
      targetAt10: searchTarget.at10
    },
    jev: jevResult ? {
      status: jevResult.status ?? null,
      decision,
      selectedRange,
      provider: jevResult.provider ?? null,
      model: jevResult.model ?? null,
      providerConfidence: Number.isFinite(jevResult.providerConfidence) ? jevResult.providerConfidence : null,
      confidenceCalibration: jevResult.confidenceCalibration ?? null,
      evidenceSufficiencyCalibration: jevResult.evidenceSufficiencyCalibration ?? null,
      candidateCount: jevResult.candidateCount ?? jevDocument.candidateHandleCount ?? null,
      candidatePoolMatchesFrozenSearch: providerPoolMatchesFrozenSearch,
      providerCalls: jevResult.providerCalls ?? null,
      elapsedMs: jevResult.elapsedMs ?? null,
      inputTokens: jevResult.usage?.input_tokens ?? null,
      outputTokens: jevResult.usage?.output_tokens ?? null,
      selectedInCandidatePool,
      selectedUnderExpectedSection,
      selectedWithinFullAcceptedRange,
      supportingLinesCovered: supportCoverage?.covered ?? null,
      supportingLinesTotal: supportCoverage?.total ?? null,
      supportingCoveragePercent: supportCoverage?.percent ?? null,
      exactFetchPassed: fetchOk,
      evidencePackPassed: packOk,
      fetchedChars: fetchResult?.text?.length ?? null,
      packedChars: packResult?.totalFetchedChars ?? null,
      citations: paragraphs.length
    } : {
      status: null,
      decision,
      selectedRange: null,
      provider: null,
      model: null,
      providerConfidence: null,
      candidateCount: 0,
      candidatePoolMatchesFrozenSearch: null,
      providerCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      selectedInCandidatePool: false,
      selectedUnderExpectedSection: false,
      selectedWithinFullAcceptedRange: false,
      supportingLinesCovered: null,
      supportingLinesTotal: null,
      supportingCoveragePercent: null,
      exactFetchPassed: null,
      evidencePackPassed: null
    }
  };
});

const positives = rows.filter((row) => row.answerability === 'answerable');
const negatives = rows.filter((row) => row.answerability !== 'answerable');
const called = rows.filter((row) => row.jev.status != null);
const selected = called.filter((row) => row.jev.decision === 'selected');
const positiveTargetHits = positives.filter((row) => row.search.exactAcceptedRangeRank != null);
const positiveSelected = positives.filter((row) => row.jev.decision === 'selected');
const positiveAbstained = positives.filter((row) => row.jev.decision === 'abstained');
const positiveJevCalled = positives.filter((row) => row.jev.status != null);
const positiveNoCandidates = positives.filter((row) => row.jev.decision === 'no-candidates');
const negativeCalled = negatives.filter((row) => row.jev.status != null);
const negativeAbstained = negatives.filter((row) => row.jev.decision === 'abstained');
const fullSupportSelections = selected.filter((row) => row.jev.supportingCoveragePercent === 100);
const targetSubtreeSelections = selected.filter((row) => row.jev.selectedUnderExpectedSection);
const exactAcceptedSelections = selected.filter((row) => row.jev.selectedWithinFullAcceptedRange);

const facets = new Map();
for (const row of rows) {
  const key = row.sourceId + '|' + row.facet;
  const group = facets.get(key) ?? [];
  group.push(row);
  facets.set(key, group);
}
const bilingualPairs = [...facets.values()].filter((group) => group.length === 2
  && new Set(group.map((row) => row.language)).size === 2);
const pairedAgreement = bilingualPairs.map((group) => ({
  sourceId: group[0].sourceId,
  facet: group[0].facet,
  cases: group.map((row) => ({
    caseId: row.caseId,
    language: row.language,
    targetInSearchPool: row.search.exactAcceptedRangeRank != null,
    decision: row.jev.decision,
    selectedRangeId: row.jev.selectedRange?.rangeId ?? null
  })),
  sameDecisionDisposition: group[0].jev.decision === group[1].jev.decision,
  bothHaveTargetInPool: group.every((row) => row.search.exactAcceptedRangeRank != null)
}));

const tokenInputValues = called.map((row) => row.jev.inputTokens).filter(Number.isFinite);
const tokenOutputValues = called.map((row) => row.jev.outputTokens).filter(Number.isFinite);
const latencies = called.map((row) => row.jev.elapsedMs).filter(Number.isFinite);
const searchPoolSizes = rows.map((row) => row.search.candidateCount);
const perSource = [...new Set(rows.map((row) => row.sourceId))].map((sourceId) => {
  const sourceRows = rows.filter((row) => row.sourceId === sourceId);
  const sourcePositives = sourceRows.filter((row) => row.answerability === 'answerable');
  const sourceNegatives = sourceRows.filter((row) => row.answerability !== 'answerable');
  return {
    sourceId,
    cases: sourceRows.length,
    answerableCases: sourcePositives.length,
    negativeCases: sourceNegatives.length,
    targetCandidateRecall: rate(sourcePositives.filter((row) => row.search.exactAcceptedRangeRank != null).length, sourcePositives.length),
    targetAt1: rate(sourcePositives.filter((row) => row.search.targetAt1).length, sourcePositives.length),
    targetAt5: rate(sourcePositives.filter((row) => row.search.targetAt5).length, sourcePositives.length),
    targetAt10: rate(sourcePositives.filter((row) => row.search.targetAt10).length, sourcePositives.length),
    positiveSelections: rate(sourcePositives.filter((row) => row.jev.decision === 'selected').length, sourcePositives.length),
    negativeAbstentions: rate(sourceNegatives.filter((row) => row.jev.decision === 'abstained').length, sourceNegatives.length)
  };
});

const compactionDocument = readJson('raw/ERS-containment-compaction.json');
const withoutDedupe = compactionDocument.withoutDedupe?.result ?? compactionDocument.withoutDedupe?.envelope?.result ?? compactionDocument.withoutDedupe;
const withDedupe = compactionDocument.withDedupe?.result ?? compactionDocument.withDedupe?.envelope?.result ?? compactionDocument.withDedupe;
const withoutCitations = (withoutDedupe?.paragraphs ?? []).map((paragraph) => paragraph.citation?.handleId).filter(Boolean);
const withCitations = (withDedupe?.paragraphs ?? []).map((paragraph) => paragraph.citation?.handleId).filter(Boolean);
const compactionSavedChars = Number(withoutDedupe?.totalFetchedChars) - Number(withDedupe?.totalFetchedChars);
const compaction = {
  control: compactionDocument.control,
  sourceId: 'electronics-repair-simulator',
  parentRangeId: compactionDocument.parent?.rangeId ?? null,
  childRangeId: compactionDocument.child?.rangeId ?? null,
  withoutDedupeChars: withoutDedupe?.totalFetchedChars ?? null,
  withDedupeChars: withDedupe?.totalFetchedChars ?? null,
  savedChars: Number.isFinite(compactionSavedChars) ? compactionSavedChars : null,
  savedPercent: Number(withoutDedupe?.totalFetchedChars) ? round(100 * compactionSavedChars / Number(withoutDedupe.totalFetchedChars), 1) : null,
  citationsWithoutDedupe: withoutCitations.length,
  citationsWithDedupe: withCitations.length,
  removedContainedChild: withCitations.includes(compactionDocument.parent?.id) && !withCitations.includes(compactionDocument.child?.id),
  interpretation: 'Deterministic removal of one strictly contained exact range; text-volume reduction only, not semantic summarization.'
};

const manualReview = optionalJson('derived/blind-composition-review.json');
const providerPairs = [...new Set(called.map((row) => row.jev.provider + '/' + row.jev.model))];
const providerCalls = called.map((row) => row.jev.providerCalls).filter(Number.isFinite);
const sumProviderCalls = providerCalls.length ? providerCalls.reduce((sum, value) => sum + value, 0) : null;
const summary = {
  schema: 'mssr-jev-cross-project-development-cohort-aggregate-v1',
  runId: manifest.runId,
  generatedAt: new Date().toISOString(),
  classification: 'development diagnostic only; not holdout, production reliability, or confidence calibration',
  dataset: {
    cases: rows.length,
    answerableCases: positives.length,
    negativeCases: negatives.length,
    semanticFacets: facets.size,
    answerableFacets: [...facets.values()].filter((group) => group[0].answerability === 'answerable').length,
    negativeFacets: [...facets.values()].filter((group) => group[0].answerability !== 'answerable').length,
    bilingualPairs: bilingualPairs.length,
    labelsExposedToProvider: labelDocument.exposedToProvider,
    labelsOwnerAdjudication: labelDocument.ownerAdjudication,
    sourceFamilyCount: sourceIntegrity.length,
    frozenEvidenceFiles: frozenEvidenceFiles.length,
    frozenEvidenceBytes: frozenEvidenceFiles.reduce((sum, file) => sum + file.bytes, 0),
    frozenEvidenceIndex: 'derived/frozen-evidence-sha256.json',
    frozenEvidenceInventorySha256: frozenEvidenceDigest,
    sourceSnapshotIntegrity: sourceIntegrity
  },
  runtime: {
    bridgeVersion: manifest.runtime?.bridgeVersionBeforeCalls ?? null,
    mssrVersion: manifest.runtime?.mssrVersionBeforeCalls ?? null,
    providerModels: providerPairs,
    queryMetadataMode: manifest.runtime?.metadataMode ?? null,
    queryVariants: manifest.runtime?.queryVariants ?? null
  },
  receiptIntegrity: {
    searchCases: rows.length,
    providerCalls: called.length,
    providerToolCallCount: sumProviderCalls,
    selectedCases: selected.length,
    frozenCandidatePoolBinding: rate(called.filter((row) => row.jev.candidatePoolMatchesFrozenSearch).length, called.length),
    exactFetchPassed: rate(selected.filter((row) => row.jev.exactFetchPassed).length, selected.length),
    evidencePackPassed: rate(selected.filter((row) => row.jev.evidencePackPassed).length, selected.length),
    selectedHandlesInFrozenCandidatePool: rate(selected.filter((row) => row.jev.selectedInCandidatePool).length, selected.length),
    packCitationCount: selected.reduce((sum, row) => sum + (row.jev.citations ?? 0), 0)
  },
  search: {
    positiveTargetCandidateRecall: rate(positiveTargetHits.length, positives.length),
    targetAt1: rate(positives.filter((row) => row.search.targetAt1).length, positives.length),
    targetAt5: rate(positives.filter((row) => row.search.targetAt5).length, positives.length),
    targetAt10: rate(positives.filter((row) => row.search.targetAt10).length, positives.length),
    meanCandidatePoolSize: round(searchPoolSizes.reduce((sum, value) => sum + value, 0) / searchPoolSizes.length, 2),
    candidatePoolSizeRange: [Math.min(...searchPoolSizes), Math.max(...searchPoolSizes)],
    negativeCasesWithSearchCandidates: rate(negatives.filter((row) => row.search.candidateCount > 0).length, negatives.length),
    targetRanks: positives.filter((row) => row.search.exactAcceptedRangeRank != null).map((row) => ({ caseId: row.caseId, rank: row.search.exactAcceptedRangeRank }))
  },
  decision: {
    positiveSelected: rate(positiveSelected.length, positives.length),
    positiveProviderAbstentions: rate(positiveAbstained.length, positives.length),
    positiveProviderAbstentionsGivenCall: rate(positiveAbstained.length, positiveJevCalled.length),
    positiveSelectionsGivenCall: rate(positiveSelected.length, positiveJevCalled.length),
    positiveJevCalls: positiveJevCalled.length,
    positiveNoCandidatesNoJevCall: rate(positiveNoCandidates.length, positives.length),
    selectedWithinExpectedHeadingSubtree: rate(targetSubtreeSelections.length, selected.length),
    selectedFullAcceptedRange: rate(exactAcceptedSelections.length, selected.length),
    selectedFullSupportingSpanCoverage: rate(fullSupportSelections.length, selected.length),
    selectedSupportCoverageMeanPercent: selected.length ? round(selected.reduce((sum, row) => sum + (row.jev.supportingCoveragePercent ?? 0), 0) / selected.length, 1) : null,
    negativeJevAbstention: rate(negativeAbstained.length, negativeCalled.length),
    rawProviderConfidenceDescriptiveOnly: {
      selectedPositive: confidenceBucket(positiveSelected),
      abstainedPositive: confidenceBucket(positiveAbstained),
      negativeAbstention: confidenceBucket(negativeAbstained)
    },
    providerTokens: {
      input: tokenInputValues.reduce((sum, value) => sum + value, 0),
      output: tokenOutputValues.reduce((sum, value) => sum + value, 0),
      jevToolCallsWithUsage: Math.min(tokenInputValues.length, tokenOutputValues.length),
      elapsedMsMedian: median(latencies),
      elapsedMsRange: latencies.length ? [Math.min(...latencies), Math.max(...latencies)] : null
    },
    bilingualPairDispositionAgreement: rate(pairedAgreement.filter((pair) => pair.sameDecisionDisposition).length, pairedAgreement.length),
    bilingualPairs: pairedAgreement
  },
  compaction,
  compositionReview: manualReview,
  perSource,
  cases: rows
};

fs.mkdirSync(derivedRoot, { recursive: true });
writeJson(path.join(derivedRoot, 'aggregate.json'), summary);

const pct = (entry) => entry.percent == null ? 'n/a' : entry.count + '/' + entry.total + ' (' + entry.percent + '%)';
const dispositionLabel = (value) => ({ selected: 'seleccionó', abstained: 'se abstuvo', 'no-candidates': 'sin candidatos', 'not-called': 'sin llamada' })[value] ?? value;
const caseRows = rows.map((row) => {
  const selectedRange = row.jev.selectedRange;
  const rangeText = selectedRange ? selectedRange.rangeId + ' L' + selectedRange.startLine + '-' + selectedRange.endLine : '—';
  const coverageText = row.jev.supportingCoveragePercent == null
    ? '—'
    : row.jev.supportingLinesCovered + '/' + row.jev.supportingLinesTotal + ' (' + row.jev.supportingCoveragePercent + '%)';
  const rankText = row.search.exactAcceptedRangeRank == null ? 'ausente' : String(row.search.exactAcceptedRangeRank);
  const disposition = dispositionLabel(row.jev.decision) + (row.jev.providerConfidence == null ? '' : ' / raw ' + row.jev.providerConfidence);
  return '| ' + row.caseId + ' | ' + row.search.candidateCount + ' | ' + rankText + ' | ' + disposition + ' | ' + rangeText + ' | ' + coverageText + ' | ' + (row.jev.exactFetchPassed === true ? 'pass' : row.jev.exactFetchPassed === false ? 'fail' : '—') + ' | ' + (row.jev.evidencePackPassed === true ? 'pass' : row.jev.evidencePackPassed === false ? 'fail' : '—') + ' |';
}).join('\n');

const sourceRows = perSource.map((source) => '| ' + source.sourceId + ' | ' + pct(source.targetCandidateRecall) + ' | ' + pct(source.targetAt5) + ' | ' + pct(source.positiveSelections) + ' | ' + pct(source.negativeAbstentions) + ' |').join('\n');
const pairRows = pairedAgreement.map((pair) => {
  const left = pair.cases[0];
  const right = pair.cases[1];
  return '| ' + pair.sourceId + ' / ' + pair.facet + ' | ' + left.language + ': ' + dispositionLabel(left.decision) + (left.targetInSearchPool ? ' (target en pool)' : ' (target ausente)') + ' | ' + right.language + ': ' + dispositionLabel(right.decision) + (right.targetInSearchPool ? ' (target en pool)' : ' (target ausente)') + ' | ' + (pair.sameDecisionDisposition ? 'sí' : 'no') + ' |';
}).join('\n');

const reviewerRows = (manualReview?.cases ?? []).map((item) => '| ' + item.family + ' | ' + item.coverage + ' | ' + item.literalSupport + ' | ' + item.overbreadth + ' | ' + item.unsupportedClaims + ' |').join('\n');
const report = [
  '# MSSR Librarian + Jev — cross-project development cohort',
  '',
  'Run: ' + manifest.runId,
  '',
  '## Alcance y límites',
  '',
  'Corrida diagnóstica de desarrollo sobre ' + facets.size + ' facetas semánticas en ' + sourceIntegrity.length + ' familias de documentos: ' + positives.length + ' consultas positivas, ' + negatives.length + ' negativos cercanos y ' + bilingualPairs.length + ' pares bilingües. Los pares inglés/español cuentan como condiciones emparejadas, no como observaciones independientes. Las etiquetas estuvieron ocultas al proveedor según el protocolo del paquete, fueron derivadas de los snapshots y revisadas por un analista independiente; no hay adjudicación de los dueños. La exposición externa de estas fuentes no puede descartarse.',
  '',
  'Esto no es un holdout certificado ni una medición de confiabilidad de producción. Las Choice/Noul y providerConfidence son salidas descriptivas sin calibración. No se estiman Brier, ECE ni un umbral de confianza.',
  '',
  'La búsqueda usó metadata off y ninguna variante de consulta. Elemental Frontier pasó por MSSR portable porque el núcleo de identidad de proyecto del adaptador Bridge estaba en estado review por superar presupuesto; sus resultados sí ejercitaron búsqueda, Jev, fetch y pack, pero no el adaptador de fuente Bridge para ese repo.',
  '',
  '## Resultados por etapa',
  '',
  '| Etapa | Resultado |',
  '|---|---:|',
  '| Búsqueda: target aceptable en el pool | ' + pct(summary.search.positiveTargetCandidateRecall) + ' positivas |',
  '| Búsqueda: target en top 1 | ' + pct(summary.search.targetAt1) + ' positivas |',
  '| Búsqueda: target en top 5 | ' + pct(summary.search.targetAt5) + ' positivas |',
  '| Búsqueda: target en top 10 | ' + pct(summary.search.targetAt10) + ' positivas |',
  '| Jev: llamadas con el pool idéntico a la búsqueda congelada | ' + pct(summary.receiptIntegrity.frozenCandidatePoolBinding) + ' llamadas |',
  '| Jev: positivo seleccionado | ' + pct(summary.decision.positiveSelected) + ' casos positivos |',
  '| Jev: positivo seleccionado entre llamadas | ' + pct(summary.decision.positiveSelectionsGivenCall) + ' positivos llamados |',
  '| Jev: positivo abstuvo | ' + pct(summary.decision.positiveProviderAbstentionsGivenCall) + ' positivos llamados |',
  '| Positivo: sin candidatos, Jev no llamado | ' + pct(summary.decision.positiveNoCandidatesNoJevCall) + ' casos positivos |',
  '| Negativo: Jev abstuvo | ' + pct(summary.decision.negativeJevAbstention) + ' negativos enviados a Jev |',
  '| Selección dentro de sección esperada | ' + pct(summary.decision.selectedWithinExpectedHeadingSubtree) + ' selecciones |',
  '| Selección cubre todas las líneas etiquetadas como soporte | ' + pct(summary.decision.selectedFullSupportingSpanCoverage) + ' selecciones |',
  '| Fetch exacto y fingerprint | ' + pct(summary.receiptIntegrity.exactFetchPassed) + ' seleccionados |',
  '| Evidence pack conserva texto/cita exactos | ' + pct(summary.receiptIntegrity.evidencePackPassed) + ' seleccionados |',
  '',
  'La búsqueda recuperó el rango aceptable en ' + summary.search.positiveTargetCandidateRecall.count + '/' + positives.length + ' consultas positivas. Las tres omisiones fueron ' + positives.filter((row) => row.search.exactAcceptedRangeRank == null).map((row) => row.caseId).join(', ') + '. Una omisión (KODE-01-ES) sí tenía candidatos, pero no el rango objetivo; EF-01-EN y ERS-01-ES no devolvieron candidatos. Las consultas negativas sí recibieron pools de búsqueda; la abstención ocurrió en Jev, no en la recuperación.',
  '',
  'Jev seleccionó ' + selected.length + ' rangos; ' + exactAcceptedSelections.length + ' cubrieron el rango aceptable completo y ' + targetSubtreeSelections.length + ' quedaron dentro de su sección esperada. La cobertura línea por línea del soporte etiquetado fue completa en ' + fullSupportSelections.length + '/' + selected.length + ' selecciones. Ese solapamiento es una señal diagnóstica, no una medida completa de suficiencia semántica: el alcance de algunas etiquetas es más amplio que el texto mínimo que permite contestar.',
  '',
  'Todas las selecciones que se enviaron a adquisición pasaron fetch exacto y evidence pack (' + summary.receiptIntegrity.exactFetchPassed.count + '/' + selected.length + ' cada uno). Esto demuestra integridad/procedencia del material seleccionado, no que todas las respuestas sean completas.',
  '',
  '## Casos',
  '',
  '| Caso | Pool | Rango aceptable: posición | Jev | Rango seleccionado | Solapamiento con soporte | Fetch | Pack |',
  '|---|---:|---:|---|---|---:|---|---|',
  caseRows,
  '',
  'El rango aceptable del buscador exige la ruta de encabezado esperada y cobertura de todo el intervalo congelado. La cobertura de soporte es intersección de líneas inclusiva; no la interpretes como juicio semántico independiente.',
  '',
  '## Resultados por fuente',
  '',
  '| Fuente | Recall de target | Top 5 | Positivos seleccionados | Negativos abstienen |',
  '|---|---:|---:|---:|---:|',
  sourceRows,
  '',
  '## Pares bilingües',
  '',
  '| Familia / faceta | Inglés | Español | Misma disposición |',
  '|---|---|---|---|',
  pairRows,
  '',
  'Coincidieron en disposición ' + pct(summary.decision.bilingualPairDispositionAgreement) + ' pares. Este patrón identifica un área de recuperación multilingüe que conviene medir con una variante de consulta/metadata pre-registrada, pero cuatro pares no justifican una tasa general.',
  '',
  '## Negativos, tokens y confianza',
  '',
  'Los ' + negativeAbstained.length + ' negativos se abstuvieron (' + pct(summary.decision.negativeJevAbstention) + '); no hubo selección de un negativo en esta cohorte. Los ' + called.length + ' recibos Jev suman ' + summary.decision.providerTokens.input + ' tokens de entrada y ' + summary.decision.providerTokens.output + ' de salida. El proveedor/modelo reportado fue ' + providerPairs.join(', ') + '.',
  '',
  'Los valores raw de confidence se conservan caso por caso en aggregate.json, pero no son probabilidades calibradas. El promedio descriptivo fue ' + summary.decision.rawProviderConfidenceDescriptiveOnly.selectedPositive.mean + ' en selecciones positivas, ' + summary.decision.rawProviderConfidenceDescriptiveOnly.abstainedPositive.mean + ' en abstenciones positivas y ' + summary.decision.rawProviderConfidenceDescriptiveOnly.negativeAbstention.mean + ' en negativos abstinentes. Los negativos abstuvieron aun con providerConfidence entre ' + summary.decision.rawProviderConfidenceDescriptiveOnly.negativeAbstention.min + ' y ' + summary.decision.rawProviderConfidenceDescriptiveOnly.negativeAbstention.max + '; este campo no es una probabilidad calibrada de respuesta correcta. La muestra y las etiquetas de analista no permiten elegir un score de paso. La política futura debería exigir evidencia recuperada, cobertura suficiente de cada faceta de la consulta y revisión de contradicciones; agregar evidencia no debe elevar confianza por sí solo.',
  '',
  '## Compacción y composición',
  '',
  'En el control determinista de contención, el pack pasó de ' + compaction.withoutDedupeChars + ' a ' + compaction.withDedupeChars + ' caracteres: se quitaron ' + compaction.savedChars + ' (' + compaction.savedPercent + '%) y las citas pasaron de ' + compaction.citationsWithoutDedupe + ' a ' + compaction.citationsWithDedupe + '. Solo se quitó el hijo estrictamente contenido por el padre. Es ahorro de texto sin pérdida de bytes cubiertos, no resumen semántico ni síntesis de varios hechos.',
  '',
  manualReview ? 'Una revisión ciega independiente de los cuatro párrafos host-compuestos evaluó: ' + manualReview.summary : 'No hay una revisión ciega de composición guardada junto a este run.',
  '',
  manualReview ? '| Familia | Cobertura | Soporte literal | Sobreextensión | Afirmaciones no sustentadas |\n|---|---|---|---|---|\n' + reviewerRows + '\n\nEl texto exacto de esos borradores no estaba persistido en los recibos al cerrar la revisión; se conserva el veredicto, no un replay textual auditable.' : '',
  '',
  '## Hallazgos y siguiente experimento',
  '',
  '1. Atacar primero la recuperación entre idiomas: tres consultas positivas perdieron el rango esperado y dos ni siquiera produjeron candidatos. Comparar una expansión/traducción explícita con el baseline, conservando pools y negativos, sin mandar etiquetas a Jev.',
  '2. Medir suficiencia de evidencia por faceta. ERS-01 seleccionó solo la Capa 2 dentro de una pregunta sobre el modelo de tres capas; ERS-02 abstuvo aunque el rango esperado estaba en el pool. Probar descomposición en facetas, unión de rangos exactos y un verificador que marque cobertura faltante antes de redactar.',
  '3. Agregar evidencia atom/metadata y contradicciones como un brazo separado. Esta cohorte usó metadata off y no ejercitó el grafo de contradicciones; no puede validar esas capas.',
  '4. Guardar el texto final compuesto, la cobertura por faceta, las citas y la revisión ciega como artefactos derivados antes de cualquier llamada de adjudicación. Esta corrida conserva el veredicto del revisor, pero no el cuerpo exacto de los cuatro borradores.',
  '',
  'El resultado apoya un sistema compuesto de búsqueda, elección, fetch verificado, empaquetado y ensamblado host-side. No demuestra que Jev por sí mismo haga grep, compresión semántica ni prosa abierta: esas capacidades dependen de la orquestación y del componente que las ejecuta.',
  '',
  '## Reproducibilidad',
  '',
  'Ejecutar desde la raíz del repo: node experiments/jev-mssr-live/runs/' + path.basename(runRoot) + '/scripts/aggregate-run.mjs',
  '',
  'El script verifica hashes/tamaños de los cuatro snapshots, la huella de cada input y recibo crudo contra derived/frozen-evidence-sha256.json, los pools Jev exactos y las referencias de fetch/pack antes de producir el agregado y el informe. Ese índice se creó después de las llamadas: fija los bytes para reruns futuros, pero no es una atestación pre-call ni demuestra por sí solo que el proveedor no vio etiquetas.',
  ''
].filter((line) => line !== null && line !== undefined).join('\n');
fs.writeFileSync(path.join(runRoot, 'RUN-REPORT.md'), report, 'utf8');

console.log(JSON.stringify({
  runId: summary.runId,
  cases: summary.dataset.cases,
  answerable: positives.length,
  negatives: negatives.length,
  semanticFacets: facets.size,
  bilingualPairs: bilingualPairs.length,
  providerCalls: called.length,
  selected: selected.length,
  frozenEvidenceFiles: frozenEvidenceFiles.length,
  positiveTargetRecall: summary.search.positiveTargetCandidateRecall,
  targetAt5: summary.search.targetAt5,
  negativeAbstention: summary.decision.negativeJevAbstention,
  fullSupportSelections: summary.decision.selectedFullSupportingSpanCoverage,
  exactFetch: summary.receiptIntegrity.exactFetchPassed,
  evidencePack: summary.receiptIntegrity.evidencePackPassed,
  compactionSavedChars: compaction.savedChars,
  report: path.join(runRoot, 'RUN-REPORT.md'),
  aggregate: path.join(derivedRoot, 'aggregate.json')
}, null, 2));
