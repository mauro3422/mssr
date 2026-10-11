import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [runArgument, writeArgument, ...extraArguments] = process.argv.slice(2);
if (!runArgument || (writeArgument && writeArgument !== "--write") || extraArguments.length) {
  console.error("Usage: node summarize-run.mjs <run-directory> [--write]");
  process.exit(2);
}

const runDir = path.resolve(runArgument);
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(runDir, file), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const finite = (value) => Number.isFinite(value);
const normalizeHeading = (value) => String(value ?? "").trim().replace(/^#{1,6}\s+/u, "").trim();

async function verifyChecksums(requiredFiles) {
  let contents;
  try {
    contents = await fs.readFile(path.join(runDir, "SHA256SUMS"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("SHA256SUMS is required to summarize a frozen Jev run");
    throw error;
  }

  const rows = contents.split(/\r?\n/u).filter(Boolean);
  assert.ok(rows.length > 0, "SHA256SUMS is empty");
  const indexedFiles = new Set();
  for (const row of rows) {
    const match = /^([a-f\d]{64})\s{2}(.+)$/iu.exec(row);
    assert.ok(match, `invalid SHA256SUMS row: ${row}`);
    const relativePath = match[2].replace(/\\/gu, "/");
    assert.ok(!path.isAbsolute(relativePath) && !/^[a-z]:/iu.test(relativePath) && !relativePath.startsWith("//"), `absolute checksum path refused: ${relativePath}`);
    const absolutePath = path.resolve(runDir, ...relativePath.split("/"));
    const pathFromRun = path.relative(runDir, absolutePath);
    assert.ok(pathFromRun && pathFromRun !== ".." && !pathFromRun.startsWith(`..${path.sep}`) && !path.isAbsolute(pathFromRun), `checksum path escapes run directory: ${relativePath}`);
    const key = relativePath.toLocaleLowerCase("en-US");
    assert.ok(!indexedFiles.has(key), `duplicate checksum path: ${relativePath}`);
    indexedFiles.add(key);
    const bytes = await fs.readFile(absolutePath);
    assert.equal(hash(bytes), match[1].toLowerCase(), `checksum mismatch: ${relativePath}`);
  }
  const missingFiles = requiredFiles.filter((file) => !indexedFiles.has(file.toLocaleLowerCase("en-US")));
  assert.deepEqual(missingFiles, [], `SHA256SUMS does not cover required frozen artifacts: ${missingFiles.join(", ")}`);
  return { present: true, verified: rows.length, requiredFiles };
}

function usageFor(records, valueAt) {
  return records.reduce((total, record) => {
    const usage = valueAt(record) ?? {};
    return {
      input: total.input + (usage.input_tokens ?? 0),
      output: total.output + (usage.output_tokens ?? 0),
    };
  }, { input: 0, output: 0 });
}

function pairedExcerptCapSummary({ manifest, completion, cases, records, checksums }) {
  assert.equal(manifest.schemaVersion, 1, "unsupported paired-excerpt-cap manifest version");
  assert.equal(completion.runId, manifest.runId, "run ID mismatch");
  assert.equal(completion.status, "complete", "paired run is not complete");
  assert.equal(completion.expectedPairs, cases.length, "completion/case pair count mismatch");
  assert.equal(completion.completedPairs, cases.length, "not all preregistered pairs completed");
  assert.equal(completion.providerCalls, records.length, "completion/record count mismatch");
  assert.equal(records.length, manifest.providerCallsExpected, "manifest/record call count mismatch");

  const caseById = new Map(cases.map((item) => [item.id, item]));
  assert.equal(caseById.size, cases.length, "duplicate paired case IDs");
  const allowedArms = new Set(manifest.arms);
  const rowsByCase = new Map();
  const seenPairs = new Set();
  for (const record of records) {
    assert.ok(caseById.has(record.caseId), `unexpected paired record ${record.caseId}`);
    assert.ok(allowedArms.has(record.cap), `unexpected excerpt cap ${record.cap}`);
    const pairKey = `${record.caseId}\u0000${record.cap}`;
    assert.ok(!seenPairs.has(pairKey), `duplicate case/cap pair ${record.caseId}/${record.cap}`);
    seenPairs.add(pairKey);
    const rows = rowsByCase.get(record.caseId) ?? [];
    rows.push(record);
    rowsByCase.set(record.caseId, rows);
  }
  for (const item of cases) {
    const rows = rowsByCase.get(item.id) ?? [];
    assert.equal(rows.length, allowedArms.size, `incomplete arm set for ${item.id}`);
    for (const arm of allowedArms) assert.ok(rows.some((row) => row.cap === arm), `missing ${item.id}/${arm} arm`);
  }

  const sourceRefs = [...new Set(cases.map((item) => item.sourceRef).filter(Boolean))].sort();
  const selected = records.filter((record) => record.selector?.status === "selected");
  const abstained = records.filter((record) => record.selector?.status === "abstained");
  const failed = records.filter((record) => record.safeError != null
    || !["selected", "abstained"].includes(record.selector?.status));
  const exactFetches = records.filter((record) => record.exactFetch?.fingerprintMatched === true);
  const evidenceSufficiencyRecorded = records.filter((record) => finite(record.selector?.evidenceSufficiency));
  const confidenceRecorded = records.filter((record) => finite(record.selector?.providerConfidence));
  const tokenUsage = usageFor(records, (record) => record.selector?.usage);

  return {
    schemaVersion: 2,
    schemaProfile: "paired-excerpt-cap-v1",
    reportType: "mechanically-derived paired diagnostic; no semantic adjudication",
    runId: manifest.runId,
    completionStatus: completion.status,
    frozenManifestSha256: null,
    checksumFile: checksums,
    preRegistered: manifest.preRegistered === true,
    labelsPreparedBeforeProviderCalls: manifest.labelsPreparedBeforeProviderCalls === true,
    ownerGold: manifest.ownerGold === true,
    independentVariable: manifest.independentVariable ?? null,
    arms: manifest.arms,
    pairedCases: cases.length,
    expectedPairs: completion.expectedPairs,
    completedPairs: completion.completedPairs,
    expectedProviderCalls: manifest.providerCallsExpected,
    attemptedRequests: records.length,
    selected: selected.length,
    abstained: abstained.length,
    failedRequests: failed.length,
    sourceDocumentClusters: sourceRefs.length,
    sourceRefs,
    clusterInterpretation: "Distinct sourceRef grouping only; it does not establish independent statistical sampling.",
    exactFetchesWithFingerprint: exactFetches.length,
    providerConfidenceCapture: { recorded: confidenceRecorded.length, missing: records.length - confidenceRecorded.length },
    evidenceSufficiencyCapture: { recorded: evidenceSufficiencyRecorded.length, missing: records.length - evidenceSufficiencyRecorded.length },
    tokenUsage,
    calibrationClaim: false,
    labelMetrics: null,
    records: records.map((record) => ({
      caseId: record.caseId,
      sourceRef: caseById.get(record.caseId)?.sourceRef ?? null,
      cap: record.cap,
      status: record.selector?.status ?? "failed",
      selectedRangeId: record.selector?.selected?.handle?.rangeId ?? null,
      selectedTitle: record.selector?.selected?.title ?? null,
      rawChoiceConfidence: record.selector?.providerConfidence ?? null,
      evidenceSufficiency: record.selector?.evidenceSufficiency ?? null,
      exactFetchPassed: record.exactFetch?.fingerprintMatched === true,
      elapsedMs: record.elapsedWallMs ?? null,
    })),
  };
}

function genericSummary({ manifest, completion, cases, labels, records, checksums }) {
  assert.ok(manifest.plan && Number.isInteger(manifest.plan.expectedRequestCount), "generic run manifest.plan.expectedRequestCount is required");
  assert.equal(completion.runId, manifest.runId, "run ID mismatch");
  assert.equal(completion.status, "complete", "generic run is not complete");
  assert.equal(completion.attemptedRequests, records.length, "completion/record count mismatch");
  assert.equal(records.length, cases.length, "case/record count mismatch");
  assert.equal(cases.length, manifest.plan.expectedRequestCount, "manifest/case count mismatch");

  const expectedIds = new Set(cases.map((item) => item.id));
  assert.equal(expectedIds.size, cases.length, "duplicate case IDs");
  const recordIds = new Set();
  for (const record of records) {
    assert.ok(expectedIds.has(record.caseId), `unexpected record ${record.caseId}`);
    assert.ok(!recordIds.has(record.caseId), `duplicate record for case ${record.caseId}`);
    recordIds.add(record.caseId);
  }
  assert.deepEqual([...recordIds].sort(), [...expectedIds].sort(), "records do not cover every case exactly once");

  const successful = records.filter((record) => record.status === "complete");
  const failed = records.filter((record) => record.status !== "complete");
  const selected = records.filter((record) => record.jev?.status === "selected");
  const abstained = records.filter((record) => record.jev?.status === "abstained");
  const fetched = records.filter((record) => record.fetch?.passed === true);
  const packs = records.filter((record) => record.evidencePack?.status === "complete");
  const evidenceSufficiencyRecorded = records.filter((record) => finite(record.jev?.evidenceSufficiency));
  const rawNoulRecorded = records.filter((record) => finite(record.jev?.noul));
  const sourceRefs = [...new Set(records.map((record) => record.sourceRef).filter(Boolean))].sort();
  const labelsByCase = new Map((labels?.cases ?? []).map((label) => [label.caseId, label]));
  if (labels) {
    assert.equal(labels.cases?.length, records.length, "label/record count mismatch");
    assert.equal(new Set(labels.cases.map((label) => label.caseId)).size, labels.cases.length, "duplicate label case IDs");
  }

  const started = records.map((record) => record.startedAt).filter(Boolean).sort();
  const completed = records.map((record) => record.completedAt).filter(Boolean).sort();
  const manifestTime = Date.parse(manifest.createdAt);
  const firstRequestTime = started.length ? Date.parse(started[0]) : Number.NaN;
  const createdAtDeltaMs = Number.isFinite(manifestTime) && Number.isFinite(firstRequestTime)
    ? firstRequestTime - manifestTime
    : null;
  const labelScores = labels
    ? records.map((record) => {
        const label = labelsByCase.get(record.caseId);
        assert.ok(label, `missing label for record ${record.caseId}`);
        const expectedHeading = normalizeHeading(label.expectedHeading);
        const observedHeading = normalizeHeading(record.jev?.selected?.title);
        const searchTargetFound = (record.search?.results ?? [])
          .some((result) => normalizeHeading(result.title) === expectedHeading
            || (Array.isArray(result.headingPath)
              && result.headingPath.some((part) => normalizeHeading(part) === expectedHeading)));
        return {
          caseId: record.caseId,
          sourceRef: record.sourceRef,
          expectedHeading: label.expectedHeading,
          observedHeading: record.jev?.selected?.title ?? null,
          normalizedExactHeadingMatch: record.jev?.status === "selected" && observedHeading === expectedHeading,
          searchTargetFound,
          exactFetchPassed: record.fetch?.passed === true,
        };
      })
    : null;

  return {
    schemaVersion: 2,
    schemaProfile: "generic-librarian-run-v1",
    reportType: "mechanically-derived run summary; no semantic adjudication",
    runId: manifest.runId,
    parentRunId: manifest.parentRunId ?? null,
    frozenManifestSha256: completion.manifestSha256,
    completionStatus: completion.status,
    checksumFile: checksums,
    sourceDocumentClusters: sourceRefs.length,
    sourceRefs,
    clusterInterpretation: "Distinct sourceRef grouping only; it does not establish independent statistical sampling.",
    expectedRequests: manifest.plan.expectedRequestCount,
    attemptedRequests: records.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    selected: selected.length,
    abstained: abstained.length,
    exactFetchesWithFingerprint: fetched.length,
    evidencePacksBuilt: packs.length,
    evidenceSufficiencyCapture: {
      recorded: evidenceSufficiencyRecorded.length,
      missingFromRecords: records.length - evidenceSufficiencyRecorded.length,
      note: "Only the explicit jev.evidenceSufficiency field is counted; raw Noul and other aliases are reported separately.",
    },
    rawNoulCapture: {
      recorded: rawNoulRecorded.length,
      missingFromRecords: records.length - rawNoulRecorded.length,
      note: "Provider Noul is descriptive and is not treated as an evidence-sufficiency alias.",
    },
    tokenUsage: usageFor(records, (record) => record.jev?.usage),
    firstRequestStartedAt: started[0] ?? null,
    lastRequestCompletedAt: completed.at(-1) ?? null,
    manifestCreatedAt: manifest.createdAt ?? null,
    createdAtDeltaMs,
    timestampWarning: createdAtDeltaMs !== null && createdAtDeltaMs < 0
      ? "manifest createdAt is future-dated relative to the first request; use request events as execution time"
      : null,
    declaredIndependentUnitUnverified: manifest.plan.independentUnit ?? null,
    independentUnitDeclarationInterpretation: "Manifest text is retained for audit; it is not verified against observed sourceRef clusters.",
    independentUnit: "source-document cluster (descriptive grouping only)",
    calibrationClaim: false,
    labelMetrics: labelScores
      ? {
          reportType: "strict normalized heading match; not semantic adjudication or calibration",
          labelSource: labels.source ?? null,
          adjudication: labels.adjudication ?? null,
          normalizedExactHeadingMatches: labelScores.filter((item) => item.normalizedExactHeadingMatch).length,
          exactHeadingDenominator: labelScores.length,
          searchTargetFound: labelScores.filter((item) => item.searchTargetFound).length,
          searchTargetDenominator: labelScores.length,
          records: labelScores,
        }
      : null,
    records: records.map((record) => ({
      caseId: record.caseId,
      sourceRef: record.sourceRef,
      status: record.status,
      searchResultCount: record.search?.resultCount ?? null,
      jevStatus: record.jev?.status ?? null,
      selectedRangeId: record.jev?.selected?.handle?.rangeId ?? null,
      rawChoiceConfidence: record.jev?.rawChoiceConfidence ?? null,
      evidenceSufficiency: record.jev?.evidenceSufficiency ?? null,
      providerNoul: record.jev?.noul ?? null,
      exactFetchPassed: record.fetch?.passed === true,
      evidencePackBuilt: record.evidencePack?.status === "complete",
      elapsedMs: record.elapsedMs ?? null,
    })),
  };
}

const manifestBytes = await fs.readFile(path.join(runDir, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const isPairedExcerptCap = manifest.study === "paired-excerpt-cap-diagnostic";
const isGenericRun = manifest.plan?.expectedRequestCount !== undefined;
assert.ok(
  isPairedExcerptCap || isGenericRun,
  `Unsupported Jev run schema; expected generic-librarian-run-v1 or paired-excerpt-cap-diagnostic. Manifest keys: ${Object.keys(manifest).sort().join(", ")}`,
);
const completion = await readJson("run-completion.json");
const casesDocument = await readJson("inputs/cases.json");
const cases = casesDocument.cases;
assert.ok(Array.isArray(cases), "inputs/cases.json must contain a cases array");
const requiredChecksumFiles = ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"];
if (!isPairedExcerptCap) {
  try {
    await fs.access(path.join(runDir, "inputs/labels.json"));
    requiredChecksumFiles.push("inputs/labels.json");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const checksums = await verifyChecksums(requiredChecksumFiles);
let labels = null;
if (manifest.study !== "paired-excerpt-cap-diagnostic") {
  try {
    labels = await readJson("inputs/labels.json");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const records = (await fs.readFile(path.join(runDir, "records.jsonl"), "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

let report;
if (isPairedExcerptCap) {
  report = pairedExcerptCapSummary({ manifest, completion, cases, records, checksums });
} else if (manifest.plan?.expectedRequestCount !== undefined) {
  assert.equal(completion.manifestSha256, hash(manifestBytes), "frozen manifest hash mismatch");
  report = genericSummary({ manifest, completion, cases, labels, records, checksums });
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (writeArgument === "--write") {
  await fs.writeFile(path.join(runDir, "summary-calculated.json"), serialized, "utf8");
} else {
  process.stdout.write(serialized);
}
