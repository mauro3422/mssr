import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const expectedRunId = "benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17";
const variants = ["text", "parent", "evidence-atom-v2"];
const scriptPath = fileURLToPath(import.meta.url);
const outputDir = path.dirname(scriptPath);
const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
if (rootIndex < 0 || !args[rootIndex + 1]) {
  throw new Error('Pass --root "<directory containing the frozen source benchmark>".');
}
const sourceRoot = await fs.realpath(path.resolve(args[rootIndex + 1]));
const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(sourceRoot, relative), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const sumsText = await fs.readFile(path.join(sourceRoot, "SHA256SUMS"), "utf8");
const entries = sumsText.trim().split(/\r?\n/u).map((line) => {
  const match = /^([a-f0-9]{64})\s{2}(.+)$/u.exec(line);
  assert.ok(match, `Invalid SHA256SUMS row: ${line.slice(0, 100)}`);
  return { expected: match[1], relative: match[2] };
});
assert.ok(entries.length >= 5, "The frozen packet checksum inventory is unexpectedly small.");
const seenPaths = new Set();
const verified = {};
for (const entry of entries) {
  const normalized = entry.relative.replaceAll("\\", "/");
  assert.ok(!normalized.startsWith("/") && !normalized.split("/").includes(".."), "Checksum path escapes the source packet.");
  assert.ok(!seenPaths.has(normalized), `Duplicate checksum path: ${normalized}`);
  seenPaths.add(normalized);
  const bytes = await fs.readFile(path.join(sourceRoot, ...normalized.split("/")));
  const actual = sha256(bytes);
  assert.equal(actual, entry.expected, `SHA-256 mismatch for ${normalized}`);
  verified[normalized] = actual;
}

for (const required of ["manifest.json", "summary.json", "records.jsonl", "inputs/labels.json"]) {
  assert.ok(seenPaths.has(required), `Frozen checksum inventory omits ${required}`);
}

const manifest = await readJson("manifest.json");
const sourceSummary = await readJson("summary.json");
const labelsFile = await readJson("inputs/labels.json");
const recordLines = (await fs.readFile(path.join(sourceRoot, "records.jsonl"), "utf8")).trim().split(/\r?\n/u);
const records = recordLines.map((line) => JSON.parse(line));
assert.equal(manifest.runId, expectedRunId);
assert.equal(manifest.status, "complete");
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.requestedModel, undefined);
assert.equal(manifest.provider.requestedModel, "jev-1.13.0");
assert.equal(manifest.plan.variants.length, variants.length);
assert.deepEqual([...manifest.plan.variants].sort(), [...variants].sort());
assert.equal(manifest.plan.repetitions, 3);
assert.equal(manifest.plan.requestCount, 153);
assert.equal(manifest.actualRequestCount, 153);
assert.equal(records.length, 153);
assert.equal(sourceSummary.totalRequests, 153);
assert.equal(sourceSummary.successfulRequests, 153);
assert.equal(sourceSummary.failedRequests, 0);
assert.equal(labelsFile.source, "historically frozen author labels; not independently adjudicated");
assert.equal(labelsFile.adjudication, "none");
assert.equal(labelsFile.exposedToRequests, false);
assert.equal(manifest.split.holdoutUsedForTuning, true);

const requestIds = new Set(records.map((record) => record.requestId));
assert.equal(requestIds.size, records.length, "Request IDs must be unique.");
const modules = new Set(records.map((record) => record.moduleId));
const results = {};

