import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMssrLibrarianEvidence, mssrLibrarianEvidenceHandleId, mssrLibrarianEvidenceHandleSchema, searchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";
import { buildMssrMarkdownDocumentSurface } from "../../../../dist/document-surface.js";

const root = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const writeJson = (path, value) => writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + "\n", "utf8");
const cases = readJson("inputs/cases.json").cases;
const labels = readJson("inputs/labels.json").cases;
const targetIndex = readJson("inputs/target-index.json").targetIndex;
const responses = readJson("responses.json").responses;
const documents = readJson("inputs/corpus.json").documents;
const holdoutRefs = new Set(readJson("../mssr-librarian-bilingual-retrieval-20260930-v1/summary.json").groupedHoldout.sourceRefs);
const shortlisted = readJson("../mssr-librarian-jev-candidate-selection-20260930-v1/scored-records.json").records;
const shortlistedById = new Map(shortlisted.map((row) => [`${row.caseId}:${row.language}`, row]));
const shortlistedResponses = readJson("../mssr-librarian-jev-candidate-selection-20260930-v1/responses.json").responses;
const shortlistedResponseById = new Map(shortlistedResponses.map((row) => [`${row.caseId}:${row.language}`, row]));
const responseById = new Map(responses.map((row) => [`${row.caseId}:${row.language}`, row]));
const documentByRef = new Map(documents.map((document) => [document.sourceRef, document]));
const headingHandles = new Map();
for (const document of documents) {
  const surface = buildMssrMarkdownDocumentSurface({ sourceRef: document.sourceRef, markdown: document.markdown });
  for (const heading of surface.headings) {
    const fields = {
      version: 1,
      owner: document.owner,
      sourceRef: document.sourceRef,
      revision: surface.revision,
      rangeId: heading.id,
      rangeKind: "section",
      startLine: heading.startLine,
      endLine: heading.endLine,
      startOffset: heading.startOffset,
      endOffset: heading.endOffset,
      fingerprint: heading.fingerprint,
      privacyClass: document.privacyClass,
    };
    const handle = mssrLibrarianEvidenceHandleSchema.parse({ ...fields, id: mssrLibrarianEvidenceHandleId(fields) });
    headingHandles.set(`${document.sourceRef}#${heading.id}`, handle);
  }
}
const retrievalDocs = documents.map(({ owner, sourceRef, markdown, privacyClass }) => ({ owner, sourceRef, markdown, privacyClass }));
const shortlistHandlesById = new Map();
for (const item of cases) {
  for (const language of ["en", "es"]) {
    const query = item[language];
    const search = searchMssrLibrarianEvidence({ documents: retrievalDocs, query: { query, maxResults: 100, maxSnippetChars: 200 } });
    shortlistHandlesById.set(`${item.id}:${language}`, new Map(search.results.map((result) => [result.handle.id, result.handle])));
  }
}

function fetchStatus(candidate, candidateType, key) {
  if (!candidate) return { status: "none-selected", fingerprintMatch: null };
  const sourceRef = candidate.sourceRef;
  const document = documentByRef.get(sourceRef);
  if (!document) return { status: "integrity-failure", fingerprintMatch: false };
  let handle;
  if (candidateType === "full-catalog") {
    handle = headingHandles.get(`${sourceRef}#${candidate.rangeId}`);
    if (!handle || handle.revision !== candidate.surfaceRevision || handle.fingerprint !== candidate.fingerprint) {
      return { status: "integrity-failure", fingerprintMatch: false };
    }
  } else {
    handle = shortlistHandlesById.get(key)?.get(candidate.handleId);
    if (!handle) return { status: "integrity-failure", fingerprintMatch: false };
  }
  try {
    const fetched = fetchMssrLibrarianEvidence({ handle, owner: document.owner, sourceRef, markdown: document.markdown, privacyClass: document.privacyClass });
    const fingerprintMatch = fetched.fingerprint === handle.fingerprint;
    const exactLength = fetched.text.length === handle.endOffset - handle.startOffset;
    return { status: fingerprintMatch && exactLength ? "pass" : "integrity-failure", fingerprintMatch, fetchedChars: fetched.text.length };
  } catch (error) {
    const message = String(error?.message ?? "");
    return { status: /exceeds fetch size limit/i.test(message) ? "size-limit" : "integrity-failure", fingerprintMatch: null };
  }
}

