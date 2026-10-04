#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const RUN_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(RUN_ROOT, "../../../..");
const RUN_ID = basename(RUN_ROOT);
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
const STAGED_IDENTITY = readJson("inputs/staged-project-identity.json");
const PROJECT_ROOT = resolve(STAGED_IDENTITY.externalProjectRoot);
const writeJsonExclusive = (relativePath, value) => writeFileSync(
  resolve(RUN_ROOT, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  { flag: "wx" },
);

function parseArgs(argv) {
  const result = { mode: "preflight", candidateRoot: CANDIDATE_ROOT, confirmation: null, pauseAfterBootstrap: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--preflight") result.mode = "preflight";
    else if (item === "--live") result.mode = "live";
    else if (item === "--bootstrap-only") result.mode = "bootstrap-only";
    else if (item === "--candidate-root" && argv[index + 1]) result.candidateRoot = resolve(argv[++index]);
    else if (item === "--confirmation" && argv[index + 1]) result.confirmation = argv[++index];
    else if (item === "--pause-after-bootstrap") result.pauseAfterBootstrap = true;
    else throw new Error(`Unsupported or incomplete argument: ${item}`);
  }
  return result;
}

function assertFreshOutputPaths(mode) {
  const relativePaths = mode !== "preflight"
    ? ["manifest.json", "records.jsonl", "summary.json", "route-plan-receipt.json", "route-evidence.json", "bootstrap-receipt.json", "bootstrap-failure.json", "run-completion.json"]
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
  const controlInventory = readJson("inputs/control-support-inventory.json");
  const stagedIdentity = readJson("inputs/staged-project-identity.json");
  assert.equal(cases.cases.length, 26);
  assert.deepEqual(cases.languages, ["en", "es"]);
  assert.equal(corpus.sourceCommit, SOURCE_COMMIT);
  assert.equal(corpus.documents.length, 21);
  assert.equal(inventory.documents.length, 21);
  assert.equal(stagedIdentity.sourceCommit, SOURCE_COMMIT);
  assert.equal(stagedIdentity.documents, 21);
  assert.equal(stagedIdentity.cleanWorkingTree, true);
  assert.equal(stagedIdentity.queryCorpusSourceRefs.length, 21);
  assert.deepEqual(stagedIdentity.queryCorpusSourceRefs, corpus.documents.map((document) => document.sourceRef));
  assert.equal(controlInventory.sourceCommit, SOURCE_COMMIT);
  assert.equal(controlInventory.files.length, stagedIdentity.controlSupportFiles);
  assert.equal(sha256(readFileSync(resolve(RUN_ROOT, "inputs/control-support-inventory.json"))), stagedIdentity.controlSupportInventorySha256);
  assert.equal(existsSync(resolve(RUN_ROOT, "inputs/labels.json")), false, "Labels must not be copied into this run.");
  assert.equal(existsSync(resolve(RUN_ROOT, "inputs/target-index.json")), false, "Target index must not be copied into this run.");
  assert.equal(existsSync(resolve(RUN_ROOT, "project")), false, "MCP project staging must stay outside the benchmark repository.");
  assert.equal(existsSync(resolve(RUN_ROOT, ".git")), false, "Benchmark run must not contain an embedded Git directory.");

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
    const stagedGitBlob = execFileSync("git", ["-C", PROJECT_ROOT, "show", `HEAD:${document.sourceRef}`]);
    assert.equal(sha256(stagedGitBlob), row.sha256, `Staged snapshot commit blob differs from frozen source: ${document.sourceRef}`);
  }

  for (const row of controlInventory.files) {
    const stagedPath = resolve(PROJECT_ROOT, ...row.sourceRef.split("/"));
    const stagedBytes = readFileSync(stagedPath);
    assert.equal(sha256(stagedBytes), row.sha256, `Staged control support hash differs: ${row.sourceRef}`);
    assert.equal(row.matchesSourceCommit, true, `Control support was not verified against source commit: ${row.sourceRef}`);
    const gitBlob = execFileSync("git", ["show", `${SOURCE_COMMIT}:${row.sourceRef}`]);
    assert.equal(sha256(gitBlob), row.sha256, `Canonical Git blob differs from control support: ${row.sourceRef}`);
    const stagedGitBlob = execFileSync("git", ["-C", PROJECT_ROOT, "show", `HEAD:${row.sourceRef}`]);
    assert.equal(sha256(stagedGitBlob), row.sha256, `Staged snapshot commit blob differs from control support: ${row.sourceRef}`);
    assert.ok(row.sourceRef === "AGENTS.md" || row.sourceRef.startsWith(".mssr/"), `Unexpected control-support path: ${row.sourceRef}`);
  }

  const manifestBytes = readFileSync(resolve(PROJECT_ROOT, ".mssr/project-context.json"));
  assert.equal(sha256(manifestBytes), stagedIdentity.projectContextManifestSha256, "Staged project manifest hash differs.");
  const gitHead = execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(gitHead, stagedIdentity.stagedSnapshotCommit, "Staged project Git identity differs.");
  const gitStatus = execFileSync("git", ["-C", PROJECT_ROOT, "status", "--porcelain"], { encoding: "utf8" }).trim();
  assert.equal(gitStatus, "", "Staged project changed after snapshot creation.");
  const trackedRefs = execFileSync("git", ["-C", PROJECT_ROOT, "ls-files"], { encoding: "utf8" }).trim().split(/\r?\n/).sort();
  const expectedTrackedRefs = [...corpus.documents.map((document) => document.sourceRef), ...controlInventory.files.map((row) => row.sourceRef)].sort();
  assert.deepEqual(trackedRefs, expectedTrackedRefs, "Staged project contains files outside the query corpus and control-support inventory.");
  const gitDir = execFileSync("git", ["-C", PROJECT_ROOT, "rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim();
  assert.equal(resolve(gitDir), resolve(stagedIdentity.externalGitDir), "Separate Git metadata is not at its declared external path.");
  assert.equal(statSync(resolve(PROJECT_ROOT, ".git")).isDirectory(), false, "External MCP project root must use a separate-Git-dir pointer file.");
  return { cases, corpus, inventory, controlInventory, inputHashes: EXPECTED_INPUT_HASHES, stagedIdentity };
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
  const traceRecordToolPath = resolve(candidateRoot, "dist/tools/mssr-observatory-tools.js");
  const mssrSelectorPath = resolve(candidateRoot, "node_modules/@mauroprime/mssr/dist/librarian-jev-selection.js");
  const mssrSelectorTypesPath = resolve(candidateRoot, "node_modules/@mauroprime/mssr/dist/librarian-jev-selection.d.ts");
  const bridgeConfig = readFileSync(bridgeConfigPath, "utf8");
  const bridgeTool = readFileSync(bridgeToolPath, "utf8");
  const traceRecordTool = readFileSync(traceRecordToolPath, "utf8");
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
  assert.match(traceRecordTool, /name:\s*["']mssr_trace_record["']/,
    "Candidate does not expose the MSSR verification checkpoint tool.");
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
      mssrTraceRecordTool: sha256(readFileSync(traceRecordToolPath)),
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
  if (error?.bridgeStatus === "mssr-lifecycle-preflight-required") return "lifecycle-preflight";
  if (error?.bootstrapStatus && error.bootstrapStatus !== "complete") return "bootstrap-incomplete";
  const message = String(error?.message ?? "");
  if (/credential|api.?key|unauthori[sz]ed|forbidden/i.test(message)) return "credential-or-authentication";
  if (/rate.?limit|429|quota/i.test(message)) return "rate-limited";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/network|fetch|ECONN|ENOTFOUND|TLS|certificate/i.test(message)) return "network-or-tls";
  if (/schema|probabilit|tool.*missing/i.test(message)) return "tool-or-contract";
  return "provider-or-tool-error";
}

function sanitizedMcpMessage(value) {
  return String(value ?? "")
    .replace(/(?:[A-Za-z]:\\|\\\\)[^\s,;"']+/g, "[path]")
    .replace(/((?:api[_ -]?key|token|password|secret))\s*[:=]\s*[^\s,;]+/ig, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

async function invokePayload(client, toolName, args, stage) {
  let result;
  try {
    result = await client.callTool({ name: toolName, arguments: args });
  } catch (error) {
    error.runStage = stage;
    error.runToolName = toolName;
    error.failureMessage = sanitizedMcpMessage(error?.message ?? error);
    error.failureCode = String(error?.code ?? error?.name ?? "mcp-call-error").slice(0, 100);
    throw error;
  }
  try {
    return extractPayload(result, toolName);
  } catch (error) {
    error.runStage = stage;
    error.runToolName = toolName;
    const errorText = result?.content?.find((item) => item.type === "text")?.text;
    error.failureMessage = sanitizedMcpMessage(errorText ?? error?.message ?? "MCP tool returned an error");
    error.failureCode = String(result?.structuredContent?.code ?? error?.failureCode ?? "mcp-tool-error").slice(0, 100);
    error.bridgeStatus = typeof result?.structuredContent?.status === "string" ? result.structuredContent.status : error.bridgeStatus;
    error.reasonCodes = Array.isArray(result?.structuredContent?.reasonCodes) ? result.structuredContent.reasonCodes.slice(0, 8) : error.reasonCodes;
    throw error;
  }
}

function extractPayload(result, toolName) {
  if (result?.isError) {
    const error = new Error(`${toolName}:mcp-tool-error`);
    error.failureCode = "mcp-tool-error";
    error.mcpIsError = true;
    throw error;
  }
  let payload = result?.structuredContent && typeof result.structuredContent === "object"
    ? result.structuredContent
    : null;
  if (!payload) {
    const text = result?.content?.find((item) => item.type === "text")?.text;
    if (typeof text !== "string") throw new Error(`${toolName}:missing-text-payload`);
    try { payload = JSON.parse(text); } catch { throw new Error(`${toolName}:non-json-payload`); }
  }
  if (payload?.executed === false && typeof payload.status === "string") {
    const error = new Error(`${toolName}:bridge-blocked:${payload.status}`);
    error.bridgeStatus = payload.status;
    error.reasonCodes = Array.isArray(payload.lifecycleDecision?.reasonCodes)
      ? payload.lifecycleDecision.reasonCodes.filter((item) => typeof item === "string").slice(0, 8)
      : [];
    error.failureCode = payload.status;
    error.failureMessage = `Bridge did not execute the requested tool; reasons=${error.reasonCodes.join(",")}`.slice(0, 240);
    throw error;
  }
  return payload;
}

function readProjectContextSelectionTelemetry(candidateRoot, traceId) {
  const logPath = resolve(candidateRoot, "logs/mssr-events.jsonl");
  if (!existsSync(logPath)) return { status: "unavailable", eventCount: 0, events: [], logSha256: null };
  const bytes = readFileSync(logPath);
  const events = [];
  for (const line of bytes.toString("utf8").split(/\r?\n/)) {
    if (!line) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.traceId !== traceId || event.eventType !== "project_context_selection") continue;
    const decisions = Array.isArray(event.details?.decisions) ? event.details.decisions : [];
    events.push({
      stage: event.stage ?? null,
      decisions: decisions.slice(0, 128).map((item) => ({
        id: typeof item.id === "string" ? item.id.slice(0, 120) : null,
        selected: item.selected === true,
        reason: typeof item.reason === "string" ? item.reason.slice(0, 80) : null,
        score: Number.isFinite(item.score) ? item.score : null,
        chars: Number.isFinite(item.chars) ? item.chars : null,
        matched: Array.isArray(item.matched) ? item.matched.slice(0, 32).map((value) => String(value).slice(0, 120)) : [],
        required: item.required === true,
        requiredBy: Array.isArray(item.requiredBy) ? item.requiredBy.slice(0, 16).map((value) => String(value).slice(0, 100)) : [],
      })),
    });
  }
  return { status: events.length > 0 ? "captured" : "no-matching-event", eventCount: events.length, events: events.slice(0, 8), logSha256: sha256(bytes) };
}

function telemetrySelected(telemetry, moduleIds) {
  const wanted = new Set(moduleIds);
  return telemetry?.events?.some((event) => event.decisions?.some((decision) => wanted.has(decision.id) && decision.selected === true)) === true;
}

async function runBootstrap(client, candidateRoot) {
  const routeArguments = {
    task: "Analyze, review, and verify the project evidence for an exploratory paired Jev Librarian benchmark, and discover the capability chain needed to run deterministic search → Jev selection → exact fetch. Load project benchmark history and Jev's feedback-learning-benchmarks procedure. This phase is bootstrap-only; do not call Jev, score, or tune thresholds.",
    projectRoot: PROJECT_ROOT,
    maxProjectContextChars: 40000,
    maxProjectContextModules: 8,
    maxContextChars: 32000,
    context: "Run11 is a fresh bootstrap-only diagnostic parented to v10. Candidate Bridge .156/MSSR .104 and exact 21-document corpus bytes from source commit c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a are pinned; 26 concepts have two paired language requests each (52 rows), and repeated use makes this an exploratory regression comparison rather than independent calibration evidence. This phase must establish the capability route for the search → Jev selection → exact-fetch chain, resolve project core and both Jev evaluation/history modules, and load the benchmark procedure. Stop before provider requests, labels, target-index, or scoring.",
    intent: {
      summary: "Analyze, review, and verify an exploratory paired Jev Librarian retrieval benchmark, including discovery of the search → Jev selection → exact-fetch capability chain. Resolve project core, both Jev evaluation/history modules, and Jev benchmark procedure. No calibration claim or provider call in this phase.",
      domains: ["coding", "skill-system", "agent-orchestration"],
      actions: ["analyze", "review", "verify"],
      artifacts: ["project", "repository", "document", "mcp"],
      needs: ["integrity-verification", "cross-agent"],
      signals: ["uncertainty", "conflicting-evidence", "capability-discovery-needed", "tool-chain-needed"],
      risk: "external-side-effect",
      ambiguity: "low",
    },
    caller: "codex-local",
    taskKey: RUN_ID,
    traceId: RUN_ID,
    workflowKey: "mssr-librarian-benchmark",
    stage: "verify",
    completedPhases: ["discovery", "safety", "implementation"],
    responseMode: "debug",
  };
  const route = await invokePayload(client, "skill_route_plan", routeArguments, "route-plan");
  const activeSkills = Array.isArray(route.activeSkills) ? route.activeSkills : [];
  const optionalCandidates = activeSkills
    .filter((skill) => skill && skill.selectedAsRoot === true && skill.required !== true && typeof skill.name === "string")
    .map((skill) => ({ name: skill.name, phase: skill.phase ?? null }));
  const relevantOptionalNames = new Set(["jev-decision-systems"]);
  const skillDecisions = optionalCandidates
    .filter((skill) => relevantOptionalNames.has(skill.name))
    .map((skill) => ({ skillName: skill.name, decision: "accepted", reasonCode: "useful", stage: "verify" }));
  let bootstrapArguments = route.nextAction?.toolName === "skill_bootstrap" && route.nextAction.arguments
    ? { ...route.nextAction.arguments }
    : { ...routeArguments };
  bootstrapArguments = {
    ...bootstrapArguments,
    task: routeArguments.task,
    projectRoot: PROJECT_ROOT,
    context: routeArguments.context,
    intent: routeArguments.intent,
    caller: routeArguments.caller,
    taskKey: RUN_ID,
    traceId: route.traceId ?? RUN_ID,
    workflowKey: routeArguments.workflowKey,
    stage: routeArguments.stage,
    completedPhases: routeArguments.completedPhases,
    responseMode: "debug",
    selectionMode: "host-gated",
    maxSkills: 8,
    maxProjectContextChars: 40000,
    maxProjectContextModules: 8,
    maxContextChars: 32000,
    skillDecisions,
  };
  const summarizeRouteSkills = (items) => Array.isArray(items)
    ? items.slice(0, 24).map((skill) => ({
      name: skill.name,
      required: skill.required === true,
      selectedAsRoot: skill.selectedAsRoot === true ? true : skill.selectedAsRoot === false ? false : null,
      phase: skill.phase ?? null,
      reason: typeof skill.reason === "string" ? skill.reason.slice(0, 160) : null,
    }))
    : [];
  const summarizeProjectContext = (projectContext) => {
    if (!projectContext || typeof projectContext !== "object") return null;
    const summarizeRefs = (items) => Array.isArray(items) ? items.slice(0, 64).map((item) => ({
      id: item?.id ?? item?.ref ?? null,
      sourcePath: item?.sourcePath ?? item?.path ?? null,
      kind: item?.kind ?? null,
      bytes: Number.isFinite(item?.bytes) ? item.bytes : null,
      sha256: typeof item?.sha256 === "string" ? item.sha256 : null,
    })) : [];
    return {
      stage: projectContext.stage ?? null,
      mode: projectContext.mode ?? null,
      manifestStatus: projectContext.manifestStatus ?? null,
      coreIncluded: typeof projectContext.coreIncluded === "boolean" ? projectContext.coreIncluded : Array.isArray(projectContext.core) ? projectContext.core.length > 0 : null,
      coreCharsLoaded: Number.isFinite(projectContext.coreCharsLoaded) ? projectContext.coreCharsLoaded : Array.isArray(projectContext.core) ? projectContext.core.reduce((sum, item) => sum + (Number.isFinite(item?.bytes) ? item.bytes : 0), 0) : null,
      moduleCharsLoaded: Number.isFinite(projectContext.moduleCharsLoaded) ? projectContext.moduleCharsLoaded : null,
      totalCharsLoaded: Number.isFinite(projectContext.totalCharsLoaded) ? projectContext.totalCharsLoaded : null,
      remainingContextChars: Number.isFinite(projectContext.remainingContextChars) ? projectContext.remainingContextChars : null,
      requiredBudgetExceeded: projectContext.requiredBudgetExceeded === true,
      optionalContextOmitted: projectContext.optionalContextOmitted === true,
      selectionSummary: projectContext.selectionSummary ?? null,
      documents: summarizeRefs(projectContext.documents),
      directives: summarizeRefs(projectContext.directives),
      core: summarizeRefs(projectContext.core),
      selected: summarizeRefs(projectContext.selected),
      decisions: Array.isArray(projectContext.decisions) ? projectContext.decisions.slice(0, 128).map((item) => ({ id: item.id ?? null, selected: item.selected === true, reason: item.reason ?? null, chars: Number.isFinite(item.chars) ? item.chars : null, score: Number.isFinite(item.score) ? item.score : null, matched: Array.isArray(item.matched) ? item.matched.slice(0, 32) : [] })) : [],
    };
  };
  const routeSummary = {
    traceId: route.traceId ?? RUN_ID,
    status: "route-planned",
    statusObserved: typeof route.status === "string" ? route.status : null,
    mcpIsError: false,
    stage: route.stage ?? null,
    intent: {
      summary: route.intent?.summary ?? routeArguments.intent.summary,
      domains: route.intent?.domains ?? routeArguments.intent.domains,
      actions: route.intent?.actions ?? routeArguments.intent.actions,
      artifacts: route.intent?.artifacts ?? routeArguments.intent.artifacts,
      needs: route.intent?.needs ?? routeArguments.intent.needs,
      signals: route.intent?.signals ?? routeArguments.intent.signals,
      risk: route.intent?.risk ?? routeArguments.intent.risk,
    },
    activeSkills: summarizeRouteSkills(activeSkills),
    requiredRootCount: activeSkills.filter((skill) => skill.required === true).length,
    optionalRootCount: activeSkills.filter((skill) => skill.selectedAsRoot === true && skill.required !== true).length,
    candidateCount: activeSkills.length,
    matches: summarizeRouteSkills(route.matches),
    deferredSkills: summarizeRouteSkills(route.deferredSkills),
    nearMatches: Array.isArray(route.nearMatches) ? route.nearMatches.slice(0, 12).map((match) => ({ name: match.name, score: match.score, reason: typeof match.reason === "string" ? match.reason.slice(0, 160) : null })) : [],
    optionalDecisionsAccepted: skillDecisions.map((decision) => decision.skillName),
    selectionPolicy: route.selectionPolicy ?? null,
    nextActionTool: route.nextAction?.toolName ?? null,
    projectContext: summarizeProjectContext(route.contextPlane?.projectContext),
    responseShape: {
      routeKeys: Object.keys(route).sort(),
      contextPlaneKeys: route.contextPlane && typeof route.contextPlane === "object" ? Object.keys(route.contextPlane).sort() : [],
      contextPlaneProjectContextKeys: route.contextPlane?.projectContext && typeof route.contextPlane.projectContext === "object" ? Object.keys(route.contextPlane.projectContext).sort() : [],
    },
  };
  const routeProjectContext = route.contextPlane?.projectContext ?? null;
  const routeEvidence = {
    tool: "skill_route_plan",
    traceId: route.traceId ?? RUN_ID,
    stage: route.stage ?? null,
    responseKeys: Object.keys(route).sort(),
    contextPlaneKeys: route.contextPlane && typeof route.contextPlane === "object" ? Object.keys(route.contextPlane).sort() : [],
    projectContext: summarizeProjectContext(routeProjectContext),
    requested: { maxProjectContextChars: 40000, maxProjectContextModules: 8, coreIncludedByAssemblerDefault: true },
    coreGate: {
      coreIncluded: routeProjectContext?.coreIncluded === true || (Array.isArray(routeProjectContext?.core) && routeProjectContext.core.length > 0),
      coreCharsLoaded: Number.isFinite(routeProjectContext?.coreCharsLoaded) ? routeProjectContext.coreCharsLoaded : Array.isArray(routeProjectContext?.core) ? routeProjectContext.core.reduce((sum, item) => sum + (Number.isFinite(item?.bytes) ? item.bytes : 0), 0) : null,
      passed: (routeProjectContext?.coreIncluded === true || (Array.isArray(routeProjectContext?.core) && routeProjectContext.core.length > 0))
        && (Number.isFinite(routeProjectContext?.coreCharsLoaded) ? routeProjectContext.coreCharsLoaded : Array.isArray(routeProjectContext?.core) ? routeProjectContext.core.reduce((sum, item) => sum + (Number.isFinite(item?.bytes) ? item.bytes : 0), 0) : 0) > 0,
    },
  };
  writeJsonExclusive("route-evidence.json", routeEvidence);
  writeJsonExclusive("route-plan-receipt.json", routeSummary);
  let payload = await invokePayload(client, "skill_bootstrap", bootstrapArguments, "bootstrap");
  const traceId = payload.traceId;
  assert.equal(typeof traceId, "string", "MSSR bootstrap did not return an explicit traceId.");
  const loadedSkills = [];
  const loadedSkillModules = [];
  const loadedEntries = [];
  const contextAssemblyPages = [];
  const projectContextSelections = [];
  const selectedProjectRefs = new Set();
  let hostSelection = null;
  const captureLoaded = (page) => {
    const selection = page.selection;
    if (selection && typeof selection === "object") {
      const names = (items) => Array.isArray(items)
        ? items.slice(0, 32).map((item) => typeof item === "string" ? item : item?.skillName ?? item?.name).filter((name) => typeof name === "string")
        : [];
      hostSelection = {
        mode: selection.mode ?? null,
        requiredRootNames: names(selection.requiredRootNames),
        acceptedOptionalRootNames: names(selection.acceptedOptionalRootNames),
        decisions: Array.isArray(selection.decisions) ? selection.decisions.slice(0, 32).map((item) => ({ skillName: item.skillName, decision: item.decision, reasonCode: item.reasonCode ?? null, stage: item.stage ?? null })) : [],
        skippedCandidates: names(selection.skippedCandidates),
        pendingCandidates: names(selection.pendingCandidates),
        loadedOrder: names(selection.loadedOrder ?? selection.eligibleLoadOrder ?? selection.loadOrder),
        selectionFieldNames: Object.keys(selection).sort().slice(0, 32),
        policy: selection.policy ?? null,
      };
    }
    const shortUnit = (unit) => ({
      id: typeof unit?.id === "string" ? unit.id.slice(0, 180) : null,
      skill: typeof unit?.skill === "string" ? unit.skill.slice(0, 100) : null,
      kind: unit?.kind ?? null,
      module: typeof unit?.module === "string" ? unit.module.slice(0, 120) : null,
      obligation: unit?.obligation ?? null,
      chars: Number.isFinite(unit?.chars) ? unit.chars : null,
    });
    const shortContextSkill = (item) => {
      const info = item?.contextAssembly ?? item ?? {};
      const name = item?.skill?.name ?? item?.skillName ?? item?.name ?? null;
      return {
        name: typeof name === "string" ? name.slice(0, 100) : null,
        obligation: item?.obligation ?? null,
        loaded: item?.loaded === true,
        skippedReason: info.skippedReason ?? item?.warning ?? null,
        coreCharsLoaded: Number.isFinite(info.coreCharsLoaded) ? info.coreCharsLoaded : null,
        moduleCharsLoaded: Number.isFinite(info.moduleCharsLoaded) ? info.moduleCharsLoaded : null,
        contextSatisfied: typeof info.contextSatisfied === "boolean" ? info.contextSatisfied : null,
        skipped: info.skipped === true,
        acceptedOverflowChars: Number.isFinite(info.acceptedOverflowChars) ? info.acceptedOverflowChars : null,
        blocked: Array.isArray(info.blocked) ? info.blocked.slice(0, 32).map(shortUnit) : Array.isArray(info.blockedUnits) ? info.blockedUnits.slice(0, 32).map(shortUnit) : [],
        selectedModules: Array.isArray(info.selectedModules) ? info.selectedModules.slice(0, 32).map((module) => String(module).slice(0, 120)) : [],
        moduleDecisions: Array.isArray(info.moduleDecisions) ? info.moduleDecisions.slice(0, 48).map((decision) => ({
          id: typeof decision.id === "string" ? decision.id.slice(0, 120) : null,
          selected: decision.selected === true,
          reason: typeof decision.reason === "string" ? decision.reason.slice(0, 120) : null,
          chars: Number.isFinite(decision.chars) ? decision.chars : null,
        })) : [],
      };
    };
    const assembly = page.contextAssembly;
    if (assembly && typeof assembly === "object" && contextAssemblyPages.length < 64) {
      contextAssemblyPages.push({
        page: Number.isInteger(assembly.page) ? assembly.page : null,
        planningMode: assembly.planningMode ?? null,
        status: assembly.status ?? null,
        maxContextChars: Number.isFinite(assembly.maxContextChars) ? assembly.maxContextChars : Number.isFinite(assembly.pageContextChars) ? assembly.pageContextChars : null,
        deliveredChars: Number.isFinite(assembly.deliveredChars) ? assembly.deliveredChars : null,
        remainingContextChars: Number.isFinite(assembly.remainingContextChars) ? assembly.remainingContextChars : null,
        requiredOverflowChars: Number.isFinite(assembly.requiredOverflowChars) ? assembly.requiredOverflowChars : null,
        acceptedOverflowChars: Number.isFinite(assembly.acceptedOverflowChars) ? assembly.acceptedOverflowChars : null,
        acceptedOverflowCharsSupported: Number.isFinite(assembly.acceptedOverflowChars),
        budgetExceeded: assembly.budgetExceeded === true,
        requiredBudgetExceeded: assembly.requiredBudgetExceeded === true,
        optionalContextOmitted: assembly.optionalContextOmitted === true,
        optionalModuleCharsLoaded: Number.isFinite(assembly.optionalModuleCharsLoaded) ? assembly.optionalModuleCharsLoaded : null,
        optionalSkillCoreCharsLoaded: Number.isFinite(assembly.optionalSkillCoreCharsLoaded) ? assembly.optionalSkillCoreCharsLoaded : null,
        units: Array.isArray(assembly.units) ? assembly.units.slice(0, 96).map(shortUnit) : [],
        retained: Array.isArray(assembly.retained) ? assembly.retained.slice(0, 96).map(shortUnit) : [],
        omitted: Array.isArray(assembly.omitted) ? assembly.omitted.slice(0, 96).map(shortUnit) : [],
        blocked: Array.isArray(assembly.blocked) ? assembly.blocked.slice(0, 96).map(shortUnit) : [],
        remaining: {
          required: Array.isArray(assembly.remaining?.required) ? assembly.remaining.required.slice(0, 96).map(shortUnit) : [],
          accepted: Array.isArray(assembly.remaining?.accepted) ? assembly.remaining.accepted.slice(0, 96).map(shortUnit) : [],
        },
        skills: Array.isArray(assembly.skills) ? assembly.skills.slice(0, 32).map(shortContextSkill) : [],
        globallySelectedModules: Array.isArray(assembly.globallySelectedModules) ? assembly.globallySelectedModules.slice(0, 64).map((item) => ({ skill: item.skill, module: item.module, tier: item.tier, chars: Number.isFinite(item.chars) ? item.chars : null })) : assembly.globallySelectedModules && typeof assembly.globallySelectedModules === "object" ? { count: assembly.globallySelectedModules.count ?? null, chars: assembly.globallySelectedModules.chars ?? null } : null,
      });
    }
    for (const item of Array.isArray(page.loaded) ? page.loaded : []) {
      const skillName = item.skill?.name ?? item.skillName ?? item.name;
      if (item.loaded === true && typeof skillName === "string" && !loadedSkills.includes(skillName)) loadedSkills.push(skillName);
      const selectedModules = item.contextAssembly?.selectedModules;
      const selectedModuleIds = [];
      for (const module of Array.isArray(selectedModules) ? selectedModules : []) {
        const moduleRef = typeof module === "string" ? module : module.id ?? module.name ?? module.source?.path ?? module.sourceRef ?? module.path;
        if (typeof moduleRef === "string") {
          selectedModuleIds.push(moduleRef);
          if (!loadedSkillModules.includes(moduleRef)) loadedSkillModules.push(moduleRef);
        }
      }
      if (loadedEntries.length < 32) loadedEntries.push({ ...shortContextSkill(item), skillName: typeof skillName === "string" ? skillName : null });
    }
    const projectContext = page.projectContext ?? {};
    if (projectContextSelections.length < 64) projectContextSelections.push({
      manifestStatus: projectContext.manifestStatus ?? null,
      coreIncluded: typeof projectContext.coreIncluded === "boolean" ? projectContext.coreIncluded : null,
      coreCharsLoaded: Number.isFinite(projectContext.coreCharsLoaded) ? projectContext.coreCharsLoaded : null,
      moduleCharsLoaded: Number.isFinite(projectContext.moduleCharsLoaded) ? projectContext.moduleCharsLoaded : null,
      totalCharsLoaded: Number.isFinite(projectContext.totalCharsLoaded) ? projectContext.totalCharsLoaded : null,
      selectionSummary: projectContext.selectionSummary ?? null,
      documents: Array.isArray(projectContext.documents) ? projectContext.documents.slice(0, 64).map((item) => ({ id: item.id ?? item.ref ?? null, sourcePath: item.sourcePath ?? item.path ?? null, kind: item.kind ?? null, bytes: Number.isFinite(item.bytes) ? item.bytes : null })) : [],
      directives: Array.isArray(projectContext.directives) ? projectContext.directives.slice(0, 32).map((item) => ({ id: item.id ?? item.ref ?? null, sourcePath: item.sourcePath ?? item.path ?? null, kind: item.kind ?? null, bytes: Number.isFinite(item.bytes) ? item.bytes : null })) : [],
      core: Array.isArray(projectContext.core) ? projectContext.core.slice(0, 32).map((item) => ({ ref: item.ref ?? null, sourcePath: item.sourcePath ?? null, kind: item.kind ?? null, bytes: Number.isFinite(item.bytes) ? item.bytes : null })) : [],
      selected: Array.isArray(projectContext.selected) ? projectContext.selected.slice(0, 64).map((item) => ({ ref: item.ref ?? null, sourcePath: item.sourcePath ?? null, kind: item.kind ?? null, bytes: Number.isFinite(item.bytes) ? item.bytes : null })) : [],
      decisions: Array.isArray(projectContext.decisions) ? projectContext.decisions.slice(0, 96).map((item) => ({ id: item.id ?? null, selected: item.selected === true, reason: item.reason ?? null, score: Number.isFinite(item.score) ? item.score : null, matched: Array.isArray(item.matched) ? item.matched.slice(0, 12) : [] })) : [],
      requiredBudgetExceeded: Array.isArray(projectContext.requiredBudgetExceeded) ? projectContext.requiredBudgetExceeded.slice(0, 32) : [],
      requiredOverflow: Array.isArray(projectContext.requiredOverflow) ? projectContext.requiredOverflow.slice(0, 32) : [],
      remainingChars: Number.isFinite(projectContext.remainingChars) ? projectContext.remainingChars : null,
    });
    for (const item of Array.isArray(projectContext.documents) ? projectContext.documents : []) {
      const ref = item.sourceRef ?? item.path ?? item.source?.path ?? item.ref ?? item.id;
      if (typeof ref === "string") selectedProjectRefs.add(ref);
    }
    for (const item of Array.isArray(projectContext.directives) ? projectContext.directives : []) {
      const ref = item.sourceRef ?? item.path ?? item.source?.path ?? item.ref ?? item.id;
      if (typeof ref === "string") selectedProjectRefs.add(ref);
    }
    for (const item of [...(Array.isArray(projectContext.core) ? projectContext.core : []), ...(Array.isArray(projectContext.selected) ? projectContext.selected : [])]) {
      const ref = item.sourcePath ?? item.sourceRef ?? item.path ?? item.ref ?? item.id;
      if (typeof ref === "string") selectedProjectRefs.add(ref);
    }
    const assemblyUnits = page.contextAssembly?.units;
    for (const item of Array.isArray(assemblyUnits) ? assemblyUnits : []) {
      const ref = item.sourceRef ?? item.path ?? item.source?.path ?? item.ref ?? item.id;
      if (typeof ref === "string") selectedProjectRefs.add(ref);
    }
  };
  captureLoaded(payload);
  let pages = 1;
  while (payload.mustContinue === true) {
    const action = payload.nextAction;
    assert.equal(action?.toolName, "skill_context_next", "Bootstrap continuation did not return the exact skill_context_next action.");
    assert.equal(action?.arguments?.traceId, traceId, "Context cursor belongs to a different trace.");
    assert.equal(typeof action?.arguments?.cursor, "string", "Bootstrap continuation omitted its opaque cursor.");
    payload = await invokePayload(client, action.toolName, action.arguments, "bootstrap-continuation");
    captureLoaded(payload);
    pages += 1;
    assert.ok(pages <= 64, "Bootstrap context chain exceeded the bounded page limit.");
  }
  if (payload.status !== "complete") {
    const error = new Error("MSSR bootstrap did not complete its context chain.");
    error.bootstrapStatus = payload.status ?? "missing";
    error.failureCode = `bootstrap-status-${error.bootstrapStatus}`;
    throw error;
  }
  if (payload.lifecycleGate?.contextChain !== "complete") {
    const error = new Error("MSSR bootstrap did not expose a completed lifecycle gate.");
    error.bootstrapStatus = payload.status ?? "missing-gate";
    error.failureCode = "bootstrap-lifecycle-gate-incomplete";
    throw error;
  }
  const nextRequiredAction = payload.lifecycleGate.nextRequiredAction;
  assert.ok(["execute-active-phase-then-record-phase-and-replan", "execute-post-context-action-before-active-phase"].includes(nextRequiredAction), "MSSR lifecycle gate returned an unknown nextRequiredAction.");

  let postContextAction = payload.lifecycleGate?.postContextAction ?? null;
  let postContextActionExecuted = false;
  if (postContextAction) {
    assert.equal(nextRequiredAction, "execute-post-context-action-before-active-phase", "Lifecycle gate and postContextAction disagree.");
    assert.equal(typeof postContextAction.toolName, "string", "Post-context action omitted its tool name.");
    assert.ok(postContextAction.arguments && typeof postContextAction.arguments === "object", "Post-context action omitted exact arguments.");
    await invokePayload(client, postContextAction.toolName, postContextAction.arguments, "post-context-action");
    postContextActionExecuted = true;
  } else {
    assert.equal(nextRequiredAction, "execute-active-phase-then-record-phase-and-replan", "Lifecycle gate requires an action that was not supplied.");
  }
  const projectContextTelemetry = readProjectContextSelectionTelemetry(candidateRoot, traceId);
  return {
    traceId,
    routePlan: routeSummary,
    status: payload.status,
    pages,
    stage: payload.lifecycleGate.stage ?? "verify",
    hostSelection,
    bootstrapPlan: {
      loadedOrder: hostSelection?.loadedOrder ?? [],
      policy: hostSelection?.policy ?? null,
      pendingCandidates: hostSelection?.pendingCandidates ?? [],
      selectionFieldNames: hostSelection?.selectionFieldNames ?? [],
      skippedCandidates: hostSelection?.skippedCandidates ?? [],
    },
    loadedSkills: loadedSkills.slice(0, 32),
    loadedSkillModules: loadedSkillModules.slice(0, 64),
    loadedEntries,
    contextAssemblyPages,
    projectContextPages: projectContextSelections,
    projectContextSelections: projectContextTelemetry.events,
    projectContextTelemetry: { status: projectContextTelemetry.status, eventCount: projectContextTelemetry.eventCount, logSha256: projectContextTelemetry.logSha256 },
    routeProjectContextCoreGate: routeEvidence.coreGate,
    bridgeRouteProjectContextCoreGate: {
      coreIncluded: routeSummary.projectContext?.coreIncluded === true,
      coreCharsLoaded: routeSummary.projectContext?.coreCharsLoaded ?? null,
      passed: routeSummary.projectContext?.coreIncluded === true && (routeSummary.projectContext?.coreCharsLoaded ?? 0) > 0,
    },
    selectedProjectRefs: [...selectedProjectRefs].slice(0, 64),
    projectContextStatus: payload.projectContext?.manifestStatus ?? null,
    projectContextLoadedChars: payload.projectContext?.totalCharsLoaded ?? null,
    jevSkillSelected: loadedSkills.includes("jev-decision-systems"),
    feedbackLearningBenchmarksSelected: loadedSkillModules.some((id) => id === "feedback-learning-benchmarks" || id.endsWith(":feedback-learning-benchmarks") || id.endsWith("/feedback-learning-benchmarks.md")),
    mssrJevBenchmarkHistorySelected: telemetrySelected(projectContextTelemetry, ["mssr-jev-confidence-benchmark-history"]) || routeProjectContext?.decisions?.some((item) => item.id === "mssr-jev-confidence-benchmark-history" && item.selected === true) === true,
    mssrJevConfidenceMergeEvaluationSelected: telemetrySelected(projectContextTelemetry, ["mssr-jev-confidence-merge-evaluation"]) || routeProjectContext?.decisions?.some((item) => item.id === "mssr-jev-confidence-merge-evaluation" && item.selected === true) === true,
    postContextAction: postContextAction ? postContextAction.toolName : null,
    postContextActionExecuted,
    lifecycleGate: {
      contextChain: payload.lifecycleGate.contextChain,
      originalNextRequiredAction: nextRequiredAction,
      nextRequiredAction: postContextActionExecuted ? "execute-active-phase-then-record-phase-and-replan" : nextRequiredAction,
    },
  };
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
    runId: RUN_ID,
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
    controlSupportDocuments: frozen.controlInventory.files,
    controlSupportInventorySha256: frozen.stagedIdentity.controlSupportInventorySha256,
    inputHashes: frozen.inputHashes,
    runnerSha256: sha256(readFileSync(resolve(RUN_ROOT, "runner.mjs"))),
    stagedProject: frozen.stagedIdentity,
    controlSupport: frozen.controlInventory,
    candidate,
    model: EXPECTED_MODEL,
    toolProtocol: {
      searchTool: "mssr_librarian_search",
      selectorTool: "mssr_librarian_jev_select",
      fetchTool: "mssr_librarian_fetch",
      traceRecordTool: "mssr_trace_record",
      maxSearchResults: MAX_CANDIDATES,
      fetchCharacterLimit: MAX_FETCH_CHARS,
      selectionInputs: "search-returned revision-bound candidate handles",
      liveTransport: "candidate dist/index.js over local MCP stdio",
      labelsAndTargetsLoaded: false,
    },
    checkedAt: new Date().toISOString(),
  };
  const lifecycleClassification = (() => {
    try {
      extractPayload({ content: [{ type: "text", text: JSON.stringify({
        executed: false,
        status: "mssr-lifecycle-preflight-required",
        lifecycleDecision: { reasonCodes: ["managed-trace-missing", "substantial-operation"] },
      }) }] }, "mssr_librarian_search");
      return { verified: false };
    } catch (error) {
      return {
        verified: classifyFailure(error) === "lifecycle-preflight",
        failureClass: classifyFailure(error),
        bridgeStatus: error.bridgeStatus ?? null,
        reasonCodes: error.reasonCodes ?? [],
        sanitizedMessage: error.failureMessage ?? null,
      };
    }
  })();
  assert.equal(lifecycleClassification.verified, true, "Sanitized lifecycle failures are not classified with their bridge status and reason codes.");
  result.lifecycleFailureClassificationContract = lifecycleClassification;
  writeJsonExclusive("preflight.json", result);
  process.stdout.write(`${JSON.stringify({ status: result.status, providerCallsMade: false, candidate: candidate.bridgeVersion, mssr: candidate.mssrVersion, documents: frozen.corpus.documents.length, concepts: frozen.cases.cases.length, requests: result.pairedLanguageRequestCount })}\n`);
}

async function runLive(candidateRoot, confirmation, pauseAfterBootstrap, bootstrapOnly = false) {
  if (!bootstrapOnly && confirmation !== CONFIRMATION) throw new Error("Live Jev gate is closed: exact coordinator confirmation is required.");
  assertFreshOutputPaths(bootstrapOnly ? "bootstrap-only" : "live");
  const frozen = verifyFrozenCorpus();
  const candidate = verifyCandidate(candidateRoot);
  const runId = RUN_ID;
  const startedAt = new Date().toISOString();
  const preflight = readJson("preflight.json");
  const runnerHash = sha256(readFileSync(resolve(RUN_ROOT, "runner.mjs")));
  assert.equal(preflight.status, "preflight-passed-provider-gate-closed", "A passing offline preflight is required before MCP startup.");
  assert.equal(preflight.runnerSha256, runnerHash, "Preflight was created from a different runner revision.");
  assert.equal(preflight.candidate.mssrArtifactSha256, candidate.mssrArtifactSha256, "Preflight candidate package hash differs from current candidate.");
  const preflightHash = sha256(readFileSync(resolve(RUN_ROOT, "preflight.json")));
  const recordsPath = resolve(RUN_ROOT, "records.jsonl");
  const environment = { ...process.env };
  delete environment.TYPESAFE_API_KEY;
  if (!bootstrapOnly) {
    environment.BRIDGE_MSSR_JEV_CREDENTIAL_TARGET = "TypeSafe:MSSR:JevLab";
    environment.BRIDGE_MSSR_JEV_MODEL = EXPECTED_MODEL;
  }
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
  let bootstrapReceipt = null;
  let traceId = null;
  let completedRequests = 0;
  let succeededRequests = 0;
  let failedRequests = 0;
  let traceCheckpoint = null;
  const aggregate = { providerCalls: 0, inputTokens: 0, outputTokens: 0, elapsedMs: 0, endToEndElapsedMs: 0, fetchPassed: 0, fetchFailed: 0, abstentions: 0 };
  writeJsonExclusive("manifest.json", {
    schemaVersion: 1,
    runId,
    suite: "mssr-librarian-jev-bootstrap-context-diagnostic-v1",
    parentRunId: "mssr-librarian-jev-bridge-0.6.156-mssr-0.2.104-frozen-corpus-20261004T105553Z-v10",
    status: "prepared",
    evaluationClass: "exploratory-build-regression-paired-comparison",
    independentConceptCount: frozen.cases.cases.length,
    pairedLanguageRequestCount: frozen.cases.cases.length * frozen.cases.languages.length,
    sourceCommit: SOURCE_COMMIT,
    candidate,
    model: EXPECTED_MODEL,
    inputs: frozen.inputHashes,
    preflightSha256: preflightHash,
    runnerSha256: runnerHash,
    controlSupportInventorySha256: frozen.stagedIdentity.controlSupportInventorySha256,
    stagedProject: frozen.stagedIdentity,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    preparedAt: startedAt,
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
    for (const name of ["skill_route_plan", "skill_bootstrap", "skill_context_next", "mssr_librarian_search", "mssr_librarian_jev_select", "mssr_librarian_fetch", "mssr_trace_record"]) {
      assert.ok(tools.has(name), `Candidate MCP catalog is missing ${name}.`);
    }
    try {
      bootstrapReceipt = await runBootstrap(client, candidateRoot);
      traceId = bootstrapReceipt.traceId;
      writeJsonExclusive("bootstrap-receipt.json", bootstrapReceipt);
      process.stdout.write(`${JSON.stringify({ status: "bootstrap-complete", traceId, pages: bootstrapReceipt.pages, nextRequiredAction: bootstrapReceipt.lifecycleGate.nextRequiredAction, jevPhaseStarted: false, bootstrapOnly })}\n`);
      if (bootstrapOnly) {
        const finishedAt = new Date().toISOString();
        const status = "bootstrap-diagnostic-complete-provider-phase-not-started";
        const missingContextObligations = [
          !bootstrapReceipt.routeProjectContextCoreGate.passed ? "Project Context core was not confirmed loaded before module selection" : null,
          !bootstrapReceipt.jevSkillSelected ? "jev-decision-systems is not confirmed in loaded[]" : null,
          !bootstrapReceipt.feedbackLearningBenchmarksSelected ? "feedback-learning-benchmarks is not confirmed in loaded[]" : null,
          !bootstrapReceipt.mssrJevBenchmarkHistorySelected ? "MSSR Jev benchmark-history module is not selected" : null,
          !bootstrapReceipt.mssrJevConfidenceMergeEvaluationSelected ? "MSSR Jev merge-evaluation module is not selected" : null,
        ].filter(Boolean);
        writeJsonExclusive("summary.json", { schemaVersion: 1, runId, status, providerCalls: 0, labelsRead: false, targetIndexRead: false, scoringPerformed: false, bootstrapReceipt, missingContextObligations, runnerConfiguredCredentialLookupTarget: false, finishedAt });
        writeJsonExclusive("run-completion.json", { schemaVersion: 1, runId, status, providerCalls: 0, jevPhaseStarted: false, runnerConfiguredCredentialLookupTarget: false, finishedAt });
        process.stdout.write(`${JSON.stringify({ status, providerCallsMade: false, jevPhaseStarted: false, runnerConfiguredCredentialLookupTarget: false, missingContextObligations })}\n`);
        return;
      }
      const missingContextObligations = [
        !bootstrapReceipt.jevSkillSelected ? "jev-decision-systems core not confirmed in loaded[]" : null,
        !bootstrapReceipt.feedbackLearningBenchmarksSelected ? "feedback-learning-benchmarks module not confirmed in loaded[]" : null,
        !bootstrapReceipt.mssrJevBenchmarkHistorySelected ? "MSSR Jev benchmark history module not selected from project context" : null,
        !bootstrapReceipt.mssrJevConfidenceMergeEvaluationSelected ? "MSSR Jev merge-evaluation module not selected from project context" : null,
      ].filter(Boolean);
      if (missingContextObligations.length > 0) {
        const finishedAt = new Date().toISOString();
        const status = "bootstrap-capability-gate-blocked";
        writeJsonExclusive("summary.json", { schemaVersion: 1, runId, status, providerCalls: 0, labelsRead: false, targetIndexRead: false, scoringPerformed: false, missingContextObligations, bootstrapReceipt, finishedAt });
        writeJsonExclusive("run-completion.json", { schemaVersion: 1, runId, status, missingContextObligations, providerCalls: 0, finishedAt });
        process.stdout.write(`${JSON.stringify({ status, providerCallsMade: false, jevPhaseStarted: false, missingContextObligations })}\n`);
        return;
      }
      if (pauseAfterBootstrap) {
        process.stdout.write("awaiting-parent-gate: send START_JEV on this process stdin to begin live requests\n");
        const input = createInterface({ input: process.stdin });
        const approval = await new Promise((resolveApproval) => {
          input.once("line", (line) => resolveApproval(line.trim()));
          input.once("close", () => resolveApproval(""));
        });
        input.close();
        if (approval !== "START_JEV") {
          const finishedAt = new Date().toISOString();
          writeJsonExclusive("summary.json", { schemaVersion: 1, runId, status: "provider-phase-not-started", providerCalls: 0, labelsRead: false, targetIndexRead: false, scoringPerformed: false, bootstrapReceipt, finishedAt });
          writeJsonExclusive("run-completion.json", { schemaVersion: 1, runId, status: "provider-phase-not-started", reason: "explicit START_JEV input was not received", providerCalls: 0, finishedAt });
          return;
        }
      }
    } catch (error) {
      const failure = {
        schemaVersion: 1,
        status: error?.bridgeStatus ?? "bootstrap-failed",
        failureClass: classifyFailure(error),
        failureCode: String(error?.failureCode ?? error?.bridgeStatus ?? "bootstrap-error").slice(0, 100),
        failureMessage: sanitizedMcpMessage(error?.failureMessage ?? error?.message ?? "MSSR bootstrap did not complete; Jev phase was not started."),
        failedStage: error?.runStage ?? "bootstrap",
        failedTool: error?.runToolName ?? "skill_bootstrap",
        mcpIsError: error?.mcpIsError === true,
        bootstrapStatus: error?.bootstrapStatus ?? null,
        reasonCodes: Array.isArray(error?.reasonCodes) ? error.reasonCodes.slice(0, 8) : [],
        providerCallsMade: false,
        labelsRead: false,
        targetIndexRead: false,
        scoringPerformed: false,
        serverInfo,
        failedAt: new Date().toISOString(),
      };
      writeJsonExclusive("bootstrap-failure.json", failure);
      const terminalStatus = failure.failureClass === "lifecycle-preflight" ? "lifecycle-preflight-blocked" : "bootstrap-failed";
      writeJsonExclusive("summary.json", {
        schemaVersion: 1,
        runId,
        status: terminalStatus,
        completedRequests: 0,
        succeededRequests: 0,
        failedRequests: 0,
        providerCalls: 0,
        labelsRead: false,
        targetIndexRead: false,
        scoringPerformed: false,
        bootstrapFailure: failure,
        finishedAt: failure.failedAt,
      });
      writeJsonExclusive("run-completion.json", { schemaVersion: 1, runId, status: terminalStatus, providerCalls: 0, bootstrapFailure: failure, finishedAt: failure.failedAt });
      process.stdout.write(`${JSON.stringify({ status: terminalStatus, providerCallsMade: false, failureClass: failure.failureClass, failureCode: failure.failureCode })}\n`);
      return;
    }
    const refs = frozen.corpus.documents.map((item) => item.sourceRef);
    let lifecycleBlocked = false;
    for (const item of frozen.cases.cases) {
      for (const language of frozen.cases.languages) {
        if (lifecycleBlocked) break;
        const query = item[language];
        const caseId = `${item.id}:${language}`;
        const requestStartedAt = new Date().toISOString();
        const requestStarted = performance.now();
        let currentStage = "search";
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
          currentStage = "selection";
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
            currentStage = "exact-fetch";
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
            traceId,
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
            traceId,
            status: "failed",
            failureClass: classifyFailure(error),
            errorName: String(error?.name ?? "Error").slice(0, 80),
            failureCode: String(error?.failureCode ?? error?.bridgeStatus ?? classifyFailure(error)).slice(0, 100),
            failureMessage: String(error?.failureMessage ?? "Tool request failed; raw provider/tool content omitted.").slice(0, 240),
            bridgeStatus: error?.bridgeStatus ?? null,
            reasonCodes: Array.isArray(error?.reasonCodes) ? error.reasonCodes.slice(0, 8) : [],
            failureStage: currentStage,
            requestStartedAt,
            elapsedMs: Number((performance.now() - requestStarted).toFixed(1)),
            rawErrorPersisted: false,
          };
          appendFileSync(recordsPath, `${JSON.stringify(record)}\n`, { flag: existsSync(recordsPath) ? "a" : "ax" });
          aggregate.endToEndElapsedMs += record.elapsedMs;
          failedRequests += 1;
          if (error?.bridgeStatus === "mssr-lifecycle-preflight-required") lifecycleBlocked = true;
        }
        completedRequests += 1;
        process.stdout.write(`progress completed=${completedRequests}/${frozen.cases.cases.length * frozen.cases.languages.length} succeeded=${succeededRequests} failed=${failedRequests}\n`);
      }
      if (lifecycleBlocked) break;
    }
    const verificationPassed = completedRequests === frozen.cases.cases.length * frozen.cases.languages.length
      && failedRequests === 0
      && aggregate.fetchFailed === 0;
    const checkpointStatus = verificationPassed ? "success" : completedRequests > 0 ? "partial" : "failed";
    try {
      await invokePayload(client, "mssr_trace_record", {
        traceId,
        eventType: "verification",
        caller: "codex-local",
        stage: "verify",
        primarySkill: bootstrapReceipt.jevSkillSelected ? "jev-decision-systems" : "mssr-agent-routing",
        supportingSkills: bootstrapReceipt.loadedSkills.filter((name) => name !== "jev-decision-systems").slice(0, 24),
        status: checkpointStatus,
        completedPhases: ["verification"],
        verificationPassed,
        evidenceKind: "manifest",
        evidenceRef: `${runId}/records.jsonl`,
        signals: failedRequests === 0 ? ["nominal"] : ["error-observed"],
        summary: `Exploratory paired benchmark capture: ${completedRequests}/52 request records, ${succeededRequests} completed tool chains, ${failedRequests} failures, ${aggregate.fetchPassed} exact fetches passed, ${aggregate.fetchFailed} failed. No labels read and no scoring performed.`,
      }, "trace-verification-checkpoint");
      traceCheckpoint = { status: "recorded", eventType: "verification", completedPhases: ["verification"], verificationPassed };
    } catch (error) {
      traceCheckpoint = {
        status: "failed",
        eventType: "verification",
        failureClass: classifyFailure(error),
        failureCode: String(error?.failureCode ?? error?.code ?? "trace-checkpoint-error").slice(0, 100),
        failureMessage: sanitizedMcpMessage(error?.failureMessage ?? error?.message ?? "Verification checkpoint was not recorded."),
      };
    }
  } finally {
    await client.close().catch(() => undefined);
    delete environment.TYPESAFE_API_KEY;
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    runId,
    status: lifecycleBlocked ? "lifecycle-preflight-blocked" : failedRequests === 0 ? "complete-exploratory" : "partial-exploratory",
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
    traceId,
    bootstrapReceipt,
    traceCheckpoint,
    stderrObserved: stderrSeen,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    thresholdTrial: false,
    finishedAt,
  };
  writeJsonExclusive("summary.json", summary);
  writeJsonExclusive("run-completion.json", {
    schemaVersion: 1,
    runId,
    status: summary.status,
    providerCalls: aggregate.providerCalls,
    recordCount: completedRequests,
    traceId,
    traceCheckpoint,
    finishedAt,
    recordsSha256: existsSync(recordsPath) ? sha256(readFileSync(recordsPath)) : null,
    summarySha256: sha256(readFileSync(resolve(RUN_ROOT, "summary.json"))),
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const options = parseArgs(process.argv.slice(2));
if (options.mode === "live") {
  await runLive(options.candidateRoot, options.confirmation, options.pauseAfterBootstrap, false);
} else if (options.mode === "bootstrap-only") {
  await runLive(options.candidateRoot, null, false, true);
} else {
  await runPreflight(options.candidateRoot);
}
