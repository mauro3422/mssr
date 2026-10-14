import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(process.argv[2] ?? '');
const snapshot = path.resolve(process.argv[3] ?? '');
const out = path.resolve(process.argv[4] ?? '');
const preparing = process.argv.includes('--prepare');
const executing = process.argv.includes('--execute');
const allowNetwork = process.argv.includes('--allow-network');
if (!repo || !snapshot || !out || preparing === executing) {
  throw new Error('usage: node runner.mjs <repo> <snapshot> <artifact-dir> --prepare | --execute --allow-network');
}
if (executing && !allowNetwork) throw new Error('live calls blocked: explicit --allow-network required');

const sha = (value) => createHash('sha256').update(value).digest('hex');
const shaFile = async (file) => sha(await readFile(file));
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const splitLines = (value) => value.trim().split(/\r?\n/).filter(Boolean);
const privacy = await import(pathToFileURL(path.join(repo, 'dist', 'jev-provider-input-privacy.js')).href);

const targetCases = [
  'mssr-architecture-impact-history:## Current cross-host coordinator (0.2.54)',
  'mssr-context-plane-history:## Current persistence review boundary (0.2.54)',
  'mssr-project-document-reference-lifecycle:## Human projections'
];
const arms = [
  { id: 'parent', representation: 'parent', clarification: false },
  { id: 'parent-neutral-note', representation: 'parent', clarification: true },
  { id: 'atom', representation: 'evidence-atom-v2', clarification: false },
  { id: 'atom-neutral-note', representation: 'evidence-atom-v2', clarification: true }
];
const neutralNote = 'Interpret source-freshness metadata literally: “unknown” or no host-side freshness observation means that an exact freshness observation is unavailable. By itself, that does not determine whether the section is current or historical; infer lifecycle from the supplied section and parent evidence.';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(values, seed) {
  const result = [...values];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function assertNoGoldMetadata(value) {
  const visit = (item) => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      assert(!/^(expected(Action|Lifecycle)?|gold|truth|labelSource|adjudication)$/i.test(key), `gold metadata key in provider payload: ${key}`);
      visit(child);
    }
  };
  visit(value);
}
async function verifySnapshot() {
  const checks = splitLines(await readFile(path.join(snapshot, 'SHA256SUMS'), 'utf8'));
  const failures = [];
  for (const line of checks) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    assert(match, 'malformed source SHA256SUMS entry');
    const file = path.join(snapshot, match[2].replace(/^\*/, ''));
    if (await shaFile(file) !== match[1].toLowerCase()) failures.push(match[2]);
  }
  assert.equal(failures.length, 0, 'source snapshot checksum mismatch: ' + failures.join(', '));
  const sourceManifest = await json(path.join(snapshot, 'manifest.json'));
  for (const [key, relative] of Object.entries({
    corpus: 'inputs/corpus.json', labels: 'inputs/labels.json', questions: 'inputs/questions.json', preparedRequests: 'inputs/prepared-requests.jsonl'
  })) {
    assert.equal(await shaFile(path.join(snapshot, relative)), sourceManifest.inputHashes[key], 'frozen source hash mismatch: ' + key);
  }
  return { checksummedFiles: checks.length, sourceManifest };
}

