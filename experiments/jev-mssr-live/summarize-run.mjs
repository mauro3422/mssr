import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [runArgument, writeArgument] = process.argv.slice(2);
if (!runArgument) {
  console.error("Usage: node summarize-run.mjs <run-directory> [--write]");
  process.exit(2);
}

const runDir = path.resolve(runArgument);
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(runDir, file), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await fs.readFile(path.join(runDir, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const completion = await readJson("run-completion.json");
const cases = (await readJson("inputs/cases.json")).cases;
const records = (await fs.readFile(path.join(runDir, "records.jsonl"), "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

assert.equal(completion.runId, manifest.runId, "run ID mismatch");
assert.equal(completion.manifestSha256, hash(manifestBytes), "frozen manifest hash mismatch");
assert.equal(completion.attemptedRequests, records.length, "completion/record count mismatch");
assert.equal(records.length, cases.length, "case/record count mismatch");
assert.equal(cases.length, manifest.plan.expectedRequestCount, "manifest/case count mismatch");

const expectedIds = new Set(cases.map((item) => item.id));
assert.equal(expectedIds.size, cases.length, "duplicate case IDs");
for (const record of records) assert.ok(expectedIds.has(record.caseId), `unexpected record ${record.caseId}`);

const successful = records.filter((record) => record.status === "complete");
const failed = records.filter((record) => record.status !== "complete");
const selected = records.filter((record) => record.jev?.status === "selected");
const abstained = records.filter((record) => record.jev?.status === "abstained");
const fetched = records.filter((record) => record.fetch?.passed === true);
const packs = records.filter((record) => record.evidencePack?.status === "complete");
const sourceRefs = [...new Set(records.map((record) => record.sourceRef))].sort();
const tokenUsage = records.reduce((total, record) => ({
  input: total.input + (record.jev?.usage?.input_tokens ?? 0),
  output: total.output + (record.jev?.usage?.output_tokens ?? 0),
}), { input: 0, output: 0 });
const started = records.map((record) => record.startedAt).filter(Boolean).sort();
const completed = records.map((record) => record.completedAt).filter(Boolean).sort();
const manifestTime = Date.parse(manifest.createdAt);
const firstRequestTime = started.length ? Date.parse(started[0]) : Number.NaN;
const createdAtDeltaMs = Number.isFinite(manifestTime) && Number.isFinite(firstRequestTime)
  ? firstRequestTime - manifestTime
  : null;

const report = {
  schemaVersion: 1,
  reportType: "mechanically-derived run summary; no semantic adjudication",
  runId: manifest.runId,
  parentRunId: manifest.parentRunId ?? null,
  frozenManifestSha256: completion.manifestSha256,
  completionStatus: completion.status,
  sourceDocumentClusters: sourceRefs.length,
  sourceRefs,
  expectedRequests: manifest.plan.expectedRequestCount,
  attemptedRequests: records.length,
  successfulRequests: successful.length,
  failedRequests: failed.length,
  selected: selected.length,
  abstained: abstained.length,
  exactFetchesWithFingerprint: fetched.length,
  evidencePacksBuilt: packs.length,
  tokenUsage,
  firstRequestStartedAt: started[0] ?? null,
  lastRequestCompletedAt: completed.at(-1) ?? null,
  manifestCreatedAt: manifest.createdAt ?? null,
  createdAtDeltaMs,
  timestampWarning: createdAtDeltaMs !== null && createdAtDeltaMs < 0
    ? "manifest createdAt is future-dated relative to the first request; use request events as execution time"
    : null,
  independentUnit: manifest.plan.independentUnit,
  calibrationClaim: false,
  records: records.map((record) => ({
    caseId: record.caseId,
    sourceRef: record.sourceRef,
    status: record.status,
    searchResultCount: record.search?.resultCount ?? null,
    jevStatus: record.jev?.status ?? null,
    selectedRangeId: record.jev?.selected?.handle?.rangeId ?? null,
    rawChoiceConfidence: record.jev?.rawChoiceConfidence ?? null,
    exactFetchPassed: record.fetch?.passed === true,
    evidencePackBuilt: record.evidencePack?.status === "complete",
    elapsedMs: record.elapsedMs ?? null,
  })),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (writeArgument === "--write") {
  await fs.writeFile(path.join(runDir, "summary-calculated.json"), serialized, "utf8");
} else {
  process.stdout.write(serialized);
}
