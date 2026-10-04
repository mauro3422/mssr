import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runRoot = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const manifest = readJson(resolve(runRoot, "manifest.json"));
const predictions = readJson(resolve(runRoot, "predictions.json"));
if (manifest.status !== "prepared" || predictions.labelContentsConsulted !== false) throw new Error("Scoring requires frozen predictions from a prepared label-blind run.");
if (sha256(readFileSync(resolve(runRoot, "runner.mjs"))) !== manifest.instrument.runnerSha256) throw new Error("Runner hash changed after preparation.");
if (sha256(readFileSync(resolve(runRoot, "score.mjs"))) !== manifest.instrument.scorerSha256) throw new Error("Scorer hash changed after preparation.");
for (const [path, item] of Object.entries(manifest.inputs)) {
  if (sha256(readFileSync(resolve(runRoot, path))) !== item.sha256) throw new Error(`Frozen input changed: ${path}`);
}
if (predictions.runId !== manifest.runId || predictions.records.length !== 52) throw new Error("Prediction file does not match the prepared run.");

const labels = readJson(resolve(runRoot, "inputs/labels.json")).cases;
const targets = readJson(resolve(runRoot, "inputs/target-index.json")).targetIndex;
const holdout = new Set(manifest.split.sourceRefs);
const variants = ["baseline", "lexiconRewrite", "pairedLanguageReference", "fused"];
const evaluated = [];
function resultsFor(record, variant) {
  if (variant === "fused") return record.fused.results;
  return record[variant].results;
}
for (const record of predictions.records) {
  const label = labels[record.caseId];
  const target = targets[record.caseId];
  if (!label || !target) throw new Error(`Missing frozen label/target for case ${record.caseId}.`);
  if (label.sourceRef !== target.sourceRef || label.targetHeading !== target.targetHeading) throw new Error(`Label/index disagreement for ${record.caseId}.`);
  const split = holdout.has(target.sourceRef) ? "previously-opened-holdout" : "development";
  for (const variant of variants) {
    const results = resultsFor(record, variant);
    const index = results.findIndex((item) => item.handle.sourceRef === target.sourceRef
      && JSON.stringify(item.headingPath) === JSON.stringify(target.targetHeadingPath));
    evaluated.push({
      caseId: record.caseId,
      language: record.language,
      split,
      variant,
      targetRank: index < 0 ? null : index + 1,
      returnedCount: results.length,
      truncated: variant === "fused" ? record.fused.truncated : record[variant].truncated,
      lexiconReplacements: record.lexiconReplacements,
      queryTokenCount: record.queryTokenCount,
      uniqueCandidates: variant === "fused" ? record.fused.uniqueCandidates : results.length,
    });
  }
}

function summarize(rows) {
  const n = rows.length;
  const reciprocalRank = rows.reduce((sum, row) => sum + (row.targetRank === null ? 0 : 1 / row.targetRank), 0);
  const mean = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : null;
  return {
    queries: n,
    expectedSectionRecallAt1: n ? Number((rows.filter((row) => row.targetRank === 1).length / n).toFixed(6)) : null,
    expectedSectionRecallAt5: n ? Number((rows.filter((row) => row.targetRank !== null && row.targetRank <= 5).length / n).toFixed(6)) : null,
    expectedSectionRecallAt100: n ? Number((rows.filter((row) => row.targetRank !== null).length / n).toFixed(6)) : null,
    expectedSectionMrrAt100: n ? Number((reciprocalRank / n).toFixed(6)) : null,
    targetAbsentFromReturnedResults: rows.filter((row) => row.targetRank === null).length,
    truncatedQueries: rows.filter((row) => row.truncated).length,
    meanReturnedCandidates: mean(rows.map((row) => row.returnedCount)),
    meanLexiconReplacementCoverage: mean(rows.map((row) => row.queryTokenCount ? row.lexiconReplacements / row.queryTokenCount : 0)),
    meanUniqueCandidatesForFusion: mean(rows.map((row) => row.uniqueCandidates)),
  };
}
const metrics = {};
for (const language of ["en", "es"]) {
  metrics[language] = {};
  for (const variant of variants) {
    const rows = evaluated.filter((row) => row.language === language && row.variant === variant);
    metrics[language][variant] = {
      all: summarize(rows),
      development: summarize(rows.filter((row) => row.split === "development")),
      previouslyOpenedHoldout: summarize(rows.filter((row) => row.split === "previously-opened-holdout")),
    };
  }
}
const evaluation = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: "exploratory-complete",
  labelFileSha256: manifest.labels.labelFileSha256,
  labelsReadAfterPredictions: true,
  labelsExposedToProvider: false,
  exactMatchDefinition: "sourceRef plus the exact frozen target heading path; alternate acceptable sections were not labeled",
  metrics,
  perQuery: evaluated,
  interpretationLimits: [
    "This is a repeated exploratory evaluation on the previously opened 2026-09-30 corpus and holdout; it is not confirmatory evidence.",
    "The exact-heading labels were Luna-reviewed and were not adjudicated by the documentation owner; semantic equivalents may be counted as misses.",
    "The lexicon is a small one-token EN-ES rewrite probe, not translation, stemming, semantic retrieval, or a production recommendation.",
    "The paired-language query is a diagnostic reference and is not a deployable query-rewrite method.",
    "Jev was not called; the evaluated variants measure lexical candidate retrieval only, not selection, sufficiency, answer quality, or confidence calibration.",
  ],
};
writeJson(resolve(runRoot, "evaluation.json"), evaluation);

