import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const runRoot = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Usage: node freeze-live-jev-requests.mjs <run-root>");
const inputs = path.join(runRoot, "inputs");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const builderPath = path.resolve(process.argv[1]);
const archiveRoot = path.resolve(path.dirname(builderPath), "../..");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: archiveRoot, encoding: "utf8" }).trim();
const requestBuilder = { path: "experiments/jev-metadata-integration/freeze-live-jev-requests.mjs", sha256: hash(fs.readFileSync(builderPath)), archiveCommit };
const sourceKey = (owner, sourceRef) => owner + "\0" + sourceRef.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
const searchResultsPath = path.join(inputs, "mcp-live-search-results.json");
const searchResultsB64Path = searchResultsPath + ".b64";
if (!fs.existsSync(searchResultsPath)) {
  const encoded = fs.readFileSync(searchResultsB64Path, "ascii");
  fs.writeFileSync(searchResultsPath, Buffer.from(encoded, "base64"));
  fs.unlinkSync(searchResultsB64Path);
}
const observed = JSON.parse(fs.readFileSync(searchResultsPath, "utf8"));
const payload = JSON.parse(fs.readFileSync(path.join(inputs, "mcp-search-payload.json"), "utf8"));
if (observed.schema !== "mssr-librarian-live-search-freeze-v1") throw new Error("Unexpected live search freeze schema.");
if (observed.replay?.directMcpSearchCalls !== 4 || observed.replay?.truthAuthority !== false) throw new Error("Live search provenance is incomplete.");
const docsByKey = new Map(payload.documents.map((doc) => [sourceKey(doc.owner, doc.sourceRef), doc]));
const requestFiles = [];
for (const item of observed.queries) {
  if (item.caseId !== "C01" || !["es", "en"].includes(item.language) || item.hits.length !== 20) {
    throw new Error("Unexpected query case " + item.caseId + "/" + item.language + ".");
  }
  if (item.advisoryOnly !== true || item.truthAuthority !== false) throw new Error("Search candidates must remain advisory.");
  const seen = new Set();
  const candidateHandles = item.hits.map((hit, index) => {
    if (hit.rank !== index + 1 || !hit.handle?.id || seen.has(hit.handle.id)) throw new Error("Search result ranks/handles are malformed or duplicated.");
    seen.add(hit.handle.id);
    return hit.handle;
  });
  const uniqueKeys = [];
  for (const handle of candidateHandles) {
    const key = sourceKey(handle.owner, handle.sourceRef);
    if (!uniqueKeys.includes(key)) uniqueKeys.push(key);
  }
  const documents = uniqueKeys.map((key) => {
    const doc = docsByKey.get(key);
    if (!doc) throw new Error("No current caller Markdown snapshot for " + key + ".");
    if (doc.privacyClass === "sensitive-excluded") throw new Error("Sensitive-excluded document cannot be selected: " + doc.sourceRef);
    return { owner: doc.owner, sourceRef: doc.sourceRef, markdown: doc.markdown, privacyClass: doc.privacyClass };
  });
  const request = { query: item.query, documents, candidateHandles };
  const requestText = JSON.stringify(request, null, 2) + "\n";
  const filename = "jev-select-c01-" + item.language + ".request.json";
  const requestPath = path.join(inputs, filename);
  fs.writeFileSync(requestPath, requestText, "utf8");
  requestFiles.push({
    caseId: item.caseId,
    language: item.language,
    filename,
    sha256: hash(requestText),
    bytes: Buffer.byteLength(requestText, "utf8"),
    query: item.query,
    handles: candidateHandles.length,
    uniqueDocuments: documents.length,
    uniqueSourceRefs: documents.map((doc) => doc.sourceRef),
    exactFetchableSearchCandidates: item.hits.filter((hit) => hit.exactFetchable).length,
    oversizedSearchCandidates: item.hits.filter((hit) => !hit.exactFetchable).length,
    candidates: item.hits.map((hit) => ({
      rank: hit.rank,
      id: hit.handle.id,
      sourceRef: hit.handle.sourceRef,
      rangeId: hit.handle.rangeId,
      rangeKind: hit.handle.rangeKind,
      exactFetchable: hit.exactFetchable,
      score: hit.score
    }))
  });
}
const summary = {
  schema: "mssr-jev-frozen-selection-requests-v1",
  createdAtUtc: new Date().toISOString(),
  runtimeBuildId: observed.runtime.buildId,
  requests: requestFiles,
  providerPlan: {
    decisionJobs: requestFiles.length,
    mcpToolCalls: requestFiles.length,
    sequential: true,
    eachRequestHasChoiceAndNoulTogether: true,
    candidateSelectionMode: "single-pass",
    maximumJevSystemOneRequestsPerJob: 1,
    sdkMaxRetriesPerRequest: 1,
    maximumProviderTransportAttempts: requestFiles.length * 2,
    callerRetries: 0,
    modelOverride: null,
    anchorOrExpectedAnswerSent: false,
    labelsAvailable: false
  }
};
fs.writeFileSync(path.join(inputs, "jev-request-summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
const manifestPath = path.join(runRoot, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.status = "prepared-awaiting-START_JEV";
manifest.requestBuilder = requestBuilder;
manifest.liveMcpObservation = {
  searchCalls: observed.replay.directMcpSearchCalls,
  distinctQueryCases: observed.replay.distinctQueryCases,
  repeatedPassesPerQuery: observed.replay.repeatsPerQuery,
  latestPassOrderMatchedPinnedLocalImplementation: observed.replay.latestPassOrderMatchedPinnedLocalImplementation,
  providerCallsMade: false,
  sourceArtifact: "inputs/mcp-live-search-results.json",
  sourceArtifactSha256: hash(fs.readFileSync(searchResultsPath))
};
manifest.provider = {
  adapter: "MssrJevSemanticCuratorProvider",
  sdk: "@typesafe-ai/sdk 0.6.0",
  endpointDefault: "https://api.typesafe.ai",
  endpointOverrideMayExistAndCannotBeReadFromMCPHostBeforeCall: true,
  modelOverride: null,
  timeoutMs: 30000,
  maxRetries: 1,
  plannedMcpToolCalls: 2,
  sequential: true,
  maximumSystemOneRequests: 2,
  maximumTransportAttemptsIncludingSdkRetry: 4,
  callerRetries: 0
};
manifest.design = {
  ...manifest.design,
  plannedDecisionJobs: 2,
  plannedMaxProviderCalls: 2,
  plannedMaxTransportAttempts: 4,
  directMcpSearchCalls: 4,
  networkAccess: "MCP search completed; no Jev/provider call yet",
  jevCallsMade: false,
  providerCallsMade: false,
  qualityMetric: "none; selection smoke with no adjudicated labels"
};
manifest.nextGate = "Review inputs/jev-request-summary.json and provider-gate-receipt.json. Exact START_JEV token is required before the two sequential Jev selector tool calls.";
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
const manifestHash = hash(fs.readFileSync(manifestPath));
const receipt = {
  schema: "mssr-jev-provider-gate-receipt-v1",
  status: "awaiting-exact-human-token",
  requiredUserMessage: "START_JEV",
  manifestSha256: manifestHash,
  runId: manifest.runId,
  runtimeBuildId: observed.runtime.buildId,
  requests: requestFiles.map((entry) => ({
    caseId: entry.caseId,
    language: entry.language,
    filename: entry.filename,
    requestSha256: entry.sha256,
    handles: entry.handles,
    uniqueDocuments: entry.uniqueDocuments,
    query: entry.query
  })),
  executionBounds: {
    toolCalls: 2,
    sequential: true,
    eachToolCallIncludesChoiceAndNoul: true,
    systemOneRequests: 2,
    sdkRetriesPerRequest: 1,
    maximumProviderTransportAttempts: 4,
    agentRetries: 0,
    noProductionActivation: true,
    noWritesOrCanonicalSynthesis: true
  },
  interpretation: {
    noGoldLabels: true,
    candidateAnchorUnadjudicated: true,
    confidenceAndNoulAreUncalibratedDescriptiveSignals: true,
    selectionDoesNotEstablishTruthOrQuality: true,
    exactFetchMustFollowSelection: true
  }
};
fs.writeFileSync(path.join(runRoot, "provider-gate-receipt.json"), JSON.stringify(receipt, null, 2) + "\n", "utf8");
const readme = "# MSSR 0.2.105 Jev live-selection smoke\n\n"
  + "Status: prepared; waiting for the exact START_JEV user message.\n\n"
  + "This run freezes two real MSSR Librarian searches over the .105 sidecar-aware corpus: C01 Spanish and English. Four read-only search MCP calls were made (two passes for each query). The latest pass matched the pinned local .105 ranking order exactly. Search outputs are advisory and have no truth authority.\n\n"
  + "The frozen selector requests contain the top 20 exact revision-bound handles per language plus only the caller-supplied Markdown snapshots needed to revalidate those handles. They contain no gold label, expected answer, or anchor designation. Jev receives the bounded query-focused excerpts built by MSSR, not a filesystem search request. Each of the two selector tool calls combines Choice and Noul in one System-One request; the SDK may retry each request once (four transport attempts maximum total). Calls are sequential, with no caller retry.\n\n"
  + "No Jev/provider calls have occurred. No production activation, source write, synthesis, quality score, or calibration claim is part of this smoke. If approved with the exact token, the selected handle must then be exact-fetched and reviewed; confidence and Noul remain descriptive and uncalibrated.\n\n"
  + "See manifest.json, provider-gate-receipt.json, and inputs/jev-request-summary.json for immutable identities and the exact request bounds.\n";
fs.writeFileSync(path.join(runRoot, "README.md"), readme, "utf8");
const allFiles = [];
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (path.relative(runRoot, full).replace(/\\/g, "/") !== "SHA256SUMS") allFiles.push(path.relative(runRoot, full).replace(/\\/g, "/"));
  }
}
visit(runRoot);
allFiles.sort();
const sums = allFiles.map((rel) => hash(fs.readFileSync(path.join(runRoot, rel))) + "  " + rel).join("\n") + "\n";
fs.writeFileSync(path.join(runRoot, "SHA256SUMS"), sums, "utf8");
console.log(JSON.stringify({
  status: manifest.status,
  requests: requestFiles.map((entry) => ({ language: entry.language, handles: entry.handles, docs: entry.uniqueDocuments, fetchable: entry.exactFetchableSearchCandidates, oversized: entry.oversizedSearchCandidates })),
  manifestSha256: manifestHash,
  requestHashes: requestFiles.map((entry) => ({ language: entry.language, filename: entry.filename, sha256: entry.sha256 })),
  checksummedFiles: allFiles.length
}, null, 2));
