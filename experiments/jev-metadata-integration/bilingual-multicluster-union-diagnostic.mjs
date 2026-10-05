import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SUITE_ROOT = path.dirname(SCRIPT_PATH);
const FIXTURE_PATH = path.join(SUITE_ROOT, "bilingual-query-seeds.v1.json");
const NATURAL_RUN = "D:\\MSSR-benchmark-artifacts\\jev-natural-query-diagnostic-20261004-0.2.105-v1";
const LIVE_SMOKE = "D:\\MSSR-benchmark-artifacts\\jev-live-smoke-20261004-0.2.105-v1";
const EXPECTED_VERSION = "0.2.105";
const EXPECTED_BUILD_ID = "mssr-build:sha256:58b3d5447d10b847";
const EXPECTED_SOURCE_COMMIT = "0c1ca590d3dcf9a8ba721f6a2975c909e13972c2";
const TOP_K = 20;

const mssrRoot = path.resolve(process.argv[2] || "");
const outputRoot = path.resolve(process.argv[3] || "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("Usage: node bilingual-multicluster-union-diagnostic.mjs <mssr-root> <new-output-root>");
}
if (fs.existsSync(outputRoot)) throw new Error("Output root already exists; choose a fresh immutable run path.");
const isWithin = (root, candidate) => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};
for (const protectedRoot of [mssrRoot, SUITE_ROOT, NATURAL_RUN, LIVE_SMOKE]) {
  if (isWithin(protectedRoot, outputRoot)) {
    throw new Error("Output root must be outside the MSSR checkout, benchmark suite, and frozen inputs.");
  }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const verifySums = (root, expectedCount) => {
  const sumsBytes = fs.readFileSync(path.join(root, "SHA256SUMS"));
  const entries = new Map();
  for (const line of sumsBytes.toString("utf8").trim().split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
    if (!match) throw new Error("Malformed frozen SHA256SUMS line in " + root);
    const relative = match[2].trim();
    const absolute = path.resolve(root, relative);
    if (!isWithin(root, absolute) || entries.has(relative)) throw new Error("Unsafe or duplicate checksum path: " + relative);
    if (hash(fs.readFileSync(absolute)).toLowerCase() !== match[1].toLowerCase()) {
      throw new Error("Frozen source checksum mismatch: " + relative);
    }
    entries.set(relative, match[1].toLowerCase());
  }
  if (entries.size !== expectedCount) throw new Error(`Expected ${expectedCount} checksum entries; observed ${entries.size}.`);
  return { sumsSha256: hash(sumsBytes), entries };
};

// Verify the frozen live-smoke package; no provider request is replayed.
const liveSums = verifySums(LIVE_SMOKE, 11);
const payloadPath = path.join(LIVE_SMOKE, "inputs", "mcp-search-payload.json");
const payloadBytes = fs.readFileSync(payloadPath);
const payload = JSON.parse(payloadBytes.toString("utf8"));
const liveSearchPath = path.join(LIVE_SMOKE, "inputs", "mcp-live-search-results.json");
const liveSearchResults = JSON.parse(fs.readFileSync(liveSearchPath, "utf8"));
const runtimeIdentity = JSON.parse(fs.readFileSync(path.join(LIVE_SMOKE, "inputs", "runtime-build.json"), "utf8"));
const parentRecordCount = payload.documents.reduce((sum, document) => sum + (document.records?.length || 0), 0);
const projectedAtomCount = payload.documents.reduce((sum, document) => sum + (document.evidenceAtoms?.length || 0), 0);
if (parentRecordCount !== 4 || projectedAtomCount !== 4) {
  throw new Error(`Expected the pinned four parent records and four projected atoms; observed ${parentRecordCount}/${projectedAtomCount}.`);
}
const modeDefinitions = [
  { id: "lexical-only", includeRecords: false, includeAtoms: false },
  { id: "parent-records-only", includeRecords: true, includeAtoms: false },
  { id: "evidence-atoms-only", includeRecords: false, includeAtoms: true },
  { id: "parent-records-plus-atoms", includeRecords: true, includeAtoms: true }
];

// Read/hash only the 27 frozen Markdown sources. Never parse old anchors/rankings.
const naturalManifestPath = path.join(NATURAL_RUN, "manifest.json");
const naturalManifestBytes = fs.readFileSync(naturalManifestPath);
const naturalManifest = JSON.parse(naturalManifestBytes.toString("utf8"));
const naturalSumsBytes = fs.readFileSync(path.join(NATURAL_RUN, "SHA256SUMS"));
const diagnosticHash = hash(fs.readFileSync(path.join(NATURAL_RUN, "diagnostic.json")));
const diagnosticSumLine = naturalSumsBytes.toString("utf8").split(/\r?\n/).find((line) => /\sdiagnostic\.json$/.test(line));
if (!diagnosticSumLine || !diagnosticSumLine.startsWith(diagnosticHash)) throw new Error("Frozen query diagnostic checksum mismatch.");
const markdownSources = naturalManifest.files.filter((entry) => entry.path.endsWith(".md")
  && (entry.path.startsWith("inputs/snapshot/.mssr/") || entry.path.startsWith("inputs/snapshot/docs/")));
if (markdownSources.length !== 27 || payload.documents.length !== 27) throw new Error("Expected the same 27-document snapshots.");
const documentsByRef = new Map(payload.documents.map((document) => [document.sourceRef, document]));
const sourceRefs = [];
for (const entry of markdownSources) {
  const sourceRef = entry.path.replace(/^inputs\/snapshot\//, "");
  const sourceBytes = fs.readFileSync(path.join(NATURAL_RUN, entry.path));
  if (hash(sourceBytes) !== entry.sha256) throw new Error("Natural snapshot source hash mismatch: " + sourceRef);
  const document = documentsByRef.get(sourceRef);
  if (!document) throw new Error("Live smoke payload is missing " + sourceRef);
  if (hash(Buffer.from(document.markdown, "utf8")) !== hash(sourceBytes)) throw new Error("Markdown snapshot mismatch: " + sourceRef);
  sourceRefs.push(sourceRef);
}
if (sourceRefs.length !== documentsByRef.size) throw new Error("Live smoke payload has an unexpected source document.");
if (naturalManifest.buildId !== EXPECTED_BUILD_ID || runtimeIdentity.build.id !== EXPECTED_BUILD_ID
  || runtimeIdentity.packageVersion !== EXPECTED_VERSION || naturalManifest.candidateCommit !== EXPECTED_SOURCE_COMMIT) {
  throw new Error("Frozen natural/live artifacts do not match the pinned MSSR .105 identity.");
}

const fixtureBytes = fs.readFileSync(FIXTURE_PATH);
const fixture = JSON.parse(fixtureBytes.toString("utf8"));
assert.equal(fixture.schema, "mssr-bilingual-query-seeds-v1");
assert.equal(fixture.sourceDiagnostic.sha256, diagnosticHash);
assert.deepEqual(fixture.sourceDiagnostic.extractedFields, ["caseId", "language", "queryText"]);
assert.deepEqual(fixture.sourceDiagnostic.excludedFields, ["sourceCluster", "candidateAnchorHeading", "ranking", "labels"]);
assert.deepEqual(Object.keys(fixture).sort(), ["cases", "schema", "sourceDiagnostic"].sort());
const expectedCases = new Set(["C01", "C02", "C04", "C24"]);
assert.equal(fixture.cases.length, 8);
for (const item of fixture.cases) {
  assert.deepEqual(Object.keys(item).sort(), ["caseId", "language", "query"].sort());
  assert(expectedCases.has(item.caseId), "Unexpected query case " + item.caseId);
  assert(["es", "en"].includes(item.language), "Unexpected query language " + item.language);
  assert.equal(typeof item.query, "string");
  assert(item.query.trim().length > 0);
}
for (const caseId of expectedCases) {
  assert.deepEqual(fixture.cases.filter((item) => item.caseId === caseId).map((item) => item.language).sort(), ["en", "es"]);
}

const moduleUrl = pathToFileURL(path.join(mssrRoot, "dist", "librarian-retrieval.js")).href;
const selectorUrl = pathToFileURL(path.join(mssrRoot, "dist", "librarian-jev-selection.js")).href;
const buildUrl = pathToFileURL(path.join(mssrRoot, "dist", "server-build.js")).href;
const { searchMssrLibrarianEvidence, fetchMssrLibrarianEvidence } = await import(moduleUrl);
const { selectMssrLibrarianEvidenceWithJev, MSSR_LIBRARIAN_JEV_SELECTION_LIMITS } = await import(selectorUrl);
const { readMssrServerBuildId } = await import(buildUrl);
const packageVersion = JSON.parse(fs.readFileSync(path.join(mssrRoot, "package.json"), "utf8")).version;
const actualBuild = readMssrServerBuildId(path.join(mssrRoot, "dist"));
if (packageVersion !== EXPECTED_VERSION || actualBuild.status !== "known" || actualBuild.id !== EXPECTED_BUILD_ID) {
  throw new Error("Pinned MSSR .105 build required; observed " + packageVersion + " / " + JSON.stringify(actualBuild));
}
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: mssrRoot, encoding: "utf8" }).trim();

