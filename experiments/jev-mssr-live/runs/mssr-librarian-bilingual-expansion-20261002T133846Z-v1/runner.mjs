import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { searchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";
import { foldMssrLibrarianSearchText } from "../../../../dist/librarian-text-normalization.js";

const runRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(runRoot, "../../../../");
const inputRoot = resolve(runRoot, "inputs");
const baselineRoot = resolve(repoRoot, "experiments/jev-mssr-live/runs/mssr-librarian-bilingual-retrieval-20260930-v1");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const runId = "mssr-librarian-bilingual-expansion-20261002T133846Z-v1";

function hashFile(path) { return sha256(readFileSync(path)); }
function git(args) { return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim(); }
function tokenize(value) {
  return [...new Set((foldMssrLibrarianSearchText(value).match(/[\p{L}\p{N}][\p{L}\p{N}_-]{1,}/gu) ?? []))];
}
function buildLexicon(pairs) {
  const byLanguage = { en: new Map(), es: new Map() };
  for (const [en, es] of pairs) {
    const enKey = foldMssrLibrarianSearchText(en);
    const esKey = foldMssrLibrarianSearchText(es);
    if (byLanguage.en.has(enKey) || byLanguage.es.has(esKey)) {
      throw new Error(`Ambiguous one-to-one lexicon entry: ${en} / ${es}`);
    }
    byLanguage.en.set(enKey, es);
    byLanguage.es.set(esKey, en);
  }
  return byLanguage;
}
function rewriteQuery(query, language, byLanguage) {
  let replacements = 0;
  const rewritten = query.replace(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu, (surface) => {
    const replacement = byLanguage[language].get(foldMssrLibrarianSearchText(surface));
    if (!replacement) return surface;
    replacements += 1;
    return replacement;
  });
  return { rewritten, replacements, tokenCount: tokenize(query).length };
}
function compactResults(results) {
  return results.map((result, index) => ({
    rank: index + 1,
    handle: result.handle,
    title: result.title,
    headingPath: result.headingPath,
    score: result.score,
  }));
}
function fuseResults(left, right) {
  const byId = new Map();
  for (const [branch, results] of [["baseline", left], ["lexicon", right]]) {
    for (const result of results) {
      const existing = byId.get(result.handle.id);
      const branchRanks = { ...(existing?.branchRanks ?? {}), [branch]: result.rank };
      byId.set(result.handle.id, {
        handle: result.handle,
        title: result.title,
        headingPath: result.headingPath,
        score: Math.max(existing?.score ?? 0, result.score),
        bestRank: Math.min(existing?.bestRank ?? Number.POSITIVE_INFINITY, result.rank),
        branchRanks,
      });
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank
      || a.handle.owner.localeCompare(b.handle.owner)
      || a.handle.sourceRef.localeCompare(b.handle.sourceRef)
      || a.handle.startOffset - b.handle.startOffset
      || a.handle.id.localeCompare(b.handle.id))
    .slice(0, 100)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
function validateFrozenInputs() {
  const manifest = readJson(resolve(runRoot, "manifest.json"));
  for (const [path, expected] of Object.entries(manifest.inputs)) {
    if (hashFile(resolve(runRoot, path)) !== expected.sha256) throw new Error(`Frozen input changed: ${path}`);
  }
  if (hashFile(resolve(runRoot, "runner.mjs")) !== manifest.instrument.runnerSha256) throw new Error("Frozen runner changed after manifest creation.");
  if (hashFile(resolve(runRoot, "score.mjs")) !== manifest.instrument.scorerSha256) throw new Error("Frozen scorer changed after manifest creation.");
  if (git(["rev-parse", "HEAD"]) !== manifest.source.gitCommit) throw new Error("Source commit changed since this run was prepared.");
  for (const artifact of manifest.source.buildArtifacts) {
    if (hashFile(resolve(repoRoot, artifact.path)) !== artifact.sha256) throw new Error(`Build/source artifact changed: ${artifact.path}`);
  }
  return manifest;
}

function prepare() {
  if (existsSync(resolve(runRoot, "manifest.json"))) throw new Error("A prepared run already exists; never overwrite it.");
  const historicalManifest = readJson(resolve(baselineRoot, "manifest.json"));
  const snapshotNames = ["cases.json", "labels.json", "corpus.json", "target-index.json"];
  for (const name of snapshotNames) {
    const sourcePath = resolve(baselineRoot, "inputs", name);
    const expected = historicalManifest.files[`inputs/${name}`];
    if (!expected || hashFile(sourcePath) !== expected) throw new Error(`Historical frozen input failed its recorded hash: ${name}`);
    writeFileSync(resolve(inputRoot, name), readFileSync(sourcePath));
  }
  const requiredSources = [
    "package.json", "package-lock.json", "src/librarian-retrieval.ts", "src/librarian-text-normalization.ts", "src/document-surface.ts",
    "dist/librarian-retrieval.js", "dist/librarian-text-normalization.js", "dist/document-surface.js",
  ];
  const buildArtifacts = requiredSources.map((path) => ({ path, sha256: hashFile(resolve(repoRoot, path)) }));
  const gitCommit = git(["rev-parse", "HEAD"]);
  const statusLines = git(["status", "--porcelain", "--untracked-files=all"]).split(/\r?\n/).filter(Boolean);
  const relativeRun = relative(repoRoot, runRoot).split(sep).join("/");
  const outsideRunChanges = statusLines.filter((line) => !line.slice(3).replace(/\\/g, "/").startsWith(relativeRun));
  const cases = readJson(resolve(inputRoot, "cases.json"));
  const corpus = readJson(resolve(inputRoot, "corpus.json"));
  const oldHoldout = historicalManifest.split.sourceRefs;
  const paths = ["inputs/cases.json", "inputs/labels.json", "inputs/corpus.json", "inputs/target-index.json", "inputs/expansion-lexicon.json"];
  const inputs = Object.fromEntries(paths.map((path) => [path, { sha256: hashFile(resolve(runRoot, path)), bytes: readFileSync(resolve(runRoot, path)).length }]));
  const manifest = {
    schemaVersion: 1,
    suite: "mssr-librarian-bilingual-lexical-query-rewrite-v1",
    runId,
    createdAt: "2026-10-02T13:38:46Z",
    status: "prepared",
    evaluationClass: "exploratory-repeated-on-previously-opened-corpus-and-holdout",
    parentRunId: historicalManifest.runId,
    source: {
      repository: "MSSR",
      gitCommit,
      workingTreeClean: false,
      sourceWorkingTreeCleanOutsideThisRun: outsideRunChanges.length === 0,
      changedPaths: [relativeRun],
      buildId: "mssr-build:sha256:bc288853f02be406",
      buildArtifacts,
    },
    instrument: {
      runnerPath: `${relativeRun}/runner.mjs`,
      runnerSha256: hashFile(resolve(runRoot, "runner.mjs")),
      scorerPath: `${relativeRun}/score.mjs`,
      scorerSha256: hashFile(resolve(runRoot, "score.mjs")),
      requestSchemaVersion: 1,
      maxResultsPerSearch: 100,
      lexiconPath: "inputs/expansion-lexicon.json",
      merge: "deduplicate exact handles; take max lexical score across baseline/rewrite; tie-break by best branch rank then stable source/range order; truncate to 100",
    },
    corpus: {
      snapshotPath: "inputs/corpus.json",
      sha256: inputs["inputs/corpus.json"].sha256,
      items: corpus.documents.length,
      sourceRevision: corpus.sourceCommit,
      redaction: "not-applicable",
    },
    inputs,
    provider: { mode: "offline", provider: "none", endpointIdentity: null, requestedModel: null, sdk: null, timeoutMs: 0, maxRetries: 0, concurrency: 1, networkOptIn: false, jevCalls: 0 },
    labels: {
      source: "independent-review",
      frozenAt: historicalManifest.createdAt,
      adjudication: "none",
      labelFile: "inputs/labels.json",
      labelFileSha256: inputs["inputs/labels.json"].sha256,
      exposedToRequests: false,
      note: "Prediction stage validates this file's hash but does not parse or consult label contents; a separate scorer reads labels after predictions are frozen. Prior run already opened these labels, so all results remain exploratory.",
    },
    split: {
      method: historicalManifest.split.method,
      sourceRefs: oldHoldout,
      holdoutOpenedAt: historicalManifest.createdAt,
      holdoutUsedForTuning: false,
      status: "previously-opened-exploratory-only",
    },
    plan: {
      primaryMetric: "exact expected Markdown section recall@100 by query language",
      secondaryMetrics: ["recall@1", "recall@5", "MRR@100", "target absence", "returned candidate count", "lexicon translation coverage"],
      thresholds: {},
      independentUnit: "query-target source document; 26 query pairs over 21 documents",
      minimumSupport: { overall: 30, perClaimedSubgroup: 30 },
      uncertaintyMethod: "descriptive counts only; no inferential or calibration claim",
      variants: ["current-search-baseline", "lexicon-query-rewrite", "paired-language-query-reference", "baseline-plus-rewrite-score-max-merge"],
      limitations: ["Single project corpus and author/model-assisted exact-heading labels; no human owner adjudication.", "The paired-language query is a reference diagnostic, not a deployable translation method.", "The holdout was already evaluated in the parent run and cannot support a confirmatory claim."],
    },
  };
  if (cases.cases.length !== 26) throw new Error(`Expected 26 frozen query pairs, got ${cases.cases.length}.`);
  writeJson(resolve(runRoot, "manifest.json"), manifest);
  process.stdout.write(JSON.stringify({ status: "prepared", runId, cases: cases.cases.length, corpusDocuments: corpus.documents.length, outsideRunChanges, inputHashes: inputs }) + "\n");
}

function predict() {
  if (existsSync(resolve(runRoot, "predictions.json"))) throw new Error("Predictions already exist; never overwrite frozen run output.");
  const manifest = validateFrozenInputs();
  const cases = readJson(resolve(inputRoot, "cases.json")).cases;
  const corpus = readJson(resolve(inputRoot, "corpus.json"));
  const lexicon = readJson(resolve(inputRoot, "expansion-lexicon.json"));
  const byLanguage = buildLexicon(lexicon.pairs);
  const documents = corpus.documents.map(({ owner, sourceRef, markdown, privacyClass }) => ({ owner, sourceRef, markdown, privacyClass }));
  const records = [];
  let searchCalls = 0;
  for (const item of cases) {
    for (const language of ["en", "es"]) {
      const query = item[language];
      const peerQuery = item[language === "en" ? "es" : "en"];
      const rewrite = rewriteQuery(query, language, byLanguage);
      const runSearch = (text) => {
        searchCalls += 1;
        const result = searchMssrLibrarianEvidence({ documents, query: { query: text, maxResults: 100, maxSnippetChars: 80 } });
        return { results: compactResults(result.results), truncated: result.truncated };
      };
      const baseline = runSearch(query);
      const lexicon = runSearch(rewrite.rewritten);
      const paired = runSearch(peerQuery);
      records.push({
        caseId: item.id,
        language,
        query,
        lexiconQuery: rewrite.rewritten,
        lexiconReplacements: rewrite.replacements,
        queryTokenCount: rewrite.tokenCount,
        peerLanguageQuery: peerQuery,
        baseline,
        lexiconRewrite: lexicon,
        pairedLanguageReference: paired,
        fused: { results: fuseResults(baseline.results, lexicon.results), truncated: baseline.truncated || lexicon.truncated, uniqueCandidates: new Set([...baseline.results, ...lexicon.results].map((result) => result.handle.id)).size },
      });
    }
  }
  if (searchCalls !== 156) throw new Error(`Unexpected search-call count: ${searchCalls}.`);
  const predictions = { schemaVersion: 1, runId, sourceCommit: manifest.source.gitCommit, providerCalls: 0, jevCalls: 0, searchCalls, labelContentsConsulted: false, labelHashVerified: true, records };
  writeJson(resolve(runRoot, "predictions.json"), predictions);
  process.stdout.write(JSON.stringify({ status: "predictions-frozen", runId, records: records.length, searchCalls, labelContentsConsulted: false, jevCalls: 0 }) + "\n");
}

function finalize() {
  validateFrozenInputs();
  const predictions = readJson(resolve(runRoot, "predictions.json"));
  const evaluation = readJson(resolve(runRoot, "evaluation.json"));
  if (predictions.records.length !== 52 || predictions.searchCalls !== 156 || evaluation.runId !== runId) throw new Error("Run outputs do not meet the frozen completion plan.");
  const required = ["manifest.json", "runner.mjs", "score.mjs", "REPORT.md", "evaluation.json", "predictions.json", "inputs/cases.json", "inputs/labels.json", "inputs/corpus.json", "inputs/target-index.json", "inputs/expansion-lexicon.json", ".gitattributes"];
  const completion = {
    schemaVersion: 1,
    runId,
    manifestSha256: hashFile(resolve(runRoot, "manifest.json")),
    completedAt: new Date().toISOString(),
    status: "complete",
    expectedSearchCalls: 156,
    attemptedSearchCalls: predictions.searchCalls,
    successfulSearchCalls: predictions.searchCalls,
    failedSearchCalls: 0,
    providerRequests: 0,
    jevRequests: 0,
    labelsExposedToRequests: false,
    evaluationLabelReadAfterPredictions: true,
    files: required,
  };
  writeJson(resolve(runRoot, "run-completion.json"), completion);
  const allFiles = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name !== "SHA256SUMS") allFiles.push(path);
    }
  };
  visit(runRoot);
  const lines = allFiles.sort().map((path) => `${hashFile(path)}  ${relative(runRoot, path).split(sep).join("/")}`);
  writeFileSync(resolve(runRoot, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(JSON.stringify({ status: "complete", runId, files: lines.length, manifestSha256: completion.manifestSha256 }) + "\n");
}

function verify() {
  const sums = readFileSync(resolve(runRoot, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  const failures = [];
  for (const line of sums) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) { failures.push(`malformed: ${line}`); continue; }
    if (!existsSync(resolve(runRoot, match[2])) || hashFile(resolve(runRoot, match[2])) !== match[1]) failures.push(match[2]);
  }
  if (failures.length) throw new Error(`SHA-256 verification failed: ${failures.join(", ")}`);
  const completion = readJson(resolve(runRoot, "run-completion.json"));
  if (hashFile(resolve(runRoot, "manifest.json")) !== completion.manifestSha256) throw new Error("Manifest hash in completion receipt does not match.");
  process.stdout.write(JSON.stringify({ status: "checksums-ok", files: sums.length, runId }) + "\n");
}

if (process.argv.includes("--prepare")) prepare();
else if (process.argv.includes("--predict")) predict();
else if (process.argv.includes("--finalize")) finalize();
else if (process.argv.includes("--verify")) verify();
else throw new Error("Expected --prepare, --predict, --finalize, or --verify.");
