import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import { buildMssrEvidenceAtom } from "../dist/evidence-atom.js";
import { fetchMssrLibrarianEvidence, mssrLibrarianEvidenceHandleId, searchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";
import { buildMssrSemanticJudgment } from "../dist/semantic-judgment.js";
import { buildMssrSemanticSynthesisProposal } from "../dist/semantic-synthesis-proposal.js";

const owner = "project:synthesis-fixture";
const documents = [
  { sourceRef: "docs/a.md", markdown: "# Knowledge\n\n## Evidence A\n\nThe feature requires a revision-bound record.\n" },
  { sourceRef: "docs/b.md", markdown: "# Knowledge\n\n## Evidence B\n\nThe feature requires a revision-bound record with an owner.\n" },
];
const docs = documents.map((item) => ({ ...item, owner, privacyClass: "project-metadata" }));
const retrieval = searchMssrLibrarianEvidence({ documents: docs, query: { query: "feature revision-bound record", maxResults: 10 } });
const inputs = documents.map((doc, index) => {
  const surface = buildMssrMarkdownDocumentSurface(doc);
  const heading = surface.headings.find((item) => item.title === `Evidence ${index === 0 ? "A" : "B"}`);
  const result = retrieval.results.find((item) => item.handle.sourceRef === doc.sourceRef && item.handle.rangeId === heading.id);
  assert.ok(result, `retrieval returns the exact source range for ${doc.sourceRef}`);
  const source = fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef: doc.sourceRef, markdown: doc.markdown, privacyClass: "project-metadata" });
  const atom = buildMssrEvidenceAtom({
    subject: { namespace: "document", kind: "section", identity: `${doc.sourceRef}#${heading.id}` },
    source: {
      ref: doc.sourceRef,
      revision: surface.revision,
      freshness: "fresh",
      freshnessEvidence: { canonicalOwner: owner, ref: doc.sourceRef, revision: surface.revision, observedAt: "2026-09-30T10:00:00Z" },
      headingPath: heading.headingPath,
      range: { startLine: heading.startLine, endLine: heading.endLine, startOffset: heading.startOffset, endOffset: heading.endOffset },
    },
    provenance: { producer: "fixture", sourceClass: "canonical", canonicalOwner: owner, projectKey: "fixture-project" },
    fingerprints: { record: (index === 0 ? "a" : "b").repeat(64), payload: heading.fingerprint },
    reasonCodes: [],
    lineage: { parentAtomIds: [], relatedAtomIds: [], supersedesAtomIds: [] },
    dedupeKey: `fixture:${doc.sourceRef}:${surface.revision}`,
    authorityClass: "observed",
    privacyClass: "project-metadata",
    usage: { selection: "selected", consumed: true, outcome: "unknown", reasonCodes: [] },
    attributes: {},
  });
  return { atom, sourceEvidence: { atomId: atom.id, handle: source.handle, text: source.text } };
});
const atoms = inputs.map((item) => item.atom);
const evidence = inputs.map((item) => item.sourceEvidence);
function reidentifyHandle(handle, changes) {
  const { id: _id, ...fields } = { ...handle, ...changes };
  return { ...fields, id: mssrLibrarianEvidenceHandleId(fields) };
}

function judgmentFor(kind, selectedAtoms = atoms) {
  const selectedProbability = kind === "supports" ? 0.95 : 0.91;
  const raw = {
    schemaVersion: 1,
    immutable: true,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
    decisionFamily: "relation",
    inputs: selectedAtoms.map((atom) => ({ atomId: atom.id, sourceRef: atom.source.ref, revision: atom.source.revision, fingerprints: { record: atom.fingerprints.record, payload: atom.fingerprints.payload } })),
    heads: [
      { head: "relation-kind", candidates: ["supports", "contradicts"], selectedId: kind, rawConfidence: selectedProbability, probabilities: [{ candidateId: "supports", probability: kind === "supports" ? 0.95 : 0.09 }, { candidateId: "contradicts", probability: kind === "contradicts" ? 0.91 : 0.05 }] },
      { head: "relation-direction", candidates: ["left-to-right", "right-to-left"], selectedId: "left-to-right", rawConfidence: 0.8, probabilities: [{ candidateId: "left-to-right", probability: 0.8 }, { candidateId: "right-to-left", probability: 0.2 }] },
    ],
    calibratedConfidence: null,
    claim: { validity: "current", scope: "feature-contract", validFrom: "2026-01-01T00:00:00Z", validUntil: null },
    citations: selectedAtoms.map((atom) => ({ atomId: atom.id, sourceRef: atom.source.ref, revision: atom.source.revision, fingerprint: atom.fingerprints.record, role: "supports" })),
    relations: [{
      leftAtomId: selectedAtoms[0].id,
      rightAtomId: selectedAtoms[1].id,
      kind,
      rawConfidence: selectedProbability,
      citedAtomIds: selectedAtoms.map((atom) => atom.id),
      comparability: { scope: { left: "feature-contract", right: "feature-contract" }, temporal: { leftValidity: "current", leftValidFrom: "2026-01-01T00:00:00Z", leftValidUntil: null, rightValidity: "current", rightValidFrom: "2026-01-01T00:00:00Z", rightValidUntil: null } },
      status: kind === "supports" ? "candidate" : "candidate",
    }],
    evidenceCoverage: { requestedAtomIds: selectedAtoms.map((atom) => atom.id), returnedAtomIds: selectedAtoms.map((atom) => atom.id), complete: true },
    abstainReasons: [],
    reviewReasons: [],
    provider: "fixture-provider",
    model: "fixture-model",
    promptVersion: "fixture-prompt-v1",
    providerSchemaVersion: "fixture-schema-v1",
    traceId: "proposal-trace-001",
    verificationEvidence: null,
  };
  const id = buildMssrSemanticJudgment({ judgment: raw, inputAtoms: selectedAtoms }).id;
  raw.verificationEvidence = {
    schemaVersion: 1,
    verificationId: `verification-${kind}-001`,
    subject: { namespace: "mssr", kind: "semantic-judgment", identity: id, proposalProvider: raw.provider, proposalTraceId: raw.traceId },
    status: "confirmed",
    value: kind,
    evidenceRef: `readback:${kind}-001`,
    evidenceRevision: "verify-revision-001",
    verifier: { kind: "test", id: "independent-readback", provider: "test-runner", traceId: "verifier-trace-002" },
    observedAt: "2026-09-30T11:00:00Z",
  };
  return buildMssrSemanticJudgment({ judgment: raw, inputAtoms: selectedAtoms });
}

