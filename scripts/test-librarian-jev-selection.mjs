import assert from "node:assert/strict";
import {
  fetchMssrLibrarianEvidence,
  searchMssrLibrarianEvidence,
  selectMssrLibrarianEvidenceWithJev,
} from "../dist/index.js";

const owner = "project:jev-selector-test";
const sourceRef = "docs/retention.md";
const markdown = [
  "# Retention guide",
  "",
  "## Audit procedure",
  "",
  `${"General retention guidance precedes the specific verification detail. ".repeat(7)}Retain the cache eviction audit identity for replay and compare the exact match-window fingerprint before accepting the deep retrieval candidate. TAIL-ONLY-MUST-NOT-BE-SENT`,
  "",
].join("\n");
const documents = [{ owner, sourceRef, markdown, privacyClass: "project-metadata" }];
const searchResult = searchMssrLibrarianEvidence({
  documents,
  query: { query: "cache eviction audit identity match-window fingerprint", maxResults: 10 },
});
const searchedRange = searchResult.results.find((result) => result.handle.rangeKind === "block");
assert.ok(searchedRange, "search should return an exact block handle for a body match");

const providerCalls = [];
const provider = {
  async executeSystemOne(request) {
    providerCalls.push(request);
    const options = request.questions.selection.options;
    const entries = Object.entries(options).filter(([key]) => key !== "none");
    const evidenceById = new Map(request.state.evidence.map((item) => [item.id, JSON.parse(item.text)]));
    const matching = entries.find(([key]) => evidenceById.get(key)?.[4] === "block")
      ?? entries.find(([key]) => evidenceById.get(key)?.[2]?.includes("Target Needle"))
      ?? entries[0];
    const localTarget = entries.find(([key]) => evidenceById.get(key)?.[2]?.includes("Target Needle"));
    const selected = request.state.stage === "local-shortlist" && localTarget
      ? entries[0]
      : matching;
    const probabilityOptions = Object.keys(options);
    const runnerUp = localTarget && localTarget[0] !== selected?.[0]
      ? localTarget
      : [probabilityOptions.find((key) => key !== selected?.[0]), ""];
    const remainder = Math.max(0, probabilityOptions.length - 2);
    const probabilities = Object.fromEntries(probabilityOptions.map((key) => [
      key,
      key === selected?.[0] ? 0.8 : key === runnerUp?.[0] ? (remainder > 0 ? 0.15 : 0.2) : 0.05 / remainder,
    ]));
    return {
      provider: "test-provider",
      model: "test-model",
      answers: {
        selection: { type: "choice", choice: selected?.[0] ?? "none", confidence: 0.96, probabilities },
        sufficiency: { type: "noul", noul: 0.91 },
      },
      usage: { input_tokens: 20, output_tokens: 4 },
    };
  },
};

const selected = await selectMssrLibrarianEvidenceWithJev({
  documents,
  query: "Which exact match-window fingerprint verifies a deep retrieval candidate?",
  candidateHandles: [searchedRange.handle],
}, provider);
assert.equal(selected.status, "selected");
assert.equal(selected.selected.handle.rangeKind, "block");
assert.deepEqual(selected.selected.handle, searchedRange.handle, "selection must return the exact supplied, revalidated handle");
assert.equal(selected.candidateCount, 1);
assert.deepEqual(selected.candidateRangeDiagnostics, {
  offered: 1,
  eligible: 1,
  oversizedOmitted: 0,
  maxFetchChars: 20_000,
  lengthUnit: "utf16-code-units",
});
assert.equal(selected.evidenceSufficiency, 0.91, "selection reports Noul's separate answer-sufficiency estimate");
assert.equal(selected.confidenceCalibration, "uncalibrated-provider-score");
const sent = providerCalls[0];
const option = JSON.parse(sent.state.evidence[0].text);
assert.equal(option[4], "block");
assert.ok(option[3].includes("match-window fingerprint"), "excerpt should be centered on the matching text even when it follows the first 220 characters");
assert.ok(option[3].includes("deep retrieval candidate"));
assert.ok(Array.from(option[3]).length <= 260);
assert.equal(sent.questions.sufficiency.kind, "noul");

