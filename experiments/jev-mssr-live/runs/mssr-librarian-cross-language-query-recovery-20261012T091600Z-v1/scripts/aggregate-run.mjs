import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const derivedRoot = path.join(runRoot, 'derived');
const baselineRunId = 'mssr-librarian-cross-project-development-cohort-20261012T083000Z-v1';
const baselineRoot = path.resolve(runRoot, '..', baselineRunId);
const readJsonAt = (root, relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (filePath, value) => fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const rate = (count, total) => ({ count, total, percent: total ? round(100 * count / total, 1) : null });
const normalizeHeading = (value) => String(value ?? '').replace(/^#+\s*/, '').normalize('NFKC').trim().toLocaleLowerCase('en');
const normalizeQuery = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

function findDeep(value, predicate, seen = new Set()) {
  value = parseMaybeJson(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (predicate(value)) return value;
  const preferred = ['search', 'result', 'envelope', 'response', 'content', 'data'];
  for (const key of preferred) {
    if (key in value) {
      const found = findDeep(value[key], predicate, seen);
      if (found) return found;
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (preferred.includes(key)) continue;
    const found = findDeep(child, predicate, seen);
    if (found) return found;
  }
  return null;
}

function responsePayload(receipt) {
  const text = receipt?.response?.content?.find((item) => item.type === 'text')?.text;
  return parseMaybeJson(text) ?? receipt?.envelope?.result ?? receipt?.search ?? receipt;
}

function searchResult(receipt) {
  const payload = responsePayload(receipt);
  const direct = receipt?.search?.results ? receipt.search : receipt?.envelope?.result;
  const found = direct?.results ? direct : findDeep(payload, (value) => Array.isArray(value.results));
  if (!found) throw new Error(`No search result object in ${receipt?.id ?? receipt?.caseId ?? 'receipt'}`);
  return found;
}

function jevResult(receipt) {
  const result = findDeep(responsePayload(receipt), (value) => typeof value.status === 'string'
    && Object.hasOwn(value, 'selected') && Object.hasOwn(value, 'providerConfidence'));
  if (!result) throw new Error('No Jev result object in receipt.');
  return result;
}

const handleOf = (candidate) => candidate?.handle ?? candidate?.range ?? candidate ?? {};
const candidateId = (candidate) => handleOf(candidate).id ?? null;
const headingPathOf = (candidate) => candidate?.headingPath ?? candidate?.metadata?.headingPath
  ?? handleOf(candidate).headingPath ?? [];
const rangeMatches = (candidate, accepted) => {
  const handle = handleOf(candidate);
  const headings = headingPathOf(candidate).map(normalizeHeading);
  return headings.includes(normalizeHeading(accepted.expectedHeading))
    && Number.isInteger(handle.startLine) && Number.isInteger(handle.endLine)
    && handle.startLine <= accepted.startLine && handle.endLine >= accepted.endLine;
};
const targetRank = (results, label) => {
  const ranks = results.flatMap((candidate, index) => (label.acceptableRanges ?? [])
    .filter((accepted) => rangeMatches(candidate, accepted)).map(() => index + 1));
  return ranks.length ? Math.min(...ranks) : null;
};
const sourceRevisions = (result) => [...new Set((result?.results ?? []).map((candidate) => {
  const handle = handleOf(candidate);
  return handle.revision ?? candidate?.metadata?.revision ?? null;
}).filter(Boolean))];
const resultSourceRefs = (result) => [...new Set((result?.results ?? []).map((candidate) => {
  const handle = handleOf(candidate);
  return handle.sourceRef ?? candidate?.metadata?.sourceRef ?? null;
}).filter(Boolean))];
const receiptSourceRefs = (receipt, result) => [...new Set([
  ...(receipt?.request?.sourceRefs ?? []),
  ...(receipt?.request?.documents ?? []).map((item) => item?.sourceRef),
  ...resultSourceRefs(result),
  receipt?.sourceIntegrity?.sourceRef
].filter(Boolean))];
const embeddedSourceHashes = (receipt) => {
  const documents = receipt?.request?.documents ?? receipt?.request?.document ?? [];
  const list = Array.isArray(documents) ? documents : [documents];
  return list.filter((document) => typeof document?.markdown === 'string')
    .map((document) => ({
      owner: document.owner ?? null,
      sourceRef: document.sourceRef ?? null,
      sha256: sha256(Buffer.from(document.markdown, 'utf8'))
    }));
};
const queryText = (receipt) => {
  const query = receipt?.request?.query ?? receipt?.query ?? null;
  return typeof query === 'string' ? query : query?.query ?? null;
};
const idsOf = (result) => (result?.results ?? []).map(candidateId).filter(Boolean);
const stableDiff = (primaryIds, variantIds) => ({
  primaryCount: primaryIds.length,
  variantCount: variantIds.length,
  addedIds: variantIds.filter((id) => !primaryIds.includes(id)),
  removedIds: primaryIds.filter((id) => !variantIds.includes(id)),
  sameOrder: primaryIds.length === variantIds.length && primaryIds.every((id, i) => id === variantIds[i])
});
const safePath = (value) => value.split(path.sep).join('/');
const fileHash = (absolutePath, logicalPath) => {
  const bytes = fs.readFileSync(absolutePath);
  return { path: logicalPath, bytes: bytes.length, sha256: sha256(bytes) };
};
const labelOnlyKeys = /^(labels?|answerability|expectedDisposition|acceptableRanges|supportingSpans|rationale)$/i;
function containsLabelField(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => labelOnlyKeys.test(key) || containsLabelField(child, seen));
}

const manifest = readJsonAt(runRoot, 'manifest.json');
const inputDocument = readJsonAt(runRoot, 'inputs/queries.json');
const amendmentDocument = readJsonAt(runRoot, 'inputs/amendments.json');
const baselineManifest = readJsonAt(baselineRoot, 'manifest.json');
const labelsDocument = readJsonAt(baselineRoot, 'inputs/labels.json');
const cases = inputDocument.cases;
if (manifest.runId !== inputDocument.runId || manifest.runId !== amendmentDocument.runId) throw new Error('Run id mismatch across frozen inputs.');
if (manifest.baselineRunId !== baselineRunId || inputDocument.baselineRunId !== baselineRunId) throw new Error('Unexpected baseline run id.');
if (!Array.isArray(cases) || cases.length !== 6 || new Set(cases.map((item) => item.id)).size !== cases.length) throw new Error('Expected six unique frozen cases.');
if (labelsDocument.exposedToProvider !== false || manifest.limits?.providerLabelsExposed !== false) throw new Error('Provider label-isolation assertion missing.');
if (manifest.runtime?.metadataMode !== 'off' || cases.some((item) => item.metadataMode !== 'off')) throw new Error('Run46 must keep metadata mode off.');
if (!amendmentDocument.amendments?.some((item) => item.id === 'ef-same-source-primary-control' && item.frozenPlanChanged === false)) throw new Error('The EF same-source control amendment is missing.');

const labels = new Map(labelsDocument.cases.map((label) => [label.caseId, label]));
const sources = new Map(manifest.sources.map((source) => [source.id, source]));
const baselineSources = new Map(baselineManifest.sources.map((source) => [source.sourceId, source]));
const sourceIntegrity = [];
for (const source of manifest.sources) {
  const baselineSource = baselineSources.get(source.id);
  if (!baselineSource || baselineSource.sourceRef !== source.sourceRef) throw new Error(`Baseline source is missing or misbound: ${source.id}`);
  const snapshotPath = path.join(baselineRoot, baselineSource.snapshot);
  const snapshotBytes = fs.readFileSync(snapshotPath);
  const snapshotHash = sha256(snapshotBytes);
  const expected = source.sha256;
  if (snapshotHash !== expected || snapshotHash !== baselineSource.snapshotSha256) throw new Error(`Frozen source snapshot mismatch: ${source.id}`);
  sourceIntegrity.push({ sourceId: source.id, sourceRef: source.sourceRef, bytes: snapshotBytes.length, expectedSha256: expected, actualSha256: snapshotHash, passed: true });
}

const rows = cases.map((testCase) => {
  const source = sources.get(testCase.projectRoot.split('/').pop() === 'kode' ? 'kode'
    : testCase.projectRoot.split('/').pop() === 'elemental-frontier' ? 'elemental-frontier' : 'electronics-repair-simulator');
  const label = labels.get(testCase.id);
  if (!source || !label || label.sourceId !== source.id) throw new Error(`Missing or misbound source label for ${testCase.id}`);
  if (label.answerability === 'answerable' && !label.acceptableRanges?.length) throw new Error(`Positive case lacks acceptable ranges: ${testCase.id}`);
  if (label.answerability !== 'answerable' && label.acceptableRanges?.length) throw new Error(`Negative case has positive target ranges: ${testCase.id}`);
  if (label.acceptableRanges?.some((item) => item.sourceRef !== source.sourceRef)) throw new Error(`Label sourceRef mismatch for ${testCase.id}`);

  const variantReceipt = readJsonAt(runRoot, `raw/${testCase.id}.search.json`);
  const variantSearch = searchResult(variantReceipt);
  const variantIds = idsOf(variantSearch);
  const variantRevisions = sourceRevisions(variantSearch);
  const variantSourceRefs = receiptSourceRefs(variantReceipt, variantSearch);
  const embeddedVariantHashes = embeddedSourceHashes(variantReceipt);
  const variantQuery = queryText(variantReceipt);
  if (normalizeQuery(variantQuery) !== normalizeQuery(testCase.primary)) throw new Error(`Primary query mismatch in variant receipt: ${testCase.id}`);
  if (variantRevisions.some((revision) => revision !== source.sha256)) throw new Error(`Variant search source revision mismatch: ${testCase.id}`);
  if (!variantSourceRefs.length || variantSourceRefs.some((sourceRef) => sourceRef !== source.sourceRef)) throw new Error(`Variant sourceRef mismatch: ${testCase.id}`);
  if (embeddedVariantHashes.some((item) => item.sha256 !== source.sha256 || item.sourceRef !== source.sourceRef)) throw new Error(`Embedded variant source mismatch: ${testCase.id}`);

  const sameRunPrimaryPath = `raw/${testCase.id}.primary-only-control.search.json`;
  const hasSameRunPrimary = fs.existsSync(path.join(runRoot, sameRunPrimaryPath));
  const primaryPath = hasSameRunPrimary ? sameRunPrimaryPath : testCase.baselineReceipt;
  if (typeof primaryPath !== 'string') throw new Error(`Missing primary-only control reference: ${testCase.id}`);
  const primaryReceipt = readJsonAt(runRoot, primaryPath);
  const primarySearch = searchResult(primaryReceipt);
  const primaryIds = idsOf(primarySearch);
  const primaryRevisions = sourceRevisions(primarySearch);
  const primarySourceRefs = receiptSourceRefs(primaryReceipt, primarySearch);
  const primaryEmbeddedHashes = embeddedSourceHashes(primaryReceipt);
  const primaryQuery = queryText(primaryReceipt);
  if (normalizeQuery(primaryQuery) !== normalizeQuery(testCase.primary)) throw new Error(`Primary control query mismatch: ${testCase.id}`);
  const bracketingHashes = primaryReceipt?.sourceIntegrity?.unchangedAcrossCall === true
    ? [primaryReceipt.sourceIntegrity.sha256Before, primaryReceipt.sourceIntegrity.sha256After]
    : [];
  const embeddedHashes = primaryEmbeddedHashes.map((item) => item.sha256);
  const primaryObservedRevisions = primaryRevisions.length ? primaryRevisions : embeddedHashes.length ? embeddedHashes : bracketingHashes;
  const primaryRevisionMatches = primaryObservedRevisions.length > 0
    && primaryObservedRevisions.every((revision) => revision === source.sha256);
  const primaryRefMatches = primarySourceRefs.length > 0 && primarySourceRefs.every((sourceRef) => sourceRef === source.sourceRef);
  const primaryComparable = primaryRevisionMatches && primaryRefMatches;
  const primarySourceEvidence = primaryRevisions.length ? 'candidate-handle-revision'
    : embeddedHashes.length ? 'embedded-source-bytes'
      : bracketingHashes.length ? 'unchanged-local-hash-before-and-after-call' : 'no-revision-evidence';

  const historicalReceipt = readJsonAt(runRoot, testCase.baselineReceipt);
  const historicalSearch = searchResult(historicalReceipt);
  const historicalRevisions = sourceRevisions(historicalSearch);
  const historicalSourceMatches = historicalRevisions.length
    ? historicalRevisions.every((revision) => revision === source.sha256) : null;
  const historicalCandidateCount = (historicalSearch.results ?? []).length;
  const historicalBaseline = {
    path: testCase.baselineReceipt,
    candidateCount: historicalCandidateCount,
    sourceRevisions: historicalRevisions,
    sourceMatchesFrozenRevision: historicalSourceMatches,
    usedForPrimaryComparison: !hasSameRunPrimary && historicalSourceMatches === true,
    excludedReason: historicalSourceMatches === true ? null : historicalSourceMatches === false
      ? 'source revision differs from Run46 frozen source; pair excluded'
      : 'empty result has no handle revision; pair excluded as unverifiable'
  };

  const primaryRank = targetRank(primarySearch.results ?? [], label);
  const variantRank = targetRank(variantSearch.results ?? [], label);
  const variantHasVariantOnly = (variantSearch.results ?? []).filter((candidate) => {
    const matches = candidate?.queryMatches ?? candidate?.metadata?.queryMatches ?? [];
    return matches.length > 0 && matches.every((item) => item.queryIndex !== 0);
  }).length;
  const diff = primaryComparable ? stableDiff(primaryIds, variantIds) : null;

  const jevPath = `raw/${testCase.id}.jev.json`;
  const hasJev = fs.existsSync(path.join(runRoot, jevPath));
  let jev = null;
  if (hasJev) {
    const receipt = readJsonAt(runRoot, jevPath);
    const result = jevResult(receipt);
    if (containsLabelField(receipt.request)) throw new Error(`Label field appears in provider request: ${testCase.id}`);
    const offeredIds = (receipt.request?.candidateHandles ?? receipt.request?.handles ?? []).map(candidateId).filter(Boolean);
    const candidatePoolMatches = offeredIds.length === variantIds.length && offeredIds.every((id, i) => id === variantIds[i]);
    if (!candidatePoolMatches) throw new Error(`Jev pool differs from frozen variant search order: ${testCase.id}`);
    if (result.selected && !variantIds.includes(candidateId(result.selected))) throw new Error(`Jev selected a candidate outside the frozen pool: ${testCase.id}`);
    jev = {
      status: result.status,
      decision: result.selected ? 'selected' : result.status === 'abstained' ? 'abstained' : 'other',
      candidateCount: result.candidateCount ?? offeredIds.length,
      candidatePoolMatchesVariantSearch: true,
      provider: result.provider ?? null,
      model: result.model ?? null,
      providerConfidence: Number.isFinite(result.providerConfidence) ? result.providerConfidence : null,
      evidenceSufficiency: Number.isFinite(result.evidenceSufficiency) ? result.evidenceSufficiency : null,
      confidenceCalibration: result.confidenceCalibration ?? null,
      evidenceSufficiencyCalibration: result.evidenceSufficiencyCalibration ?? null,
      providerCalls: result.providerCalls ?? null,
      elapsedMs: result.elapsedMs ?? null,
      inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
      selectedRangeId: result.selected ? handleOf(result.selected).rangeId ?? null : null,
      selectedTarget: result.selected ? (label.acceptableRanges ?? []).some((accepted) => rangeMatches(result.selected, accepted)) : false
    };
  }

  const hasFetch = fs.existsSync(path.join(runRoot, `raw/${testCase.id}.fetch.json`));
  const hasPack = fs.existsSync(path.join(runRoot, `raw/${testCase.id}.pack.json`));
  if (jev?.decision === 'selected' && (!hasFetch || !hasPack)) throw new Error(`Selected Jev result lacks exact fetch or evidence pack: ${testCase.id}`);

  return {
    caseId: testCase.id,
    sourceId: source.id,
    sourceRef: source.sourceRef,
    answerability: label.answerability,
    expectedDisposition: label.expectedDisposition,
    queryVariantCount: testCase.variants?.length ?? 0,
    primaryControl: {
      origin: hasSameRunPrimary ? 'same-run-primary-only-control' : 'Run45-primary-only-receipt',
      candidateCount: primaryIds.length,
      sourceRevisions: primaryObservedRevisions,
      sourceEvidence: primarySourceEvidence,
      sourceRefs: primarySourceRefs,
      sourceMatchesFrozenRevision: primaryRevisionMatches,
      targetRank: primaryRank,
      comparableToVariant: primaryComparable
    },
    variantSearch: {
      candidateCount: variantIds.length,
      sourceRevisions: variantRevisions,
      targetRank: variantRank,
      targetAt5: variantRank != null && variantRank <= 5,
      targetAt10: variantRank != null && variantRank <= 10,
      variantOnlyCandidateCount: variantHasVariantOnly
    },
    comparison: diff ? {
      status: 'same-source-revision-comparable',
      ...diff,
      primaryTargetRank: primaryRank,
      variantTargetRank: variantRank
    } : {
      status: 'not-comparable',
      reason: 'Primary receipt source revision or sourceRef did not match the Run46 frozen source.'
    },
    historicalRun45Baseline: historicalBaseline,
    jev,
    exactFetchReceiptPresent: hasFetch,
    evidencePackReceiptPresent: hasPack
  };
});

const positives = rows.filter((row) => row.answerability === 'answerable');
const negatives = rows.filter((row) => row.answerability !== 'answerable');
const variantPositiveRecovery = positives.filter((row) => row.queryVariantCount > 0);
const recoveredPositive = variantPositiveRecovery.filter((row) => row.variantSearch.targetRank != null);
const positiveJevCalls = positives.filter((row) => row.jev);
const selectedPositive = positiveJevCalls.filter((row) => row.jev.decision === 'selected');
const negativeJevCalls = negatives.filter((row) => row.jev);
const abstainedNegative = negativeJevCalls.filter((row) => row.jev.decision === 'abstained');
const allJevCalls = rows.filter((row) => row.jev);
const jevMetrics = {
  calls: allJevCalls.length,
  positiveCalls: positiveJevCalls.length,
  positiveSelections: rate(selectedPositive.length, positiveJevCalls.length),
  negativeCalls: negativeJevCalls.length,
  negativeAbstentions: rate(abstainedNegative.length, negativeJevCalls.length),
  allAbstained: allJevCalls.every((row) => row.jev.decision === 'abstained'),
  inputTokens: allJevCalls.reduce((sum, row) => sum + (row.jev.inputTokens ?? 0), 0),
  outputTokens: allJevCalls.reduce((sum, row) => sum + (row.jev.outputTokens ?? 0), 0),
  totalElapsedMs: round(allJevCalls.reduce((sum, row) => sum + (row.jev.elapsedMs ?? 0), 0), 1),
  rawScoresAreCalibrated: false,
  fetchReceipts: rows.filter((row) => row.exactFetchReceiptPresent).length,
  evidencePackReceipts: rows.filter((row) => row.evidencePackReceiptPresent).length,
  compositionPerformed: false
};
if (jevMetrics.calls !== 3 || !jevMetrics.allAbstained || jevMetrics.fetchReceipts !== 0 || jevMetrics.evidencePackReceipts !== 0) {
  throw new Error('Unexpected Jev/fetch/pack scope; inspect Run46 receipts before reporting.');
}
if (variantPositiveRecovery.length !== 3 || recoveredPositive.length !== 2) throw new Error('Unexpected positive query-variant recovery result.');
const efHistorical = rows.filter((row) => row.sourceId === 'elemental-frontier');
if (!efHistorical.some((row) => row.historicalRun45Baseline.sourceMatchesFrozenRevision === false)
  || efHistorical.some((row) => row.historicalRun45Baseline.sourceMatchesFrozenRevision === true)) {
  throw new Error('Expected Run45 EF mismatch/unverifiable historical receipts were not detected.');
}
if (rows.some((row) => row.caseId !== 'EF-01-EN' && row.caseId !== 'EF-NEG-01' && !row.comparison.status.startsWith('same-source'))) {
  throw new Error('A non-EF comparison unexpectedly failed source-revision validation: '
    + JSON.stringify(rows.filter((row) => row.caseId !== 'EF-01-EN' && row.caseId !== 'EF-NEG-01')
      .map((row) => ({ caseId: row.caseId, primary: row.primaryControl, historical: row.historicalRun45Baseline }))));
}

const aggregate = {
  schema: 'mssr-librarian-cross-language-query-recovery-aggregate-v1',
  runId: manifest.runId,
  baselineRunId,
  protocol: {
    sourceFamilies: manifest.limits.sourceFamilies,
    metadataMode: 'off',
    maxResults: manifest.runtime.maxResults,
    providerLabelsExposed: false,
    labelsOwnerAdjudicated: false,
    sourceSnapshots: 'Run45 frozen snapshots, independently SHA-256 checked against Run46 manifest',
    queryVariants: 'explicit blind translations only; primary-query-first ranking remains active'
  },
  sourceIntegrity,
  cases: rows,
  searchSummary: {
    positiveCasesWithVariants: rate(variantPositiveRecovery.length, positives.length),
    positiveTargetsRecoveredInVariantPools: rate(recoveredPositive.length, variantPositiveRecovery.length),
    recoveredCaseIds: recoveredPositive.map((row) => row.caseId),
    recoveredTargetRanks: Object.fromEntries(recoveredPositive.map((row) => [row.caseId, row.variantSearch.targetRank])),
    efNegativeCandidateDelta: (() => {
      const row = rows.find((item) => item.caseId === 'EF-NEG-01');
      return row ? { primaryOnly: row.primaryControl.candidateCount, withVariant: row.variantSearch.candidateCount, added: row.comparison.addedIds.length } : null;
    })(),
    kodeTop10CandidateDelta: (() => {
      const row = rows.find((item) => item.caseId === 'KODE-01-ES');
      return row ? { primaryOnly: row.primaryControl.candidateCount, withVariant: row.variantSearch.candidateCount, added: row.comparison.addedIds.length, removed: row.comparison.removedIds.length, sameOrder: row.comparison.sameOrder } : null;
    })()
  },
  jev: jevMetrics,
  interpretation: {
    scope: 'Retrieval candidate recovery and Jev selection diagnostics only; no fetch, evidence-pack, compaction, or paragraph-composition result.',
    confidence: 'Provider confidence/evidence-sufficiency values are uncalibrated descriptive outputs; no threshold or reliability claim is supported.',
    labels: 'Analyst source-derived labels; no source-owner adjudication or certified holdout.',
    comparison: 'Run45 EF raw baseline is excluded because its handle revision differs from the declared and independently hashed EF source. Same-snapshot EF primary-only controls were added by the recorded amendment.'
  }
};

const frozenPaths = [
  'RUN-PLAN.md', 'manifest.json', 'inputs/queries.json', 'inputs/amendments.json',
  ...fs.readdirSync(path.join(runRoot, 'raw')).filter((name) => name.endsWith('.json')).map((name) => `raw/${name}`),
  'scripts/aggregate-run.mjs'
];
const baselineReceiptPaths = [...new Set(cases.map((item) => item.baselineReceipt))];
const baselineSourcePaths = manifest.sources.map((source) => {
  const baselineSource = baselineSources.get(source.id);
  return path.posix.join('..', baselineRunId, baselineSource.snapshot.replaceAll('\\', '/'));
});
const evidencePaths = [
  ...frozenPaths.map((relative) => path.join(runRoot, relative)),
  path.join(baselineRoot, 'manifest.json'),
  path.join(baselineRoot, 'inputs/labels.json'),
  ...baselineReceiptPaths.map((relative) => path.resolve(runRoot, relative)),
  ...baselineSourcePaths.map((relative) => path.resolve(runRoot, relative))
];
const frozenFiles = evidencePaths.map((absolutePath) => {
  const logicalPath = safePath(path.relative(runRoot, absolutePath));
  return fileHash(absolutePath, logicalPath);
}).sort((a, b) => a.path.localeCompare(b.path));
const inventorySha256 = sha256(Buffer.from(JSON.stringify(frozenFiles), 'utf8'));
const indexPath = path.join(derivedRoot, 'frozen-evidence-sha256.json');
if (fs.existsSync(indexPath)) {
  const prior = readJsonAt(runRoot, 'derived/frozen-evidence-sha256.json');
  if (JSON.stringify(prior.files) !== JSON.stringify(frozenFiles) || prior.inventorySha256 !== inventorySha256) {
    throw new Error('Frozen evidence changed after the post-call checksum checkpoint.');
  }
} else {
  fs.mkdirSync(derivedRoot, { recursive: true });
  writeJson(indexPath, {
    schema: 'mssr-jev-frozen-evidence-sha256-v1',
    createdAt: new Date().toISOString(),
    checkpoint: 'post-call integrity lock; not a pre-call or provider-isolation attestation',
    files: frozenFiles,
    inventorySha256
  });
}

aggregate.frozenEvidenceInventorySha256 = inventorySha256;
writeJson(path.join(derivedRoot, 'aggregate.json'), aggregate);

const table = rows.map((row) => `| ${row.caseId} | ${row.queryVariantCount ? 'primary + translation' : 'primary only'} | ${row.primaryControl.candidateCount} | ${row.variantSearch.candidateCount} | ${row.comparison.status === 'same-source-revision-comparable' ? `+${row.comparison.addedIds.length} / −${row.comparison.removedIds.length}` : 'excluded'} | ${row.variantSearch.targetRank ?? '—'} | ${row.jev?.decision ?? 'not called'} |`).join('\n');
const ersPrimary = rows.find((row) => row.caseId === 'ERS-01-ES').primaryControl;
const efHistoricalNegative = rows.find((row) => row.caseId === 'EF-NEG-01').historicalRun45Baseline;
const efHistoricalPositive = rows.find((row) => row.caseId === 'EF-01-EN').historicalRun45Baseline;
const report = `# Run46 — Cross-language Librarian query recovery\n\n## Scope\n\nThis is a small development diagnostic of explicit bilingual query variants and Jev candidate selection on three real project-document families. Metadata and atom/contradiction projections were off. The translator saw only the query text. Labels stayed in the local evaluator and were not sent to search or Jev. The labels are analyst-derived, not source-owner adjudicated; this is not a holdout or calibration cohort.\n\nThe Run45 EF negative receipt carried revision \`${efHistoricalNegative.sourceRevisions[0]}\`, which differs from the declared and SHA-verified EF snapshot \`${sourceIntegrity.find((item) => item.sourceId === 'elemental-frontier').actualSha256}\`. The Run45 EF positive receipt had ${efHistoricalPositive.candidateCount} candidates and no handle revision. Both historical EF receipts are excluded from same-source pairing. Run45's ERS positive receipt also returned no handles, so it could not attest its search revision. Amendments add two EF controls and one live Bridge ERS primary-only control. ERS source hash before and after its call remained \`${ersPrimary.sourceRevisions[0]}\`; Run45 artifacts remain unchanged.\n\n## Results\n\n| Case | Search arm | Primary candidates | Variant/current candidates | Candidate delta | Target rank in variant/current pool | Jev |\n|---|---|---:|---:|---:|---:|---|\n${table}\n\nAcross the three positive query-variant cases, the accepted target appeared in **2/3** variant pools, at rank **2** for EF and ERS; KODE remained absent from the top 10 and the returned handle pool did not change. EF's negative control grew from ${aggregate.searchSummary.efNegativeCandidateDelta.primaryOnly} to ${aggregate.searchSummary.efNegativeCandidateDelta.withVariant} handles (**+${aggregate.searchSummary.efNegativeCandidateDelta.added}**), showing bounded variant-driven noise in this one negative.\n\nJev was called on two positive pools (EF and ERS) and the changed EF negative pool. It **abstained 3/3**: positive selections **0/2**, negative abstentions **1/1**. Its three requests offered the exact ordered search pools. Raw confidence/evidence-sufficiency scores and token/latency counts are preserved in \`derived/aggregate.json\`; scores are explicitly uncalibrated. No case selected a candidate, so this run has **zero exact fetches and zero evidence packs**. It did not test compaction, union, paragraph assembly, or the composed Librarian workflow.\n\n## Interpretation and next diagnostic\n\nExplicit translations recovered two targets in the search pool, but Jev abstained on both; this is retrieval recovery, not successful end-to-end answer production. KODE suggests a top-10 candidate-cap question, but a larger-k or separate-variant arm is required before attributing that miss to top-k starvation. Do not tune a confidence threshold from these three calls.\n\nThe next run should separate three questions: (1) whether Jev selects differently when only query language changes while the candidate pool/order stays identical; (2) whether compound questions split into manually frozen facets, followed by exact fetch, evidence union and host paragraph assembly with blind review; and (3) whether KODE's target appears in an isolated translation search or a larger top-k pool. Preserve exact source revisions and keep labels hidden from the agent. The second arm is the one that evaluates the complete intelligent Librarian flow—retrieval, selection, union, exact evidence, compaction, and cited paragraph assembly—rather than treating it as plain grep.\n\n## Reproduction and integrity\n\nRun \`node scripts/aggregate-run.mjs\` from this run directory. The script checks case/source binding, frozen source hashes, primary query text, exact Jev candidate-pool identity, labels isolation assertions, EF's mismatch/empty baseline, and ERS's empty baseline limitation. \`derived/frozen-evidence-sha256.json\` locks the plan, manifest, inputs, raw receipts, aggregation script, baseline labels, source snapshots, and baseline search receipts after provider calls; it is a post-call integrity checkpoint, not proof of pre-call provider isolation.\n`;
fs.writeFileSync(path.join(runRoot, 'RUN-REPORT.md'), report, 'utf8');
console.log(JSON.stringify({
  runId: manifest.runId,
  report: path.join(runRoot, 'RUN-REPORT.md'),
  aggregate: path.join(derivedRoot, 'aggregate.json'),
  frozenEvidenceIndex: indexPath,
  positiveTargetRecovery: aggregate.searchSummary.positiveTargetsRecoveredInVariantPools,
  jev: jevMetrics,
  frozenEvidenceFiles: frozenFiles.length,
  inventorySha256
}, null, 2));