const supported = judgmentFor("supports");
const preview = buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: atoms, sourceEvidence: evidence });
assert.equal(preview.disposition, "candidate");
assert.equal(preview.groups.length, 1);
assert.equal(preview.groups[0].disposition, "consolidation-candidate");
assert.equal(preview.groups[0].markdown, evidence.map((item) => item.text).join("\n\n"));
assert.equal(preview.groups[0].markdownSha256.length, 64);
assert.equal(preview.sourceEvidenceRetained, true);
assert.equal(preview.reversible, true);
assert.equal(preview.applyAllowed, false);
assert.equal(preview.policy.thresholdIsCalibrated, false);
assert.equal(preview.policy.verificationEvidenceIsCallerAsserted, true);
assert.equal(preview.policy.sourceFreshnessIsCallerAsserted, true);
assert.equal(preview.policy.hostMustRevalidateCurrentRevisions, true);
assert.equal(Object.isFrozen(preview), true);
assert.equal(Object.isFrozen(preview.groups[0].sourceSnapshots[0].range), true);

const contradicted = judgmentFor("contradicts");
const conflictPreview = buildMssrSemanticSynthesisProposal({ judgment: contradicted, inputAtoms: atoms, sourceEvidence: evidence });
assert.equal(conflictPreview.disposition, "review");
assert.equal(conflictPreview.groups.length, 2, "contradicting claims stay in separate groups");
assert.ok(conflictPreview.groups.every((group) => group.disposition === "review" && group.markdown === null));
assert.ok(conflictPreview.groups.every((group) => group.sourceSnapshots.length === 1), "the exact original source remains recoverable");

assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: atoms, sourceEvidence: [{ ...evidence[0], text: `${evidence[0].text} altered` }, evidence[1]] }), /fingerprint/i);
assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: atoms, sourceEvidence: [{ ...evidence[0], handle: { ...evidence[0].handle, endLine: evidence[0].handle.endLine + 1 } }, evidence[1]] }), /content id/i);
assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: atoms, sourceEvidence: [{ ...evidence[0], handle: reidentifyHandle(evidence[0].handle, { owner: "project:other" }) }, evidence[1]] }), /canonical owner/i);
assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: atoms, sourceEvidence: [{ ...evidence[0], handle: reidentifyHandle(evidence[0].handle, { privacyClass: "public-metadata" }) }, evidence[1]] }), /privacy class/i);
assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: supported, inputAtoms: Array.from({ length: 65 }, (_, index) => atoms[index % atoms.length]), sourceEvidence: evidence }), /at most 64/i);
const { schemaVersion: _schemaVersion, id: _atomId, advisoryOnly: _advisoryOnly, canonicalRewriteAllowed: _canonicalRewriteAllowed, ...opaqueAtomInput } = atoms[0];
const opaqueAtom = buildMssrEvidenceAtom({ ...opaqueAtomInput, fingerprints: { ...opaqueAtomInput.fingerprints, payload: "opaque-payload-fingerprint" } });
const opaqueAtoms = [opaqueAtom, atoms[1]];
const opaqueEvidence = [{ ...evidence[0], atomId: opaqueAtom.id }, evidence[1]];
assert.throws(() => buildMssrSemanticSynthesisProposal({ judgment: judgmentFor("supports", opaqueAtoms), inputAtoms: opaqueAtoms, sourceEvidence: opaqueEvidence }), /payload fingerprint/i);

const { schemaVersion: _freshSchemaVersion, id: _freshAtomId, advisoryOnly: _freshAdvisoryOnly, canonicalRewriteAllowed: _freshRewriteAllowed, ...unknownFreshnessInput } = atoms[0];
const unknownFreshnessAtom = buildMssrEvidenceAtom({
  ...unknownFreshnessInput,
  source: { ...unknownFreshnessInput.source, freshness: "unknown", freshnessEvidence: undefined },
});
const unknownFreshnessAtoms = [unknownFreshnessAtom, atoms[1]];
const unknownFreshnessEvidence = [{ ...evidence[0], atomId: unknownFreshnessAtom.id }, evidence[1]];
const unknownFreshnessPreview = buildMssrSemanticSynthesisProposal({
  judgment: judgmentFor("supports", unknownFreshnessAtoms),
  inputAtoms: unknownFreshnessAtoms,
  sourceEvidence: unknownFreshnessEvidence,
});
assert.equal(unknownFreshnessPreview.disposition, "review");
assert.ok(unknownFreshnessPreview.groups.every((group) => group.disposition === "review"));
assert.ok(unknownFreshnessPreview.groups.every((group) => group.reasonCodes.includes("source-freshness-not-confirmed")));

console.log("semantic synthesis proposal tests passed");
