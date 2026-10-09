import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import { buildMssrEvidenceAtom } from "../dist/evidence-atom.js";
import { fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";
import { reviewMssrSemanticEvidenceRelations } from "../dist/semantic-evidence-review.js";

const owner = "project:jev-evidence-review";
const sourceDocuments = [
  { sourceRef: "docs/support-a.md", markdown: "# Claims\n\n## Claim A\n\nThe release requires a signed manifest.\n" },
  { sourceRef: "docs/support-b.md", markdown: "# Claims\n\n## Claim B\n\nThe release requires a signed manifest and readback.\n" },
  { sourceRef: "docs/conflict-a.md", markdown: "# Claims\n\n## Claim C\n\nThe retention period is thirty days.\n" },
  { sourceRef: "docs/conflict-b.md", markdown: "# Claims\n\n## Claim D\n\nThe retention period is ninety days.\n" },
];
const documents = sourceDocuments.map((document) => ({ ...document, owner, privacyClass: "project-metadata" }));
const search = searchMssrLibrarianEvidence({ documents, query: { query: "release requires signed manifest retention period" , maxResults: 20 } });
const atoms = [];
const sourceEvidence = [];
for (const document of sourceDocuments) {
  const surface = buildMssrMarkdownDocumentSurface(document);
  const heading = surface.headings.find((item) => item.title.startsWith("Claim "));
  const result = search.results.find((item) => item.handle.sourceRef === document.sourceRef && item.handle.rangeId === heading.id);
  assert.ok(result, `search returns a section handle for ${document.sourceRef}`);
  const fetched = fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef: document.sourceRef, markdown: document.markdown, privacyClass: "project-metadata" });
  const index = atoms.length;
  const atom = buildMssrEvidenceAtom({
    subject: { namespace: "document", kind: "section", identity: `${document.sourceRef}#${heading.id}` },
    source: {
      ref: document.sourceRef,
      revision: surface.revision,
      freshness: "fresh",
      freshnessEvidence: { canonicalOwner: owner, ref: document.sourceRef, revision: surface.revision, observedAt: "2026-09-30T12:00:00Z" },
      headingPath: heading.headingPath,
      range: { startLine: heading.startLine, endLine: heading.endLine, startOffset: heading.startOffset, endOffset: heading.endOffset },
    },
    provenance: { producer: "test-fixture", sourceClass: "canonical", canonicalOwner: owner, projectKey: "review-project" },
    fingerprints: { record: String.fromCharCode(97 + index).repeat(64), payload: fetched.fingerprint },
    reasonCodes: [],
    lineage: { parentAtomIds: [], relatedAtomIds: [], supersedesAtomIds: [] },
    dedupeKey: `fixture:${document.sourceRef}:${surface.revision}`,
    authorityClass: "observed",
    privacyClass: "project-metadata",
    usage: { selection: "selected", consumed: true, outcome: "unknown", reasonCodes: [] },
    attributes: {},
  });
  atoms.push(atom);
  sourceEvidence.push({ atomId: atom.id, handle: fetched.handle, text: fetched.text });
}

const at = "2026-01-01T00:00:00Z";
const pair = (id, leftIndex, rightIndex) => ({
  id,
  leftAtomId: atoms[leftIndex].id,
  rightAtomId: atoms[rightIndex].id,
  claim: { validity: "current", scope: "release-policy", validFrom: at, validUntil: null },
  comparability: {
    scope: { left: "release-policy", right: "release-policy" },
    temporal: { leftValidity: "current", leftValidFrom: at, leftValidUntil: null, rightValidity: "current", rightValidFrom: at, rightValidUntil: null },
  },
});
const pairs = [pair("pair-support", 0, 1), pair("pair-conflict", 2, 3)];
const requests = [];
const provider = {
  async executeSystemOne(request) {
    requests.push(request);
    return {
      provider: "fixture-jev",
      model: "jev-fixture-model",
      answers: Object.fromEntries(request.state.pairs.map((item, index) => [
        `r${index}`,
        { type: "choice", choice: item.id === "pair-conflict" ? "contradicts" : "supports", confidence: 0.93 },
      ])),
      usage: { input_tokens: 320, output_tokens: 12 },
    };
  },
};