const parentRange = searchResult.results.find((result) => result.handle.rangeKind === "section");
assert.ok(parentRange, "search should expose the parent section for an exact block candidate");
const overlapCallStart = providerCalls.length;
const overlappingSelection = await selectMssrLibrarianEvidenceWithJev({
  documents,
  query: "Which exact match-window fingerprint verifies a deep retrieval candidate?",
  candidateHandles: [parentRange.handle, searchedRange.handle],
}, provider);
assert.equal(overlappingSelection.candidateCount, 2, "diagnostics must not discard either exact candidate");
assert.equal(overlappingSelection.rangeOverlapDiagnostics.sameSourceRevisionPairs, 1);
assert.equal(overlappingSelection.rangeOverlapDiagnostics.overlappingPairCount, 1);
assert.equal(overlappingSelection.rangeOverlapDiagnostics.nestedPairCount, 1);
assert.equal(overlappingSelection.rangeOverlapDiagnostics.exactRangePairCount, 0);
assert.equal(overlappingSelection.rangeOverlapDiagnostics.partialOverlapPairCount, 0);
assert.deepEqual(overlappingSelection.rangeOverlapDiagnostics.pairs[0], {
  leftOptionId: "h001",
  leftRangeId: parentRange.handle.rangeId,
  leftRangeKind: "section",
  leftLines: [parentRange.handle.startLine, parentRange.handle.endLine],
  rightOptionId: "h002",
  rightRangeId: searchedRange.handle.rangeId,
  rightRangeKind: "block",
  rightLines: [searchedRange.handle.startLine, searchedRange.handle.endLine],
  relation: "left-contains-right",
  overlapCodeUnits: searchedRange.handle.endOffset - searchedRange.handle.startOffset,
});
assert.equal(overlappingSelection.rangeOverlapDiagnostics.mutationApplied, false);
assert.equal(providerCalls[overlapCallStart].state.evidence.length, 2, "Jev receives both candidates after diagnostics");

const disjointDocument = {
  owner,
  sourceRef: "docs/disjoint-ranges.md",
  markdown: "# Disjoint ranges\n\n## Alpha\n\nALPHA_ONLY_EVIDENCE_FOR_RETENTION.\n\n## Beta\n\nBETA_ONLY_EVIDENCE_FOR_REPLAY.\n",
  privacyClass: "project-metadata",
};
const alphaHandle = searchMssrLibrarianEvidence({
  documents: [disjointDocument],
  query: { query: "ALPHA_ONLY_EVIDENCE_FOR_RETENTION", maxResults: 10 },
}).results.find((result) => result.handle.rangeKind === "block")?.handle;
const betaHandle = searchMssrLibrarianEvidence({
  documents: [disjointDocument],
  query: { query: "BETA_ONLY_EVIDENCE_FOR_REPLAY", maxResults: 10 },
}).results.find((result) => result.handle.rangeKind === "block")?.handle;
assert.ok(alphaHandle && betaHandle, "both disjoint evidence blocks should be searchable");
const disjointSelection = await selectMssrLibrarianEvidenceWithJev({
  documents: [disjointDocument],
  query: "Which exact range contains ALPHA_ONLY_EVIDENCE_FOR_RETENTION?",
  candidateHandles: [alphaHandle, betaHandle],
}, provider);
assert.equal(disjointSelection.rangeOverlapDiagnostics.sameSourceRevisionPairs, 1);
assert.equal(disjointSelection.rangeOverlapDiagnostics.overlappingPairCount, 0);
assert.equal(disjointSelection.rangeOverlapDiagnostics.nestedPairCount, 0);
assert.deepEqual(disjointSelection.rangeOverlapDiagnostics.pairs, []);
assert.ok(Object.values(sent.questions.selection.options).every((value) => value.startsWith("Evidence candidate") || value === "No supplied range directly answers the information need."));
assert.equal(JSON.stringify(sent).includes("TAIL-ONLY-MUST-NOT-BE-SENT"), false, "bounded Jev input must not include the unrelated section tail");

