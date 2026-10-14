import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(process.argv[2] ?? '');
const previous = path.resolve(process.argv[3] ?? '');
const out = path.resolve(process.argv[4] ?? '');
const preparing = process.argv.includes('--prepare');
const executing = process.argv.includes('--execute');
const allowNetwork = process.argv.includes('--allow-network');
if (!repo || !previous || !out || preparing === executing) {
  throw new Error('usage: node runner.mjs <repo> <previous-artifact> <artifact-dir> --prepare | --execute --allow-network');
}
if (executing && !allowNetwork) throw new Error('live calls blocked: explicit --allow-network required');

const sha = (value) => createHash('sha256').update(value).digest('hex');
const shaFile = async (file) => sha(await readFile(file));
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const splitLines = (value) => value.trim().split(/\r?\n/).filter(Boolean);
const privacy = await import(pathToFileURL(path.join(repo, 'dist', 'jev-provider-input-privacy.js')).href);
const atomModule = await import(pathToFileURL(path.join(repo, 'dist', 'evidence-atom.js')).href);
const { buildMssrEvidenceAtom, mssrEvidenceAtomSchema } = atomModule;

const targetCases = [
  'mssr-architecture-impact-history:## Current cross-host coordinator (0.2.54)',
  'mssr-context-plane-history:## Current persistence review boundary (0.2.54)',
  'mssr-project-document-reference-lifecycle:## Human projections'
];
const arms = [
  { id: 'parent-neutral-note', sourceArm: 'parent-neutral-note', category: 'control-valid' },
  { id: 'atom-full-neutral-note', sourceArm: 'atom-neutral-note', category: 'atom-valid' },
  { id: 'atom-omit-freshness', sourceArm: 'atom-neutral-note', category: 'malformed-schema-ablation', mutation: 'source.freshness omitted' },
  { id: 'atom-omit-usage', sourceArm: 'atom-neutral-note', category: 'malformed-schema-ablation', mutation: 'usage object omitted' },
  { id: 'atom-neutralize-locators', sourceArm: 'atom-neutral-note', category: 'schema-valid-locator-ablation', mutation: 'subject identity and source locator fields neutralized; id rebuilt' }
];

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
async function verifyPrevious() {
  const manifest = await json(path.join(previous, 'manifest.json'));
  const sums = splitLines(await readFile(path.join(previous, 'SHA256SUMS'), 'utf8'));
  const failures = [];
  for (const line of sums) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    assert(match, 'malformed prior SHA256SUMS entry');
    const relative = match[2].replace(/^\*/, '');
    const file = relative === 'runner.mjs' ? path.resolve(repo, manifest.inputs.runner) : path.join(previous, relative);
    if (await shaFile(file) !== match[1].toLowerCase()) failures.push(relative);
  }
  assert.equal(failures.length, 0, 'prior run artifact checksum mismatch: ' + failures.join(', '));
  assert.equal(manifest.status, 'complete', 'prior diagnostic is not complete');
  assert.equal(await shaFile(path.join(previous, manifest.inputs.requests)), manifest.inputs.requestsSha256, 'prior request hash mismatch');
  assert.equal(await shaFile(path.join(previous, manifest.inputs.privateLabels)), manifest.inputs.labelsSha256, 'prior private-label hash mismatch');
  const requests = splitLines(await readFile(path.join(previous, manifest.inputs.requests), 'utf8')).map((line) => JSON.parse(line));
  const labels = await json(path.join(previous, manifest.inputs.privateLabels));
  assert.equal(requests.length, 36);
  assert.equal(Object.keys(labels.cases).length, 3);
  return { manifest, requests, labels, checksummedFiles: sums.length };
}

