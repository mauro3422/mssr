import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const runDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8"));
const allowNetwork = process.argv.includes("--allow-network");
const cases = JSON.parse(await fs.readFile(path.join(runDir, "inputs/cases.json"), "utf8")).cases;
const labels = JSON.parse(await fs.readFile(path.join(runDir, "inputs/labels.json"), "utf8"));
const bridgeRoot = manifest.source.bridgeRoot;
const projectRoot = manifest.corpus.projectRoot;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const hashFile = async (file) => hash(await fs.readFile(file));
const json = (value) => JSON.stringify(value) + "\n";
const outputs = ["request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json", "SHA256SUMS"];
for (const file of outputs) {
  await fs.access(path.join(runDir, file)).then(
    () => { throw new Error("Refusing to overwrite output: " + file); },
    (error) => { if (error?.code !== "ENOENT") throw error; },
  );
}
assert.equal(manifest.status, "prepared");
assert.equal(cases.length, manifest.plan.expectedRequestCount);
assert.equal(await hashFile(path.join(runDir, "runner.mjs")), manifest.instrument.runnerSha256);
assert.equal(await hashFile(path.join(runDir, "inputs/cases.json")), manifest.instrument.casesSha256);
assert.equal(await hashFile(path.join(runDir, "inputs/labels.json")), manifest.labels.labelFileSha256);
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(runDir, source.snapshotPath)), source.sha256, "snapshot changed: " + source.sourceRef);
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, "source changed since freeze: " + source.sourceRef);
}
for (const artifact of manifest.source.buildArtifacts) {
  assert.equal(await hashFile(path.join(bridgeRoot, artifact.path)), artifact.sha256, "build artifact changed: " + artifact.path);
}
if (!allowNetwork) {
  console.log(JSON.stringify({
    status: "dry-run",
    networkRequests: 0,
    requestedCalls: cases.length,
    requestedModel: manifest.provider.requestedModel,
    sourceDocuments: manifest.corpus.sources.length,
    independentUnits: manifest.plan.independentUnit,
    cases: cases.map(({ id, sourceRef, query }) => ({ id, sourceRef, query })),
    labelsRead: false,
  }, null, 2));
  process.exit(0);
}
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.provider.networkOptIn, true);
assert.equal(manifest.provider.networkOptInMethod, "explicit command-line --allow-network plus user authorization recorded in manifest");
const frozenManifestHash = await hashFile(path.join(runDir, "manifest.json"));
const registryUrl = pathToFileURL(path.join(bridgeRoot, "dist/tool-registry.js")).href;
const toolsUrl = pathToFileURL(path.join(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href;
const [{ createToolRegistry }, { createMssrJevBridgeDecisionProvider, createMssrSemanticEvidenceToolModule }] = await Promise.all([
  import(registryUrl),
  import(toolsUrl),
]);
const provider = createMssrJevBridgeDecisionProvider({ model: manifest.provider.requestedModel });
const registry = createToolRegistry([createMssrSemanticEvidenceToolModule({ decisionProvider: provider })]);
assert.ok(registry.has("mssr_librarian_search"));
assert.ok(registry.has("mssr_librarian_jev_select"));
assert.ok(registry.has("mssr_librarian_fetch"));
assert.ok(registry.has("mssr_librarian_evidence_pack"));

const appendJsonl = async (file, value) => fs.appendFile(path.join(runDir, file), json(value), "utf8");
const records = [];
for (const testCase of cases) {
  const request = {
    caseId: testCase.id,
    sourceRefs: [testCase.sourceRef],
    query: testCase.query,
    metadataMode: "off",
    requestedModel: manifest.provider.requestedModel,
  };
  const requestFingerprint = hash(Buffer.from(JSON.stringify(request), "utf8"));
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  await appendJsonl("request-events.jsonl", {
    event: "request-started",
    caseId: testCase.id,
    requestFingerprint,
    startedAt,
    inputHashes: [manifest.corpus.sources.find((source) => source.sourceRef === testCase.sourceRef).sha256],
  });
  const record = {
    caseId: testCase.id,
    requestFingerprint,
    startedAt,
    connector: "local Bridge release module",
    toolChain: ["mssr_librarian_search", "mssr_librarian_jev_select", "mssr_librarian_fetch", "mssr_librarian_evidence_pack"],
    sourceRef: testCase.sourceRef,
    sourceSha256: manifest.corpus.sources.find((source) => source.sourceRef === testCase.sourceRef).sha256,
    query: testCase.query,
    requestedProvider: manifest.provider.provider,
    requestedModel: manifest.provider.requestedModel,
    status: "failed",
    failureClass: null,
    elapsedMs: null,
    search: null,
    jev: null,
    fetch: null,
    evidencePack: null,
  };
  try {
    const search = await registry.call("mssr_librarian_search", {
      projectRoot,
      sourceRefs: [testCase.sourceRef],
      metadataMode: "off",
      query: { query: testCase.query, maxResults: 100, maxSnippetChars: 240 },
    });
    const searchResults = search.results ?? [];

    const candidateHandles = searchResults.map((item) => item.handle).filter(Boolean);
    const selected = await registry.call("mssr_librarian_jev_select", {
      projectRoot,
      sourceRefs: [testCase.sourceRef],
      query: testCase.query,
      ...(candidateHandles.length > 0 ? { candidateHandles } : {}),
      model: manifest.provider.requestedModel,
    });
    record.search = {
      sourceCount: search.sourceCount,
      resultCount: searchResults.length,

      results: searchResults.map((item) => ({
        title: item.title ?? null,
        headingPath: item.headingPath ?? null,
        lexicalScore: item.score ?? null,
        handle: item.handle ?? null,
      })),
    };
    const candidateSetFingerprint = hash(Buffer.from(JSON.stringify({
      sourceRef: testCase.sourceRef,
      sourceSha256: record.sourceSha256,
      query: testCase.query,
      requestedModel: manifest.provider.requestedModel,
      candidateHandles,
    }), "utf8"));
    record.jev = {
      candidateSetFingerprint,
      providerRequestId: selected.providerRequestId ?? null,
      status: selected.status,
      provider: selected.provider ?? null,
      returnedModel: selected.model ?? null,
      rawChoiceConfidence: selected.providerConfidence ?? null,
      confidenceCalibration: selected.confidenceCalibration ?? "unknown",
      noul: selected.noul ?? selected.sufficiency ?? null,
      requestFingerprint: selected.requestFingerprint ?? null,
      elapsedMs: selected.elapsedMs ?? null,
      usage: selected.usage ?? null,
      candidateCount: selected.candidateCount ?? candidateHandles.length,
      choiceCalls: selected.choiceCalls ?? null,
      selected: selected.selected ? {
        title: selected.selected.title ?? null,
        headingPath: selected.selected.headingPath ?? null,
        handle: selected.selected.handle ?? null,
      } : null,
      advisoryOnly: selected.advisoryOnly ?? null,
      truthAuthority: selected.truthAuthority ?? null,
      verification: selected.verification ?? null,
    };
    record.returnedProvider = selected.provider ?? null;
    record.returnedModel = selected.model ?? null;
    if (selected.status === "selected" && selected.selected?.handle) {
      const fetched = await registry.call("mssr_librarian_fetch", {
        projectRoot,
        handle: selected.selected.handle,
      });
      record.fetch = {
        status: fetched.status ?? "fetched",
        handleId: fetched.handle?.id ?? null,
        revision: fetched.handle?.revision ?? null,
        fingerprint: fetched.handle?.fingerprint ?? null,
        textSha256: hash(Buffer.from(fetched.text ?? "", "utf8")),
        selectedFingerprint: selected.selected.handle.fingerprint,
        passed: fetched.handle?.fingerprint === selected.selected.handle.fingerprint,
        textChars: (fetched.text ?? "").length,
        text: fetched.text ?? null,
      };
      const pack = await registry.call("mssr_librarian_evidence_pack", {
        projectRoot,
        sourceRefs: [testCase.sourceRef],
        handles: [selected.selected.handle],
        dedupeContainedRanges: false,
      });
      record.evidencePack = {
        status: pack.status ?? "complete",
        evidenceCount: pack.evidence?.length ?? pack.items?.length ?? pack.entries?.length ?? null,
        outputSha256: hash(Buffer.from(JSON.stringify(pack), "utf8")),
        rawPack: pack,
      };
    }
    record.status = "complete";
  } catch (error) {
    record.status = "failed";
    record.failureClass = error?.name === "AssertionError" ? "validation-error" : "provider-or-tool-chain-error";
    record.safeErrorName = error?.name ?? "Error";
  }
  record.elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  record.completedAt = new Date().toISOString();
  records.push(record);
  await appendJsonl("records.jsonl", record);
  await appendJsonl("request-events.jsonl", {
    event: "request-completed",
    caseId: testCase.id,
    requestFingerprint,
    completedAt: record.completedAt,
    status: record.status,
  });
}
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, "source changed during run: " + source.sourceRef);
}
const labelByCase = new Map(labels.cases.map((label) => [label.caseId, label]));
const scored = records.map((record) => {
  const label = labelByCase.get(record.caseId);
  assert.ok(label, "missing label " + record.caseId);
  const selected = record.jev?.selected;
  const targetInSearchTop100 = Boolean(label.expectedHeading && record.search?.results?.some((item) => ((item.title ?? "") + "\n" + (item.headingPath ?? "")).includes(label.expectedHeading)));
  return {
    caseId: record.caseId,
    sourceRef: record.sourceRef,
    expectedHeading: label.expectedHeading,
    observedHeading: selected?.title ?? null,
    exactHeadingMatch: Boolean(record.status === "complete" && selected?.title === label.expectedHeading),
    targetInSearchTop100,
    exactFetchPassed: Boolean(record.fetch?.passed),
    evidencePackBuilt: Boolean(record.evidencePack?.outputSha256),
    status: record.status,
  };
});
const summary = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: records.every((record) => record.status === "complete") ? "complete" : "partial",
  expectedRequests: cases.length,
  attemptedRequests: records.length,
  successfulRequests: records.filter((record) => record.status === "complete").length,
  failedRequests: records.filter((record) => record.status === "failed").length,
  sourceDocumentClusters: new Set(records.map((record) => record.sourceRef)).size,
  independentUnits: manifest.plan.independentUnit,
  exactHeadingMatches: scored.filter((item) => item.exactHeadingMatch).length,
  exactHeadingDenominator: scored.length,
  searchTargetRecallAt100: scored.filter((item) => item.targetInSearchTop100).length,
  searchTargetRecallAt100Denominator: scored.length,
  exactFetchesWithFingerprint: scored.filter((item) => item.exactFetchPassed).length,
  evidencePacksBuilt: scored.filter((item) => item.evidencePackBuilt).length,
  tokenUsage: {
    input: records.reduce((sum, record) => sum + (record.jev?.usage?.input_tokens ?? 0), 0),
    output: records.reduce((sum, record) => sum + (record.jev?.usage?.output_tokens ?? 0), 0),
  },
  records: scored,
  limitations: [
    "Exploratory source-derived case set; labels are not independently or owner adjudicated.",
    "Cases are grouped by source document; repeated queries are diagnostics, not independent units.",
    "Raw Choice confidence and Noul are uncalibrated descriptive provider outputs.",
    "This diagnostic does not estimate generalization or confidence calibration.",
    "Exact-heading matching is a strict diagnostic; adjacent exact evidence may still be useful and requires blind review.",
    "The Bridge package implementation used by the local runner is clean release 0.6.169 / MSSR 0.2.121, not the active MCP server process; runtime activation is independently reported only by the existing Bridge smoke."
  ],
  runtime: {
    bridgeCommit: manifest.source.bridgeCommit,
    bridgeVersion: manifest.source.bridgeVersion,
    mssrVersion: manifest.source.mssrVersion,
    requestedModel: manifest.provider.requestedModel,
    returnedModel: records.find((record) => record.returnedModel)?.returnedModel ?? null,
  },
};
await fs.writeFile(path.join(runDir, "summary.json"), json(summary), "utf8");
await fs.writeFile(path.join(runDir, "run-completion.json"), json({
  schemaVersion: 1,
  runId: manifest.runId,
  manifestSha256: frozenManifestHash,
  status: summary.status,
  completedAt: new Date().toISOString(),
  attemptedRequests: records.length,
  successfulRequests: summary.successfulRequests,
  failedRequests: summary.failedRequests,
  labelsExposedToProvider: false,
  networkOptInUsed: true,
  argvContainsAllowNetwork: true,
}), "utf8");
const fileList = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name !== "SHA256SUMS") fileList.push(path.relative(runDir, full).replaceAll("\\", "/"));
  }
}
await walk(runDir);
fileList.sort();
const sums = [];
for (const file of fileList) sums.push((await hashFile(path.join(runDir, file))) + "  " + file);
await fs.writeFile(path.join(runDir, "SHA256SUMS"), sums.join("\n") + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));