const summarizeCandidate = (item, rank) => ({
  rank,
  handle: item.handle,
  score: item.score,
  exactFetchable: item.exactFetchable,
  rangeCodeUnits: item.rangeCodeUnits,
  ...(item.metadataProjectionMatches?.length ? { metadataProjectionMatches: item.metadataProjectionMatches } : {})
});
const searchCase = (caseId, language, query, mode, documents) => {
  const result = searchMssrLibrarianEvidence({ documents, query: { query, maxResults: TOP_K } });
  const candidates = result.results.map((item, index) => summarizeCandidate(item, index + 1));
  return {
    caseId, language, query, mode,
    advisoryOnly: result.advisoryOnly,
    truthAuthority: result.truthAuthority,
    truncated: result.truncated,
    resultCount: candidates.length,
    uniqueSourceRefs: [...new Set(candidates.map((item) => item.handle.sourceRef))],
    exactFetchableCount: candidates.filter((item) => item.exactFetchable).length,
    oversizedCount: candidates.filter((item) => !item.exactFetchable).length,
    atomProjectedHitCount: candidates.filter((item) => item.metadataProjectionMatches?.length).length,
    candidates
  };
};
const compareTopK = (baseline, comparison) => {
  const before = new Map(baseline.candidates.map((item) => [item.handle.id, item]));
  const after = new Map(comparison.candidates.map((item) => [item.handle.id, item]));
  const shared = [...before.keys()].filter((id) => after.has(id));
  return {
    baselineCount: before.size,
    atomCount: after.size,
    topKOverlap: shared.length,
    baselineOnlyCount: [...before.keys()].filter((id) => !after.has(id)).length,
    atomOnlyCount: [...after.keys()].filter((id) => !before.has(id)).length,
    commonHandleRankChanges: shared.filter((id) => before.get(id).rank !== after.get(id).rank).length
  };
};
const makeUnion = (spanish, english) => {
  const byHandleId = new Map();
  for (const result of [spanish, english]) {
    for (const candidate of result.candidates) {
      const item = byHandleId.get(candidate.handle.id);
      const queryRank = { language: result.language, rank: candidate.rank, score: candidate.score };
      if (item) item.sourceQueryRanks.push(queryRank);
      else byHandleId.set(candidate.handle.id, {
        handle: candidate.handle,
        exactFetchable: candidate.exactFetchable,
        rangeCodeUnits: candidate.rangeCodeUnits,
        sourceQueryRanks: [queryRank]
      });
    }
  }
  return [...byHandleId.values()];
};
const unionSummary = (candidates) => ({
  uniqueHandleCount: candidates.length,
  sharedAcrossLanguages: candidates.filter((item) => item.sourceQueryRanks.length > 1).length,
  addedByEnglishCount: candidates.filter((item) => item.sourceQueryRanks.every((rank) => rank.language === "en")).length,
  uniqueSourceRefs: [...new Set(candidates.map((item) => item.handle.sourceRef))],
  exactFetchableCount: candidates.filter((item) => item.exactFetchable).length,
  oversizedCount: candidates.filter((item) => !item.exactFetchable).length
});

