#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const RUN_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(RUN_ROOT, "../../../..");
const PROJECT_ROOT = resolve(RUN_ROOT, "project");
const CANDIDATE_ROOT = "D:\\Dev\\bridge-mcp-jev-mssr-0.2.103";
const SOURCE_COMMIT = "c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a";
const CONFIRMATION = "0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca";
const EXPECTED_INPUT_HASHES = {
  "cases.json": "70e4c30fa2473a73fd9c2626a92ecfc58addb548da132e2ee639614b94e384f4",
  "corpus.json": "40a4d6b1f936d71eea56e4feac4105a68b6db995d1b6b96e03d8570413fa5a4d",
};
const EXPECTED_BRIDGE_VERSION = "0.6.156";
const EXPECTED_MSSR_VERSION = "0.2.104";
const EXPECTED_MODEL = "jev-1.13.0";
const MAX_CANDIDATES = 100;
const MAX_FETCH_CHARS = 20_000;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(RUN_ROOT, relativePath), "utf8"));
const writeJsonExclusive = (relativePath, value) => writeFileSync(
  resolve(RUN_ROOT, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  { flag: "wx" },
);

function parseArgs(argv) {
  const result = { mode: "preflight", candidateRoot: CANDIDATE_ROOT, confirmation: null };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--preflight") result.mode = "preflight";
    else if (item === "--live") result.mode = "live";
    else if (item === "--candidate-root" && argv[index + 1]) result.candidateRoot = resolve(argv[++index]);
    else if (item === "--confirmation" && argv[index + 1]) result.confirmation = argv[++index];
    else throw new Error(`Unsupported or incomplete argument: ${item}`);
  }
  return result;
}

function assertFreshOutputPaths(mode) {
  const relativePaths = mode === "live"
    ? ["manifest.json", "records.jsonl", "summary.json"]
    : ["preflight.json"];
  for (const relativePath of relativePaths) {
    assert.equal(existsSync(resolve(RUN_ROOT, relativePath)), false, `Refusing existing output: ${relativePath}`);
  }
}

function verifyFrozenCorpus() {
  const casesBytes = readFileSync(resolve(RUN_ROOT, "inputs/cases.json"));
  const corpusBytes = readFileSync(resolve(RUN_ROOT, "inputs/corpus.json"));
  assert.equal(sha256(casesBytes), EXPECTED_INPUT_HASHES["cases.json"], "Frozen query bytes differ from the pinned input.");
  assert.equal(sha256(corpusBytes), EXPECTED_INPUT_HASHES["corpus.json"], "Frozen corpus bytes differ from the pinned input.");

  const cases = JSON.parse(casesBytes.toString("utf8"));
  const corpus = JSON.parse(corpusBytes.toString("utf8"));
  const inventory = readJson("inputs/source-inventory.json");
  const stagedIdentity = readJson("inputs/staged-project-identity.json");
  assert.equal(cases.cases.length, 26);
  assert.deepEqual(cases.languages, ["en", "es"]);
  assert.equal(corpus.sourceCommit, SOURCE_COMMIT);
  assert.equal(corpus.documents.length, 21);
  assert.equal(inventory.documents.length, 21);
  assert.equal(stagedIdentity.sourceCommit, SOURCE_COMMIT);
  assert.equal(stagedIdentity.documents, 21);
  assert.equal(stagedIdentity.cleanWorkingTree, true);
  assert.equal(existsSync(resolve(RUN_ROOT, "inputs/labels.json")), false, "Labels must not be copied into this run.");
  assert.equal(existsSync(resolve(RUN_ROOT, "inputs/target-index.json")), false, "Target index must not be copied into this run.");

  for (let index = 0; index < corpus.documents.length; index += 1) {
    const document = corpus.documents[index];
    const row = inventory.documents[index];
    assert.equal(row.sourceRef, document.sourceRef, `Source order differs at document ${index}`);
    const stagedPath = resolve(PROJECT_ROOT, ...document.sourceRef.split("/"));
    const stagedBytes = readFileSync(stagedPath);
    const frozenBytes = Buffer.from(document.markdown, "utf8");
    assert.equal(sha256(stagedBytes), row.sha256, `Staged source hash differs: ${document.sourceRef}`);
    assert.equal(sha256(stagedBytes), sha256(frozenBytes), `Frozen JSON payload differs from staged source: ${document.sourceRef}`);
    assert.equal(row.matchesGitCommit, true, `Source was not verified against source commit: ${document.sourceRef}`);
    const gitBlob = execFileSync("git", ["show", `${SOURCE_COMMIT}:${document.sourceRef}`]);
    assert.equal(sha256(gitBlob), row.sha256, `Canonical Git blob differs from frozen source: ${document.sourceRef}`);
  }

  const manifestBytes = readFileSync(resolve(PROJECT_ROOT, ".mssr/project-context.json"));
  assert.equal(sha256(manifestBytes), stagedIdentity.projectContextManifestSha256, "Staged project manifest hash differs.");
  const gitHead = execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(gitHead, stagedIdentity.stagedSnapshotCommit, "Staged project Git identity differs.");
  const gitStatus = execFileSync("git", ["-C", PROJECT_ROOT, "status", "--porcelain"], { encoding: "utf8" }).trim();
  assert.equal(gitStatus, "", "Staged project changed after snapshot creation.");
  return { cases, corpus, inventory, inputHashes: EXPECTED_INPUT_HASHES, stagedIdentity };
}