const excerptWindowQuery = "Which exact search request should match the payload fingerprint offsets source revision and privacy class before a result is accepted?";
const excerptWindowDocument = {
  owner,
  sourceRef: "docs/excerpt-window.md",
  markdown: [
    "# Retrieval note",
    "",
    "## Binding rule",
    "",
    "Exact search should inspect each document section and source before deciding what to retrieve.",
    ...Array.from({ length: 8 }, () => "Routine background details describe the surrounding system but do not state the binding contract."),
    "The record must match payload fingerprint offsets source revision and privacy class before the metadata is eligible for search.",
    "",
  ].join("\n"),
  privacyClass: "project-metadata",
};
const excerptWindowHandle = searchMssrLibrarianEvidence({
  documents: [excerptWindowDocument],
  query: { query: "exact search document section", maxResults: 10 },
}).results.find((result) => result.handle.rangeKind === "section")?.handle;
assert.ok(excerptWindowHandle, "search should expose the exact section used by the query-window regression");
const excerptWindowCallStart = providerCalls.length;
const excerptWindowSelection = await selectMssrLibrarianEvidenceWithJev({
  documents: [excerptWindowDocument],
  candidateHandles: [excerptWindowHandle],
  query: excerptWindowQuery,
}, provider);
assert.equal(excerptWindowSelection.status, "selected");
const excerptWindowEvidence = JSON.parse(providerCalls[excerptWindowCallStart].state.evidence[0].text);
assert.ok(excerptWindowEvidence[3].includes("payload fingerprint offsets"), "the bounded excerpt should center on the dense binding terms instead of an earlier generic search match");
assert.ok(excerptWindowEvidence[3].includes("source revision and privacy class"), "the excerpt should preserve nearby binding evidence needed to distinguish the candidate");
assert.ok(Array.from(excerptWindowEvidence[3]).length <= 260, "the improved centering must retain the existing excerpt budget");

const decomposedSpanishDocument = {
  owner,
  sourceRef: "docs/decomposed-spanish.md",
  markdown: `# Guía\n\n## Año fiscal\n\n${"Contexto general sin el término buscado. ".repeat(18)}La evidencia clave del an\u0303o fiscal debe contrastarse con la fuente original.`,
  privacyClass: "project-metadata",
};
const decomposedSpanishStart = providerCalls.length;
await selectMssrLibrarianEvidenceWithJev({ documents: [decomposedSpanishDocument], query: "¿Cuál es la evidencia clave del año fiscal?" }, provider);
const decomposedSpanishEvidence = providerCalls[decomposedSpanishStart].state.evidence.map((item) => JSON.parse(item.text)[3]);
assert.ok(decomposedSpanishEvidence.some((excerpt) => excerpt.includes("an\u0303o fiscal")), "query-centering must find composed ñ against decomposed source text and preserve its exact bytes");
const beforeInvalidHandleChecks = providerCalls.length;

const exact = fetchMssrLibrarianEvidence({
  handle: selected.selected.handle,
  owner,
  sourceRef,
  markdown,
  privacyClass: "project-metadata",
});
assert.match(exact.text, /cache eviction audit identity/);
assert.equal(exact.fingerprint, searchedRange.handle.fingerprint);

await assert.rejects(
  selectMssrLibrarianEvidenceWithJev({
    documents,
    query: "select this range",
    candidateHandles: [{ ...searchedRange.handle, owner: "project:other" }],
  }, provider),
  /explicitly supplied document owned by the same caller/,
);
await assert.rejects(
  selectMssrLibrarianEvidenceWithJev({
    documents: [{ ...documents[0], markdown: `${markdown}\nchanged` }],
    query: "select this stale range",
    candidateHandles: [searchedRange.handle],
  }, provider),
  /stale/,
);
assert.equal(providerCalls.length, beforeInvalidHandleChecks, "invalid and stale candidate handles must be rejected before contacting Jev");

const legacyCallIndex = providerCalls.length;
const legacy = await selectMssrLibrarianEvidenceWithJev({
  documents,
  query: "select by heading when no search handles were supplied",
}, provider);
assert.equal(legacy.status, "selected", "existing callers without candidate handles retain heading selection behavior");
assert.equal(legacy.selected.handle.rangeKind, "section");
const legacyOption = JSON.parse(providerCalls[legacyCallIndex].state.evidence[0].text);
assert.equal(legacyOption[4], "section");