async function prepare() {
  const { checksummedFiles, sourceManifest } = await verifySnapshot();
  assert.equal(sourceManifest.labels.exposedToRequests, false);
  assert.equal(sourceManifest.labels.adjudication, 'none');
  const requestsPath = path.join(snapshot, 'inputs', 'prepared-requests.jsonl');
  const frozen = splitLines(await readFile(requestsPath, 'utf8')).map((line) => JSON.parse(line));
  const labelsSource = await json(path.join(snapshot, 'inputs', 'labels.json'));
  const labels = {};
  for (const caseId of targetCases) {
    const label = labelsSource.labels[caseId];
    assert(label, 'missing frozen lifecycle label: ' + caseId);
    assert(['current', 'historical'].includes(label.expectedLifecycle), 'unsupported frozen label: ' + caseId);
    labels[caseId] = { expectedLifecycle: label.expectedLifecycle, labelSource: 'author-derived; not independently adjudicated' };
  }

  const candidates = [];
  for (const caseId of targetCases) {
    for (let rep = 1; rep <= 3; rep++) {
      for (const arm of arms) {
        const base = frozen.find((row) => row.caseId === caseId && row.rep === rep && row.variant === arm.representation);
        assert(base, 'missing frozen base request for ' + caseId + ' / ' + rep + ' / ' + arm.representation);
        const state = structuredClone(base.state);
        if (arm.clarification) state.diagnosticClarification = neutralNote;
        const payload = {
          state: privacy.labelMssrJevProviderLocalPathIdentifiers(state),
          questions: { lifecycle: structuredClone(base.questions.lifecycle) }
        };
        assertNoGoldMetadata(payload);
        const screen = privacy.scanMssrJevProviderInputPrivacy(payload);
        assert(!screen.blocked, 'provider payload blocked by local privacy preflight: ' + JSON.stringify(screen));
        candidates.push({ caseId, rep, arm: arm.id, payload, inputPrivacy: screen });
      }
    }
  }
  assert.equal(candidates.length, 36);
  const ordered = shuffle(candidates, 20261014);
  await mkdir(out, { recursive: true });
  const requestBytes = ordered.map((row, requestId) => JSON.stringify({ requestId, ...row })).join('\n') + '\n';
  await writeFile(path.join(out, 'requests.jsonl'), requestBytes);
  await writeJson(path.join(out, 'labels.private.json'), {
    source: 'author-derived, exposed development labels; no independent adjudication',
    sourceLabelsSha256: sourceManifest.inputHashes.labels,
    cases: labels
  });
  const sdkPackage = await json(path.join(repo, 'node_modules', '@typesafe-ai', 'sdk', 'package.json'));
  const manifest = {
    schemaVersion: 1,
    runId: path.basename(out),
    purpose: 'development-only causal probe; excluded from reliability, holdout, and calibration estimates',
    status: 'prepared',
    preparedAt: new Date().toISOString(),
    source: {
      snapshotRunId: sourceManifest.runId,
      snapshotManifestSha256: await shaFile(path.join(snapshot, 'manifest.json')),
      sourceCommit: sourceManifest.source.gitCommit,
      checksummedSourceFiles: checksummedFiles,
      sourceLabelsAdjudication: sourceManifest.labels.adjudication,
      sourceLabelsExposedAt: sourceManifest.split.holdoutOpenedAt
    },
    design: {
      factors: { representation: ['parent', 'evidence-atom-v2'], clarification: [false, true] },
      arms,
      cases: targetCases,
      uniqueContentUnits: targetCases.length,
      repetitionsPerArmAndCase: 3,
      requestedCalls: ordered.length,
      randomization: { method: 'seeded Fisher-Yates', seed: 20261014, blockedByCaseAndRepeat: false },
      questionIds: ['lifecycle'],
      clarification: neutralNote,
      interpretationLimit: 'The atom retains its original readable identity/source metadata; estimate is for the complete EvidenceAtom payload, not freshness alone. All three labels are author-derived current labels; no mixed-label or negative-class inference is valid.'
    },
    provider: {
      provider: 'TypeSafe AI', endpointIdentity: 'api.typesafe.ai/v1/systemone', requestedModel: 'jev-1.13.0',
      sdk: '@typesafe-ai/sdk@' + sdkPackage.version, timeoutMs: 30000, maxRetries: 0, concurrency: 1, networkOptIn: false
    },
    privacyPreflight: {
      scanner: 'MSSR local deterministic provider-input scanner',
      scannerBuildSha256: await shaFile(path.join(repo, 'dist', 'jev-provider-input-privacy.js')),
      requestsScanned: ordered.length,
      blockedRequests: 0,
      blockedMatches: 0,
      matchedTextPersisted: false
    },
    inputs: {
      requests: 'requests.jsonl', requestsSha256: sha(Buffer.from(requestBytes)),
      privateLabels: 'labels.private.json', labelsSha256: await shaFile(path.join(out, 'labels.private.json')),
      runner: path.relative(repo, fileURLToPath(import.meta.url)).replaceAll('\\', '/'),
      runnerSha256: await shaFile(fileURLToPath(import.meta.url))
    }
  };
  await writeJson(path.join(out, 'manifest.json'), manifest);
  console.log(JSON.stringify({ prepared: true, runId: manifest.runId, sourceChecksums: checksummedFiles, uniqueContentUnits: targetCases.length, requests: ordered.length, arms: arms.map((arm) => arm.id), privacyBlocked: 0, labelsSeparated: true, manifestSha256: await shaFile(path.join(out, 'manifest.json')), requestsSha256: manifest.inputs.requestsSha256 }, null, 2));
}

