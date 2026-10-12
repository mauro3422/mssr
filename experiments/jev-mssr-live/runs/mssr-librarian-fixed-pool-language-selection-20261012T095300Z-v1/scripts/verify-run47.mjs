import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(runRoot, '../../../..');
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(runRoot, relativePath), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const manifest = await readJson('manifest.json');
const pairs = await readJson('inputs/query-pairs.json');
const pools = await readJson('inputs/frozen-pools.json');
const labels = await readJson('inputs/labels.json');
const lock = await readJson('PRECALL-SHA256SUMS.json');
const poolById = new Map(pools.cases.map((entry) => [entry.caseId, entry]));
const labelById = new Map(labels.cases.map((entry) => [entry.caseId, entry]));
const sourceById = new Map(manifest.sources.map((entry) => [entry.id, entry]));

assert(manifest.runId === 'mssr-librarian-fixed-pool-language-selection-20261012T095300Z-v1', 'Unexpected run ID.');
assert(manifest.runtime.providerCalls === 6 && manifest.runtime.providerCallsCompleted === 0, 'Frozen manifest must retain its pre-call values.');
assert(lock.providerCallsCompleted === 0, 'Pre-call checksum lock must remain immutable.');
assert(labels.exposedToProvider === false, 'Labels were declared exposed to the provider.');
assert(pairs.cases.length === 3 && pools.cases.length === 3 && labels.cases.length === 3, 'Expected exactly three paired cases.');
assert(!/answerability|expectedDisposition|targetRangeId|supportingSpans|targetHeading/i.test(JSON.stringify(pairs)), 'Provider-facing input contains label fields.');

