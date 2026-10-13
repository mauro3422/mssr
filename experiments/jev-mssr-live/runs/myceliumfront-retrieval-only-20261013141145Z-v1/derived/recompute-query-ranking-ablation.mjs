import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const runDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(scriptDir, '../../../../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = async (p) => readFile(p, 'utf8');
const plan = JSON.parse(await read(path.join(runDir, 'RUN-PLAN.json')));
const queryBytes = await read(path.join(runDir, 'inputs', 'QUERIES.json'));
const queries = JSON.parse(queryBytes);
const checksums = await read(path.join(runDir, 'SHA256SUMS.txt'));
const expectedHash = (relative) => {
  const line = checksums.split(/\r?\n/).find((entry) => entry.endsWith(`  ${relative.replaceAll('\\', '/')}`));
  if (!line) throw new Error(`Missing frozen SHA-256 entry for ${relative}`);
  return line.slice(0, 64).toLowerCase();
};
if (hash(Buffer.from(queryBytes, 'utf8')) !== expectedHash('inputs/QUERIES.json')) throw new Error('Frozen query input SHA-256 mismatch.');
const sourceRefs = ['README.md', 'ROADMAP.md', 'docs/ARCHITECTURE.md', 'docs/PROJECT_NOTES.md'];
const documents = [];
for (const sourceRef of sourceRefs) {
  const markdown = await read(path.join(runDir, 'inputs', 'sources', sourceRef));
  if (hash(Buffer.from(markdown, 'utf8')) !== String(plan.sourceHashes[sourceRef]).toLowerCase()) throw new Error(`Frozen source SHA-256 mismatch: ${sourceRef}`);
  documents.push({
    owner: `project:MyceliumFront@${plan.source.revision}`,
    sourceRef,
    markdown,
    privacyClass: 'project-metadata',
  });
}
const packageMetadata = JSON.parse(await read(path.join(repoRoot, 'package.json')));
const moduleUrl = pathToFileURL(path.join(repoRoot, 'src', 'librarian-retrieval.ts')).href;
const { searchMssrLibrarianEvidence } = await import(moduleUrl);

const recorded = JSON.parse(await read(path.join(runDir, 'results', 'QUERY-VARIANTS.json')));
const recordedTop8 = new Map(recorded.maxResults8.map((row) => [row.caseId, row.anchorInTop8]));
const recordedTop16 = new Map(recorded.maxResults16.map((row) => [row.caseId, row.anchorOverlapTop16]));
const englishMisses = new Set();
for (let part = 1; part <= 5; part += 1) {
  const baseline = JSON.parse(await read(path.join(runDir, 'results', `BASELINE-TOP8-0${part}.json`)));
  for (const row of baseline.results) if (row.language === 'en' && !row.anchorOverlapTop8) englishMisses.add(row.caseId);
}
const cohort = queries.queries.filter((item) => englishMisses.has(item.caseId));
if (cohort.length !== 9) throw new Error(`Expected nine English top-8 misses; found ${cohort.length}.`);

function matchesAnchor(candidate, anchor, kind) {
  if (candidate.handle.sourceRef !== anchor.sourceRef) return false;
  if (kind === 'exact') return candidate.handle.startLine === anchor.startLine && candidate.handle.endLine === anchor.endLine;
  if (kind === 'contains') return candidate.handle.startLine <= anchor.startLine && candidate.handle.endLine >= anchor.endLine;
  return candidate.handle.startLine <= anchor.endLine && candidate.handle.endLine >= anchor.startLine;
}
function hasTarget(list, anchors, kind) {
  return list.some((candidate) => anchors.some((anchor) => matchesAnchor(candidate, anchor, kind)));
}
function firstTargetRank(list, anchors) {
  const index = list.findIndex((candidate) => anchors.some((anchor) => matchesAnchor(candidate, anchor, 'overlap')));
  return index < 0 ? null : index + 1;
}
function interleave(primary, variant) {
  const queues = [primary, variant];
  const indices = [0, 0];
  const seen = new Set();
  const ranked = [];
  let turn = 0;
  let stalledTurns = 0;
  while (ranked.length < primary.length + variant.length && stalledTurns < 2) {
    const side = turn % 2;
    turn += 1;
    let candidate;
    while (indices[side] < queues[side].length) {
      const next = queues[side][indices[side]++];
      if (!seen.has(next.handle.id)) {
        candidate = next;
        break;
      }
    }
    if (candidate) {
      ranked.push({ candidate, firstQuery: side === 0 ? 'primary' : 'variant' });
      seen.add(candidate.handle.id);
      stalledTurns = 0;
    } else {
      stalledTurns += 1;
    }
  }
  return ranked;
}
const caseResults = [];
for (const item of cohort) {
  const english = item.arms.find((arm) => arm.language === 'en')?.query;
  const spanish = item.arms.find((arm) => arm.language === 'es')?.query;
  if (!english || !spanish || !item.anchors?.length) throw new Error(`Incomplete frozen case ${item.caseId}`);
  const primary = searchMssrLibrarianEvidence({ documents, query: { query: english, maxResults: 100 } });
  const variant = searchMssrLibrarianEvidence({ documents, query: { query: spanish, maxResults: 100 } });
  const mixed = searchMssrLibrarianEvidence({ documents, query: { query: english, queryVariants: [spanish], maxResults: 100 } });
  const balanced = interleave(primary.results, variant.results);
  const summarize = (list, getter) => {
    const candidates = list.map(getter);
    const top8 = candidates.slice(0, 8);
    const top16 = candidates.slice(0, 16);
    return {
      candidateCount: candidates.length,
      firstAnchorOverlapRank: firstTargetRank(candidates, item.anchors),
      overlapAt8: hasTarget(top8, item.anchors, 'overlap'),
      containmentAt8: hasTarget(top8, item.anchors, 'contains'),
      exactRangeAt8: hasTarget(top8, item.anchors, 'exact'),
      overlapAt16: hasTarget(top16, item.anchors, 'overlap'),
      containmentAt16: hasTarget(top16, item.anchors, 'contains'),
      exactRangeAt16: hasTarget(top16, item.anchors, 'exact'),
      poolExceeds16: candidates.length > 16,
    };
  };
  const current = summarize(mixed.results, (candidate) => candidate);
  const balancedStats = summarize(balanced, (row) => row.candidate);
  const primaryFirstTop8 = mixed.results.slice(0, 8).filter((candidate) => candidate.scoreQueryIndex === 0).length;
  const balancedTop8Sources = balanced.slice(0, 8).reduce((counts, row) => ({ ...counts, [row.firstQuery]: counts[row.firstQuery] + 1 }), { primary: 0, variant: 0 });
  if (current.overlapAt8 !== recordedTop8.get(item.caseId) || current.overlapAt16 !== recordedTop16.get(item.caseId)) {
    throw new Error(`Current-source replay disagrees with frozen result for ${item.caseId}.`);
  }
  caseResults.push({
    caseId: item.caseId,
    provisionalAnchors: item.anchors,
    primaryPool: { candidates: primary.results.length, truncatedAt100: primary.truncated },
    variantPool: { candidates: variant.results.length, truncatedAt100: variant.truncated },
    currentCombinedPool: { candidates: mixed.results.length, truncatedAt100: mixed.truncated },
    primaryFirst: { ...current, primaryRankedCandidatesAt8: primaryFirstTop8 },
    roundRobinInterleave: { ...balancedStats, firstQueryContributionAt8: balancedTop8Sources },
  });
}
const aggregate = (key) => Object.fromEntries(
  ['overlapAt8', 'containmentAt8', 'exactRangeAt8', 'overlapAt16', 'containmentAt16', 'exactRangeAt16']
    .map((metric) => [metric, caseResults.filter((row) => row[key][metric]).length]),
);
const result = {
  schemaVersion: 1,
  runId: plan.runId,
  evaluatedAt: '2026-10-13T15:01:54.230Z',
  method: {
    implementation: 'offline deterministic replay of src/librarian-retrieval.ts; no network and no Jev/provider calls',
    sourceRevision: plan.source.revision,
    mssrPackageVersion: packageMetadata.version,
    sourceRefs,
    sourceSnapshotHashesVerified: true,
    queryInputHashVerified: true,
    retrievalSourceSha256: hash(await readFile(path.join(repoRoot, 'src', 'librarian-retrieval.ts'))),
    cohort: 'nine English top-8 misses from one exposed MyceliumFront project family; provisional anchors, owner adjudication pending',
    currentPolicy: 'one combined English primary + explicit Spanish variant search; primary-query group ranks before variant-only results; maxResults=100 for replay, then inspect top 8 and top 16',
    candidatePolicy: 'run English-only and Spanish-only searches separately (maxResults=100 each), alternate one candidate from each ranked list starting with English, deduplicate by exact handle id; this is an offline counterfactual, not a production policy',
    truncation: 'separate top-100 pools may already be truncated; interleaving their union cannot recover candidates outside either frozen 100-result pool',
    targetMetrics: 'any provisional anchor overlap, full anchor containment, and exact range equality, scored separately',
  },
  metrics: {
    cases: caseResults.length,
    primaryFirst: aggregate('primaryFirst'),
    roundRobinInterleave: aggregate('roundRobinInterleave'),
    rescuedAt8: caseResults.filter((row) => !row.primaryFirst.overlapAt8 && row.roundRobinInterleave.overlapAt8).map((row) => row.caseId),
    regressedAt8: caseResults.filter((row) => row.primaryFirst.overlapAt8 && !row.roundRobinInterleave.overlapAt8).map((row) => row.caseId),
  },
  limitations: [
    'All anchors are author-derived and provisional; this is not owner-gold or a holdout.',
    'This ranks evidence candidates only; Jev was not called, so answer quality, abstention quality, and confidence calibration were not tested.',
    'The counterfactual changes retrieval order and may change Jev behavior; this replay does not establish a safe production change.',
    'The top-k improvements are measured within a single project family and nine linked cases.',
  ],
  caseResults,
};
if (result.metrics.primaryFirst.overlapAt8 !== 8 || result.metrics.primaryFirst.overlapAt16 !== 9 || result.metrics.primaryFirst.exactRangeAt16 !== 5) {
  throw new Error('Aggregate replay does not match the frozen report baseline (8/9 top-8, 9/9 overlap and 5/9 exact at top-16).');
}
if (result.metrics.roundRobinInterleave.overlapAt8 !== 9 || result.metrics.roundRobinInterleave.exactRangeAt8 !== 2 || result.metrics.roundRobinInterleave.exactRangeAt16 !== 5) {
  throw new Error('Counterfactual aggregate changed unexpectedly; inspect before relying on the report.');
}
await writeFile(path.join(scriptDir, 'QUERY-RANKING-ABLATION.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ metrics: result.metrics, cases: caseResults.map(({caseId,primaryFirst,roundRobinInterleave})=>({caseId,primaryRank:primaryFirst.firstAnchorOverlapRank,interleavedRank:roundRobinInterleave.firstAnchorOverlapRank,primary8:primaryFirst.overlapAt8,interleaved8:roundRobinInterleave.overlapAt8,exact8:primaryFirst.exactRangeAt8,interleavedExact8:roundRobinInterleave.exactRangeAt8})), report: path.join(scriptDir, 'QUERY-RANKING-ABLATION.json') }, null, 2));
