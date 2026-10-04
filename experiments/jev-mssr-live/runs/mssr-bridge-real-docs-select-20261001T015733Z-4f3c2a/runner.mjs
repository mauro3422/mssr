import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const runDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const manifestPath = path.join(runDir, "manifest.json");
const inputsDir = path.join(runDir, "inputs");
const bridgeRoot = process.env.BRIDGE_REPO ?? "D:\\Dev\\bridge-mcp";
const projectRoot = process.env.MSSR_PROJECT ?? "D:\\Dev\\mssr";
const allowNetwork = process.argv.includes("--allow-network");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function hashFile(filePath) {
  return sha256(await fs.readFile(filePath));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

const manifest = await readJson(manifestPath);
assert.equal(manifest.status, "prepared", "run must start from a frozen prepared manifest");
const casesFile = await readJson(path.join(inputsDir, "cases.json"));
const cases = casesFile.cases;
assert.ok(Array.isArray(cases) && cases.length === manifest.plan.expectedRequestCount, "case inventory does not match the frozen manifest");
assert.equal(await hashFile(path.join(runDir, "runner.mjs")), manifest.instrument.runnerSha256, "runner changed after manifest freeze");
assert.equal(await hashFile(path.join(inputsDir, "cases.json")), manifest.instrument.casesSha256, "case file changed after manifest freeze");
const inputFiles = [
  "inputs/cases.json",
  "inputs/labels.json",
  "inputs/semantic-evidence-plane.md",
  "inputs/jev-confidence-merge-evaluation.md",
];
for (const relativePath of inputFiles) {
  assert.equal(await hashFile(path.join(runDir, relativePath)), manifest.frozenInputHashes[relativePath], `frozen input changed: ${relativePath}`);
}
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(runDir, source.snapshotPath)), source.sha256, `corpus snapshot changed: ${source.sourceRef}`);
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, `live source changed since freeze: ${source.sourceRef}`);
}
for (const artifact of manifest.source.buildArtifacts) {
  assert.equal(await hashFile(path.join(projectRoot, artifact.path)), artifact.sha256, `MSSR build artifact changed: ${artifact.path}`);
}
for (const artifact of manifest.source.hostBuild.buildArtifacts) {
  assert.equal(await hashFile(path.join(bridgeRoot, artifact.path)), artifact.sha256, `Bridge build artifact changed: ${artifact.path}`);
}
assert.equal((await readJson(path.join(bridgeRoot, "node_modules/@mauroprime/mssr/package.json"))).version, "0.2.95");
assert.equal((await readJson(path.join(bridgeRoot, "package.json"))).version, "0.6.143");
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.provider.networkOptIn, true);

if (!allowNetwork) {
  console.log(JSON.stringify({
    status: "dry-run",
    networkRequests: 0,
    requestedCalls: cases.length,
    model: manifest.provider.requestedModel,
    cases: cases.map(({ id, query, sourceRefs }) => ({ id, query, sourceRefs })),
    labelsRead: false,
  }, null, 2));
  process.exit(0);
}

for (const outputPath of ["records.jsonl", "summary.json", "scoring.json"]) {
  await fs.access(path.join(runDir, outputPath)).then(
    () => { throw new Error(`refusing to overwrite existing run output: ${outputPath}`); },
    (error) => { if (error?.code !== "ENOENT") throw error; },
  );
}