const scored = [];
for (const item of cases) {
  for (const language of ["en", "es"]) {
    const key = `${item.id}:${language}`;
    const target = targetIndex[item.id];
    const label = labels[item.id];
    const response = responseById.get(key);
    const short = shortlistedById.get(key);
    const shortResponse = shortlistedResponseById.get(key);
    if (!target || !label || !response || !short) throw new Error(`Missing paired score input for ${key}.`);
    const candidate = response.selectedCandidate;
    const selectedFetch = fetchStatus(candidate, "full-catalog", key);
    const shortlistFetch = fetchStatus(shortResponse?.selectedCandidate ?? null, "shortlist", key);
    const selectedExpectedSection = !!candidate && candidate.sourceRef === target.sourceRef
      && JSON.stringify(candidate.headingPath) === JSON.stringify(target.targetHeadingPath);
    scored.push({
      caseId: item.id,
      language,
      status: response.status,
      split: holdoutRefs.has(label.sourceRef) ? "grouped-holdout" : "development",
      targetSourceRef: target.sourceRef,
      targetHeadingPath: target.targetHeadingPath,
      fullCatalogCandidateCount: response.offeredCandidates,
      expectedSectionPresent: true,
      selectedOption: response.selectedOption ?? null,
      selectedSourceRef: candidate?.sourceRef ?? null,
      selectedHeadingPath: candidate?.headingPath ?? null,
      selectedExpectedSection,
      selectedFetchStatus: selectedFetch.status,
      selectedFetchFingerprintMatch: selectedFetch.fingerprintMatch,
      selectedFetchChars: selectedFetch.fetchedChars ?? null,
      selectedConfidence: response.selectedConfidence ?? null,
      noneSelected: response.noneSelected ?? false,
      elapsedMs: response.elapsedMs,
      usage: response.usage ?? null,
      providerFailureClass: response.failureClass ?? null,
      top100JevSelectedExpectedSection: short.selectedExpectedSection,
      top100SelectedSourceRef: short.selectedSourceRef,
      top100SelectedHeadingPath: short.selectedHeadingPath,
      top100FetchStatus: shortlistFetch.status,
      top100FetchFingerprintMatch: shortlistFetch.fingerprintMatch,
      top100FetchChars: shortlistFetch.fetchedChars ?? null,
      fullCatalogOnlyHit: selectedExpectedSection && !short.selectedExpectedSection,
      top100OnlyHit: !selectedExpectedSection && short.selectedExpectedSection,
    });
  }
}