const documentsByMode = Object.fromEntries(modeDefinitions.map((mode) => {
  const documents = payload.documents.map((document) => ({
    ...document,
    records: mode.includeRecords ? (document.records ?? []) : [],
    evidenceAtoms: mode.includeAtoms ? (document.evidenceAtoms ?? []) : []
  }));
  assert.equal(documents.reduce((sum, document) => sum + document.records.length, 0), mode.includeRecords ? 4 : 0);
  assert.equal(documents.reduce((sum, document) => sum + document.evidenceAtoms.length, 0), mode.includeAtoms ? 4 : 0);
  return [mode.id, documents];
}));
const cases = [];
for (const caseId of ["C01", "C02", "C04", "C24"]) {
  const languages = {};
  for (const language of ["es", "en"]) {
    const seed = fixture.cases.find((item) => item.caseId === caseId && item.language === language);
    const runs = Object.fromEntries(modeDefinitions.map((mode) => [mode.id,
      searchCase(caseId, language, seed.query, mode.id, documentsByMode[mode.id])
    ]));
    const lexical = runs["lexical-only"];
    languages[language] = {
      query: seed.query,
      modes: runs,
      comparisons: {
        parentRecordsVsLexical: compareTopK(lexical, runs["parent-records-only"]),
        atomsVsLexical: compareTopK(lexical, runs["evidence-atoms-only"]),
        combinedVsLexical: compareTopK(lexical, runs["parent-records-plus-atoms"]),
        incrementalAtomsWithRecords: compareTopK(runs["parent-records-only"], runs["parent-records-plus-atoms"]),
        incrementalRecordsWithAtoms: compareTopK(runs["evidence-atoms-only"], runs["parent-records-plus-atoms"])
      }
    };
  }
  const unions = Object.fromEntries(modeDefinitions.map((mode) => {
    const candidates = makeUnion(languages.es.modes[mode.id], languages.en.modes[mode.id]);
    return [mode.id, { ...unionSummary(candidates), candidates }];
  }));
  cases.push({
    caseId,
    role: caseId === "C24" ? "separate untagged sidecar-behavior control" : "query cluster; anchors remain unadjudicated",
    languages,
    separateQueryUnions: unions
  });
}