function pct(value) { return `${(value * 100).toFixed(1)}%`; }
const lines = [
  "# MSSR Librarian bilingual lexical expansion probe",
  "",
  `**Run:** \`${manifest.runId}\`  `,
  `**Source build:** \`${manifest.source.buildId}\` at \`${manifest.source.gitCommit}\`  `,
  `**Corpus:** ${manifest.corpus.items} frozen MSSR documents; ${predictions.records.length / 2} bilingual query pairs  `,
  "**Mode:** offline; 156 deterministic searches; no provider or Jev calls  ",
  "**Status:** exploratory only; reuses a corpus and grouped holdout opened in the parent run",
  "",
  "## Exact expected-section retrieval",
  "",
  "Recall@100 is candidate presence, not semantic answer quality. The paired-language column is a reference query, not a runtime translation feature.",
  "",
  "| Language | Variant | Recall @1 | Recall @5 | Recall @100 | MRR @100 | Missing / 26 |",
  "|---|---|---:|---:|---:|---:|---:|",
];
const names = { baseline: "Current baseline", lexiconRewrite: "Lexicon rewrite", pairedLanguageReference: "Paired-query reference", fused: "Baseline + rewrite merge" };
for (const language of ["en", "es"]) {
  for (const variant of variants) {
    const row = metrics[language][variant].all;
    lines.push(`| ${language.toUpperCase()} | ${names[variant]} | ${pct(row.expectedSectionRecallAt1)} | ${pct(row.expectedSectionRecallAt5)} | ${pct(row.expectedSectionRecallAt100)} | ${row.expectedSectionMrrAt100.toFixed(4)} | ${row.targetAbsentFromReturnedResults} |`);
  }
}
lines.push(
  "",
  "## Interpretation",
  "",
  "The baseline, rewrite and merge share one frozen corpus and query set. The lexicon variant substitutes exact one-token equivalents and reruns the existing deterministic search; it neither changes the core search implementation nor lets Jev generate terms. The merge deduplicates exact handles, keeps the maximum score returned by either query, then applies stable tie-breaks.",
  "",
  "Because this exact corpus and holdout were already scored in the parent run, all new results are exploratory regardless of the inherited split. Do not use them to set confidence thresholds or claim general bilingual performance. A fresh document-grouped holdout and owner-adjudicated acceptable evidence ranges are required before a production routing change.",
  "",
  "See `manifest.json`, `predictions.json`, `evaluation.json`, `run-completion.json`, and `SHA256SUMS` for frozen inputs, label-blind predictions, separate scoring, and integrity evidence.",
  "",
);
writeFileSync(resolve(runRoot, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(JSON.stringify({ status: evaluation.status, runId: evaluation.runId, metrics: Object.fromEntries(["en", "es"].map((language) => [language, Object.fromEntries(variants.map((variant) => [variant, metrics[language][variant].all]))])) }) + "\n");