const run = await reviewMssrSemanticEvidenceRelations({
  provider,
  input: {
    projectKey: "review-project",
    corpusKey: "release-docs",
    goal: "Compare current release requirements and detect contradictions.",
    inputAtoms: atoms,
    sourceEvidence,
    pairs,
    traceId: "jev-evidence-review-trace-001",
    maxPairsPerRequest: 2,
    maxStateChars: 24_000,
    concurrency: 1,
  },
});
assert.equal(requests.length, 2, "disjoint relation components do not share Jev state");
assert.ok(requests.every((request) => Object.keys(request.questions).length === 1));
assert.equal(run.batches.length, 2);
assert.ok(run.batches.every((batch) => batch.pairIds.length === 1));
assert.equal(run.policy.mixedProjectOrCorpusState, false);
assert.equal(run.policy.providerConfidenceDistributionInvented, false);
assert.equal(run.policy.judgmentsVerified, false);
assert.deepEqual(run.judgments.map((item) => item.judgment.relations[0].kind), ["contradicts", "supports"]);
assert.ok(run.judgments.every((item) => item.judgment.heads[0].probabilities === null));
assert.ok(run.judgments.every((item) => item.judgment.verification.status === "unverified"));
assert.ok(run.judgments.every((item) => item.evaluation.disposition === "review"), "unverified Jev choices never become synthesis-ready");
assert.deepEqual(run.unusedAtomIds, []);

const splitRequests = [];
const split = await reviewMssrSemanticEvidenceRelations({
  provider: { async executeSystemOne(request) { splitRequests.push(request); return await provider.executeSystemOne(request); } },
  input: { projectKey: "review-project", corpusKey: "release-docs", goal: "Compare release requirements.", inputAtoms: atoms, sourceEvidence, pairs, traceId: "jev-evidence-review-trace-002", maxPairsPerRequest: 1, maxStateChars: 24_000, concurrency: 1 },
});
assert.equal(splitRequests.length, 2, "disjoint components already require isolated provider calls");
assert.ok(split.batches.every((batch) => batch.questions === 1));

const linkedPairs = [pair("pair-linked-a", 0, 1), pair("pair-linked-b", 1, 2)];
const linkedRequests = [];
const linked = await reviewMssrSemanticEvidenceRelations({
  provider: { async executeSystemOne(request) { linkedRequests.push(request); return await provider.executeSystemOne(request); } },
  input: { projectKey: "review-project", corpusKey: "release-docs", goal: "Compare linked release evidence.", inputAtoms: atoms.slice(0, 3), sourceEvidence: sourceEvidence.slice(0, 3), pairs: linkedPairs, traceId: "jev-evidence-review-trace-linked", maxPairsPerRequest: 2, maxStateChars: 24_000, concurrency: 1 },
});
assert.equal(linkedRequests.length, 1, "pairs sharing an atom may share one compatible bounded Jev request");
assert.equal(linked.batches[0].pairIds.length, 2);
assert.deepEqual(linked.batches[0].pairIds, ["pair-linked-a", "pair-linked-b"]);

const tampered = sourceEvidence.map((item, index) => index === 0 ? { ...item, text: `${item.text} forged` } : item);
await assert.rejects(() => reviewMssrSemanticEvidenceRelations({ provider, input: { projectKey: "review-project", corpusKey: "release-docs", goal: "Compare.", inputAtoms: atoms, sourceEvidence: tampered, pairs, traceId: "jev-evidence-review-trace-003" } }), /fingerprint/i);

console.log("semantic evidence Jev review tests passed");
