import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runRoot = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(resolve(runRoot, path), "utf8"));
const writeJson = (path, value) => writeFileSync(resolve(runRoot, path), JSON.stringify(value, null, 2) + "\n", "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const cases = readJson("inputs/cases.json").cases;
const labels = readJson("inputs/labels.json").cases;
const records = readJson("responses.json").responses;
const baseline = readJson("../mssr-librarian-bilingual-retrieval-20260930-v1/records.json").records;
const targetIndex = readJson("inputs/target-index.json").targetIndex;
const baselineSummary = readJson("../mssr-librarian-bilingual-retrieval-20260930-v1/summary.json");
const baselineById = new Map(baseline.map((item) => [`${item.caseId}:${item.language}`, item]));
const responseById = new Map(records.map((item) => [`${item.caseId}:${item.language}`, item]));
const holdoutDocs = new Set(baselineSummary.groupedHoldout.sourceRefs);

const scored = [];
for (const item of cases) {
  for (const language of ["en", "es"]) {
    const key = `${item.id}:${language}`;
    const base = baselineById.get(key);
    const response = responseById.get(key);
    const label = labels[item.id];
    const target = targetIndex[item.id];
    if (!base || !response || !label || !target) throw new Error(`Missing frozen data for ${key}.`);
    const chosen = response.selectedCandidate;
    const selectedTarget = !!chosen && chosen.sourceRef === target.sourceRef
      && JSON.stringify(chosen.headingPath) === JSON.stringify(target.targetHeadingPath);
    scored.push({
      caseId: item.id,
      language,
      status: response.status,
      split: holdoutDocs.has(label.sourceRef) ? "grouped-holdout" : "development",
      targetSourceRef: target.sourceRef,
      targetHeadingPath: target.targetHeadingPath,
      baselineTargetRank: base.targetRank,
      targetPresentInCandidateSet: base.targetRank !== null,
      selectedOption: response.selectedOption ?? null,
      selectedSourceRef: chosen?.sourceRef ?? null,
      selectedHeadingPath: chosen?.headingPath ?? null,
      selectedCandidateRank: chosen?.rank ?? null,
      selectedExpectedSection: selectedTarget,
      selectedConfidence: response.selectedConfidence ?? null,
      noneSelected: response.noneSelected ?? false,
      elapsedMs: response.elapsedMs,
      usage: response.usage ?? null,
      providerFailureClass: response.failureClass ?? null,
    });
  }
}

function summarize(rows) {
  const successful = rows.filter((item) => item.status === "success");
  const covered = successful.filter((item) => item.targetPresentInCandidateSet);
  const misses = successful.filter((item) => !item.targetPresentInCandidateSet);
  const confidence = successful.map((item) => item.selectedConfidence).filter((item) => typeof item === "number");
  const avg = (items) => items.length ? Number((items.reduce((sum, item) => sum + item, 0) / items.length).toFixed(6)) : null;
  const latency = successful.map((item) => item.elapsedMs).sort((a, b) => a - b);
  const medianLatency = latency.length ? Number((latency.length % 2 ? latency[Math.floor(latency.length / 2)] : (latency[latency.length / 2 - 1] + latency[latency.length / 2]) / 2).toFixed(1)) : null;
  const candidateHitsAt1 = rows.filter((item) => item.baselineTargetRank === 1).length;
  const candidateHitsAt5 = rows.filter((item) => item.baselineTargetRank !== null && item.baselineTargetRank <= 5).length;
  const exactSectionMatches = successful.filter((item) => item.selectedExpectedSection).length;
  const coveredMatches = covered.filter((item) => item.selectedExpectedSection).length;
  return {
    queries: rows.length,
    successfulJevCalls: successful.length,
    failedJevCalls: rows.length - successful.length,
    baselineRecallAt1: rows.length ? Number((candidateHitsAt1 / rows.length).toFixed(6)) : null,
    baselineRecallAt5: rows.length ? Number((candidateHitsAt5 / rows.length).toFixed(6)) : null,
    baselineCandidateRecallAt100: rows.length ? Number((rows.filter((item) => item.targetPresentInCandidateSet).length / rows.length).toFixed(6)) : null,
    expectedSectionSelectionRateAmongAllSuccessful: successful.length ? Number((exactSectionMatches / successful.length).toFixed(6)) : null,
    targetSelectionRateWhenExpectedSectionWasOffered: covered.length ? Number((coveredMatches / covered.length).toFixed(6)) : null,
    targetPresentInCandidateSet: covered.length,
    targetAbsentFromCandidateSet: misses.length,
    selectedExpectedSectionAboveBaselineTop5: successful.filter((item) => item.selectedExpectedSection && item.baselineTargetRank !== null && item.baselineTargetRank > 5).length,
    noneSelectedWhenTargetPresent: covered.filter((item) => item.noneSelected).length,
    noneSelectedWhenTargetAbsent: misses.filter((item) => item.noneSelected).length,
    selectedChoiceConfidenceMeanDescriptiveOnly: avg(confidence),
    selectedChoiceConfidenceN: confidence.length,
    latencyMeanMs: avg(successful.map((item) => item.elapsedMs)),
    latencyMedianMs: medianLatency,
    inputTokens: successful.reduce((sum, item) => sum + (item.usage?.input_tokens ?? 0), 0),
    outputTokens: successful.reduce((sum, item) => sum + (item.usage?.output_tokens ?? 0), 0),
  };
}

const metrics = {};
for (const language of ["en", "es"]) {
  const localeRows = scored.filter((item) => item.language === language);
  metrics[language] = {
    all: summarize(localeRows),
    development: summarize(localeRows.filter((item) => item.split === "development")),
    groupedHoldout: summarize(localeRows.filter((item) => item.split === "grouped-holdout")),
  };
}
const allSuccesses = records.filter((item) => item.status === "success");
const providerModels = [...new Set(allSuccesses.map((item) => item.returnedModel))];
const summary = {
  schemaVersion: 1,
  runId: "mssr-librarian-jev-candidate-selection-20260930-v1",
  parentRunId: "mssr-librarian-bilingual-retrieval-20260930-v1",
  status: records.every((item) => item.status === "success") ? "complete" : "partial",
  provider: "TypeSafe Jev via exported MSSR MssrJevSemanticCuratorProvider decisionProvider",
  model: providerModels.length === 1 ? providerModels[0] : providerModels,
  candidateSet: "top 100 candidates returned by the deterministic MSSR Librarian for the same frozen query; one additional none option",
  calls: records.length,
  metrics,
  totalInputTokens: allSuccesses.reduce((sum, item) => sum + item.usage.input_tokens, 0),
  totalOutputTokens: allSuccesses.reduce((sum, item) => sum + item.usage.output_tokens, 0),
  limitations: [
    "Jev only reselected among candidates already found by the deterministic Librarian; it cannot recover the 8 English and 22 Spanish expected sections missing from top 100.",
    "The exact-section labels were double-reviewed by Luna agents, not approved by the human document owner; selecting a different section is not necessarily semantically wrong without further adjudication.",
    "Selected-choice confidence is recorded descriptively and is not a calibrated confidence claim for this small exploratory set.",
    "This choice task tests bounded candidate selection from titles, heading paths and query-specific excerpts, not paragraph generation, compaction, citation synthesis or write authority.",
    "The none choice is scored only as a raw behavior; the benchmark does not have independent labels for all alternate relevant sections.",
  ],
};
writeJson("scored-records.json", { schemaVersion: 1, records: scored });
writeJson("summary.json", summary);
process.stdout.write(JSON.stringify({ runId: summary.runId, status: summary.status, model: summary.model, metrics, totalInputTokens: summary.totalInputTokens, totalOutputTokens: summary.totalOutputTokens }) + "\n");