const frozenLiveParity = [];
for (const language of ["es", "en"]) {
  const frozen = liveSearchResults.queries.find((item) => item.caseId === "C01" && item.language === language);
  const fixtureQuery = fixture.cases.find((item) => item.caseId === "C01" && item.language === language)?.query;
  const local = cases.find((item) => item.caseId === "C01").languages[language].modes["parent-records-plus-atoms"];
  if (!frozen || frozen.query !== fixtureQuery || frozen.hits.length !== TOP_K || local.candidates.length !== TOP_K) {
    throw new Error("Frozen live C01 search or query seed did not match the pinned comparison contract.");
  }
  const exactOrderMatches = frozen.hits.every((item, index) => item.handle.id === local.candidates[index].handle.id);
  const exactScoreMatches = frozen.hits.every((item, index) => item.score === local.candidates[index].score);
  if (!exactOrderMatches || !exactScoreMatches) throw new Error("Local combined-metadata C01 search differs from frozen live MCP order/scores.");
  frozenLiveParity.push({ caseId: "C01", language, candidatesCompared: frozen.hits.length, orderedHandleMatches: frozen.hits.length, scoreMatches: frozen.hits.length });
}

const exactFetchIntegrity = [];
for (const caseRun of cases) {
  const atomsOnly = new Set(caseRun.separateQueryUnions["evidence-atoms-only"].candidates.map((item) => item.handle.id));
  const combinedCandidates = caseRun.separateQueryUnions["parent-records-plus-atoms"].candidates;
  const combinedIds = new Set(combinedCandidates.map((item) => item.handle.id));
  assert.equal(atomsOnly.size, combinedIds.size, "Metadata ablations have different union sizes for " + caseRun.caseId);
  assert([...atomsOnly].every((id) => combinedIds.has(id)), "Metadata ablations produced different exact handles for " + caseRun.caseId);
  let fetched = 0;
  for (const candidate of combinedCandidates.filter((item) => item.exactFetchable)) {
    const document = payload.documents.find((item) => item.sourceRef === candidate.handle.sourceRef);
    if (!document) throw new Error("Exact-fetch source snapshot missing for " + candidate.handle.sourceRef);
    const result = fetchMssrLibrarianEvidence({
      handle: candidate.handle,
      owner: document.owner,
      sourceRef: document.sourceRef,
      markdown: document.markdown,
      privacyClass: document.privacyClass
    });
    if (result.handle.id !== candidate.handle.id || result.fingerprint !== candidate.handle.fingerprint
      || result.text.length !== candidate.rangeCodeUnits) {
      throw new Error("Exact-fetch integrity mismatch for " + caseRun.caseId + "/" + candidate.handle.id);
    }
    fetched += 1;
  }
  exactFetchIntegrity.push({
    caseId: caseRun.caseId,
    uniqueCombinedHandles: combinedCandidates.length,
    sameExactHandleSetAsAtomsOnly: true,
    exactFetchableHandles: combinedCandidates.filter((item) => item.exactFetchable).length,
    exactFetchFingerprintChecksPassed: fetched,
    mismatches: 0
  });
}