for (const variant of variants) {
  const rows = records.filter((record) => record.variant === variant);
  assert.equal(rows.length, 51, `${variant} request count`);
  assert.ok(rows.every((record) => record.status === "success"), `${variant} has a non-success request.`);
  const grouped = new Map();
  for (const record of rows) {
    const group = grouped.get(record.caseId) ?? [];
    group.push(record);
    grouped.set(record.caseId, group);
  }
  assert.equal(grouped.size, 17, `${variant} unique section count`);

  const perSection = [...grouped.entries()].map(([caseId, group]) => {
    const expected = labelsFile.labels[caseId];
    assert.ok(expected, `Missing frozen label for a request case in ${variant}.`);
    assert.equal(group.length, 3, `${variant} repetitions for one section`);
    assert.deepEqual(group.map((item) => item.rep).sort(), [1, 2, 3]);
    const actionCorrect = group.filter((item) => item.answers.action.choice === expected.expectedAction).length;
    const lifecycleCorrect = group.filter((item) => item.answers.lifecycle.choice === expected.expectedLifecycle).length;
    const actionValues = new Set(group.map((item) => item.answers.action.choice));
    const lifecycleValues = new Set(group.map((item) => item.answers.lifecycle.choice));
    return {
      actionCorrect,
      actionMajorityCorrect: actionCorrect >= 2,
      actionAllThreeCorrect: actionCorrect === 3,
      actionStable: actionValues.size === 1,
      lifecycleCorrect,
      lifecycleMajorityCorrect: lifecycleCorrect >= 2,
      lifecycleAllThreeCorrect: lifecycleCorrect === 3,
      lifecycleStable: lifecycleValues.size === 1,
    };
  });

  const actionCorrectCalls = perSection.reduce((sum, item) => sum + item.actionCorrect, 0);
  const lifecycleCorrectCalls = perSection.reduce((sum, item) => sum + item.lifecycleCorrect, 0);
  const aggregate = sourceSummary.variants[variant].aggregate;
  assert.equal(aggregate.correct, actionCorrectCalls, `${variant} action aggregate changed.`);
  assert.equal(aggregate.successful, 51, `${variant} summary coverage changed.`);
  assert.equal(Math.round(aggregate.lifecycleAccuracy * 51), lifecycleCorrectCalls, `${variant} lifecycle aggregate changed.`);

  results[variant] = {
    requests: rows.length,
    uniqueSections: perSection.length,
    action: {
      correctCalls: actionCorrectCalls,
      majorityCorrectSections: perSection.filter((item) => item.actionMajorityCorrect).length,
      allThreeCorrectSections: perSection.filter((item) => item.actionAllThreeCorrect).length,
      stableSections: perSection.filter((item) => item.actionStable).length,
    },
    lifecycle: {
      correctCalls: lifecycleCorrectCalls,
      majorityCorrectSections: perSection.filter((item) => item.lifecycleMajorityCorrect).length,
      allThreeCorrectSections: perSection.filter((item) => item.lifecycleAllThreeCorrect).length,
      stableSections: perSection.filter((item) => item.lifecycleStable).length,
    },
  };
}

assert.equal(modules.size, 4, "The audit expects the four frozen source-module clusters.");
const result = {
  analysisId: "evidence-atom-cluster-audit-20261014T011057Z-v1",
  status: "verified-offline-reanalysis",
  source: {
    runId: manifest.runId,
    gitCommit: manifest.source.gitCommit,
    buildId: manifest.source.buildId,
    requestedModel: manifest.provider.requestedModel,
    sourceRoot,
    manifestSha256: verified["manifest.json"],
    recordsSha256: verified["records.jsonl"],
    labelsSha256: verified["inputs/labels.json"],
    summarySha256: verified["summary.json"],
    checksumEntriesVerified: entries.length,
  },
  scope: {
    uniqueSections: 17,
    sourceModuleClusters: modules.size,
    variants,
    repetitionsPerSectionAndVariant: 3,
    providerCallsInOriginalRun: records.length,
    providerCallsInThisAnalysis: 0,
    labels: "author-created; not independently adjudicated",
    holdout: "opened and used for tuning; development evidence only",
  },
  results,
  interpretation: "Descriptive repeated-case comparison only. Three repetitions do not create independent sections; sections are nested within four modules. This is not owner-gold, a protected holdout, cross-project reliability, or confidence calibration.",
};

await fs.writeFile(path.join(outputDir, "cluster-audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