const registryUrl = pathToFileURL(path.join(bridgeRoot, "dist/tool-registry.js")).href;
const providerModuleUrl = pathToFileURL(path.join(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href;
const [{ createToolRegistry }, { createMssrJevBridgeDecisionProvider, createMssrSemanticEvidenceToolModule }] = await Promise.all([
  import(registryUrl),
  import(providerModuleUrl),
]);
const decisionProvider = createMssrJevBridgeDecisionProvider({ model: manifest.provider.requestedModel });
const registry = createToolRegistry([createMssrSemanticEvidenceToolModule({ decisionProvider })]);
assert.ok(registry.has("mssr_librarian_jev_select"));
assert.ok(registry.has("mssr_librarian_fetch"));

manifest.status = "running";
manifest.startedAt = new Date().toISOString();
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const preRunSums = [];
for (const relativePath of [...inputFiles, "runner.mjs", "manifest.json"]) {
  preRunSums.push(`${await hashFile(path.join(runDir, relativePath))}  ${relativePath}`);
}
await fs.writeFile(path.join(runDir, "SHA256SUMS"), `${preRunSums.join("\n")}\n`, "utf8");

const rawRecords = [];
let firstReturnedModel = null;
let callsSucceeded = 0;
let callsFailed = 0;
for (const testCase of cases) {
  const record = {
    caseId: testCase.id,
    startedAt: new Date().toISOString(),
    requestedModel: manifest.provider.requestedModel,
    sourceRefs: testCase.sourceRefs,
    query: testCase.query,
  };
  try {
    const selected = await registry.call("mssr_librarian_jev_select", {
      projectRoot,
      sourceRefs: testCase.sourceRefs,
      query: testCase.query,
      model: manifest.provider.requestedModel,
    });
    record.requestFingerprint = selected.requestFingerprint;
    record.status = selected.status;
    record.candidateCount = selected.candidateCount;
    record.advisoryOnly = selected.advisoryOnly;
    record.truthAuthority = selected.truthAuthority;
    record.verification = selected.verification;
    record.confidenceCalibration = selected.confidenceCalibration;
    record.providerConfidence = selected.providerConfidence ?? null;
    record.provider = selected.provider ?? null;
    record.returnedModel = selected.model ?? null;
    record.usage = selected.usage ?? null;
    record.elapsedMs = selected.elapsedMs ?? null;
    if (record.returnedModel && !firstReturnedModel) firstReturnedModel = record.returnedModel;
    if (selected.status === "selected" && selected.selected) {
      record.selected = {
        sourceRef: selected.selected.handle.sourceRef,
        title: selected.selected.title,
        headingPath: selected.selected.headingPath,
        revision: selected.selected.handle.revision,
        rangeId: selected.selected.handle.rangeId,
        fingerprint: selected.selected.handle.fingerprint,
        handleId: selected.selected.handle.id,
      };
      const fetched = await registry.call("mssr_librarian_fetch", {
        projectRoot,
        handle: selected.selected.handle,
      });
      record.exactFetch = {
        passed: fetched.handle.fingerprint === selected.selected.handle.fingerprint,
        fingerprint: fetched.handle.fingerprint,
        textSha256: sha256(Buffer.from(fetched.text, "utf8")),
        textChars: fetched.text.length,
      };
    } else {
      record.selected = null;
      record.exactFetch = null;
    }
    callsSucceeded++;
  } catch {
    record.status = "failed";
    record.failureClass = "provider-or-host-adapter-error";
    callsFailed++;
  }
  record.completedAt = new Date().toISOString();
  rawRecords.push(record);
  await fs.appendFile(path.join(runDir, "records.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
  if (record.status === "failed") break;
}

for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(projectRoot, ...source.sourceRef.split("/"))), source.sha256, `live source changed during selection run: ${source.sourceRef}`);
}

const labels = await readJson(path.join(inputsDir, "labels.json"));
const caseLabels = new Map(labels.cases.map((label) => [label.caseId, label]));
const scored = rawRecords.map((record) => {
  const label = caseLabels.get(record.caseId);
  assert.ok(label, `missing frozen label: ${record.caseId}`);
  const exactTargetMatch = label.expectedStatus === "abstained"
    ? record.status === "abstained"
    : record.status === "selected"
      && record.selected?.sourceRef === label.expectedSourceRef
      && record.selected?.title === label.expectedTitle;
  return {
    caseId: record.caseId,
    expectedStatus: label.expectedStatus,
    expectedSourceRef: label.expectedSourceRef ?? null,
    expectedTitle: label.expectedTitle ?? null,
    observedStatus: record.status,
    observedSourceRef: record.selected?.sourceRef ?? null,
    observedTitle: record.selected?.title ?? null,
    exactTargetMatch,
    exactFetchPassed: record.exactFetch?.passed ?? null,
  };
});
const selectedRecords = rawRecords.filter((record) => record.status === "selected");
const summary = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: callsFailed === 0 && rawRecords.length === cases.length ? "complete" : "partial",
  attempted: rawRecords.length,
  expected: cases.length,
  successfulCalls: callsSucceeded,
  failedCalls: callsFailed,
  exactTargetMatches: scored.filter((item) => item.exactTargetMatch).length,
  exactTargetDenominator: scored.length,
  abstentionExpected: scored.filter((item) => item.expectedStatus === "abstained").length,
  abstentionCorrect: scored.filter((item) => item.expectedStatus === "abstained" && item.exactTargetMatch).length,
  selectedCount: selectedRecords.length,
  exactFetchPassed: selectedRecords.filter((record) => record.exactFetch?.passed === true).length,
  exactFetchDenominator: selectedRecords.length,
  totalInputTokens: rawRecords.reduce((sum, record) => sum + (record.usage?.input_tokens ?? 0), 0),
  totalOutputTokens: rawRecords.reduce((sum, record) => sum + (record.usage?.output_tokens ?? 0), 0),
  latenciesMs: rawRecords.map((record) => record.elapsedMs).filter((value) => typeof value === "number"),
  returnedModel: firstReturnedModel,
  independentUnits: rawRecords.length,
  labels: { source: manifest.labels.source, adjudication: manifest.labels.adjudication },
  interpretation: "Exploratory Bridge-handler smoke on three author-labeled queries; not calibration, a representative benchmark, or production-quality evidence.",
};
await fs.writeFile(path.join(runDir, "scoring.json"), `${JSON.stringify({ schemaVersion: 1, runId: manifest.runId, cases: scored }, null, 2)}\n`, "utf8");
await fs.writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

manifest.status = summary.status;
manifest.completedAt = new Date().toISOString();
manifest.actualRequestCount = rawRecords.length;
manifest.successfulRequestCount = callsSucceeded;
manifest.failedRequestCount = callsFailed;
manifest.provider.returnedModel = firstReturnedModel;
manifest.outputArtifacts = {
  recordsSha256: await hashFile(path.join(runDir, "records.jsonl")),
  scoringSha256: await hashFile(path.join(runDir, "scoring.json")),
  summarySha256: await hashFile(path.join(runDir, "summary.json")),
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const sumsPaths = [...inputFiles, "runner.mjs", "records.jsonl", "scoring.json", "summary.json", "manifest.json"];
const sums = [];
for (const relativePath of sumsPaths) sums.push(`${await hashFile(path.join(runDir, relativePath))}  ${relativePath}`);
await fs.writeFile(path.join(runDir, "SHA256SUMS"), `${sums.join("\n")}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