function summarize(rows) {
  const successes = rows.filter((row) => row.status === "success");
  const confidence = successes.map((row) => row.selectedConfidence).filter((value) => typeof value === "number");
  const avg = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6)) : null;
  const latencies = successes.map((row) => row.elapsedMs).sort((a, b) => a - b);
  const medianLatency = latencies.length ? Number((latencies.length % 2 ? latencies[Math.floor(latencies.length / 2)] : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2).toFixed(1)) : null;
  return {
    queries: rows.length,
    successfulJevCalls: successes.length,
    failedJevCalls: rows.length - successes.length,
    expectedSectionsInFullCatalog: rows.filter((row) => row.expectedSectionPresent).length,
    fullCatalogExactSectionSelections: successes.filter((row) => row.selectedExpectedSection).length,
    fullCatalogExactSectionSelectionRate: successes.length ? Number((successes.filter((row) => row.selectedExpectedSection).length / successes.length).toFixed(6)) : null,
    top100CandidateSetExactSectionSelections: successes.filter((row) => row.top100JevSelectedExpectedSection).length,
    fullCatalogOnlyExactHits: successes.filter((row) => row.fullCatalogOnlyHit).length,
    top100OnlyExactHits: successes.filter((row) => row.top100OnlyHit).length,
    fullCatalogFetchChecks: successes.filter((row) => row.selectedFetchStatus !== "none-selected").length,
    fullCatalogFetchPasses: successes.filter((row) => row.selectedFetchStatus === "pass").length,
    fullCatalogFetchSizeLimitRejections: successes.filter((row) => row.selectedFetchStatus === "size-limit").length,
    fullCatalogFetchIntegrityFailures: successes.filter((row) => row.selectedFetchStatus === "integrity-failure").length,
    top100FetchChecks: successes.filter((row) => row.top100FetchStatus !== "none-selected").length,
    top100FetchPasses: successes.filter((row) => row.top100FetchStatus === "pass").length,
    top100FetchSizeLimitRejections: successes.filter((row) => row.top100FetchStatus === "size-limit").length,
    top100FetchIntegrityFailures: successes.filter((row) => row.top100FetchStatus === "integrity-failure").length,
    noneSelected: successes.filter((row) => row.noneSelected).length,
    selectedChoiceConfidenceMeanDescriptiveOnly: avg(confidence),
    selectedChoiceConfidenceN: confidence.length,
    latencyMeanMs: avg(successes.map((row) => row.elapsedMs)),
    latencyMedianMs: medianLatency,
    inputTokens: successes.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0),
    outputTokens: successes.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0),
  };
}

const metrics = {};
for (const language of ["en", "es"]) {
  const locale = scored.filter((row) => row.language === language);
  metrics[language] = {
    all: summarize(locale),
    development: summarize(locale.filter((row) => row.split === "development")),
    groupedHoldout: summarize(locale.filter((row) => row.split === "grouped-holdout")),
  };
}
const successes = responses.filter((row) => row.status === "success");
const models = [...new Set(successes.map((row) => row.returnedModel))];
const summary = {
  schemaVersion: 1,
  runId: "mssr-librarian-jev-full-heading-choice-20260930-v1",
  parentRunId: "mssr-librarian-jev-candidate-selection-20260930-v1",
  status: responses.length === 52 && responses.every((row) => row.status === "success") ? "complete" : "partial",
  provider: "TypeSafe Jev via exported MSSR MssrJevSemanticCuratorProvider decisionProvider",
  model: models.length === 1 ? models[0] : models,
  candidateCatalog: "all 200 Markdown heading sections across the 21 frozen documents, plus none; each option uses sourceRef, heading path, and the document surface's bounded leading-block hint",
  calls: responses.length,
  metrics,
  totalInputTokens: successes.reduce((sum, row) => sum + row.usage.input_tokens, 0),
  totalOutputTokens: successes.reduce((sum, row) => sum + row.usage.output_tokens, 0),
  limitations: [
    "This is direct Choice over the complete heading catalog, not the production Librarian search path and not Noul pairwise reranking.",
    "Expected exact-section labels were double-reviewed by Luna agents, not approved by the human document owner; other sections may also be acceptable evidence.",
    "The same 21 documents remain visible in the grouped query holdout; the holdout is by target sourceRef in the query set, not by unseen corpus documents.",
    "Each candidate has only a bounded leading-block hint. A section whose decisive evidence appears later may be underrepresented.",
    "Selected-choice confidence is descriptive and uncalibrated; this experiment does not test abstention gold, synthesis, citations, contradiction truth, or write authority.",
  ],
};
writeJson("scored-records.json", { schemaVersion: 1, records: scored });
writeJson("summary.json", summary);
process.stdout.write(JSON.stringify({ runId: summary.runId, status: summary.status, metrics, totalInputTokens: summary.totalInputTokens, totalOutputTokens: summary.totalOutputTokens }) + "\n");
