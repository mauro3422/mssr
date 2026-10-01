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
    const matching = entries.find(([, value]) => JSON.parse(value)[4] === "block") ?? entries[0];
    return {
      provider: "test-provider",
      model: "test-model",
      answers: { selection: { type: "choice", choice: matching?.[0] ?? "none", confidence: 0.96 } },
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
const sent = providerCalls[0];
const option = JSON.parse(Object.entries(sent.questions.selection.options).find(([key]) => key !== "none")[1]);
assert.equal(option[4], "block");
assert.ok(option[3].includes("match-window fingerprint"), "excerpt should be centered on the matching text even when it follows the first 220 characters");
assert.ok(option[3].includes("deep retrieval candidate"));
assert.ok(Array.from(option[3]).length <= 220);
assert.equal(JSON.stringify(sent).includes("TAIL-ONLY-MUST-NOT-BE-SENT"), false, "bounded Jev input must not include the unrelated section tail");

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
assert.equal(providerCalls.length, 1, "invalid and stale candidate handles must be rejected before contacting Jev");

const legacy = await selectMssrLibrarianEvidenceWithJev({
  documents,
  query: "select by heading when no search handles were supplied",
}, provider);
assert.equal(legacy.status, "selected", "existing callers without candidate handles retain heading selection behavior");
assert.equal(legacy.selected.handle.rangeKind, "section");
const legacyOption = JSON.parse(Object.entries(providerCalls[1].questions.selection.options).find(([key]) => key !== "none")[1]);
assert.equal(legacyOption[4], "section");

console.log("librarian Jev selection tests passed");
