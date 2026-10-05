import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const mssrRoot = path.resolve(process.argv[2] || "");
const outputRoot = path.resolve(process.argv[3] || "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("Usage: node bilingual-query-expansion-diagnostic.mjs <mssr-root> <new-output-root>");
}
if (fs.existsSync(outputRoot)) throw new Error("Output root already exists; choose a fresh immutable run path.");
const sourceRun = "D:\\MSSR-benchmark-artifacts\\jev-live-smoke-20261004-0.2.105-v1";
const isWithin = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};
if (isWithin(mssrRoot, outputRoot) || isWithin(sourceRun, outputRoot)) {
  throw new Error("Output root must be outside the MSSR checkout and frozen source run.");
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
const inputs = path.join(sourceRun, "inputs");
const payloadPath = path.join(inputs, "mcp-search-payload.json");
const sourceSumsPath = path.join(sourceRun, "SHA256SUMS");
const sourceSumsBytes = fs.readFileSync(sourceSumsPath);
const sourceSumLines = sourceSumsBytes.toString("utf8").trim().split(/\r?\n/);
const sourceEntries = new Map();
for (const line of sourceSumLines) {
  const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
  if (!match) throw new Error("Malformed frozen source SHA256SUMS line.");
  const relative = match[2].trim();
  const absolute = path.resolve(sourceRun, relative);
  if (isWithin(sourceRun, absolute) === false || path.relative(sourceRun, absolute).startsWith("..")) {
    throw new Error("Frozen source checksum path escapes its artifact root.");
  }
  if (sourceEntries.has(relative)) throw new Error("Duplicate frozen source checksum path: " + relative);
  const actual = hash(fs.readFileSync(absolute));
  if (actual.toLowerCase() !== match[1].toLowerCase()) throw new Error("Frozen source checksum mismatch: " + relative);
  sourceEntries.set(relative, actual);
}
if (sourceEntries.size !== 11) throw new Error("Expected the reviewed 11-entry frozen source artifact manifest.");
const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const queryPairs = JSON.parse(fs.readFileSync(path.join(inputs, "mcp-live-search-results.json"), "utf8")).queries;
const spanish = queryPairs.find((item) => item.caseId === "C01" && item.language === "es");
const english = queryPairs.find((item) => item.caseId === "C01" && item.language === "en");
if (!spanish || !english) throw new Error("Frozen paired C01 queries were not found.");
const moduleUrl = pathToFileURL(path.join(mssrRoot, "dist", "librarian-retrieval.js")).href;
const { searchMssrLibrarianEvidence } = await import(moduleUrl);
const { selectMssrLibrarianEvidenceWithJev } = await import(pathToFileURL(path.join(mssrRoot, "dist", "librarian-jev-selection.js")).href);
const { readMssrServerBuildId } = await import(pathToFileURL(path.join(mssrRoot, "dist", "server-build.js")).href);
const packageVersion = JSON.parse(fs.readFileSync(path.join(mssrRoot, "package.json"), "utf8")).version;
const actualBuild = readMssrServerBuildId(path.join(mssrRoot, "dist"));
if (packageVersion !== "0.2.105" || actualBuild.status !== "known" || actualBuild.id !== "mssr-build:sha256:58b3d5447d10b847") {
  throw new Error("The diagnostic requires the pinned MSSR 0.2.105 package/build; observed " + packageVersion + " / " + JSON.stringify(actualBuild));
}
const summarizeCandidate = (item, index) => ({
  rank: index + 1,
  handle: item.handle,
  score: item.score,
  exactFetchable: item.exactFetchable,
  rangeCodeUnits: item.rangeCodeUnits,
  title: item.title,
  headingPath: item.headingPath,
  snippet: item.snippet,
  metadata: item.metadata,
  ...(item.metadataProjectionMatches?.length ? { metadataProjectionMatches: item.metadataProjectionMatches } : {})
});
const runCase = (id, query, method) => {
  const result = searchMssrLibrarianEvidence({
    documents: payload.documents,
    query: { query, maxResults: 20 }
  });
  const candidates = result.results.map(summarizeCandidate);
  return {
    id,
    query,
    method,
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
const c01Baseline = runCase("C01-es-baseline", spanish.query, "frozen Spanish query");
const c01PairedQuery = runCase(
  "C01-es-plus-en-query",
  spanish.query + " " + english.query,
  "experimental concatenation of the already-frozen Spanish and English query variants; no model translation"
);
const c01English = runCase("C01-en-baseline", english.query, "frozen English query");
const unionById = new Map();
for (const [language, sourceCase] of [["es", c01Baseline], ["en", c01English]]) {
  for (const candidate of sourceCase.candidates) {
    const existing = unionById.get(candidate.handle.id);
    if (existing) existing.sourceQueryRanks.push({ language, rank: candidate.rank, score: candidate.score });
    else unionById.set(candidate.handle.id, { ...candidate, sourceQueryRanks: [{ language, rank: candidate.rank, score: candidate.score }] });
  }
}
const c01SeparateQueryUnion = [...unionById.values()];
const unionSourceRefs = [...new Set(c01SeparateQueryUnion.map((candidate) => candidate.handle.sourceRef))];
const unionDocs = unionSourceRefs.map((sourceRef) => {
  const doc = payload.documents.find((item) => item.sourceRef === sourceRef);
  if (!doc) throw new Error("No caller snapshot for separate-query union source " + sourceRef);
  return { owner: doc.owner, sourceRef: doc.sourceRef, markdown: doc.markdown, privacyClass: doc.privacyClass };
});
let selectionCalls = 0;
let capturedSelectionRequest;
const offlineProvider = {
  async executeSystemOne(request) {
    selectionCalls += 1;
    capturedSelectionRequest = request;
    const choice = Object.keys(request.questions.selection.options).find((key) => key !== "none");
    return {
      provider: "offline-no-network-stub",
      model: "offline-no-network-stub",
      answers: {
        selection: { type: "choice", choice, confidence: 0.01 },
        sufficiency: { type: "noul", noul: 0.5 }
      },
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }
};
const unionSelection = await selectMssrLibrarianEvidenceWithJev({
  query: spanish.query + " " + english.query,
  documents: unionDocs,
  candidateHandles: c01SeparateQueryUnion.map((candidate) => candidate.handle)
}, offlineProvider);
if (selectionCalls !== unionSelection.providerCalls || selectionCalls < 1) {
  throw new Error("Offline selector invocation accounting did not match its result.");
}
const offlineSelectionPreview = {
  status: unionSelection.status,
  offered: unionSelection.candidateRangeDiagnostics?.offered,
  eligible: unionSelection.candidateRangeDiagnostics?.eligible,
  oversizedOmitted: unionSelection.candidateRangeDiagnostics?.oversizedOmitted,
  selectionMode: unionSelection.selectionMode,
  providerCalls: unionSelection.providerCalls,
  exactFetchRequired: unionSelection.exactFetchRequired,
  providerAdapter: "offline-no-network-stub",
  externalProviderCalls: 0,
  stubInvocations: selectionCalls,
  fullSourceDocumentsSuppliedToLocalSelector: unionDocs.length,
  uniqueSourceRefs: unionSourceRefs,
  boundedEvidenceSentToStub: capturedSelectionRequest?.state?.evidence ?? []
};
const negativeEs = "¿Qué comen los ajolotes y cómo funcionan los acordeones?";
const negativeEn = "What do axolotls eat and how do accordions work?";
const negativeBaseline = runCase("negative-es-baseline", negativeEs, "unrelated negative-control phrase");
const negativeEnglish = runCase("negative-en-baseline", negativeEn, "unrelated English negative-control phrase");
const negativeUnionById = new Map([...negativeBaseline.candidates, ...negativeEnglish.candidates].map((item) => [item.handle.id, item]));
const negativeSeparateQueryUnion = [...negativeUnionById.values()];
const negativeUnionSourceRefs = [...new Set(negativeSeparateQueryUnion.map((item) => item.handle.sourceRef))];
const negativePaired = runCase(
  "negative-es-plus-en-query",
  negativeEs + " " + negativeEn,
  "same unrelated negative control with its English variant concatenated"
);
const baselineIds = new Set(c01Baseline.candidates.map((item) => item.handle.id));
const expandedIds = new Set(c01PairedQuery.candidates.map((item) => item.handle.id));
const diff = {
  baselineCount: baselineIds.size,
  expandedCount: expandedIds.size,
  sharedHandles: [...baselineIds].filter((id) => expandedIds.has(id)).length,
  addedHandles: c01PairedQuery.candidates.filter((item) => !baselineIds.has(item.handle.id)).map((item) => ({
    sourceRef: item.handle.sourceRef, rangeId: item.handle.rangeId, score: item.score, exactFetchable: item.exactFetchable
  })),
  removedHandles: c01Baseline.candidates.filter((item) => !expandedIds.has(item.handle.id)).map((item) => ({
    sourceRef: item.handle.sourceRef, rangeId: item.handle.rangeId, score: item.score, exactFetchable: item.exactFetchable
  }))
};
const separateQueryUnionFindings = {
  spanishCount: c01Baseline.resultCount,
  englishCount: c01English.resultCount,
  uniqueUnionCount: c01SeparateQueryUnion.length,
  sharedHandles: c01SeparateQueryUnion.filter((item) => item.sourceQueryRanks.length > 1).length,
  addedByEnglishCount: c01SeparateQueryUnion.filter((item) => item.sourceQueryRanks.every((rank) => rank.language === "en")).length,
  uniqueSourceRefs: unionSourceRefs,
  exactFetchableCount: c01SeparateQueryUnion.filter((item) => item.exactFetchable).length,
  oversizedCount: c01SeparateQueryUnion.filter((item) => !item.exactFetchable).length,
  atomProjectedHitCount: c01SeparateQueryUnion.filter((item) => item.metadataProjectionMatches?.length).length,
  localSelector: offlineSelectionPreview
};
const negativeSeparateQueryUnionFindings = {
  spanishCount: negativeBaseline.resultCount,
  englishCount: negativeEnglish.resultCount,
  uniqueUnionCount: negativeSeparateQueryUnion.length,
  uniqueSourceRefs: negativeUnionSourceRefs,
  exactFetchableCount: negativeSeparateQueryUnion.filter((item) => item.exactFetchable).length,
  oversizedCount: negativeSeparateQueryUnion.filter((item) => !item.exactFetchable).length
};
fs.mkdirSync(outputRoot, { recursive: true });
const manifest = {
  schema: "mssr-bilingual-query-expansion-diagnostic-v2",
  runId: path.basename(outputRoot),
  status: "offline-exploratory-no-provider-no-labels",
  createdAtUtc: new Date().toISOString(),
  runtime: {
    root: mssrRoot,
    packageVersion,
    buildId: actualBuild.id,
    sourceCommit: "0c1ca590d3dcf9a8ba721f6a2975c909e13972c2"
  },
  input: {
    sourceRun,
    sourceSumsSha256: hash(sourceSumsBytes),
    sourceChecksumEntriesVerified: sourceEntries.size,
    mcpSearchPayloadSha256: hash(fs.readFileSync(payloadPath)),
    documents: payload.documents.length,
    sidecarEntries: payload.documents.reduce((sum, doc) => sum + (doc.evidenceAtoms?.length || 0), 0),
    metadataFilters: false
  },
  design: {
    topK: 20,
    externalProviderCalls: 0,
    offlineSelectorStubInvocations: selectionCalls,
    mcpCalls: 0,
    labelsRead: false,
    qualityMetric: null,
    question: "How do raw query concatenation and separately searched, exact-handle-deduplicated union differ on frozen C01 and an unrelated negative control, and can the local .105 selector consume that union within its existing limits?"
  },
  findings: {
    c01Top20: diff,
    baselineSpanish: {
      candidateCount: c01Baseline.resultCount,
      uniqueSourceRefs: c01Baseline.uniqueSourceRefs,
      exactFetchable: c01Baseline.exactFetchableCount,
      atomProjectedHits: c01Baseline.atomProjectedHitCount
    },
    pairedSpanishEnglish: {
      candidateCount: c01PairedQuery.resultCount,
      uniqueSourceRefs: c01PairedQuery.uniqueSourceRefs,
      exactFetchable: c01PairedQuery.exactFetchableCount,
      atomProjectedHits: c01PairedQuery.atomProjectedHitCount
    },
    separateQueryUnion: separateQueryUnionFindings,
    unrelatedControl: {
      baselineCount: negativeBaseline.resultCount,
      pairedCount: negativePaired.resultCount,
      pairedUniqueSourceRefs: negativePaired.uniqueSourceRefs,
      separateQueryUnion: negativeSeparateQueryUnionFindings
    },
    interpretation: "Retrieval and bounded-input mechanics only. Candidate diversity is not relevance; no anchor, gold label, accuracy, recall, or quality claim is used. Separate queries preserve each search ranking before exact-handle union; the union itself has no new relevance score."
  }
};
const outputs = {
  "search-variants.json": {
    schema: "mssr-bilingual-search-variants-v2",
    cases: [c01Baseline, c01PairedQuery, c01English, { id: "C01-separate-query-union", candidateCount: c01SeparateQueryUnion.length, uniqueSourceRefs: unionSourceRefs, candidates: c01SeparateQueryUnion }, negativeBaseline, negativeEnglish, negativePaired],
    comparison: diff
  },
  "selection-preview.json": offlineSelectionPreview,
  "manifest.json": manifest,
  "README.md": `# MSSR bilingual query expansion diagnostic\n\nStatus: offline exploratory sensitivity check; no external provider, MCP, labels, network calls, or production code changes.\n\nThe diagnostic replays the frozen .105 corpus with exact C01 Spanish and English query variants. It compares raw query concatenation with separate searches followed by exact-handle deduplication. The unrelated Spanish/English negative-control pair checks both interventions. The separate-query union is passed through the local .105 Jev selector using a no-network stub, which checks the current bounded-input and exact-fetch contract only.\n\nC01 separate-query union: ${separateQueryUnionFindings.uniqueUnionCount} unique handles from ${separateQueryUnionFindings.uniqueSourceRefs.length} source refs; ${separateQueryUnionFindings.exactFetchableCount} exact-fetchable and ${separateQueryUnionFindings.oversizedCount} oversized. The local selector returned ${offlineSelectionPreview.status} with ${offlineSelectionPreview.eligible} eligible handles and ${offlineSelectionPreview.stubInvocations} offline stub invocation(s). The unrelated negative-control union has ${negativeSeparateQueryUnionFindings.uniqueUnionCount} handles.\n\nThese are retrieval and input-mechanics observations only. No candidate is treated as relevant, the unadjudicated anchor is not used as a label, and the offline stub's choice/confidence is arbitrary. Do not promote either variant to production from this sample; owner-adjudicated grouped evidence is still required.\n`
};
for (const [name, value] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outputRoot, name), typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n", "utf8");
}
const files = Object.keys(outputs).sort();
fs.writeFileSync(
  path.join(outputRoot, "SHA256SUMS"),
  files.map((name) => hash(fs.readFileSync(path.join(outputRoot, name))) + "  " + name).join("\n") + "\n",
  "utf8"
);
console.log(JSON.stringify({
  runId: manifest.runId,
  outputRoot,
  c01: {
    baselineUniqueSources: c01Baseline.uniqueSourceRefs.length,
    pairedUniqueSources: c01PairedQuery.uniqueSourceRefs.length,
    baselineFetchable: c01Baseline.exactFetchableCount,
    pairedFetchable: c01PairedQuery.exactFetchableCount,
    sharedHandles: diff.sharedHandles,
    addedHandles: diff.addedHandles.length,
    removedHandles: diff.removedHandles.length,
    baselineAtomHits: c01Baseline.atomProjectedHitCount,
    pairedAtomHits: c01PairedQuery.atomProjectedHitCount
  },
  separateQueryUnion: { candidates: c01SeparateQueryUnion.length, sources: unionSourceRefs.length, eligible: offlineSelectionPreview.eligible, stubCalls: selectionCalls },
  negativeControl: { baselineCount: negativeBaseline.resultCount, pairedCount: negativePaired.resultCount, separateLanguageUnion: negativeSeparateQueryUnion.length },
  externalProviderCalls: 0,
  offlineSelectorStubInvocations: selectionCalls,
  labelsRead: false
}, null, 2));