const manyHeadings = ["# Large evidence catalog", ""];
for (let index = 1; index <= 260; index += 1) {
  manyHeadings.push(`## ${index === 260 ? "Target Needle" : `Section ${String(index).padStart(3, "0")}`}`, "", `Candidate ${index} contains bounded evidence for catalog hierarchy and selection. ${index === 260 ? "UNIQUE_TARGET_EVIDENCE" : ""}`, "");
}
const largeDocument = { owner, sourceRef: "docs/large-catalog.md", markdown: manyHeadings.join("\n"), privacyClass: "project-metadata" };
const beforeHierarchicalCalls = providerCalls.length;
const hierarchical = await selectMssrLibrarianEvidenceWithJev({ documents: [largeDocument], query: "Find the target needle evidence in the large catalog." }, provider);
assert.equal(hierarchical.status, "selected");
assert.equal(hierarchical.selectionMode, "hierarchical");
assert.equal(hierarchical.candidateCount, 260, "the oversized root range is omitted while 260 exact child ranges remain eligible");
assert.deepEqual(hierarchical.candidateRangeDiagnostics, {
  offered: 261,
  eligible: 260,
  oversizedOmitted: 1,
  maxFetchChars: 20_000,
  lengthUnit: "utf16-code-units",
});
assert.equal(hierarchical.providerCalls, 3, "260 headings require two bounded local choices and one global choice");
assert.equal(providerCalls.length - beforeHierarchicalCalls, hierarchical.providerCalls);
assert.equal(hierarchical.finalistCount, 4, "the selector retains the two highest-probability candidates from each shard");
assert.equal(hierarchical.selected.title, "Target Needle");
assert.equal(hierarchical.batchAssessments.length, 2);
assert.deepEqual(hierarchical.batchAssessments.map((item) => item.retainedFinalistCount), [2, 2]);
assert.ok(hierarchical.batchAssessments.every((item) => item.retainedFinalists.length === 2));
assert.equal(hierarchical.usage.input_tokens, 60);
for (const request of providerCalls.slice(beforeHierarchicalCalls)) {
  const optionCount = Object.keys(request.questions.selection.options).length;
  assert.ok(optionCount <= 255, "every provider call stays within the TypeSafe Choice option ceiling");
  const candidateChars = request.state.evidence.reduce((sum, item) => sum + item.text.length, 0);
  assert.ok(candidateChars <= 80_000, "every provider call respects the bounded MSSR candidate-text budget");
  assert.equal(request.questions.sufficiency.kind, "noul");
}
const selectedExact = fetchMssrLibrarianEvidence({ handle: hierarchical.selected.handle, owner, sourceRef: largeDocument.sourceRef, markdown: largeDocument.markdown, privacyClass: "project-metadata" });
assert.match(selectedExact.text, /UNIQUE_TARGET_EVIDENCE/);

const fetchLimit = 20_000;
const oversizedSectionDocument = {
  owner,
  sourceRef: "docs/oversized-section.md",
  markdown: `# Oversized source\n\n## Target Needle\n\n${"Oversized context that cannot be re-fetched as one exact range. ".repeat(400)}UNIQUE_OVERSIZED_TAIL`,
  privacyClass: "project-metadata",
};
const oversizedSearch = searchMssrLibrarianEvidence({
  documents: [oversizedSectionDocument],
  query: { query: "UNIQUE_OVERSIZED_TAIL", maxResults: 10 },
});
const oversizedCandidate = oversizedSearch.results.find((result) => result.handle.rangeKind === "section");
assert.ok(oversizedCandidate);
assert.ok(oversizedCandidate.rangeCodeUnits > fetchLimit);
assert.equal(oversizedCandidate.exactFetchable, false);
const oversizedCallStart = providerCalls.length;
const mixedCandidateSelection = await selectMssrLibrarianEvidenceWithJev({
  documents: [oversizedSectionDocument, ...documents],
  query: "select the exact source range for the unique tail evidence",
  candidateHandles: [oversizedCandidate.handle, searchedRange.handle],
}, provider);
assert.equal(mixedCandidateSelection.status, "selected", "a valid fetchable candidate remains selectable when another supplied candidate is oversized");
assert.deepEqual(mixedCandidateSelection.selected.handle, searchedRange.handle);
assert.deepEqual(mixedCandidateSelection.candidateRangeDiagnostics, {
  offered: 2,
  eligible: 1,
  oversizedOmitted: 1,
  maxFetchChars: fetchLimit,
  lengthUnit: "utf16-code-units",
});
assert.equal(JSON.stringify(providerCalls[oversizedCallStart]).includes("UNIQUE_OVERSIZED_TAIL"), false, "an oversized exact source range is never sent to Jev");