async function prepare() {
  const prior = await verifyPrevious();
  const candidates = [];
  const schemaValidation = { valid: 0, invalidExpected: 0, errorsByArm: {} };
  for (const caseId of targetCases) {
    assert(prior.labels.cases[caseId], 'missing private author-derived label');
    for (let rep = 1; rep <= 3; rep++) {
      for (const arm of arms) {
        const base = prior.requests.find((row) => row.caseId === caseId && row.rep === rep && row.arm === arm.sourceArm);
        assert(base, 'missing frozen source request for ' + caseId + ' / ' + rep + ' / ' + arm.sourceArm);
        const payload = structuredClone(base.payload);
        if (arm.id === 'atom-omit-freshness') delete payload.state.evidenceAtom.source.freshness;
        if (arm.id === 'atom-omit-usage') delete payload.state.evidenceAtom.usage;
        if (arm.id === 'atom-neutralize-locators') {
          const atom = payload.state.evidenceAtom;
          const input = structuredClone(atom);
          delete input.schemaVersion;
          delete input.id;
          delete input.advisoryOnly;
          delete input.canonicalRewriteAllowed;
          input.subject.identity = 'opaque-section-target';
          input.source.ref = 'opaque-canonical-source';
          delete input.source.revision;
          delete input.source.headingPath;
          delete input.source.range;
          input.dedupeKey = 'opaque-section-source';
          payload.state.evidenceAtom = buildMssrEvidenceAtom(input);
        }

        const atom = payload.state.evidenceAtom;
        let atomSchema = 'not-applicable';
        if (atom) {
          const parsed = mssrEvidenceAtomSchema.safeParse(atom);
          atomSchema = parsed.success ? 'valid' : 'invalid';
          if (parsed.success) schemaValidation.valid++;
          else {
            assert(['atom-omit-freshness', 'atom-omit-usage'].includes(arm.id), 'unexpected schema-invalid atom arm');
            schemaValidation.invalidExpected++;
            schemaValidation.errorsByArm[arm.id] = [...new Set((schemaValidation.errorsByArm[arm.id] ?? []).concat(parsed.error.issues.map((issue) => issue.path.join('.'))))];
          }
        }
        if (['atom-omit-freshness', 'atom-omit-usage'].includes(arm.id)) assert.equal(atomSchema, 'invalid');
        else if (atom) assert.equal(atomSchema, 'valid');

        assertNoGoldMetadata(payload);
        const inputPrivacy = privacy.scanMssrJevProviderInputPrivacy(payload);
        assert(!inputPrivacy.blocked, 'provider payload blocked by local privacy preflight');
        candidates.push({ caseId, rep, arm: arm.id, category: arm.category, atomSchema, payload, inputPrivacy });
      }
    }
  }
  assert.equal(candidates.length, 45);
  assert.equal(schemaValidation.valid, 18);
  assert.equal(schemaValidation.invalidExpected, 18);
  const ordered = shuffle(candidates, 2026101401);
  await mkdir(out, { recursive: true });
  const requestBytes = ordered.map((row, requestId) => JSON.stringify({ requestId, ...row })).join('\n') + '\n';
  await writeFile(path.join(out, 'requests.jsonl'), requestBytes);
  await writeJson(path.join(out, 'labels.private.json'), {
    source: 'inherited exposed author-derived development labels; no independent adjudication',
    priorPrivateLabelsSha256: prior.manifest.inputs.labelsSha256,
    cases: prior.labels.cases
  });
  const sdkPackage = await json(path.join(repo, 'node_modules', '@typesafe-ai', 'sdk', 'package.json'));
  const manifest = {
    schemaVersion: 1,
    runId: path.basename(out),
    purpose: 'exploratory field sensitivity only; excluded from reliability, holdout, calibration and benchmark denominators',
    status: 'prepared',
    preparedAt: new Date().toISOString(),
    source: {
      priorRunId: prior.manifest.runId,
      priorManifestSha256: await shaFile(path.join(previous, 'manifest.json')),
      priorArtifactChecksummedFiles: prior.checksummedFiles,
      sourceLabelsAdjudication: prior.manifest.source.sourceLabelsAdjudication,
      labelsNotIndependentlyAdjudicated: true
    },
    design: {
      arms,
      cases: targetCases,
      uniqueContentUnits: targetCases.length,
      repetitionsPerArmAndCase: 3,
      requestedCalls: ordered.length,
      randomization: { method: 'seeded Fisher-Yates', seed: 2026101401, blockedByCaseAndRepeat: false },
      questionIds: ['lifecycle'],
      commonNeutralClarification: true,
      invalidSchemaArms: ['atom-omit-freshness', 'atom-omit-usage'],
      interpretationLimit: 'Three exposed content units, all author-derived positive/current labels. Repetitions are within-case repeats, not independent examples. The two omission arms violate strict EvidenceAtom v2 and measure malformed-input prompt sensitivity only. Locator arm remains schema-valid but is a synthetic opaque projection, not a production atom. Do not pool with benchmark, holdout or calibration.'
    },
    schemaPreflight: {
      validator: 'MSSR mssrEvidenceAtomSchema from current dist/evidence-atom.js',
      validAtomPayloads: schemaValidation.valid,
      expectedInvalidAtomPayloads: schemaValidation.invalidExpected,
      errorsByInvalidArm: schemaValidation.errorsByArm
    },
    provider: {
      provider: 'TypeSafe AI', endpointIdentity: 'api.typesafe.ai/v1/systemone', requestedModel: 'jev-1.13.0',
      sdk: '@typesafe-ai/sdk@' + sdkPackage.version, timeoutMs: 30000, maxRetries: 0, concurrency: 1, networkOptIn: false,
      credentialSource: 'Windows Credential Manager target TypeSafe:MSSR:JevLab; secret not read into artifact or output'
    },
    privacyPreflight: {
      scanner: 'MSSR local deterministic provider-input scanner',
      scannerBuildSha256: await shaFile(path.join(repo, 'dist', 'jev-provider-input-privacy.js')),
      requestsScanned: ordered.length,
      blockedRequests: 0,
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
  console.log(JSON.stringify({ prepared: true, runId: manifest.runId, priorChecksumsVerified: prior.checksummedFiles, requests: ordered.length, uniqueContentUnits: targetCases.length, arms: arms.map((arm) => arm.id), schemaValidation, privacyBlocked: 0, labelsSeparated: true, manifestSha256: await shaFile(path.join(out, 'manifest.json')), requestsSha256: manifest.inputs.requestsSha256 }, null, 2));
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
    if (row.arm === 'atom-omit-freshness' || row.arm === 'atom-omit-usage') {
      assert.equal(mssrEvidenceAtomSchema.safeParse(row.payload.state.evidenceAtom).success, false);
    } else if (row.payload.state.evidenceAtom) {
      assert.equal(mssrEvidenceAtomSchema.safeParse(row.payload.state.evidenceAtom).success, true);
    }
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
        category: request.category, atomSchema: request.atomSchema,
        requestFingerprint: sha(JSON.stringify(request.payload)), status: 'success', startedAt,
        elapsedMs: performance.now() - started, returnedModel: response.model ?? response.model_id ?? null,
        usage: response.usage ?? null, choice: answer.choice, choiceScore: answer.confidence
      });
    } catch (error) {
      records.push({
        requestId: request.requestId, caseId: request.caseId, repetition: request.rep, arm: request.arm,
        category: request.category, atomSchema: request.atomSchema,
        requestFingerprint: sha(JSON.stringify(request.payload)), status: 'failed', startedAt,
        elapsedMs: performance.now() - started, errorClass: error?.name ?? 'Error'
      });
      stoppedOnFailure = true;
    }
    await appendFile(recordsPath, JSON.stringify(records.at(-1)) + '\n');
    if (records.length % 5 === 0 || stoppedOnFailure) console.log('completed ' + records.length + '/' + requests.length + (stoppedOnFailure ? ' (stopped at first failed call)' : ''));
    if (stoppedOnFailure) break;
  }

  const labelDoc = await json(path.join(out, manifest.inputs.privateLabels));
  const successful = records.filter((row) => row.status === 'success');
  const armSummary = {};
  for (const arm of arms) {
    const rows = successful.filter((row) => row.arm === arm.id);
    const matching = rows.filter((row) => labelDoc.cases[row.caseId]?.expectedLifecycle === row.choice);
    armSummary[arm.id] = {
      schemaCategory: arm.category,
      responses: rows.length,
      matchingAuthorLabels: matching.length,
      choices: Object.fromEntries(['current', 'historical', 'mixed', 'unknown'].map((choice) => [choice, rows.filter((row) => row.choice === choice).length])),
      meanRawChoiceScore: rows.length ? rows.reduce((sum, row) => sum + row.choiceScore, 0) / rows.length : null,
      meanScoreOnMatches: matching.length ? matching.reduce((sum, row) => sum + row.choiceScore, 0) / matching.length : null,
      meanScoreOnMismatches: rows.length > matching.length ? rows.filter((row) => labelDoc.cases[row.caseId]?.expectedLifecycle !== row.choice).reduce((sum, row) => sum + row.choiceScore, 0) / (rows.length - matching.length) : null,
      perCase: Object.fromEntries(targetCases.map((caseId) => [caseId, rows.filter((row) => row.caseId === caseId).map((row) => row.choice)]))
    };
  }
  const baselineByKey = new Map(successful.filter((row) => row.arm === 'atom-full-neutral-note').map((row) => [`${row.caseId}\u0000${row.repetition}`, row]));
  const paired = {};
  for (const arm of arms.filter((item) => item.id !== 'atom-full-neutral-note' && item.id !== 'parent-neutral-note')) {
    const pairs = successful.filter((row) => row.arm === arm.id).flatMap((row) => {
      const baseline = baselineByKey.get(`${row.caseId}\u0000${row.repetition}`);
      return baseline ? [{ row, baseline }] : [];
    });
    paired[arm.id] = {
      pairedResponses: pairs.length,
      changedChoices: pairs.filter(({ row, baseline }) => row.choice !== baseline.choice).length,
      changedToAuthorMatch: pairs.filter(({ row, baseline }) => row.choice !== baseline.choice && labelDoc.cases[row.caseId]?.expectedLifecycle === row.choice).length,
      changedFromAuthorMatch: pairs.filter(({ row, baseline }) => row.choice !== baseline.choice && labelDoc.cases[row.caseId]?.expectedLifecycle === baseline.choice).length
    };
  }
  const summary = {
    schemaVersion: 1, runId: manifest.runId, completedAt: new Date().toISOString(),
    requestedCalls: requests.length, attemptedCalls: records.length,
    successfulCalls: successful.length, failedCalls: records.length - successful.length,
    notAttemptedCalls: requests.length - records.length, status: stoppedOnFailure ? 'partial' : 'complete',
    uniqueContentUnits: targetCases.length, reliabilityEstimate: null,
    note: 'Exploratory prompt sensitivity only. Three exposed author-derived current labels; repeats are not independent examples. Invalid schema arms are malformed-input diagnostics only. Do not pool with benchmark, holdout or calibration.',
    returnedModels: [...new Set(successful.map((row) => row.returnedModel).filter(Boolean))],
    totalInputTokens: successful.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0),
    totalOutputTokens: successful.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0),
    meanElapsedMs: successful.length ? successful.reduce((sum, row) => sum + row.elapsedMs, 0) / successful.length : null,
    arms: armSummary,
    pairedAgainstFullAtom: paired
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
