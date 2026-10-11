import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const runDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const manifestPath = path.join(runDir, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const allowNetwork = process.argv.includes("--allow-network");
const cases = JSON.parse(await fs.readFile(path.join(runDir, "inputs/cases.json"), "utf8")).cases;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const hashFile = async (file) => hash(await fs.readFile(file));
const json = (value) => JSON.stringify(value) + "\n";
for (const file of ["request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json", "SHA256SUMS"]) {
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
  assert.equal(await hashFile(path.join(runDir, source.snapshotPath)), source.sha256, "frozen source changed");
  assert.equal(await hashFile(path.join(manifest.corpus.projectRoot, ...source.sourceRef.split("/"))), source.sha256, "canonical source changed since freeze");
}
for (const artifact of manifest.source.buildArtifacts) {
  assert.equal(await hashFile(path.join(manifest.source.bridgeRoot, artifact.path)), artifact.sha256, "Bridge artifact changed: " + artifact.path);
}
if (!allowNetwork) {
  console.log(JSON.stringify({ status: "dry-run", networkRequests: 0, requestedCalls: cases.length, requestedModel: manifest.provider.requestedModel, source: manifest.corpus.sources[0].sourceRef, labelsRead: false }, null, 2));
  process.exit(0);
}
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.provider.networkOptIn, true);
const frozenManifestHash = await hashFile(manifestPath);
const bridgeRoot = manifest.source.bridgeRoot;
const [{ createToolRegistry }, { createMssrJevBridgeDecisionProvider, createMssrSemanticEvidenceToolModule }] = await Promise.all([
  import(pathToFileURL(path.join(bridgeRoot, "dist/tool-registry.js")).href),
  import(pathToFileURL(path.join(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href),
]);
const installed = JSON.parse(await fs.readFile(path.join(bridgeRoot, "node_modules/@mauroprime/mssr/package.json"), "utf8"));
assert.equal(installed.version, manifest.source.expectedMssrVersion, "unexpected installed MSSR candidate");
const provider = createMssrJevBridgeDecisionProvider({ model: manifest.provider.requestedModel });
const registry = createToolRegistry([createMssrSemanticEvidenceToolModule({ decisionProvider: provider })]);
assert.ok(registry.has("mssr_librarian_jev_select"));
assert.ok(registry.has("mssr_librarian_fetch"));
const append = async (name, value) => fs.appendFile(path.join(runDir, name), json(value), "utf8");
const records = [];
for (const testCase of cases) {
  const source = manifest.corpus.sources.find((entry) => entry.sourceRef === testCase.sourceRef);
  const request = { caseId: testCase.id, sourceRef: testCase.sourceRef, sourceSha256: source.sha256, query: testCase.query, requestedModel: manifest.provider.requestedModel, mode: "heading-no-candidate-handles" };
  const requestFingerprint = hash(Buffer.from(JSON.stringify(request), "utf8"));
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  await append("request-events.jsonl", { event: "request-started", caseId: testCase.id, requestFingerprint, startedAt, inputHashes: [source.sha256] });
  const record = { ...request, requestFingerprint, startedAt, status: "failed", selection: null, fetch: null };
  try {
    const selected = await registry.call("mssr_librarian_jev_select", {
      projectRoot: manifest.corpus.projectRoot,
      sourceRefs: [testCase.sourceRef],
      query: testCase.query,
      model: manifest.provider.requestedModel,
    });
    record.selection = {
      status: selected.status ?? null,
      provider: selected.provider ?? null,
      model: selected.model ?? null,
      elapsedMs: selected.elapsedMs ?? null,
      providerConfidence: selected.providerConfidence ?? null,
      evidenceSufficiency: selected.evidenceSufficiency ?? null,
      confidenceCalibration: selected.confidenceCalibration ?? null,
      usage: selected.usage ?? null,
      candidateCount: selected.candidateCount ?? null,
      choiceCalls: selected.choiceCalls ?? null,
      selected: selected.selected ? {
        title: selected.selected.title ?? null,
        headingPath: selected.selected.headingPath ?? null,
        handle: selected.selected.handle ?? null,
      } : null,
      advisoryOnly: selected.advisoryOnly ?? null,
      verification: selected.verification ?? null,
    };
    if (selected.status === "selected" && selected.selected?.handle) {
      const fetched = await registry.call("mssr_librarian_fetch", { projectRoot: manifest.corpus.projectRoot, handle: selected.selected.handle });
      record.fetch = {
        status: fetched.status ?? "fetched",
        fingerprint: fetched.handle?.fingerprint ?? null,
        selectedFingerprint: selected.selected.handle.fingerprint,
        passed: fetched.handle?.fingerprint === selected.selected.handle.fingerprint,
        textSha256: hash(Buffer.from(fetched.text ?? "", "utf8")),
        textChars: (fetched.text ?? "").length,
        text: fetched.text ?? null,
      };
    }
    record.status = "complete";
  } catch (error) {
    record.failureClass = error?.name === "AssertionError" ? "validation-error" : "provider-or-tool-chain-error";
    record.safeErrorName = error?.name ?? "Error";
  }
  record.elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  record.completedAt = new Date().toISOString();
  records.push(record);
  await append("records.jsonl", record);
  await append("request-events.jsonl", { event: "request-completed", caseId: testCase.id, requestFingerprint, completedAt: record.completedAt, status: record.status });
}
for (const source of manifest.corpus.sources) {
  assert.equal(await hashFile(path.join(manifest.corpus.projectRoot, ...source.sourceRef.split("/"))), source.sha256, "canonical source changed during run");
}
assert.equal(await hashFile(manifestPath), frozenManifestHash, "frozen manifest changed during run");
const labels = JSON.parse(await fs.readFile(path.join(runDir, "inputs/labels.json"), "utf8"));
const label = labels.cases[0];
const record = records[0];
const summary = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: record.status === "complete" ? "complete" : "partial",
  expectedRequests: cases.length,
  attemptedRequests: records.length,
  successfulRequests: records.filter((entry) => entry.status === "complete").length,
  failedRequests: records.filter((entry) => entry.status !== "complete").length,
  independentUnit: manifest.plan.independentUnit,
  exactHeadingMatch: Boolean(record.selection?.selected?.title === label.expectedHeading),
  expectedHeading: label.expectedHeading,
  observedHeading: record.selection?.selected?.title ?? null,
  exactFetchPassed: Boolean(record.fetch?.passed),
  evidenceSufficiencyRecorded: typeof record.selection?.evidenceSufficiency === "number",
  confidenceCalibration: record.selection?.confidenceCalibration ?? "unknown",
  limitation: "One synthetic diagnostic source only; not owner-gold, not reliability evidence, and not confidence calibration.",
};
await fs.writeFile(path.join(runDir, "summary.json"), json(summary), "utf8");
await fs.writeFile(path.join(runDir, "run-completion.json"), json({ runId: manifest.runId, frozenManifestSha256: frozenManifestHash, completedAt: new Date().toISOString(), status: summary.status }), "utf8");
const outputs = ["manifest.json", "runner.mjs", "inputs/cases.json", "inputs/labels.json", ...manifest.corpus.sources.map((entry) => entry.snapshotPath), "request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json"];
const sums = [];
for (const file of outputs) sums.push(`${await hashFile(path.join(runDir, file))}  ${file}`);
await fs.writeFile(path.join(runDir, "SHA256SUMS"), sums.join("\n") + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
