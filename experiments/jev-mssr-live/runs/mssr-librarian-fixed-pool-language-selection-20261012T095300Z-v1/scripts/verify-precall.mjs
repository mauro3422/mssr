import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(runRoot, relativePath), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = await readJson('manifest.json');
const pairs = await readJson('inputs/query-pairs.json');
const pools = await readJson('inputs/frozen-pools.json');
const labels = await readJson('inputs/labels.json');

if (manifest.runtime.providerCalls !== 6 || manifest.runtime.providerCallsCompleted !== 0) {
  throw new Error('Manifest provider-call gate must be planned=6 and completed=0 before calls.');
}
if (labels.exposedToProvider !== false) throw new Error('Labels must remain withheld from Jev.');
if (pairs.cases.length !== 3 || pools.cases.length !== 3 || labels.cases.length !== 3) {
  throw new Error('Expected three paired cases, three frozen pools, and three private labels.');
}

const queryText = JSON.stringify(pairs);
if (/answerability|expectedDisposition|targetRangeId|supportingSpans|targetHeading/i.test(queryText)) {
  throw new Error('A provider-facing query input contains label fields.');
}
const fileToHash = [
  'RUN-PLAN.md',
  'manifest.json',
  'inputs/query-pairs.json',
  'inputs/frozen-pools.json',
  'inputs/labels.json',
  'scripts/verify-precall.mjs',
];

const labelById = new Map(labels.cases.map((entry) => [entry.caseId, entry]));
const poolById = new Map(pools.cases.map((entry) => [entry.caseId, entry]));
const sourceById = new Map(manifest.sources.map((entry) => [entry.id, entry]));
const validations = [];

for (const pair of pairs.cases) {
  const pool = poolById.get(pair.caseId);
  const label = labelById.get(pair.caseId);
  const source = sourceById.get(pair.sourceId);
  if (!pool || !label || !source) throw new Error(`Missing frozen case binding for ${pair.caseId}.`);
  if (pair.executionOrder.length !== 2 || new Set(pair.executionOrder).size !== 2) {
    throw new Error(`Expected both query arms once for ${pair.caseId}.`);
  }
  if (!pair.primaryQuery || !pair.variantQuery) throw new Error(`Missing bilingual pair for ${pair.caseId}.`);
  if (pool.sourceSha256 !== source.sha256 || pool.sourceRef !== source.sourceRef) {
    throw new Error(`Pool/source manifest mismatch for ${pair.caseId}.`);
  }
  const ids = pool.candidateHandles.map((handle) => handle.id);
  if (ids.length !== pool.candidateCount || new Set(ids).size !== ids.length) {
    throw new Error(`Candidate IDs are not unique or count changed for ${pair.caseId}.`);
  }
  if (JSON.stringify(ids) !== JSON.stringify(pool.candidateIds)) {
    throw new Error(`Frozen order does not match candidate IDs for ${pair.caseId}.`);
  }
  for (const handle of pool.candidateHandles) {
    if (handle.sourceRef !== pool.sourceRef || handle.revision !== pool.sourceSha256) {
      throw new Error(`Handle source/revision drift in ${pair.caseId}.`);
    }
  }
  if (label.expectedDisposition === 'select' && !ids.some((id) =>
    pool.candidateHandles.find((handle) => handle.id === id)?.rangeId === label.targetRangeId)) {
    throw new Error(`Accepted target is absent from the positive pool for ${pair.caseId}.`);
  }
  if (label.expectedDisposition === 'abstain' && label.targetRangeId !== null) {
    throw new Error(`Negative control must not declare a target for ${pair.caseId}.`);
  }

  const absoluteSource = path.win32.join(source.projectRoot.replaceAll('/', '\\'), source.sourceRef);
  const sourceBytes = await readFile(absoluteSource);
  const actualSha256 = sha256(sourceBytes);
  if (actualSha256 !== source.sha256) throw new Error(`Current source changed for ${pair.caseId}.`);
  validations.push({
    caseId: pair.caseId,
    sourceRef: source.sourceRef,
    sourceSha256: actualSha256,
    candidateCount: ids.length,
    orderedPoolSha256: sha256(Buffer.from(JSON.stringify(ids))),
    targetPresent: label.expectedDisposition === 'select',
  });
}

const inventory = [];
for (const relativePath of fileToHash) {
  const bytes = await readFile(path.join(runRoot, relativePath));
  inventory.push({ path: relativePath.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha256(bytes) });
}
const lock = {
  schema: 'mssr-run-precall-lock-v1',
  runId: manifest.runId,
  lockedAt: new Date().toISOString(),
  providerCallsCompleted: 0,
  validations,
  inventory,
};
await writeFile(path.join(runRoot, 'PRECALL-SHA256SUMS.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ runId: manifest.runId, lockFile: 'PRECALL-SHA256SUMS.json', validations }, null, 2));