const selectionPreviews = [];
let offlineStubInvocations = 0;
for (const caseRun of cases) {
  for (const modeId of ["parent-records-plus-atoms"]) {
    const candidates = caseRun.separateQueryUnions[modeId].candidates;
    const unionRefs = [...new Set(candidates.map((item) => item.handle.sourceRef))];
    const unionDocuments = unionRefs.map((sourceRef) => {
      const document = payload.documents.find((item) => item.sourceRef === sourceRef);
      if (!document) throw new Error("No frozen exact-source snapshot for " + sourceRef);
      return { owner: document.owner, sourceRef, markdown: document.markdown, privacyClass: document.privacyClass };
    });
    let calls = 0;
    const requestShapes = [];
    const offlineProvider = {
      async executeSystemOne(request) {
        calls += 1;
        offlineStubInvocations += 1;
        const optionKeys = Object.keys(request.questions.selection.options);
        const choice = optionKeys.find((key) => key !== "none") ?? "none";
        const requestJson = JSON.stringify(request);
        const stateJson = JSON.stringify(request.state);
        const evidenceItems = Array.isArray(request.state?.evidence) ? request.state.evidence : [];
        const aggregateEvidenceCodeUnits = evidenceItems.reduce((sum, item) => sum + (typeof item.text === "string" ? item.text.length : 0), 0);
        const selectionOptionCount = optionKeys.length;
        if (aggregateEvidenceCodeUnits > MSSR_LIBRARIAN_JEV_SELECTION_LIMITS.maxAggregateOptionChars) {
          throw new Error("Offline selector request exceeds the pinned aggregate-evidence character bound.");
        }
        if (selectionOptionCount > MSSR_LIBRARIAN_JEV_SELECTION_LIMITS.maxOptions) {
          throw new Error("Offline selector request exceeds the pinned option-count bound.");
        }
        requestShapes.push({
          requestJsonCodeUnits: requestJson.length,
          stateCodeUnits: stateJson.length,
          evidenceItemCount: evidenceItems.length,
          aggregateEvidenceCodeUnits,
          selectionOptionCount
        });
        return {
          provider: "offline-no-network-stub", model: "offline-no-network-stub",
          answers: {
            selection: { type: "choice", choice, confidence: 0.01 },
            sufficiency: { type: "noul", noul: 0.5 }
          },
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }
    };
    const selection = await selectMssrLibrarianEvidenceWithJev({
      query: caseRun.languages.es.query + " " + caseRun.languages.en.query,
      documents: unionDocuments,
      candidateHandles: candidates.map((item) => item.handle)
    }, offlineProvider);
    if (calls !== selection.providerCalls || calls < 1) throw new Error("Offline selector call accounting failed for " + caseRun.caseId + "/" + modeId);
    selectionPreviews.push({
      caseId: caseRun.caseId,
      mode: modeId,
      status: selection.status,
      selectionMode: selection.selectionMode,
      candidatePoolHandles: candidates.length,
      offered: selection.candidateRangeDiagnostics?.offered,
      eligible: selection.candidateRangeDiagnostics?.eligible,
      oversizedOmitted: selection.candidateRangeDiagnostics?.oversizedOmitted,
      exactFetchRequired: selection.exactFetchRequired,
      uniqueSourceRefs: unionRefs,
      fullSourceDocumentsSuppliedToLocalSelector: unionDocuments.length,
      providerAdapter: "offline-no-network-stub",
      externalProviderCalls: 0,
      stubInvocations: calls,
      stubChoiceIsArbitrary: true,
      requestShapes,
      maxRequestJsonCodeUnits: Math.max(...requestShapes.map((item) => item.requestJsonCodeUnits)),
      maxStateCodeUnits: Math.max(...requestShapes.map((item) => item.stateCodeUnits)),
      maxAggregateEvidenceCodeUnits: Math.max(...requestShapes.map((item) => item.aggregateEvidenceCodeUnits))
    });
  }
}

const packageJsonBytes = fs.readFileSync(path.join(mssrRoot, "package.json"));
const summarizeSearch = (run) => ({
  resultCount: run.resultCount,
  uniqueSourceRefs: run.uniqueSourceRefs.length,
  exactFetchable: run.exactFetchableCount,
  oversized: run.oversizedCount,
  atomProjectedHits: run.atomProjectedHitCount
});
const manifest = {
  schema: "mssr-bilingual-multicluster-union-diagnostic-v3",
  runId: path.basename(outputRoot),
  status: "offline-exploratory-no-provider-no-labels",
  createdAtUtc: new Date().toISOString(),
  runtime: { root: mssrRoot, packageVersion, buildId: actualBuild.id, sourceCommit },
  inputs: {
    naturalDiagnostic: {
      artifactRoot: path.basename(NATURAL_RUN), diagnosticSha256: diagnosticHash,
      manifestSha256: hash(naturalManifestBytes), sha256SumsSha256: hash(naturalSumsBytes),
      markdownDocumentsMatched: markdownSources.length, anchorAndRankingObjectsParsed: false
    },
    liveSmoke: {
      artifactRoot: path.basename(LIVE_SMOKE), sha256SumsSha256: liveSums.sumsSha256,
      checksumEntriesVerified: liveSums.entries.size, searchPayloadSha256: hash(payloadBytes),
      documents: payload.documents.length,
      parentRecords: parentRecordCount,
      evidenceAtoms: projectedAtomCount
    },
    frozenLiveMcpParity: {
      path: "inputs/mcp-live-search-results.json",
      queriesCompared: frozenLiveParity.length,
      candidatesCompared: frozenLiveParity.reduce((sum, item) => sum + item.candidatesCompared, 0),
      allOrderedHandlesAndScoresMatch: true,
      currentRunMcpCalls: 0
    },
    queryFixture: { path: path.basename(FIXTURE_PATH), sha256: hash(fixtureBytes), cases: fixture.cases.length },
    packageJsonSha256: hash(packageJsonBytes)
  },
  design: {
    caseIds: ["C01", "C02", "C04", "C24"], languages: ["es", "en"], topK: TOP_K,
    modes: modeDefinitions.map(({ id, includeRecords, includeAtoms }) => ({ id, includeRecords, includeAtoms })),
    metadataFilters: false,
    controlledDifference: "Only records and evidenceAtoms vary; owner/sourceRef/Markdown/privacy are byte-identical across modes.",
    separateQueryUnionDeduplication: "exact handle.id; preserve per-language ranks; no synthetic union score",
    selectorInputs: ["parent-records-plus-atoms"],
    mcpCalls: 0, networkCalls: 0, externalProviderCalls: 0,
    offlineSelectorStubInvocations: offlineStubInvocations,
    exactFetches: exactFetchIntegrity.reduce((sum, item) => sum + item.exactFetchFingerprintChecksPassed, 0),
    labelsRead: false, anchorOrRankingFieldsRead: false, qualityMetric: null, confidenceCalibration: null
  },
  findings: cases.map((caseRun) => ({
    caseId: caseRun.caseId,
    role: caseRun.role,
    languages: Object.fromEntries(Object.entries(caseRun.languages).map(([language, run]) => [language, {
      modes: Object.fromEntries(Object.entries(run.modes).map(([modeId, modeRun]) => [modeId, summarizeSearch(modeRun)])),
      comparisons: run.comparisons
    }])) ,
    unions: Object.fromEntries(Object.entries(caseRun.separateQueryUnions).map(([modeId, result]) => [modeId, unionSummary(result.candidates)])),
    exactFetchIntegrity: exactFetchIntegrity.find((item) => item.caseId === caseRun.caseId)
  })),
  interpretation: "Frozen-corpus 2x2 metadata-layer retrieval, bilingual candidate fanout, exact-fetchability, and local selector-input mechanics only. Anchors are not read as labels. Candidate counts, metadata matches, rankings, and offline stub choices do not measure relevance, recall, Jev quality, sufficiency, or calibrated confidence. C24 remains a separate untagged control."
};

const unionTable = cases.map((caseRun) => {
  const cell = (modeId) => {
    const item = caseRun.separateQueryUnions[modeId];
    return `${item.uniqueHandleCount}/${item.uniqueSourceRefs.length}/${item.exactFetchableCount}/${item.oversizedCount}`;
  };
  return `| ${caseRun.caseId} | ${cell("lexical-only")} | ${cell("parent-records-only")} | ${cell("evidence-atoms-only")} | ${cell("parent-records-plus-atoms")} |`;
}).join("\n");
const selectorTable = selectionPreviews.map((item) =>
  `| ${item.caseId} | ${item.mode} | ${item.candidatePoolHandles} | ${item.eligible}/${item.offered} | ${item.oversizedOmitted} | ${item.stubInvocations} | ${item.maxStateCodeUnits} | ${item.maxAggregateEvidenceCodeUnits} |`
).join("\n");
const fetchTable = exactFetchIntegrity.map((item) =>
  `| ${item.caseId} | ${item.exactFetchableHandles} | ${item.exactFetchFingerprintChecksPassed} | ${item.mismatches} |`
).join("\n");
const outputs = {
  "search-results.json": { schema: "mssr-bilingual-multicluster-search-results-v3", cases },
  "selection-preview.json": { schema: "mssr-bilingual-multicluster-selection-preview-v3", previews: selectionPreviews },
  "exact-fetch-integrity.json": { schema: "mssr-bilingual-multicluster-exact-fetch-integrity-v1", cases: exactFetchIntegrity },
  "live-mcp-parity.json": { schema: "mssr-bilingual-multicluster-frozen-live-parity-v1", cases: frozenLiveParity },
  "manifest.json": manifest,
  "README.md": `# MSSR bilingual multi-cluster union diagnostic\n\nStatus: offline exploratory mechanics check. It runs eight frozen Spanish/English queries for C01, C02, C04, and separately reports untagged C24 as a control over the same 27 exact Markdown documents. It compares a 2×2 design: lexical only, parent records only, projected EvidenceAtoms only, and both metadata layers together. Only the records/atoms arrays vary; the source snapshots and other document fields stay fixed. No metadata filters are applied.\n\nThe seed fixture contains only case ID, language, and query text. Its source is the hash-pinned natural-query diagnostic; this runner checks that diagnostic's hash but never parses prior results, candidate anchors, or rankings. It verifies all 11 live-smoke input hashes and byte-matches the 27 source Markdown files against the pinned natural snapshot. It compares the combined-metadata C01 local search against the frozen direct-MCP observations: both 20-handle orders and scores must match exactly. This runner itself makes no MCP calls.\n\nEach language is searched independently at top ${TOP_K}; separate-query unions deduplicate by exact handle ID and preserve source-language ranks without assigning a union score.\n\nUnion summary columns are unique handles / source refs / exact-fetchable / oversized:\n\n| Case | lexical only | parent records | atoms only | records + atoms |\n| --- | ---: | ---: | ---: | ---: |\n${unionTable}\n\nAll exact-fetchable handles from the combined metadata unions were fetched against the frozen source snapshots. Handle IDs, fingerprints, and returned code-unit lengths matched; the atoms-only union had the same exact handle set in each cluster.\n\nThe four combined unions are passed to the local .105 selector with a no-network stub. The stub choice and confidence are arbitrary. Request sizes and omission counts are mechanics only:\n\n| Case | Mode | Pool | Eligible/offered | Oversized | Stub calls | Max state chars | Max evidence chars |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${selectorTable}\n\nExact-fetch verification:\n\n| Case | Fetchable | Fingerprints checked | Mismatches |\n| --- | ---: | ---: | ---: |\n${fetchTable}\n\nThis run can show layer-specific ranking deltas, candidate fanout, fetchability, and selector bounds. It cannot show relevance or quality: anchors remain unadjudicated, no labels are read, and no live Jev/provider/MCP/network call is made. Do not use these counts to enable ranking changes or confidence thresholds.\n\nSee ` + "`manifest.json`" + `, ` + "`live-mcp-parity.json`" + `, and ` + "`SHA256SUMS`" + ` for pinned identities and output integrity.\n`
};

fs.mkdirSync(outputRoot, { recursive: true });
for (const [name, value] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outputRoot, name), typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n", "utf8");
}
const outputFiles = Object.keys(outputs).sort();
fs.writeFileSync(path.join(outputRoot, "SHA256SUMS"), outputFiles
  .map((name) => hash(fs.readFileSync(path.join(outputRoot, name))) + "  " + name).join("\n") + "\n", "utf8");