const allOversizedProviderCalls = providerCalls.length;
const allOversizedSelection = await selectMssrLibrarianEvidenceWithJev({
  documents: [oversizedSectionDocument],
  query: "select the oversized tail",
  candidateHandles: [oversizedCandidate.handle],
}, provider);
assert.equal(allOversizedSelection.status, "not-run");
assert.equal(allOversizedSelection.reason, "no-fetchable-candidates");
assert.equal(allOversizedSelection.selected, null);
assert.equal(allOversizedSelection.jevCallMade, false);
assert.equal(allOversizedSelection.candidateRangeDiagnostics.offered, 1);
assert.equal(allOversizedSelection.candidateRangeDiagnostics.eligible, 0);
assert.equal(allOversizedSelection.candidateRangeDiagnostics.oversizedOmitted, 1);
assert.equal(providerCalls.length, allOversizedProviderCalls, "all-oversized exact handles abstain before contacting Jev");

const oversizedHeadingDocument = {
  owner,
  sourceRef: "docs/oversized-heading.md",
  markdown: `# Oversized heading\n\n${"Root material too large to return through the exact fetch cap. ".repeat(400)}\n\n## Fetchable Needle\n\nThe child section remains small, exact, and retrievable.`,
  privacyClass: "project-metadata",
};
const headingCallStart = providerCalls.length;
const headingSelection = await selectMssrLibrarianEvidenceWithJev({
  documents: [oversizedHeadingDocument],
  query: "select the fetchable child section",
}, provider);
assert.equal(headingSelection.status, "selected", "heading mode omits only oversized ranges while retaining fetchable child sections");
assert.deepEqual(headingSelection.candidateRangeDiagnostics, {
  offered: 2,
  eligible: 1,
  oversizedOmitted: 1,
  maxFetchChars: fetchLimit,
  lengthUnit: "utf16-code-units",
});
assert.equal(headingSelection.selected.title, "Fetchable Needle");
assert.equal(JSON.stringify(providerCalls[headingCallStart]).includes("Root material too large"), false, "oversized heading text is never sent to Jev through its candidate range");

const noDistributionCalls = [];
const providerWithoutDistribution = {
  async executeSystemOne(request) {
    noDistributionCalls.push(request);
    const firstOption = Object.keys(request.questions.selection.options).find((option) => option !== "none");
    return {
      provider: "test-provider-without-distribution",
      model: "test-model",
      answers: {
        selection: { type: "choice", choice: firstOption ?? "none", confidence: 0.7 },
        sufficiency: { type: "noul", noul: 0.6 },
      },
      usage: { input_tokens: 3, output_tokens: 1 },
    };
  },
};
const fallbackHierarchy = await selectMssrLibrarianEvidenceWithJev({ documents: [largeDocument], query: "Find a target in the catalog." }, providerWithoutDistribution);
assert.equal(fallbackHierarchy.status, "selected");
assert.equal(fallbackHierarchy.finalistCount, 2, "providers without a probability map retain one selected candidate per shard");
assert.deepEqual(fallbackHierarchy.batchAssessments.map((item) => item.retainedFinalistCount), [1, 1]);
assert.equal(noDistributionCalls.length, 3);

const oversizedCatalogs = Array.from({ length: 4 }, (_, documentIndex) => {
  const headings = ["# " + "Root evidence catalog ".repeat(8).trim(), ""];
  for (let index = 1; index < 512; index += 1) {
    headings.push(`## ${String(index).padStart(4, "0")} ${"Detailed catalog evidence heading ".repeat(8).trim()}`, "", "Bounded source material for the provider-call preflight fixture.", "");
  }
  return {
    owner,
    sourceRef: `docs/${documentIndex}-${"long-source-reference-segment-".repeat(25).slice(0, 870)}.md`,
    markdown: headings.join("\n"),
    privacyClass: "project-metadata",
  };
});
let limitProviderCalls = 0;
const limitResult = await selectMssrLibrarianEvidenceWithJev({ documents: oversizedCatalogs, query: "Find a matching catalog section." }, {
  async executeSystemOne() { limitProviderCalls += 1; throw new Error("provider must not be called after preflight limit"); },
});
assert.equal(limitResult.status, "not-run");
assert.equal(limitResult.reason, "provider-call-limit");
assert.equal(limitResult.candidateRangeDiagnostics.offered, 2_048);
assert.equal(limitResult.candidateRangeDiagnostics.eligible, 2_044);
assert.equal(limitResult.candidateRangeDiagnostics.oversizedOmitted, 4);
assert.equal(limitProviderCalls, 0, "a catalog exceeding the provider-call budget must fail closed before Jev use");

console.log("librarian Jev selection tests passed");