function verifyCandidate(candidateRoot) {
  const packageJson = readJsonFrom(candidateRoot, "package.json");
  const packageLock = readJsonFrom(candidateRoot, "package-lock.json");
  const mssrPackage = readJsonFrom(candidateRoot, "node_modules/@mauroprime/mssr/package.json");
  const sdkPackage = readJsonFrom(candidateRoot, "node_modules/@typesafe-ai/sdk/package.json");
  const artifactPath = resolve(candidateRoot, "vendor/mauroprime-mssr-0.2.104.tgz");
  const artifactBytes = readFileSync(artifactPath);
  const bridgeConfigPath = resolve(candidateRoot, "src/config.ts");
  const bridgeToolPath = resolve(candidateRoot, "dist/tools/mssr-semantic-evidence-tools.js");
  const mssrSelectorPath = resolve(candidateRoot, "node_modules/@mauroprime/mssr/dist/librarian-jev-selection.js");
  const mssrSelectorTypesPath = resolve(candidateRoot, "node_modules/@mauroprime/mssr/dist/librarian-jev-selection.d.ts");
  const bridgeConfig = readFileSync(bridgeConfigPath, "utf8");
  const bridgeTool = readFileSync(bridgeToolPath, "utf8");
  const mssrSelector = readFileSync(mssrSelectorPath, "utf8");
  const mssrSelectorTypes = readFileSync(mssrSelectorTypesPath, "utf8");

  assert.equal(packageJson.version, EXPECTED_BRIDGE_VERSION, "Candidate Bridge package version mismatch.");
  assert.equal(mssrPackage.version, EXPECTED_MSSR_VERSION, "Installed MSSR package version mismatch.");
  assert.equal(sdkPackage.version, "0.6.0", "Installed TypeSafe SDK version mismatch.");
  assert.equal(packageJson.dependencies?.["@mauroprime/mssr"], "file:vendor/mauroprime-mssr-0.2.104.tgz", "Candidate package.json does not pin the confirmed MSSR artifact.");
  assert.equal(packageLock.packages?.["" ]?.dependencies?.["@mauroprime/mssr"], "file:vendor/mauroprime-mssr-0.2.104.tgz", "Candidate package-lock does not pin the confirmed MSSR artifact.");
  assert.equal(sha256(artifactBytes), CONFIRMATION.split(":")[2], "Candidate MSSR package artifact hash does not match the coordinator-confirmed hash.");
  assert.match(bridgeConfig, /SERVER_VERSION\s*=\s*["']0\.6\.156["']/);
  assert.match(bridgeTool, /value\.probabilities/,
    "Bridge provider adapter does not preserve TypeSafe per-choice probabilities.");
  assert.match(mssrSelector, /choiceCalls:\s*allCalls\.map/,
    "MSSR selector does not expose per-call Choice details.");
  assert.match(mssrSelectorTypes, /choiceCalls:/);
  assert.match(mssrSelectorTypes, /probabilities:\s*Record<string, number> \| null/);
  assert.equal(existsSync(resolve(candidateRoot, "dist/index.js")), true, "Candidate stdio entrypoint is missing.");

  return {
    candidateRoot,
    bridgeVersion: packageJson.version,
    mssrVersion: mssrPackage.version,
    mssrArtifact: "vendor/mauroprime-mssr-0.2.104.tgz",
    mssrArtifactSha256: sha256(artifactBytes),
    typeSafeSdkVersion: sdkPackage.version,
    nodeVersion: process.version,
    hashes: {
      bridgeConfig: sha256(readFileSync(bridgeConfigPath)),
      bridgePackage: sha256(readFileSync(resolve(candidateRoot, "package.json"))),
      bridgePackageLock: sha256(readFileSync(resolve(candidateRoot, "package-lock.json"))),
      bridgeStdioEntrypoint: sha256(readFileSync(resolve(candidateRoot, "dist/index.js"))),
      bridgeCompiledConfig: sha256(readFileSync(resolve(candidateRoot, "dist/config.js"))),
      bridgeSemanticEvidenceAdapter: sha256(readFileSync(bridgeToolPath)),
      mssrSelector: sha256(readFileSync(mssrSelectorPath)),
      mssrSelectorTypes: sha256(readFileSync(mssrSelectorTypesPath)),
    },
    probabilityContract: {
      bridgeAdapterPreservesChoiceProbabilities: true,
      mssrExposesChoiceCalls: true,
      mssrChoiceCallProbabilitiesMayBeNull: true,
    },
  };
}

function readJsonFrom(root, relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function classifyFailure(error) {
  const message = String(error?.message ?? "");
  if (/credential|api.?key|unauthori[sz]ed|forbidden/i.test(message)) return "credential-or-authentication";
  if (/rate.?limit|429|quota/i.test(message)) return "rate-limited";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/network|fetch|ECONN|ENOTFOUND|TLS|certificate/i.test(message)) return "network-or-tls";
  if (/schema|probabilit|tool.*missing/i.test(message)) return "tool-or-contract";
  return "provider-or-tool-error";
}

function extractPayload(result, toolName) {
  if (result?.isError) throw new Error(`${toolName}:tool-error:${classifyFailure(new Error(result.content?.map((item) => item.text ?? "").join(" ")) )}`);
  if (result?.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (typeof text !== "string") throw new Error(`${toolName}:missing-text-payload`);
  try { return JSON.parse(text); } catch { throw new Error(`${toolName}:non-json-payload`); }
}

function optionMapForHandles(handles) {
  const eligible = handles.filter((handle) => Number.isInteger(handle.endOffset - handle.startOffset)
    && handle.endOffset - handle.startOffset <= MAX_FETCH_CHARS);
  return Object.fromEntries(eligible.map((handle, index) => [
    `h${String(index + 1).padStart(3, "0")}`,
    {
      version: handle.version,
      id: handle.id,
      owner: handle.owner,
      sourceRef: handle.sourceRef,
      revision: handle.revision,
      rangeId: handle.rangeId,
      rangeKind: handle.rangeKind,
      startLine: handle.startLine,
      endLine: handle.endLine,
      startOffset: handle.startOffset,
      endOffset: handle.endOffset,
      fingerprint: handle.fingerprint,
      privacyClass: handle.privacyClass,
    },
  ]));
}

function validateChoiceCalls(selection, optionMap) {
  const calls = Array.isArray(selection.choiceCalls) ? selection.choiceCalls : [];
  if (calls.length !== selection.providerCalls) throw new Error("Choice call count does not match providerCalls.");
  return calls.map((call, index) => {
    const ids = call.offeredOptionIds;
    const probabilities = call.probabilities;
    let vectorStatus = "complete";
    let probabilitySum = null;
    if (!Array.isArray(ids) || ids.length < 2) vectorStatus = "invalid-option-ids";
    else if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) vectorStatus = "missing";
    else {
      const idSet = [...ids].sort();
      const keySet = Object.keys(probabilities).sort();
      if (JSON.stringify(idSet) !== JSON.stringify(keySet)) vectorStatus = "option-id-mismatch";
      else {
        const values = Object.values(probabilities);
        if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) vectorStatus = "invalid-probability";
        else {
          probabilitySum = values.reduce((sum, value) => sum + value, 0);
          if (Math.abs(probabilitySum - 1) > 1e-6) vectorStatus = "probabilities-do-not-sum-to-one";
        }
      }
    }
    for (const id of ids ?? []) {
      if (id !== "none" && !optionMap[id]) vectorStatus = "unmapped-option-id";
    }
    return {
      callIndex: index + 1,
      stage: call.stage ?? null,
      offeredOptionIds: ids ?? null,
      selectedOptionId: call.selectedOptionId ?? null,
      probabilities: probabilities ?? null,
      probabilityVectorStatus: vectorStatus,
      probabilitySum,
      providerConfidence: call.providerConfidence ?? null,
      evidenceSufficiency: call.evidenceSufficiency ?? null,
      provider: call.provider ?? null,
      model: call.model ?? null,
      usage: call.usage ?? null,
      requestFingerprint: call.requestFingerprint ?? null,
    };
  });
}

async function runPreflight(candidateRoot) {
  assertFreshOutputPaths("preflight");
  const frozen = verifyFrozenCorpus();
  const candidate = verifyCandidate(candidateRoot);
  const result = {
    schemaVersion: 1,
    runId: "mssr-librarian-jev-bridge-0.6.156-mssr-0.2.104-frozen-corpus-20261004T090944Z-v1",
    status: "preflight-passed-provider-gate-closed",
    providerCallsMade: false,
    labelsRead: false,
    scoringPerformed: false,
    evaluationClass: "exploratory-build-regression-paired-comparison",
    independentConceptCount: frozen.cases.cases.length,
    pairedLanguageRequestCount: frozen.cases.cases.length * frozen.cases.languages.length,
    languages: frozen.cases.languages,
    sourceCommit: SOURCE_COMMIT,
    corpusDocumentCount: frozen.corpus.documents.length,
    corpusDocuments: frozen.inventory.documents,
    inputHashes: frozen.inputHashes,
    runnerSha256: sha256(readFileSync(resolve(RUN_ROOT, "runner.mjs"))),
    stagedProject: frozen.stagedIdentity,
    candidate,
    model: EXPECTED_MODEL,
    toolProtocol: {
      searchTool: "mssr_librarian_search",
      selectorTool: "mssr_librarian_jev_select",
      fetchTool: "mssr_librarian_fetch",
      maxSearchResults: MAX_CANDIDATES,
      fetchCharacterLimit: MAX_FETCH_CHARS,
      selectionInputs: "search-returned revision-bound candidate handles",
      liveTransport: "candidate dist/index.js over local MCP stdio",
      labelsAndTargetsLoaded: false,
    },
    checkedAt: new Date().toISOString(),
  };
  writeJsonExclusive("preflight.json", result);
  process.stdout.write(`${JSON.stringify({ status: result.status, providerCallsMade: false, candidate: candidate.bridgeVersion, mssr: candidate.mssrVersion, documents: frozen.corpus.documents.length, concepts: frozen.cases.cases.length, requests: result.pairedLanguageRequestCount })}\n`);
}

async function runLive(candidateRoot, confirmation) {
  if (confirmation !== CONFIRMATION) throw new Error("Live Jev gate is closed: exact coordinator confirmation is required.");
  assertFreshOutputPaths("live");
  const frozen = verifyFrozenCorpus();
  const candidate = verifyCandidate(candidateRoot);
  const runId = "mssr-librarian-jev-bridge-0.6.156-mssr-0.2.104-frozen-corpus-20261004T090944Z-v1";
  const startedAt = new Date().toISOString();
  const recordsPath = resolve(RUN_ROOT, "records.jsonl");
  const environment = { ...process.env };
  delete environment.TYPESAFE_API_KEY;
  environment.BRIDGE_MSSR_JEV_CREDENTIAL_TARGET = "TypeSafe:MSSR:JevLab";
  environment.BRIDGE_MSSR_JEV_MODEL = EXPECTED_MODEL;
  const candidateRequire = createRequire(resolve(candidateRoot, "package.json"));
  const clientEntry = pathToFileURL(candidateRequire.resolve("@modelcontextprotocol/sdk/client/index.js")).href;
  const transportEntry = pathToFileURL(candidateRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js")).href;
  const [{ Client }, { StdioClientTransport }] = await Promise.all([import(clientEntry), import(transportEntry)]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(candidateRoot, "dist/index.js")],
    cwd: candidateRoot,
    env: environment,
    stderr: "pipe",
  });
  let stderrSeen = false;
  transport.stderr?.on("data", () => { stderrSeen = true; });
  const client = new Client({ name: "mssr-librarian-frozen-corpus-runner", version: "1.0.0" }, { capabilities: {} });
  let serverInfo = null;
  let completedRequests = 0;
  let succeededRequests = 0;
  let failedRequests = 0;
  const aggregate = { providerCalls: 0, inputTokens: 0, outputTokens: 0, elapsedMs: 0, endToEndElapsedMs: 0, fetchPassed: 0, fetchFailed: 0, abstentions: 0 };
  writeJsonExclusive("manifest.json", {
    schemaVersion: 1,
    runId,
    suite: "mssr-librarian-jev-bridge-live-frozen-corpus-exploratory-v1",
    status: "running",
    evaluationClass: "exploratory-build-regression-paired-comparison",
    independentConceptCount: frozen.cases.cases.length,
    pairedLanguageRequestCount: frozen.cases.cases.length * frozen.cases.languages.length,
    sourceCommit: SOURCE_COMMIT,
    candidate,
    model: EXPECTED_MODEL,
    inputs: frozen.inputHashes,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    startedAt,
    rawProviderBodiesPersisted: false,
    fetchedSourceTextPersisted: false,
    credentialValuePersisted: false,
  });
  try {
    await client.connect(transport);
    serverInfo = client.getServerVersion?.() ?? null;
    assert.equal(serverInfo?.version, EXPECTED_BRIDGE_VERSION, "MCP server handshake version differs from the confirmed candidate.");
    const catalog = await client.listTools();
    const tools = new Map(catalog.tools.map((tool) => [tool.name, tool]));
    for (const name of ["mssr_librarian_search", "mssr_librarian_jev_select", "mssr_librarian_fetch"]) {
      assert.ok(tools.has(name), `Candidate MCP catalog is missing ${name}.`);
    }
    const refs = frozen.corpus.documents.map((item) => item.sourceRef);
    for (const item of frozen.cases.cases) {
      for (const language of frozen.cases.languages) {
        const query = item[language];
        const caseId = `${item.id}:${language}`;
        const requestStartedAt = new Date().toISOString();
        const requestStarted = performance.now();
        try {
          const searchResult = extractPayload(await client.callTool({
            name: "mssr_librarian_search",
            arguments: {
              projectRoot: PROJECT_ROOT,
              sourceRefs: refs,
              query: { query, maxResults: MAX_CANDIDATES, maxSnippetChars: 200 },
              metadataMode: "off",
            },
          }), "mssr_librarian_search");
          const searchRows = Array.isArray(searchResult.results) ? searchResult.results : [];
          const optionMap = optionMapForHandles(searchRows.map((row) => row.handle).filter(Boolean));
          const candidateHandles = Object.values(optionMap);
          if (candidateHandles.length === 0) throw new Error("deterministic-search-returned-no-eligible-handles");
          const searchCandidates = searchRows.map((row, index) => ({
            rank: index + 1,
            handle: row.handle ? {
              id: row.handle.id,
              sourceRef: row.handle.sourceRef,
              revision: row.handle.revision,
              rangeId: row.handle.rangeId,
              rangeKind: row.handle.rangeKind,
              startLine: row.handle.startLine,
              endLine: row.handle.endLine,
              startOffset: row.handle.startOffset,
              endOffset: row.handle.endOffset,
              fingerprint: row.handle.fingerprint,
            } : null,
          }));
          const selection = extractPayload(await client.callTool({
            name: "mssr_librarian_jev_select",
            arguments: {
              projectRoot: PROJECT_ROOT,
              sourceRefs: refs,
              query,
              candidateHandles,
              model: EXPECTED_MODEL,
            },
          }), "mssr_librarian_jev_select");
          const choiceCalls = selection.jevCallMade === true ? validateChoiceCalls(selection, optionMap) : [];
          let exactFetch = { status: "not-attempted" };
          if (selection.status === "selected" && selection.selected?.handle) {
            const fetchStarted = performance.now();
            try {
              const fetched = extractPayload(await client.callTool({
                name: "mssr_librarian_fetch",
                arguments: { projectRoot: PROJECT_ROOT, handle: selection.selected.handle },
              }), "mssr_librarian_fetch");
              const handle = selection.selected.handle;
              const fingerprintMatched = fetched.fingerprint === handle.fingerprint;
              const revisionMatched = fetched.revision === handle.revision;
              exactFetch = {
                status: fingerprintMatched && revisionMatched ? "passed" : "mismatch",
                sourceRef: fetched.sourceRef ?? handle.sourceRef,
                revision: fetched.revision ?? null,
                fingerprint: fetched.fingerprint ?? null,
                fingerprintMatched,
                revisionMatched,
                fetchedTextChars: typeof fetched.text === "string" ? fetched.text.length : null,
                textPersisted: false,
                elapsedMs: Number((performance.now() - fetchStarted).toFixed(1)),
              };
              if (exactFetch.status === "passed") aggregate.fetchPassed += 1;
              else aggregate.fetchFailed += 1;
            } catch (error) {
              exactFetch = { status: "failed", failureClass: classifyFailure(error), textPersisted: false, elapsedMs: Number((performance.now() - fetchStarted).toFixed(1)) };
              aggregate.fetchFailed += 1;
            }
          } else if (selection.status === "abstained") {
            aggregate.abstentions += 1;
            exactFetch = { status: "not-applicable-abstained" };
          }
          const endToEndElapsedMs = Number((performance.now() - requestStarted).toFixed(1));
          const record = {
            schemaVersion: 1,
            caseId: item.id,
            language,
            status: selection.jevCallMade === true ? "complete" : "selector-not-run",
            queryFingerprint: sha256(Buffer.from(query, "utf8")),
            sourceRefs: refs,
            projectRoot: PROJECT_ROOT,
            search: {
              sourceCount: searchResult.sourceCount ?? refs.length,
              candidateCount: searchRows.length,
              truncated: searchResult.truncated ?? null,
              candidates: searchCandidates,
            },
            selection: {
              status: selection.status,
              reason: selection.reason ?? null,
              jevCallMade: selection.jevCallMade === true,
              candidateRangeDiagnostics: selection.candidateRangeDiagnostics ?? null,
              candidateCount: selection.candidateCount ?? null,
              finalistCount: selection.finalistCount ?? null,
              selectionMode: selection.selectionMode ?? null,
              selectionPasses: selection.selectionPasses ?? null,
              providerCalls: selection.providerCalls ?? 0,
              providerConfidence: selection.providerConfidence ?? null,
              evidenceSufficiency: selection.evidenceSufficiency ?? null,
              confidenceCalibration: selection.confidenceCalibration ?? null,
              evidenceSufficiencyCalibration: selection.evidenceSufficiencyCalibration ?? null,
              provider: selection.provider ?? null,
              model: selection.model ?? null,
              providersUsed: selection.providersUsed ?? [],
              modelsUsed: selection.modelsUsed ?? [],
              usage: selection.usage ?? null,
              requestFingerprint: selection.requestFingerprint ?? null,
              elapsedMs: selection.elapsedMs ?? null,
              selectedOption: selection.selected ? {
                optionId: selection.selected.optionId,
                sourceRef: selection.selected.sourceRef,
                rangeId: selection.selected.rangeId,
                rangeKind: selection.selected.rangeKind,
                title: selection.selected.title,
                headingPath: selection.selected.headingPath,
                handle: selection.selected.handle,
              } : null,
              choiceCalls,
              optionMap,
              exactFetch,
              advisoryOnly: selection.advisoryOnly === true,
              truthAuthority: selection.truthAuthority === true,
              autoApplyAllowed: selection.autoApplyAllowed === true,
            },
            requestStartedAt,
            elapsedMs: endToEndElapsedMs,
          };
          appendFileSync(recordsPath, `${JSON.stringify(record)}\n`, { flag: existsSync(recordsPath) ? "a" : "ax" });
          succeededRequests += 1;
          aggregate.endToEndElapsedMs += endToEndElapsedMs;
          aggregate.providerCalls += Number(selection.providerCalls ?? 0);
          aggregate.inputTokens += Number(selection.usage?.input_tokens ?? 0);
          aggregate.outputTokens += Number(selection.usage?.output_tokens ?? 0);
          aggregate.elapsedMs += Number(selection.elapsedMs ?? 0);
        } catch (error) {
          const record = {
            schemaVersion: 1,
            caseId: item.id,
            language,
            status: "failed",
            failureClass: classifyFailure(error),
            errorName: String(error?.name ?? "Error").slice(0, 80),
            requestStartedAt,
            elapsedMs: Number((performance.now() - requestStarted).toFixed(1)),
            rawErrorPersisted: false,
          };
          appendFileSync(recordsPath, `${JSON.stringify(record)}\n`, { flag: existsSync(recordsPath) ? "a" : "ax" });
          aggregate.endToEndElapsedMs += record.elapsedMs;
          failedRequests += 1;
        }
        completedRequests += 1;
        process.stdout.write(`progress completed=${completedRequests}/${frozen.cases.cases.length * frozen.cases.languages.length} succeeded=${succeededRequests} failed=${failedRequests}\n`);
      }
    }
  } finally {
    await client.close().catch(() => undefined);
    delete environment.TYPESAFE_API_KEY;
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    runId,
    status: failedRequests === 0 ? "complete-exploratory" : "partial-exploratory",
    completedRequests,
    succeededRequests,
    failedRequests,
    independentConceptCount: frozen.cases.cases.length,
    pairedLanguageRequestCount: frozen.cases.cases.length * frozen.cases.languages.length,
    providerCalls: aggregate.providerCalls,
    inputTokens: aggregate.inputTokens,
    outputTokens: aggregate.outputTokens,
    meanEndToEndElapsedMs: completedRequests ? Number((aggregate.endToEndElapsedMs / completedRequests).toFixed(1)) : null,
    exactFetchPassed: aggregate.fetchPassed,
    exactFetchFailed: aggregate.fetchFailed,
    abstentions: aggregate.abstentions,
    serverInfo,
    stderrObserved: stderrSeen,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    thresholdTrial: false,
    finishedAt,
  };
  writeJsonExclusive("summary.json", summary);
  const manifest = readJson("manifest.json");
  writeFileSync(resolve(RUN_ROOT, "manifest.json"), `${JSON.stringify({ ...manifest, status: summary.status, finishedAt, serverInfo, output: { records: "records.jsonl", summary: "summary.json", recordCount: completedRequests } }, null, 2)}\n`, { flag: "w" });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const options = parseArgs(process.argv.slice(2));
if (options.mode === "live") {
  await runLive(options.candidateRoot, options.confirmation);
} else {
  await runPreflight(options.candidateRoot);
}