console.log(JSON.stringify({
  runId: manifest.runId, outputRoot,
  runtime: { packageVersion, buildId: actualBuild.id, sourceCommit },
  cases: cases.map((caseRun) => ({
    caseId: caseRun.caseId,
    rankings: Object.fromEntries(Object.entries(caseRun.languages).map(([language, run]) => [language, run.comparisons])),
    unions: Object.fromEntries(Object.entries(caseRun.separateQueryUnions).map(([modeId, union]) => [modeId, {
      handles: union.uniqueHandleCount, sourceRefs: union.uniqueSourceRefs.length,
      fetchable: union.exactFetchableCount, oversized: union.oversizedCount
    }])),
    exactFetchIntegrity: exactFetchIntegrity.find((item) => item.caseId === caseRun.caseId)
  })),
  frozenLiveParity,
  selectorPreviews: selectionPreviews.map((item) => ({
    caseId: item.caseId, mode: item.mode, status: item.status, selectionMode: item.selectionMode,
    offered: item.offered, eligible: item.eligible, oversized: item.oversizedOmitted,
    calls: item.stubInvocations, maxStateCodeUnits: item.maxStateCodeUnits,
    maxAggregateEvidenceCodeUnits: item.maxAggregateEvidenceCodeUnits,
    maxRequestJsonCodeUnits: item.maxRequestJsonCodeUnits
  })),
  externalProviderCalls: 0, networkCalls: 0, offlineSelectorStubInvocations: offlineStubInvocations,
  labelsRead: false, anchorAndRankingFieldsRead: false
}, null, 2));
