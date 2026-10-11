import fs from "node:fs/promises";
import path from "node:path";
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const lines = (await fs.readFile(path.join(base, "records.jsonl"), "utf8")).trim().split(/\r?\n/);
const records = lines.map((line) => JSON.parse(line));
const labels = JSON.parse(await fs.readFile(path.join(base, "inputs/labels.json"), "utf8"));
const byId = new Map(labels.cases.map((item) => [item.caseId, item]));
const norm = (s) => String(s ?? "").replace(/^#+\s*/, "").trim();
const scored = records.map((record) => {
  const label = byId.get(record.caseId);
  const expected = norm(label.expectedHeading);
  const observed = norm(record.jev?.selected?.title);
  const searchHit = (record.search?.results ?? []).some((item) =>
    norm(item.title) === expected || norm(item.headingPath) === expected
  );
  return {
    caseId: record.caseId,
    sourceRef: record.sourceRef,
    expectedHeading: label.expectedHeading,
    normalizedExpectedHeading: expected,
    observedHeading: record.jev?.selected?.title ?? null,
    exactHeadingMatchAfterMarkerNormalization: Boolean(record.jev?.selected && observed === expected),
    targetInSearchTop100AfterMarkerNormalization: searchHit,
    jevStatus: record.jev?.status ?? "missing",
    rawChoiceConfidence: record.jev?.rawChoiceConfidence ?? null,
    confidenceCalibration: record.jev?.confidenceCalibration ?? "unknown",
    exactFetchPassed: Boolean(record.fetch?.passed),
    evidencePackBuilt: Boolean(record.evidencePack?.outputSha256),
  };
});
const summary = {
  schemaVersion: 1,
  runId: "mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f",
  derivedFrom: "records.jsonl + frozen labels.json; no provider calls",
  scoringRevision: "heading-marker-normalization-v2",
  status: "complete",
  attemptedRequests: records.length,
  successfulProviderRequests: records.filter((r) => r.jev?.status === "selected" || r.jev?.status === "abstained").length,
  providerFailures: records.filter((r) => r.status === "failed").length,
  selections: records.filter((r) => r.jev?.status === "selected").length,
  abstentions: records.filter((r) => r.jev?.status === "abstained").length,
  sourceDocumentClusters: new Set(records.map((r) => r.sourceRef)).size,
  independentUnits: "five source-document clusters; not ten independent cases",
  selectedExactHeadingMatches: scored.filter((r) => r.exactHeadingMatchAfterMarkerNormalization).length,
  exactHeadingDenominator: scored.length,
  searchTargetHitAt100: scored.filter((r) => r.targetInSearchTop100AfterMarkerNormalization).length,
  searchTargetDenominator: scored.length,
  exactFetchMatches: scored.filter((r) => r.exactFetchPassed).length,
  exactFetchDenominator: records.filter((r) => r.jev?.status === "selected").length,
  evidencePacksBuilt: scored.filter((r) => r.evidencePackBuilt).length,
  tokenUsage: {
    input: records.reduce((sum, r) => sum + (r.jev?.usage?.input_tokens ?? 0), 0),
    output: records.reduce((sum, r) => sum + (r.jev?.usage?.output_tokens ?? 0), 0),
  },
  records: scored,
  limitations: [
    "Source-derived author labels, not independent or owner adjudication.",
    "Path-unseen only within the reviewed local artifact inventory; not a protected holdout and not proof of model non-exposure.",
    "Five source-document clusters are the upper bound for independent-unit counting; this is exploratory only.",
    "Choice confidence and Noul are descriptive, uncalibrated outputs.",
    "Exact-heading match does not prove answer completeness; independent blind review is pending.",
    "The initial summary used literal Markdown heading markers and returned 0/10; that derived-score bug is preserved in summary.json and superseded by this normalized analysis. Raw records are unchanged."
  ],
};
await fs.writeFile(path.join(base, "scoring-normalized.json"), JSON.stringify({ schemaVersion: 1, runId: summary.runId, scored }, null, 2) + "\n");
await fs.writeFile(path.join(base, "summary-normalized.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));