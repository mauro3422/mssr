import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import { catalogMssrLibrarianRecord } from "../dist/librarian-contract.js";
import {
  fetchMssrLibrarianEvidence,
  searchMssrLibrarianEvidence,
} from "../dist/librarian-retrieval.js";

const markdown = [
  "# Handbook",
  "",
  "## Routing",
  "",
  "MSSR routing selects declared capabilities and preserves canonical ownership.",
  "",
  "## Storage",
  "",
  "Storage keeps bounded evidence metadata and exact source revisions.",
  "",
].join("\n");
const sourceRef = "docs/handbook.md";
const owner = "project:demo";
const surface = buildMssrMarkdownDocumentSurface({ sourceRef, markdown });
const routing = surface.headings.find((item) => item.title === "Routing");
const record = catalogMssrLibrarianRecord({
  namespace: "document", kind: "section", identity: `${sourceRef}#${routing.id}`, sourceRef,
  revision: surface.revision, payloadFingerprint: routing.fingerprint,
  metadata: { area: "routing", headingPath: routing.headingPath, level: routing.level },
  provenance: { producer: "document-surface" },
});
const doc = { owner, sourceRef, markdown, surface, records: [record], searchableMetadata: { area: "routing" }, privacyClass: "project-metadata" };

const found = searchMssrLibrarianEvidence({ documents: [doc], query: { query: "routing declared capabilities", maxResults: 10 } });
assert.equal(found.advisoryOnly, true);
assert.ok(found.results.some((item) => item.handle.rangeId === routing.id));
assert.ok(found.results.every((item) => item.snippet.length <= 160 && !("text" in item.handle)));

const filtered = searchMssrLibrarianEvidence({ documents: [doc], query: { query: "routing", namespace: "document", kind: "section", metadata: { area: "routing" } } });
assert.ok(filtered.results.some((item) => item.handle.rangeId === routing.id));
assert.equal("records" in filtered.results[0].metadata, false, "catalog metadata is not copied into the retrieval result");
assert.equal(searchMssrLibrarianEvidence({ documents: [doc], query: { query: "routing", namespace: "unknown" } }).results.length, 0);

const capped = searchMssrLibrarianEvidence({ documents: [doc], query: { query: "routing storage evidence", maxResults: 1 } });
assert.equal(capped.results.length, 1);
assert.equal(capped.truncated, true);
assert.throws(() => searchMssrLibrarianEvidence({ documents: Array(33).fill(doc), query: { query: "routing" } }), /at most 32/);
assert.throws(() => searchMssrLibrarianEvidence({ documents: [doc], query: { query: "x".repeat(501) } }), /500/);

const result = found.results.find((item) => item.handle.rangeId === routing.id);
assert.ok(result);
const fetched = fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef, markdown, privacyClass: "project-metadata" });
assert.equal(fetched.text, "## Routing\n\nMSSR routing selects declared capabilities and preserves canonical ownership.\n\n");
assert.equal(fetched.fingerprint, routing.fingerprint);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef, markdown: `${markdown}\nchanged`, privacyClass: "project-metadata" }), /stale/);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: result.handle, owner: "project:other", sourceRef, markdown, privacyClass: "project-metadata" }), /identity mismatch/);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef, markdown, privacyClass: "sensitive-excluded" }), /privacy/);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: result.handle, owner, sourceRef, markdown, privacyClass: "public-metadata" }), /classification mismatch/);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: { ...result.handle, startLine: result.handle.startLine + 1 }, owner, sourceRef, markdown, privacyClass: "project-metadata" }), /id mismatch/);
assert.throws(() => fetchMssrLibrarianEvidence({ handle: { ...result.handle, id: "0".repeat(64) }, owner, sourceRef, markdown, privacyClass: "project-metadata" }), /id mismatch/);

const longBody = `# Long\n\n## Full Text\n\n${"routine words ".repeat(80)}😀 café retrievalNeedle appears only near the end of the exact body.`;
const longDoc = { owner, sourceRef: "docs/long.md", markdown: longBody, privacyClass: "project-metadata" };
const longResult = searchMssrLibrarianEvidence({ documents: [longDoc], query: { query: "retrievalNeedle", maxSnippetChars: 80 } }).results[0];
assert.ok(longResult, "search must match body terms beyond the capped Document Surface term list");
assert.ok(longResult.snippet.includes("retrievalNeedle"), "snippet must be cut from the matching body span");
assert.ok(longResult.snippet.includes("😀"), "Unicode characters before a match must remain intact in snippets");
assert.ok(Array.from(longResult.snippet).length <= 80, "snippet cap includes any ellipsis markers");

const sensitiveDoc = { ...doc, privacyClass: "sensitive-excluded" };
assert.equal(searchMssrLibrarianEvidence({ documents: [sensitiveDoc], query: { query: "routing" } }).results.length, 0);
assert.equal(found.results[0].ownerAndPrivacyAreCallerAsserted, true, "search results expose that owner/privacy labels are host assertions, not authorization");
assert.equal(found.results[0].catalogProvenanceIsCallerAsserted, true, "catalog namespace/kind filters are caller assertions, not authenticated producer facts");
assert.throws(() => searchMssrLibrarianEvidence({ documents: [{ ...doc, searchableMetadata: { note: "private summary" } }], query: { query: "routing" } }), /sensitive content/i);
assert.throws(() => searchMssrLibrarianEvidence({ documents: [{ ...doc, markdown: "line\n".repeat(50_001) }], query: { query: "line" } }), /lines/i);

const spanishLanguageDoc = {
  owner,
  sourceRef: "docs/spanish-language.md",
  markdown: "# Año y señal\n\n## Señal del año\n\nLa señal conserva el año y el café.\n",
  privacyClass: "project-metadata",
};
const spanishMatches = searchMssrLibrarianEvidence({ documents: [spanishLanguageDoc], query: { query: "señal año cafe" } });
assert.ok(spanishMatches.results.some((item) => item.title === "Señal del año"), "Spanish ñ, accented vowels, and ASCII query variants are tokenized consistently");
assert.equal(searchMssrLibrarianEvidence({ documents: [spanishLanguageDoc], query: { query: "ano" } }).results.length, 0, "ñ must remain distinct from n so año cannot falsely match ano");

const decomposedSpanishDoc = {
  owner,
  sourceRef: "docs/decomposed-spanish.md",
  markdown: `# Información\n\n## Año fiscal\n\n${"Contexto general sin el término buscado. ".repeat(18)}La verificación del an\u0303o fiscal requiere contrastar la evidencia original.`,
  privacyClass: "project-metadata",
};
const decomposedSpanishMatch = searchMssrLibrarianEvidence({ documents: [decomposedSpanishDoc], query: { query: "verificación del año fiscal", maxSnippetChars: 100 } }).results.find((item) => item.handle.rangeKind === "block");
assert.ok(decomposedSpanishMatch, "composed query ñ should match an n plus combining tilde in source text");
assert.ok(decomposedSpanishMatch.snippet.includes("an\u0303o fiscal"), "the source-offset map should center snippets on a decomposed ñ without rewriting source text");

console.log("librarian retrieval tests passed");
