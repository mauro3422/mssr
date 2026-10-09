import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMssrMarkdownDocumentSurface } from "../../../../dist/document-surface.js";
import { fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";

const runRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(runRoot, "../../../../");
const inputRoot = resolve(runRoot, "inputs");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (name) => JSON.parse(readFileSync(resolve(inputRoot, name), "utf8"));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
const cases = json("cases.json");
const labels = json("labels.json");
const queryCases = cases.cases;
const targetLabels = labels.cases;
const owner = "D:/Dev/mssr";

function safeSourcePath(sourceRef) {
  if (sourceRef.startsWith("/") || sourceRef.includes("\\") || sourceRef.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Unsafe sourceRef in label file: ${sourceRef}`);
  }
  return resolve(repoRoot, sourceRef);
}

function validateCaseInventory() {
  const ids = queryCases.map((item) => item.id);
  if (ids.length !== 26 || new Set(ids).size !== ids.length) throw new Error("Expected 26 unique frozen cases.");
  if (JSON.stringify([...ids].sort()) !== JSON.stringify(Object.keys(targetLabels).sort())) throw new Error("Case and target-label inventories differ.");
  if (JSON.stringify([...cases.excludedCaseIds].sort()) !== JSON.stringify(["05", "07", "11", "14"])) throw new Error("Ambiguous exclusions changed.");
  if (queryCases.some((item) => !item.en || !item.es || item.en.length > 500 || item.es.length > 500)) throw new Error("A query is missing or exceeds the tool limit.");
}

function freezeCorpus() {
  validateCaseInventory();
  const sourceRefs = [...new Set(Object.values(targetLabels).map((item) => item.sourceRef))].sort();
  if (sourceRefs.length !== 21) throw new Error(`Expected 21 unique source documents, found ${sourceRefs.length}.`);
  const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const documents = sourceRefs.map((sourceRef) => {
    const status = execFileSync("git", ["status", "--porcelain", "--", sourceRef], { cwd: repoRoot, encoding: "utf8" }).trim();
    if (status) throw new Error(`Refusing to freeze a modified source document: ${sourceRef}`);
    const markdown = readFileSync(safeSourcePath(sourceRef), "utf8");
    const surface = buildMssrMarkdownDocumentSurface({ sourceRef, markdown });
    return { owner, sourceRef, markdown, privacyClass: "project-metadata", revision: surface.revision, sha256: sha256(markdown) };
  });
  const byRef = new Map(documents.map((item) => [item.sourceRef, item]));
  const targetIndex = {};
  for (const [caseId, label] of Object.entries(targetLabels)) {
    const document = byRef.get(label.sourceRef);
    if (!document) throw new Error(`Missing frozen source for case ${caseId}.`);
    const surface = buildMssrMarkdownDocumentSurface({ sourceRef: label.sourceRef, markdown: document.markdown });
    const matches = surface.headings.filter((heading) => heading.title === label.targetHeading);
    if (matches.length !== 1) throw new Error(`Target heading must be unique for case ${caseId}; found ${matches.length}: ${label.targetHeading}`);
    targetIndex[caseId] = { sourceRef: label.sourceRef, targetHeading: label.targetHeading, targetHeadingPath: matches[0].headingPath, targetRangeId: matches[0].id, targetFingerprint: matches[0].fingerprint };
  }
  mkdirSync(inputRoot, { recursive: true });
  writeJson(resolve(inputRoot, "corpus.json"), { schemaVersion: 1, sourceCommit: gitCommit, frozenAt: new Date().toISOString(), documents });
  writeJson(resolve(inputRoot, "target-index.json"), { schemaVersion: 1, targetIndex });
  process.stdout.write(JSON.stringify({ sourceCommit: gitCommit, documents: documents.length, cases: Object.keys(targetIndex).length, corpusSha256: sha256(readFileSync(resolve(inputRoot, "corpus.json"))) }) + "\n");
}

function holdoutSelection(sourceRefs) {
  const sorted = [...sourceRefs].sort((a, b) => sha256(a).localeCompare(sha256(b)) || a.localeCompare(b));
  const count = Math.ceil(sorted.length * 0.2);
  return sorted.slice(0, count);
}

function summarize(rows) {
  const count = rows.length;
  const hits1 = rows.filter((item) => item.targetRank === 1).length;
  const hits5 = rows.filter((item) => item.targetRank !== null && item.targetRank <= 5).length;
  const reciprocalRankSum = rows.reduce((sum, item) => sum + (item.targetRank === null ? 0 : 1 / item.targetRank), 0);
  const exactFetchChecks = rows.reduce((sum, item) => sum + item.topFiveFetchChecks, 0);
  const exactFetchPasses = rows.reduce((sum, item) => sum + item.topFiveFetchPasses, 0);
  const fetchStatuses = rows.flatMap((item) => item.topFiveFetchResults.map((result) => result.status));
  return {
    queries: count,
    expectedSectionRecallAt1: count ? Number((hits1 / count).toFixed(6)) : null,
    expectedSectionRecallAt5: count ? Number((hits5 / count).toFixed(6)) : null,
    expectedSectionMrrAt100: count ? Number((reciprocalRankSum / count).toFixed(6)) : null,
    targetNotReturnedInTop100: rows.filter((item) => item.targetRank === null).length,
    truncatedQueries: rows.filter((item) => item.truncated).length,
    topFiveExactFetchChecks: exactFetchChecks,
    topFiveExactFetchPasses: exactFetchPasses,
    topFiveFetchRejectedBySizeLimit: fetchStatuses.filter((status) => status === "limit-exceeded").length,
    topFiveFetchIntegrityFailures: fetchStatuses.filter((status) => ["source-missing", "range-mismatch", "rejected"].includes(status)).length,
  };
}

function runBenchmark() {
  validateCaseInventory();
  const corpus = json("corpus.json");
  const targetIndex = json("target-index.json").targetIndex;
  if (corpus.documents.length !== 21) throw new Error(`Frozen corpus has ${corpus.documents.length} documents, expected 21.`);
  const markdownByRef = new Map(corpus.documents.map((item) => [item.sourceRef, item]));
  const docs = corpus.documents.map(({ owner: docOwner, sourceRef, markdown, privacyClass }) => ({ owner: docOwner, sourceRef, markdown, privacyClass }));
  const holdoutRefs = holdoutSelection(corpus.documents.map((item) => item.sourceRef));
  const holdoutSet = new Set(holdoutRefs);
  const records = [];

  for (const item of queryCases) {
    for (const language of ["en", "es"]) {
      const query = item[language];
      const label = targetIndex[item.id];
      if (!label) throw new Error(`Missing target index for case ${item.id}.`);
      const search = searchMssrLibrarianEvidence({ documents: docs, query: { query, maxResults: 100, maxSnippetChars: 80 } });
      const targetRank = search.results.findIndex((result) => result.handle.sourceRef === label.sourceRef
        && JSON.stringify(result.headingPath) === JSON.stringify(label.targetHeadingPath));
      const rankedTarget = targetRank >= 0 ? targetRank + 1 : null;
      const topFive = search.results.slice(0, 5);
      let topFiveFetchPasses = 0;
      const topFiveFetchResults = [];
      for (const result of topFive) {
        const source = markdownByRef.get(result.handle.sourceRef);
        if (!source) {
          topFiveFetchResults.push({ rank: topFiveFetchResults.length + 1, status: "source-missing" });
          continue;
        }
        try {
          const exact = fetchMssrLibrarianEvidence({ handle: result.handle, owner: source.owner, sourceRef: source.sourceRef, markdown: source.markdown, privacyClass: source.privacyClass });
          const exactMatch = exact.fingerprint === result.handle.fingerprint && exact.text.length === result.handle.endOffset - result.handle.startOffset;
          if (exactMatch) topFiveFetchPasses += 1;
          topFiveFetchResults.push({ rank: topFiveFetchResults.length + 1, status: exactMatch ? "ok" : "range-mismatch" });
        } catch (error) {
          // Preserve a bounded failure reason so size limits can be separated from stale or invalid handles.
          const reason = String(error?.message ?? error).slice(0, 200);
          topFiveFetchResults.push({ rank: topFiveFetchResults.length + 1, status: /exceeds fetch size limit/i.test(reason) ? "limit-exceeded" : "rejected", reason });
        }
      }
      records.push({
        caseId: item.id,
        language,
        query,
        targetSourceRef: label.sourceRef,
        targetHeadingPath: label.targetHeadingPath,
        split: holdoutSet.has(label.sourceRef) ? "grouped-holdout" : "development",
        targetRank: rankedTarget,
        returnedCount: search.results.length,
        truncated: search.truncated,
        topFiveFetchChecks: topFive.length,
        topFiveFetchPasses: topFiveFetchPasses,
        topFiveFetchResults,
        top100: search.results.map((result, index) => ({ rank: index + 1, sourceRef: result.handle.sourceRef, headingPath: result.headingPath, score: result.score, handleId: result.handle.id })),
      });
    }
  }

  const metrics = {};
  for (const language of ["en", "es"]) {
    const localeRows = records.filter((item) => item.language === language);
    metrics[language] = {
      all: summarize(localeRows),
      development: summarize(localeRows.filter((item) => item.split === "development")),
      groupedHoldout: summarize(localeRows.filter((item) => item.split === "grouped-holdout")),
    };
  }

  const failures = records.reduce((sum, row) => sum + row.topFiveFetchResults.filter((result) => ["source-missing", "range-mismatch", "rejected"].includes(result.status)).length, 0);
  const sizeLimitRejections = records.reduce((sum, row) => sum + row.topFiveFetchResults.filter((result) => result.status === "limit-exceeded").length, 0);
  const sourceStatus = execFileSync("git", ["status", "--porcelain", "--", ...corpus.documents.map((item) => item.sourceRef)], { cwd: repoRoot, encoding: "utf8" }).trim();
  if (sourceStatus) throw new Error("Frozen corpus source files changed after the snapshot was captured.");
  const retrievalPath = resolve(repoRoot, "dist/librarian-retrieval.js");
  const surfacePath = resolve(repoRoot, "dist/document-surface.js");
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const rowsPayload = { schemaVersion: 1, records };
  const summary = {
    schemaVersion: 1,
    runId: "mssr-librarian-bilingual-retrieval-20260930-v1",
    status: failures === 0 ? "complete" : "verification-failed",
    implementation: "MSSR dist/librarian-retrieval.js (same searchMssrLibrarianEvidence function wired by semantic-evidence-mcp.ts; no Jev retrieval call)",
    packageVersion: packageJson.version,
    gitCommit,
    sourceCommit: corpus.sourceCommit,
    sourceDocs: corpus.documents.length,
    queryCases: queryCases.length,
    queryRuns: records.length,
    relevantUnit: "expected Markdown section; queries grouped by target sourceRef",
    groupedHoldout: { method: "sort unique sourceRefs by SHA-256 and reserve ceil(20%) before scoring; no tuning performed", sourceRefs: holdoutRefs },
    metrics,
    limitations: [
      "This is a deterministic lexical Librarian baseline; Jev was not part of retrieval or reranking.",
      "Labels were created/reviewed by two Luna agents and were not approved by a human corpus owner.",
    "Metrics characterize only these 26 English and 26 Spanish queries over the 21 frozen MSSR documents.",
      "MRR is bounded by the tool's maxResults=100; a target absent from top 100 is counted as zero.",
      "Exact-fetch checks validate handle/fingerprint/range integrity for returned top-five candidates; they do not prove answer completeness or semantic correctness.",
    ],
  };

  const recordsPath = resolve(runRoot, "records.json");
  const summaryPath = resolve(runRoot, "summary.json");
  writeJson(recordsPath, rowsPayload);
  writeJson(summaryPath, summary);
  const runFiles = ["inputs/cases.json", "inputs/labels.json", "inputs/corpus.json", "inputs/target-index.json", "runner.mjs", "records.json", "summary.json"];
  const manifest = {
    schemaVersion: 1,
    suite: "mssr-librarian-bilingual-retrieval-v1",
    runId: summary.runId,
    createdAt: new Date().toISOString(),
    status: summary.status,
    source: {
      repository: "MSSR",
      gitCommit,
      sourceCommit: corpus.sourceCommit,
      workingTreeClean: execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim() === "",
      retrievalAndSourceCodeClean: !sourceStatus,
      buildArtifacts: [
        { path: "dist/librarian-retrieval.js", sha256: sha256(readFileSync(retrievalPath)) },
        { path: "dist/document-surface.js", sha256: sha256(readFileSync(surfacePath)) },
      ],
    },
    runtime: process.version,
    inputs: {
      corpusDocuments: corpus.documents.length,
      corpusSha256: sha256(readFileSync(resolve(inputRoot, "corpus.json"))),
      caseCount: queryCases.length,
      casesSha256: sha256(readFileSync(resolve(inputRoot, "cases.json"))),
      labelsSha256: sha256(readFileSync(resolve(inputRoot, "labels.json"))),
      targetIndexSha256: sha256(readFileSync(resolve(inputRoot, "target-index.json"))),
    },
    execution: {
      searchCalls: records.length,
      exactFetchChecks: records.reduce((sum, item) => sum + item.topFiveFetchChecks, 0),
      exactFetchPassed: records.reduce((sum, item) => sum + item.topFiveFetchPasses, 0),
      exactFetchSizeLimitRejections: sizeLimitRejections,
      exactFetchIntegrityFailures: failures,
      jevCalls: 0,
      maxResults: 100,
    },
    split: summary.groupedHoldout,
    files: Object.fromEntries(runFiles.map((name) => [name, sha256(readFileSync(resolve(runRoot, name)))])),
    summarySha256: sha256(readFileSync(summaryPath)),
    recordsSha256: sha256(readFileSync(recordsPath)),
  };
  writeJson(resolve(runRoot, "manifest.json"), manifest);
  const allFiles = [];
  const visit = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.name !== "SHA256SUMS") allFiles.push(child);
    }
  };
  visit(runRoot);
  const sums = allFiles.sort().map((path) => `${sha256(readFileSync(path))}  ${relative(runRoot, path).split(sep).join("/")}`).join("\n") + "\n";
  writeFileSync(resolve(runRoot, "SHA256SUMS"), sums, "utf8");
  process.stdout.write(JSON.stringify({ status: summary.status, runId: summary.runId, metrics, exactFetchIntegrityFailures: failures, exactFetchSizeLimitRejections: sizeLimitRejections, holdoutRefs }) + "\n");
  if (failures > 0) process.exitCode = 1;
}

function verifyChecksums() {
  const sums = readFileSync(resolve(runRoot, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  const failures = [];
  for (const row of sums) {
    const match = row.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) { failures.push(`malformed line: ${row}`); continue; }
    const actual = sha256(readFileSync(resolve(runRoot, match[2])));
    if (actual !== match[1]) failures.push(match[2]);
  }
  if (failures.length) throw new Error(`SHA256 verification failed: ${failures.join(", ")}`);
  process.stdout.write(JSON.stringify({ status: "checksums-ok", files: sums.length }) + "\n");
}

if (process.argv.includes("--freeze")) freezeCorpus();
else if (process.argv.includes("--verify")) verifyChecksums();
else runBenchmark();
