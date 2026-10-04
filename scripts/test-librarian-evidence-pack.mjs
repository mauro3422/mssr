import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import {
  MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS,
  buildMssrLibrarianEvidencePack,
  mssrLibrarianEvidencePackInputSchema,
} from "../dist/librarian-evidence-pack.js";
import { mssrLibrarianEvidenceHandleId, searchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";

const owner = "project:evidence-pack-fixture";
const sources = [
  { sourceRef: "docs/architecture.md", markdown: "# Architecture\n\n## Jev boundary\n\nJev returns a typed choice; the host verifies current source evidence.\n" },
  { sourceRef: "docs/operations.md", markdown: "# Operations\n\n## Read-only composition\n\nThe evidence pack preserves exact ranges and source citations.\n" },
];
const documents = sources.map((source) => ({ ...source, owner, privacyClass: "project-metadata" }));
const found = searchMssrLibrarianEvidence({ documents, query: { query: "source evidence exact ranges", maxResults: 10 } });
const handles = sources.map((source) => {
  const surface = buildMssrMarkdownDocumentSurface(source);
  const target = surface.headings.find((heading) => heading.title === (source.sourceRef.includes("architecture") ? "Jev boundary" : "Read-only composition"));
  assert.ok(target);
  const match = found.results.find((item) => item.handle.sourceRef === source.sourceRef && item.handle.rangeId === target.id);
  assert.ok(match, `search returns the exact range in ${source.sourceRef}`);
  return match.handle;
});
function reidentifyHandle(handle, changes) {
  const fields = { ...handle, ...changes };
  delete fields.id;
  return { ...fields, id: mssrLibrarianEvidenceHandleId(fields) };
}

const packed = buildMssrLibrarianEvidencePack({ documents, handles });
assert.equal(packed.schemaVersion, 1);
assert.equal(packed.kind, "mssr-librarian-evidence-pack");
assert.equal(packed.assembly, "verbatim-source-ranges");
assert.equal(packed.paragraphs.length, 2);
assert.equal(packed.paragraphs[0].exactText, "## Jev boundary\n\nJev returns a typed choice; the host verifies current source evidence.\n");
assert.equal(packed.paragraphs[1].exactText, "## Read-only composition\n\nThe evidence pack preserves exact ranges and source citations.\n");
assert.deepEqual(packed.paragraphs.map((item) => item.ordinal), [1, 2]);
assert.equal(packed.paragraphs[0].citation.display, "docs/architecture.md:L3-L5");
assert.equal(packed.paragraphs[0].citation.owner, owner);
assert.equal(packed.paragraphs[0].citation.sourceRef, "docs/architecture.md");
assert.equal(packed.paragraphs[0].citation.revision, handles[0].revision);
assert.equal(packed.paragraphs[0].citation.rangeId, handles[0].rangeId);
assert.equal(packed.paragraphs[0].citation.fingerprint, handles[0].fingerprint);
assert.equal(packed.totalFetchedChars, packed.paragraphs.reduce((sum, item) => sum + item.exactText.length, 0));
assert.equal(packed.advisoryOnly, true);
assert.equal(packed.truthAuthority, false);
assert.equal(packed.canonicalRewriteAllowed, false);
assert.equal(packed.ownerAndPrivacyAreCallerAsserted, true);

assert.throws(() => buildMssrLibrarianEvidencePack({
  documents: documents.map((document, index) => index === 0 ? { ...document, markdown: `${document.markdown}\nchanged\n` } : document),
  handles,
}), /stale/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents: [{ ...documents[0], privacyClass: "sensitive-excluded" }, documents[1]], handles }), /privacy/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents: [{ ...documents[0], privacyClass: "public-metadata" }, documents[1]], handles }), /classification mismatch/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents: [documents[0]], handles }), /bind to one supplied/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents: [{ ...documents[0], owner: "project:other" }, documents[1]], handles }), /bind to one supplied/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents: [...documents, { ...documents[0], sourceRef: "docs/unused.md" }], handles }), /referenced/);
assert.throws(() => buildMssrLibrarianEvidencePack({ documents, handles: [{ ...handles[0], id: "f".repeat(64) }, handles[1]] }), /handle id mismatch/i, "a forged handle id fails before any evidence is returned");
assert.throws(() => buildMssrLibrarianEvidencePack({ documents, handles: [reidentifyHandle(handles[0], { startOffset: handles[0].startOffset + 1 }), handles[1]] }), /range or fingerprint mismatch/i, "tampered offsets fail even when the handle id is recomputed");
assert.throws(() => buildMssrLibrarianEvidencePack({ documents, handles: [reidentifyHandle(handles[0], { fingerprint: "0".repeat(64) }), handles[1]] }), /range or fingerprint mismatch/i, "tampered fingerprints fail even when the handle id is recomputed");
assert.throws(() => buildMssrLibrarianEvidencePack({ documents, handles: [reidentifyHandle(handles[0], { revision: "0".repeat(64) }), handles[1]] }), /stale/i, "tampered revisions fail against the current Markdown snapshot");
assert.equal(mssrLibrarianEvidencePackInputSchema.safeParse({ documents, handles: [handles[0], handles[0]] }).success, false, "duplicate handles are rejected before producing repeated citations");
assert.equal(mssrLibrarianEvidencePackInputSchema.safeParse({
  documents: [...documents, { ...documents[0], sourceRef: "docs\\architecture.md" }],
  handles,
}).success, false, "normalized duplicate source identities are rejected");
assert.equal(mssrLibrarianEvidencePackInputSchema.safeParse({
  documents,
  handles: Array(MSSR_LIBRARIAN_EVIDENCE_PACK_LIMITS.maxHandles + 1).fill(handles[0]),
}).success, false, "handle count is bounded before exact fetch");

const oversizedSources = Array.from({ length: 5 }, (_, index) => ({
  owner,
  sourceRef: `docs/large-${index}.md`,
  markdown: `# Large ${index}\n\n## Match ${index}\n\nthreshold marker ${"x".repeat(16_000)}\n`,
  privacyClass: "project-metadata",
}));
const oversizedSearch = searchMssrLibrarianEvidence({ documents: oversizedSources, query: { query: "threshold marker", maxResults: 20 } });
const oversizedHandles = oversizedSources.map((source) => oversizedSearch.results.find((item) => item.handle.sourceRef === source.sourceRef && item.handle.rangeKind === "section")?.handle);
assert.equal(oversizedHandles.filter(Boolean).length, 5);
assert.equal(mssrLibrarianEvidencePackInputSchema.safeParse({ documents: oversizedSources, handles: oversizedHandles }).success, false, "aggregate exact output is bounded before fetch");

console.log("Librarian evidence pack tests passed");