async function execute() {
  assert(process.env.TYPESAFE_API_KEY, 'credential unavailable in child environment; no request made');
  const manifestPath = path.join(out, 'manifest.json');
  const manifest = await json(manifestPath);
  assert.equal(manifest.status, 'prepared', 'run must be frozen in prepared state');
  assert.equal(await shaFile(path.join(out, manifest.inputs.requests)), manifest.inputs.requestsSha256, 'frozen requests changed');
  assert.equal(await shaFile(path.join(out, manifest.inputs.privateLabels)), manifest.inputs.labelsSha256, 'private labels changed');
  assert.equal(await shaFile(fileURLToPath(import.meta.url)), manifest.inputs.runnerSha256, 'runner changed after freeze');
  const requests = splitLines(await readFile(path.join(out, manifest.inputs.requests), 'utf8')).map((line) => JSON.parse(line));
  assert.equal(requests.length, manifest.design.requestedCalls);
  for (const row of requests) {
    assertNoGoldMetadata(row.payload);
    assert(!privacy.scanMssrJevProviderInputPrivacy(row.payload).blocked, 'privacy preflight changed; no request made');
  }
  manifest.status = 'running';
  manifest.startedAt = new Date().toISOString();
  manifest.provider.networkOptIn = true;
  await writeJson(manifestPath, manifest);

  const sdk = await import(pathToFileURL(path.join(repo, 'node_modules', '@typesafe-ai', 'sdk', 'dist', 'index.mjs')).href);
  const client = new sdk.TypeSafeClient({ timeout: manifest.provider.timeoutMs, retry: { maxRetries: 0 }, logLevel: 'off' });
  const recordsPath = path.join(out, 'records.jsonl');
  await writeFile(recordsPath, '');
  const records = [];
  let stoppedOnFailure = false;
  for (const request of requests) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    try {
      const response = await client.systemOne({ model: manifest.provider.requestedModel, state: request.payload.state, questions: request.payload.questions });
      const answer = response.answers?.lifecycle;
      assert(answer && ['current', 'historical', 'mixed', 'unknown'].includes(answer.choice), 'invalid lifecycle Choice response');
      assert(Number.isFinite(answer.confidence) && answer.confidence >= 0 && answer.confidence <= 1, 'invalid lifecycle confidence');
      records.push({
        requestId: request.requestId, caseId: request.caseId, repetition: request.rep, arm: request.arm,
        requestFingerprint: sha(JSON.stringify(request.payload)), status: 'success', startedAt,
        elapsedMs: performance.now() - started, returnedModel: response.model ?? response.model_id ?? null,
        usage: response.usage ?? null, choice: answer.choice, choiceScore: answer.confidence
      });
    } catch (error) {
      records.push({
        requestId: request.requestId, caseId: request.caseId, repetition: request.rep, arm: request.arm,
        requestFingerprint: sha(JSON.stringify(request.payload)), status: 'failed', startedAt,
        elapsedMs: performance.now() - started, errorClass: error?.name ?? 'Error'
      });
      stoppedOnFailure = true;
    }
    await appendFile(recordsPath, JSON.stringify(records.at(-1)) + '\n');
    if (records.length % 6 === 0 || stoppedOnFailure) console.log('completed ' + records.length + '/' + requests.length + (stoppedOnFailure ? ' (stopped at first failed call)' : ''));
    if (stoppedOnFailure) break;
  }

  const labelDoc = await json(path.join(out, manifest.inputs.privateLabels));
  const successful = records.filter((row) => row.status === 'success');
  const armSummary = {};
  for (const arm of arms) {
    const rows = successful.filter((row) => row.arm === arm.id);
    const expected = rows.filter((row) => labelDoc.cases[row.caseId]?.expectedLifecycle === row.choice).length;
    armSummary[arm.id] = {
      responses: rows.length,
      matchingAuthorLabels: expected,
      choices: Object.fromEntries(['current', 'historical', 'mixed', 'unknown'].map((choice) => [choice, rows.filter((row) => row.choice === choice).length])),
      perCase: Object.fromEntries(targetCases.map((caseId) => [caseId, rows.filter((row) => row.caseId === caseId).map((row) => row.choice)]))
    };
  }
  const summary = {
    schemaVersion: 1, runId: manifest.runId, completedAt: new Date().toISOString(),
    requestedCalls: requests.length, attemptedCalls: records.length,
    successfulCalls: successful.length, failedCalls: records.length - successful.length,
    notAttemptedCalls: requests.length - records.length, status: stoppedOnFailure ? 'partial' : 'complete',
    uniqueContentUnits: targetCases.length, reliabilityEstimate: null,
    note: 'Do not pool with benchmark or holdout. Labels are exposed author-derived lifecycle labels; only three positive/current units are included.',
    returnedModels: [...new Set(successful.map((row) => row.returnedModel).filter(Boolean))],
    totalInputTokens: successful.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0),
    totalOutputTokens: successful.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0),
    meanElapsedMs: successful.length ? successful.reduce((sum, row) => sum + row.elapsedMs, 0) / successful.length : null,
    arms: armSummary
  };
  await writeJson(path.join(out, 'summary.json'), summary);
  manifest.status = summary.status;
  manifest.completedAt = summary.completedAt;
  manifest.actualRequestCount = records.length;
  manifest.successfulRequestCount = successful.length;
  manifest.failedRequestCount = records.length - successful.length;
  manifest.notAttemptedRequestCount = requests.length - records.length;
  await writeJson(manifestPath, manifest);
  const files = ['manifest.json', 'requests.jsonl', 'labels.private.json', 'records.jsonl', 'summary.json'];
  const sums = [];
  for (const relative of files) sums.push((await shaFile(path.join(out, relative))) + '  ' + relative);
  sums.push((await shaFile(fileURLToPath(import.meta.url))) + '  runner.mjs');
  await writeFile(path.join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (stoppedOnFailure) process.exitCode = 2;
}

if (preparing) await prepare();
else await execute();