const preCallFiles = [
  'RUN-PLAN.md', 'manifest.json', 'inputs/query-pairs.json', 'inputs/frozen-pools.json',
  'inputs/labels.json', 'scripts/verify-precall.mjs',
];
assert(same(lock.inventory.map((entry) => entry.path).sort(), preCallFiles.slice().sort()), 'Pre-call checksum index is incomplete or has unexpected entries.');
for (const item of lock.inventory) {
  const bytes = await readFile(path.join(runRoot, item.path));
  assert(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Frozen pre-call artifact changed: ${item.path}`);
}
assert(lock.inventory.length === preCallFiles.length, 'Pre-call inventory coverage changed.');

const sourceIntegrity = [];
const callRows = [];
for (const pair of pairs.cases) {
  const pool = poolById.get(pair.caseId);
  const label = labelById.get(pair.caseId);
  const source = sourceById.get(pair.sourceId);
  assert(pool && label && source, `Missing source/pool/label binding for ${pair.caseId}.`);
  const candidateIds = pool.candidateHandles.map((handle) => handle.id);
  assert(candidateIds.length === pool.candidateCount && same(candidateIds, pool.candidateIds), `Frozen candidate pool changed for ${pair.caseId}.`);
  assert(sha256(Buffer.from(JSON.stringify(candidateIds))) === lock.validations.find((entry) => entry.caseId === pair.caseId)?.orderedPoolSha256,
    `Pre-call ordered pool checksum mismatch for ${pair.caseId}.`);
  assert(pool.sourceSha256 === source.sha256 && pool.sourceRef === source.sourceRef, `Frozen source binding mismatch for ${pair.caseId}.`);

  const sourceBytes = await readFile(path.win32.join(source.projectRoot.replaceAll('/', '\\'), source.sourceRef));
  const actualSha256 = sha256(sourceBytes);
  assert(actualSha256 === source.sha256, `Current source revision changed for ${pair.caseId}.`);
  if (!sourceIntegrity.some((entry) => entry.sourceRef === source.sourceRef && entry.expectedSha256 === source.sha256)) {
    sourceIntegrity.push({ sourceId: pair.sourceId, sourceRef: source.sourceRef, bytes: sourceBytes.length, expectedSha256: source.sha256, actualSha256, passed: true });
  }

  for (const arm of ['primary', 'variant']) {
    const file = `raw/${pair.caseId}.${arm}.jev.json`;
    const receipt = await readJson(file);
    assert(receipt.caseId === pair.caseId && receipt.arm === arm && receipt.runId === manifest.runId, `Receipt identity mismatch: ${file}`);
    assert(receipt.response?.isError === false, `Provider call failed: ${file}`);
    const result = JSON.parse(receipt.response.text);
    const expectedQuery = arm === 'primary' ? pair.primaryQuery : pair.variantQuery;
    const expectedLanguage = arm === 'primary' ? pair.primaryLanguage : pair.variantLanguage;
    assert(receipt.request.query === expectedQuery && receipt.queryLanguage === expectedLanguage, `Query arm mismatch: ${file}`);
    assert(same(receipt.request.candidateIds, candidateIds), `Ordered candidate pool mismatch: ${file}`);
    assert(receipt.request.orderedPoolSha256 === lock.validations.find((entry) => entry.caseId === pair.caseId)?.orderedPoolSha256, `Pool hash mismatch: ${file}`);
    assert(receipt.request.sourceSha256 === source.sha256, `Source revision mismatch: ${file}`);
    assert(result.candidateCount === pool.candidateCount && result.provider === 'typesafe-jev' && result.model === 'jev-1.13.0', `Provider identity/count mismatch: ${file}`);
    assert(result.providerCalls === 1 && result.jevCallMade === true && result.autoApplyAllowed === false, `Call/mutation invariant mismatch: ${file}`);
    assert(['selected', 'abstained'].includes(result.status), `Unexpected disposition in ${file}`);
    if (result.status === 'selected') {
      const selected = result.selected?.handle;
      assert(selected && candidateIds.includes(selected.id), `Selected handle was not offered: ${file}`);
      assert(pool.candidateHandles.some((handle) => handle.id === selected.id && handle.fingerprint === selected.fingerprint), `Selected handle identity mismatch: ${file}`);
    }
    callRows.push({
      file,
      caseId: pair.caseId,
      arm,
      queryLanguage: expectedLanguage,
      disposition: result.status,
      provider: result.provider,
      model: result.model,
      candidateCount: result.candidateCount,
      orderedPoolSha256: receipt.request.orderedPoolSha256,
      confidence: result.providerConfidence,
      evidenceSufficiency: result.evidenceSufficiency,
      confidenceCalibration: result.confidenceCalibration,
      evidenceSufficiencyCalibration: result.evidenceSufficiencyCalibration,
      tokens: result.usage,
      elapsedMs: result.elapsedMs,
      selected: result.status === 'selected' ? {
        id: result.selected.handle.id,
        rangeId: result.selected.handle.rangeId,
        fingerprint: result.selected.handle.fingerprint,
        title: result.selected.title,
        startLine: result.selected.handle.startLine,
        endLine: result.selected.handle.endLine,
      } : null,
    });
  }
}

for (const pair of pairs.cases) {
  const arms = callRows.filter((row) => row.caseId === pair.caseId);
  assert(arms.length === 2 && same(arms[0].orderedPoolSha256, arms[1].orderedPoolSha256), `Pair does not hold the exact pool fixed: ${pair.caseId}.`);
}

const fetches = [];
const ef = await readJson('raw/EF-01-EN.variant.fetch.json');
assert(ef.response?.isError === false, 'EF exact fetch failed.');
const efFetched = JSON.parse(ef.response.text);
assert(efFetched.fingerprint === callRows.find((row) => row.caseId === 'EF-01-EN' && row.arm === 'variant').selected.fingerprint,
  'EF fetch fingerprint does not match selected evidence.');
fetches.push({ file: 'raw/EF-01-EN.variant.fetch.json', caseId: 'EF-01-EN', status: 'passed', rangeId: efFetched.handle.rangeId, fingerprint: efFetched.fingerprint, fetchedChars: efFetched.text.length });

const ersInitialFetch = await readJson('raw/ERS-01-ES.variant.fetch.json');
assert(ersInitialFetch.isError === true, 'Expected preserved initial ERS fetch rejection.');
const ersByteFetch = await readJson('raw/ERS-01-ES.variant.fetch-byte-preserved.json');
const ersFetched = JSON.parse(ersByteFetch.fetch.content[0].text);
assert(ersByteFetch.fetch.isError !== true, 'Byte-preserved ERS exact fetch failed.');
assert(ersFetched.fingerprint === callRows.find((row) => row.caseId === 'ERS-01-ES' && row.arm === 'variant').selected.fingerprint,
  'ERS fetch fingerprint does not match selected evidence.');
fetches.push({ file: 'raw/ERS-01-ES.variant.fetch-byte-preserved.json', caseId: 'ERS-01-ES', status: 'passed', rangeId: ersFetched.handle.rangeId, fingerprint: ersFetched.fingerprint, fetchedChars: ersFetched.text.length });

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row.tokens?.[key]) || 0), 0);
const summaries = {
  'EF-01-EN': {
    primaryDisposition: 'abstained', variantDisposition: 'selected',
    assessment: 'partial-with-reviewer-disagreement',
    basis: 'The exact fetched list gives the settings and at-least-five repeat count, but omits the source framing line. A fresh-context blind reviewer marked it partial because the excerpt alone does not establish the scope/exhaustiveness of the list; a prior-context reviewer called it complete and is excluded from blind scoring.',
    supportSpanFullyCovered: false,
  },
  'ERS-01-ES': {
    primaryDisposition: 'abstained', variantDisposition: 'selected',
    assessment: 'partial-answer',
    basis: 'The selected/fetched range is only Layer 2; the question asks for all three layers and which layer positions atomics.',
    supportSpanFullyCovered: false,
  },
  'EF-NEG-01': {
    primaryDisposition: 'abstained', variantDisposition: 'abstained',
    assessment: 'analyst-labeled-negative-abstained',
    basis: 'Both arms abstained on the frozen unanswerable-in-source control; labels are not owner-adjudicated.',
    supportSpanFullyCovered: null,
  },
};

const aggregate = {
  schema: 'mssr-fixed-pool-language-selection-aggregate-v1',
  runId: manifest.runId,
  baselineRunId: manifest.baselineRunId,
  status: 'completed-development-diagnostic',
  protocol: {
    independentVariable: 'query language only',
    provider: 'typesafe-jev', model: 'jev-1.13.0',
    actualProviderCalls: callRows.length,
    frozenPreCallManifestUnmodified: true,
    labelsExposedToProvider: false,
    labelsOwnerAdjudicated: false,
    sourceFamilies: 2,
    cases: 3,
    positivePairs: 2,
    negativePairs: 1,
    holdout: false,
    adapter: 'portable MSSR; this is not a Bridge-path integration test',
    bridgeGate: 'EF Bridge project-context selection exceeded its configured byte budget before Jev; all six arms used the same portable adapter.',
  },
  postCallAmendments: [
    'The frozen manifest is preserved as written. Its ERS route field names Bridge 0.6.173 and a child trace, but no Jev calls ran through that route; all six calls used portable MSSR after the EF Bridge context gate blocked before provider work, keeping the adapter constant across pairs.',
    'The frozen manifest and pre-call lock retain providerCallsCompleted=0 by design. The six observed calls are recorded here and in the raw receipts; no frozen pre-call file was rewritten.',
  ],
  frozenInputs: {
    preCallLockValid: true,
    manifestPlannedProviderCalls: manifest.runtime.providerCalls,
    manifestPreCallCompletedCalls: manifest.runtime.providerCallsCompleted,
    sourceIntegrity,
    allPairCandidateOrdersIdentical: true,
    labelsFileNotProviderInput: true,
  },
  calls: callRows,
  fetches: {
    exactFetchesPassed: fetches.length,
    exactFetchesAttempted: 3,
    initialNormalizedTextAttempt: 'rejected-as-stale; current file bytes matched the frozen SHA; byte-preserving retry passed, so the rejection is recorded as input-serialization friction.',
    receipts: fetches,
  },
  independentBlindReview: {
    artifact: 'derived/blind-review.json',
    reviewerType: 'independent fresh-context subagent; gpt-6-luna was requested, actual host model metadata unavailable',
    labelsAndPriorAdjudicationShown: false,
    completeAnswers: 0,
    partialAnswers: 2,
  },
  cases: pairs.cases.map((pair) => ({ caseId: pair.caseId, label: labelById.get(pair.caseId), ...summaries[pair.caseId] })),
  findings: {
    positivePrimarySelections: callRows.filter((row) => row.caseId !== 'EF-NEG-01' && row.arm === 'primary' && row.disposition === 'selected').length,
    positiveVariantSelections: callRows.filter((row) => row.caseId !== 'EF-NEG-01' && row.arm === 'variant' && row.disposition === 'selected').length,
    positiveTranslatedSelectionsFullyCoveredSupport: 0,
    positiveTranslatedSelectionsBlindComplete: 0,
    positiveTranslatedSelectionsBlindPartial: 2,
    negativeAbstentions: callRows.filter((row) => row.caseId === 'EF-NEG-01' && row.disposition === 'abstained').length,
    positivePairTransitions: ['EF-01-EN', 'ERS-01-ES'].map((caseId) => ({
      caseId,
      from: callRows.find((row) => row.caseId === caseId && row.arm === 'primary').disposition,
      to: callRows.find((row) => row.caseId === caseId && row.arm === 'variant').disposition,
      assessment: summaries[caseId].assessment,
    })),
    scoresAreCalibratedProbabilities: false,
    thresholdOrRuntimeChanged: false,
    productionReliabilityClaim: false,
  },
  usage: {
    inputTokens: sum(callRows, 'input_tokens'),
    outputTokens: sum(callRows, 'output_tokens'),
    totalTokens: sum(callRows, 'input_tokens') + sum(callRows, 'output_tokens'),
    elapsedMs: callRows.reduce((total, row) => total + row.elapsedMs, 0),
  },
  limits: [
    'Only three development cases from two previously exposed source families; one negative pair.',
    'Labels are analyst-derived, not owner-adjudicated; no source-disjoint holdout.',
    'Changing language also makes the query language match the source language; this is a narrow paired diagnostic, not general multilingual quality evidence.',
    'Both positive translations changed abstention to a nested-range selection, but exact fetched evidence was incomplete for the full support/question scope in both cases.',
    'Provider confidence and evidence sufficiency are raw uncalibrated values.',
    'No atom metadata, contradiction graph, search rerun, union, semantic compaction or paragraph composition was tested.',
    'No threshold, routing policy, canonical source or runtime behavior changed.',
  ],
};

const aggregatePath = path.join(runRoot, 'derived/aggregate.json');
const rawPaths = (await readdir(path.join(runRoot, 'raw')))
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => `raw/${entry}`);
const postCallPaths = [
  ...preCallFiles,
  'PRECALL-SHA256SUMS.json',
  'RUN-REPORT.md',
  'scripts/verify-run47.mjs',
  'derived/aggregate.json',
  'derived/blind-review.json',
  ...rawPaths,
].sort();
if (process.argv.includes('--verify')) {
  const current = await readJson('derived/aggregate.json');
  assert(same(current, aggregate), 'Derived aggregate differs from the reproducible raw-receipt aggregation.');
  const sums = await readJson('derived/POSTCALL-SHA256SUMS.json');
  assert(same(sums.inventory.map((entry) => entry.path).sort(), postCallPaths), 'Post-call checksum index is incomplete or has unexpected entries.');
  for (const item of sums.inventory) {
    const bytes = await readFile(path.join(runRoot, item.path));
    assert(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Post-call checksum mismatch: ${item.path}`);
  }
  console.log(JSON.stringify({ runId: manifest.runId, status: 'verified', providerCalls: callRows.length, passedExactFetches: fetches.length, indexedPostCallFiles: sums.inventory.length }, null, 2));
} else {
  await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8');
  if (process.argv.includes('--write-postcall-index')) {
    const inventory = [];
    for (const relativePath of postCallPaths) {
      const bytes = await readFile(path.join(runRoot, relativePath));
      inventory.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }
    await writeFile(path.join(runRoot, 'derived/POSTCALL-SHA256SUMS.json'), `${JSON.stringify({
      schema: 'mssr-run-postcall-lock-v1',
      runId: manifest.runId,
      immutablePreCallLock: 'PRECALL-SHA256SUMS.json',
      excludesSelf: true,
      inventory,
    }, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({ runId: manifest.runId, status: 'aggregate-written', providerCalls: callRows.length, passedExactFetches: fetches.length, inputTokens: aggregate.usage.inputTokens, outputTokens: aggregate.usage.outputTokens }, null, 2));
}
