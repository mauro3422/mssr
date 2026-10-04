import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNS = [
  {
    id: "direct-80k-v2",
    relativePath: "experiments/jev-mssr-live/runs/mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2",
    hashes: {
      "score-summary.json": "08d0eeb81e91d5ba9f31b67720ee21a19d4550d1caf7898c9e754f58ffd66d13",
      "scored-records.json": "82d809856fb702bb12d96676b27ec89378a8803a713cdb2db79b273897ede226",
    },
  },
  {
    id: "hierarchical-64k-v1",
    relativePath: "experiments/jev-mssr-live/runs/mssr-librarian-jev-bilingual-hierarchical-64k-20261001T181350Z-v1",
    hashes: {
      "score-summary.json": "e9beb149367256ff31c3256fc5ca827ca5ffcef200d5c4971c6894deae2449bf",
      "scored-records.json": "2d052319061f5055dea6dd92513fdf296a0ebb186a893e743953361a4dc9b105",
    },
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const thresholds = [0.5, 0.7, 0.8, 0.9];

function verifyRunInput(run) {
  const runRoot = resolve(REPO_ROOT, run.relativePath);
  const sums = new Map(readFileSync(resolve(runRoot, "SHA256SUMS"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
      assert.ok(match, "SHA256SUMS contains a malformed row.");
      return [match[2], match[1].toLowerCase()];
    }));
  const bytesByName = new Map();
  for (const [name, expectedHash] of Object.entries(run.hashes)) {
    const bytes = readFileSync(resolve(runRoot, name));
    assert.equal(sha256(bytes), expectedHash, `${run.id}/${name} differs from its pinned archive hash.`);
    assert.equal(sums.get(name), expectedHash, `${run.id}/${name} is not pinned by SHA256SUMS.`);
    bytesByName.set(name, bytes);
  }

  const score = JSON.parse(bytesByName.get("score-summary.json").toString("utf8"));
  const scored = JSON.parse(bytesByName.get("scored-records.json").toString("utf8"));
  assert.equal(scored.schemaVersion, 1);
  assert.equal(scored.records.length, 52);
  assert.equal(score.humanOwnerAdjudication, false);
  const keys = scored.records.map((record) => `${record.caseId}:${record.language}`);
  assert.equal(new Set(keys).size, 52, "Expected exactly one record per paired concept and language.");

  const selected = scored.records.filter((record) => record.status === "selected");
  assert.ok(selected.every((record) => typeof record.exactTarget === "boolean"));
  assert.ok(selected.every((record) => Number.isFinite(record.providerConfidence)
    && record.providerConfidence >= 0 && record.providerConfidence <= 1));
  assert.equal(selected.length + scored.records.filter((record) => record.status === "abstained").length, 52);
  assert.equal(selected.filter((record) => record.exactTarget).length, score.metrics.combined.exactTargetSelections);
  assert.equal(score.metrics.combined.providerCalls, run.id === "direct-80k-v2" ? 52 : 156);

  const brier = selected.reduce((total, record) =>
    total + (record.providerConfidence - Number(record.exactTarget)) ** 2, 0) / selected.length;
  const epsilon = 1e-15;
  const logLoss = selected.reduce((total, record) => {
    const p = Math.min(1 - epsilon, Math.max(epsilon, record.providerConfidence));
    const y = Number(record.exactTarget);
    return total - (y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }, 0) / selected.length;
  const reliabilityBands = [
    { label: "<0.50", accepts: (p) => p < 0.5 },
    { label: "0.50-0.69", accepts: (p) => p >= 0.5 && p < 0.7 },
    { label: "0.70-0.84", accepts: (p) => p >= 0.7 && p < 0.85 },
    { label: "0.85-1.00", accepts: (p) => p >= 0.85 },
  ].map((band) => {
    const rows = selected.filter((record) => band.accepts(record.providerConfidence));
    const correct = rows.filter((record) => record.exactTarget).length;
    return {
      band: band.label,
      n: rows.length,
      meanConfidence: rows.length
        ? Number((rows.reduce((sum, record) => sum + record.providerConfidence, 0) / rows.length).toFixed(4))
        : null,
      strictExactMatches: correct,
      strictExactRate: rows.length ? Number((correct / rows.length).toFixed(4)) : null,
    };
  });
  const thresholdDiagnostics = thresholds.map((threshold) => {
    const rows = selected.filter((record) => record.providerConfidence >= threshold);
    const correct = rows.filter((record) => record.exactTarget).length;
    return {
      threshold,
      selected: rows.length,
      coverageOf52Requests: Number((rows.length / 52).toFixed(4)),
      strictExactMatches: correct,
      strictPrecisionAmongThresholdedSelections: rows.length ? Number((correct / rows.length).toFixed(4)) : null,
    };
  });
  return {
    runId: score.runId,
    mode: score.candidateMode,
    concepts: 26,
    pairedLanguages: ["en", "es"],
    requests: scored.records.length,
    providerCalls: score.metrics.combined.providerCalls,
    selected: selected.length,
    abstained: 52 - selected.length,
    strictExactMatches: selected.filter((record) => record.exactTarget).length,
    coverage: Number((selected.length / 52).toFixed(4)),
    strictExactRateAmongSelections: Number((selected.filter((record) => record.exactTarget).length / selected.length).toFixed(4)),
    meanConfidenceAmongSelections: Number((selected.reduce((sum, record) => sum + record.providerConfidence, 0) / selected.length).toFixed(4)),
    binaryBrierAgainstStrictExactTargetAmongSelections: Number(brier.toFixed(5)),
    binaryLogLossAgainstStrictExactTargetAmongSelections: Number(logLoss.toFixed(5)),
    descriptiveReliabilityBands: reliabilityBands,
    descriptiveThresholds: thresholdDiagnostics,
    inputHashes: run.hashes,
  };
}

const result = {
  schemaVersion: 1,
  classification: "exploratory-binary-exact-target-diagnostic",
  target: "author-preferred exact heading match among selected outputs",
  ownerAdjudicatedGold: false,
  untouchedHoldoutClaim: false,
  calibrationClaim: false,
  productionThreshold: null,
  selectionConfidenceIsNotEvidenceSufficiency: true,
  limitations: [
    "The labels are strict author-preferred headings, not owner-adjudicated acceptable evidence sets or answer-quality labels.",
    "English and Spanish rows are paired variants of 26 concepts; source and concept clusters are not independent observations.",
    "Abstentions are reported as coverage loss and excluded from Brier/log-loss because a selected-choice confidence is not defined for them.",
    "Threshold and reliability bands are descriptive summaries of these historical rows, not tuning recommendations or production gates.",
  ],
  runs: RUNS.map(verifyRunInput),
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
