import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summarizer = path.join(root, "experiments/jev-mssr-live/summarize-run.mjs");
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-jev-summary-test-"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = async (target, value) => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return bytes;
};
const writeChecksumIndex = async (directory, names) => {
  const rows = [];
  for (const name of names) {
    const bytes = await fs.readFile(path.join(directory, ...name.split("/")));
    rows.push(`${digest(bytes)}  ${name}`);
  }
  await fs.writeFile(path.join(directory, "SHA256SUMS"), `${rows.join("\n")}\n`);
};
const invoke = (directory, args = []) => spawnSync(process.execPath, [summarizer, directory, ...args], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});

try {
  const generic = path.join(scratch, "generic");
  const genericCases = [
    { id: "heading-one", sourceRef: "docs/a.md", expectedHeading: "# Overview" },
    { id: "heading-three", sourceRef: "docs/b.md", expectedHeading: "### History" },
    { id: "abstain", sourceRef: "docs/c.md", expectedHeading: "# Missing" },
  ];
  const genericManifest = {
    schemaVersion: 1,
    runId: "generic-test-v1",
    createdAt: "2026-10-11T00:00:00Z",
    plan: { expectedRequestCount: 3, independentUnit: "source-document clusters; 5 only" },
  };
  const genericManifestBytes = await writeJson(path.join(generic, "manifest.json"), genericManifest);
  await writeJson(path.join(generic, "run-completion.json"), {
    runId: genericManifest.runId,
    manifestSha256: digest(genericManifestBytes),
    status: "complete",
    attemptedRequests: 3,
  });
  await writeJson(path.join(generic, "inputs/cases.json"), { schemaVersion: 1, cases: genericCases });
  await writeJson(path.join(generic, "inputs/labels.json"), {
    source: "frozen-offline-fixture",
    adjudication: "independent fixture labels",
    cases: genericCases.map(({ id, expectedHeading }) => ({ caseId: id, expectedHeading })),
  });
  const genericRecords = [
    {
      caseId: "heading-one", sourceRef: "docs/a.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "A section", headingPath: ["Root", "## Overview"] }] },
      jev: { status: "selected", rawChoiceConfidence: 0.44, evidenceSufficiency: 0.58, noul: 0.91, usage: { input_tokens: 10, output_tokens: 2 }, selected: { title: "Overview", handle: { rangeId: "heading-1" } } },
      fetch: { passed: true }, evidencePack: { status: "complete" }, startedAt: "2026-10-11T00:00:01Z", completedAt: "2026-10-11T00:00:02Z",
    },
    {
      caseId: "heading-three", sourceRef: "docs/b.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "Historical overview", headingPath: ["Parent", "### History"] }] },
      jev: { status: "selected", rawChoiceConfidence: 0.72, noul: 0.33, usage: { input_tokens: 20, output_tokens: 3 }, selected: { title: " History ", handle: { rangeId: "heading-2" } } },
      fetch: { passed: true }, evidencePack: { status: "complete" }, startedAt: "2026-10-11T00:00:03Z", completedAt: "2026-10-11T00:00:04Z",
    },
    {
      caseId: "abstain", sourceRef: "docs/c.md", status: "complete",
      search: { resultCount: 1, results: [{ title: "Missing details", headingPath: ["Archive", "Missing context"] }] },
      jev: { status: "abstained", rawChoiceConfidence: 0.21, usage: { input_tokens: 30, output_tokens: 1 }, selected: null },
      fetch: { passed: false }, evidencePack: { status: "not-built" }, startedAt: "2026-10-11T00:00:05Z", completedAt: "2026-10-11T00:00:06Z",
    },
  ];
  const genericRecordsPath = path.join(generic, "records.jsonl");
  const genericRecordsBytes = Buffer.from(`${genericRecords.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);
  const genericChecksumFiles = ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl", "inputs/labels.json"];
  await writeChecksumIndex(generic, genericChecksumFiles);
  const genericResult = invoke(generic);
  assert.equal(genericResult.status, 0, genericResult.stderr);
  const genericSummary = JSON.parse(genericResult.stdout);
  assert.equal(genericSummary.schemaProfile, "generic-librarian-run-v1");
  assert.equal(genericSummary.sourceDocumentClusters, 3);
  assert.match(genericSummary.clusterInterpretation, /does not establish independent statistical sampling/u);
  assert.equal(genericSummary.independentUnit, "source-document cluster (descriptive grouping only)");
  assert.equal(genericSummary.declaredIndependentUnitUnverified, "source-document clusters; 5 only");
  assert.match(genericSummary.independentUnitDeclarationInterpretation, /not verified/u);
  assert.equal(genericSummary.labelMetrics.normalizedExactHeadingMatches, 2);
  assert.equal(genericSummary.labelMetrics.searchTargetFound, 2);
  assert.equal(genericSummary.labelMetrics.records[0].searchTargetFound, true, "headingPath should count an exact normalized heading");
  assert.equal(genericSummary.labelMetrics.records[1].searchTargetFound, true, "headingPath component should count even if title differs");
  assert.equal(genericSummary.labelMetrics.records[2].searchTargetFound, false, "partial title/path matches must not count");
  assert.equal(genericSummary.evidenceSufficiencyCapture.recorded, 1);
  assert.equal(genericSummary.rawNoulCapture.recorded, 2);
  assert.equal(genericSummary.records[0].evidenceSufficiency, 0.58);
  assert.equal(genericSummary.records[0].providerNoul, 0.91);
  assert.equal(genericSummary.calibrationClaim, false);
  assert.deepEqual(genericSummary.checksumFile.requiredFiles, genericChecksumFiles);
  await assert.rejects(fs.access(path.join(generic, "summary-calculated.json")), "stdout mode must not write run artifacts");

  const duplicateRecords = [genericRecords[0], genericRecords[0], genericRecords[2]];
  await fs.writeFile(genericRecordsPath, `${duplicateRecords.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await writeChecksumIndex(generic, genericChecksumFiles);
  const duplicateResult = invoke(generic);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /duplicate record for case/u);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);
  await writeChecksumIndex(generic, genericChecksumFiles);

  const genericChecksumPath = path.join(generic, "SHA256SUMS");
  const validGenericSums = await fs.readFile(genericChecksumPath, "utf8");
  await fs.rename(genericChecksumPath, `${genericChecksumPath}.missing`);
  const missingSumsResult = invoke(generic);
  assert.notEqual(missingSumsResult.status, 0);
  assert.match(missingSumsResult.stderr, /SHA256SUMS is required/u);
  await fs.rename(`${genericChecksumPath}.missing`, genericChecksumPath);

  await fs.writeFile(genericChecksumPath, validGenericSums.split(/\r?\n/u).filter((row) => !row.endsWith("  records.jsonl")).join("\n") + "\n");
  const uncoveredResult = invoke(generic);
  assert.notEqual(uncoveredResult.status, 0);
  assert.match(uncoveredResult.stderr, /does not cover required frozen artifacts.*records\.jsonl/u);
  await fs.writeFile(genericChecksumPath, validGenericSums);

  await fs.writeFile(genericRecordsPath, Buffer.concat([genericRecordsBytes, Buffer.from(" ")]));
  const mismatchResult = invoke(generic);
  assert.notEqual(mismatchResult.status, 0);
  assert.match(mismatchResult.stderr, /checksum mismatch: records\.jsonl/u);
  await fs.writeFile(genericRecordsPath, genericRecordsBytes);

  await fs.writeFile(genericChecksumPath, `${validGenericSums.trimEnd()}\n${"a".repeat(64)}  ../outside.json\n`);
  const traversalResult = invoke(generic);
  assert.notEqual(traversalResult.status, 0);
  assert.match(traversalResult.stderr, /checksum path escapes run directory/u);
  await fs.writeFile(genericChecksumPath, validGenericSums);

  const paired = path.join(scratch, "paired");
  const pairedCases = [
    { id: "case-a", sourceRef: "docs/decision-a.md" },
    { id: "case-b", sourceRef: "docs/decision-b.md" },
  ];
  const pairedManifest = {
    schemaVersion: 1,
    runId: "paired-test-v1",
    study: "paired-excerpt-cap-diagnostic",
    preRegistered: true,
    labelsPreparedBeforeProviderCalls: true,
    ownerGold: false,
    providerCallsExpected: 4,
    independentSourceClusters: 2,
    arms: [260, 780],
    independentVariable: "maxExcerptChars",
  };
  const pairedManifestBytes = await writeJson(path.join(paired, "manifest.json"), pairedManifest);
  const pairedCompletion = {
    schemaVersion: 1,
    runId: pairedManifest.runId,
    status: "complete",
    expectedPairs: 2,
    completedPairs: 2,
    providerCalls: 4,
  };
  const pairedCompletionBytes = await writeJson(path.join(paired, "run-completion.json"), pairedCompletion);
  const pairedCasesBytes = await writeJson(path.join(paired, "inputs/cases.json"), { schemaVersion: 1, cases: pairedCases });
  const pairedRows = [];
  for (const [index, item] of pairedCases.entries()) {
    for (const cap of pairedManifest.arms) {
      const selected = !(item.id === "case-b" && cap === 780);
      pairedRows.push({
        caseId: item.id,
        cap,
        elapsedWallMs: 100 + index,
        selector: {
          status: selected ? "selected" : "abstained",
          selected: selected ? { title: "Decision", handle: { sourceRef: item.sourceRef, rangeId: "heading-1" } } : null,
          providerConfidence: selected ? 0.8 : 0.2,
          evidenceSufficiency: selected ? 0.7 : null,
          usage: { input_tokens: 10, output_tokens: 2 },
        },
        exactFetch: selected ? { fingerprintMatched: true } : null,
        safeError: null,
      });
    }
  }
  const pairedRecordsBytes = Buffer.from(`${pairedRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(path.join(paired, "records.jsonl"), pairedRecordsBytes);
  const sums = [
    ["manifest.json", pairedManifestBytes],
    ["run-completion.json", pairedCompletionBytes],
    ["inputs/cases.json", pairedCasesBytes],
    ["records.jsonl", pairedRecordsBytes],
  ].map(([name, bytes]) => `${digest(bytes)}  ${name}`).join("\n") + "\n";
  await fs.writeFile(path.join(paired, "SHA256SUMS"), sums);

  const pairedResult = invoke(paired, ["--write"]);
  assert.equal(pairedResult.status, 0, pairedResult.stderr);
  const pairedSummaryPath = path.join(paired, "summary-calculated.json");
  const pairedSummary = JSON.parse(await fs.readFile(pairedSummaryPath, "utf8"));
  assert.equal(pairedSummary.schemaProfile, "paired-excerpt-cap-v1");
  assert.equal(pairedSummary.pairedCases, 2);
  assert.equal(pairedSummary.attemptedRequests, 4);
  assert.equal(pairedSummary.sourceDocumentClusters, 2);
  assert.equal(pairedSummary.selected, 3);
  assert.equal(pairedSummary.abstained, 1);
  assert.equal(pairedSummary.exactFetchesWithFingerprint, 3);
  assert.equal(pairedSummary.checksumFile.verified, 4);
  assert.deepEqual(pairedSummary.checksumFile.requiredFiles, ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"]);
  assert.equal(pairedSummary.labelMetrics, null);
  assert.equal(pairedSummary.calibrationClaim, false);
  for (const name of ["manifest.json", "run-completion.json", "inputs/cases.json", "records.jsonl"]) {
    const current = await fs.readFile(path.join(paired, ...name.split("/")));
    const expected = sums.split(/\r?\n/u).find((row) => row.endsWith(`  ${name}`)).slice(0, 64);
    assert.equal(digest(current), expected, `--write changed frozen input ${name}`);
  }
  const pairedSumsPath = path.join(paired, "SHA256SUMS");
  const validPairedSums = await fs.readFile(pairedSumsPath, "utf8");
  await fs.writeFile(pairedSumsPath, validPairedSums.split(/\r?\n/u).filter((row) => !row.endsWith("  records.jsonl")).join("\n") + "\n");
  const pairedCoverageResult = invoke(paired);
  assert.notEqual(pairedCoverageResult.status, 0);
  assert.match(pairedCoverageResult.stderr, /does not cover required frozen artifacts.*records\.jsonl/u);

  const unsupported = path.join(scratch, "unsupported");
  await writeJson(path.join(unsupported, "manifest.json"), { schemaVersion: 1, runId: "unknown" });
  await writeJson(path.join(unsupported, "run-completion.json"), { runId: "unknown" });
  await writeJson(path.join(unsupported, "inputs/cases.json"), { cases: [] });
  await fs.writeFile(path.join(unsupported, "records.jsonl"), "");
  const unsupportedResult = invoke(unsupported);
  assert.notEqual(unsupportedResult.status, 0);
  assert.match(unsupportedResult.stderr, /Unsupported Jev run schema/u);

  console.log("PASS: generic and paired Jev run summaries preserve headings, score semantics, source clusters, schema gates, and frozen inputs.");
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
