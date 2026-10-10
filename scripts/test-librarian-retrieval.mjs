import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import { evidenceAtomFromLibrarianCatalogRecord } from "../dist/evidence-atom.js";
import { catalogMssrLibrarianRecord } from "../dist/librarian-contract.js";
import {
  MSSR_LIBRARIAN_RETRIEVAL_LIMITS,
  fetchMssrLibrarianEvidence,
  mssrLibrarianEvidenceHandleId,
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

const routingAtom = evidenceAtomFromLibrarianCatalogRecord({
  record,
  sourceClass: "observed",
  canonicalOwner: owner,
  authorityClass: "observed",
  privacyClass: "project-metadata",
  headingPath: routing.headingPath,
  range: {
    startLine: routing.startLine,
    endLine: routing.endLine,
    startOffset: routing.startOffset,
    endOffset: routing.endOffset,
  },
  attributes: { domain: "skill-system", signal: "reusable-pattern", description: "not-searchable-as-free-form-metadata" },
});
const atomDoc = { ...doc, searchableMetadata: undefined, evidenceAtoms: [routingAtom] };
const metadataOnly = searchMssrLibrarianEvidence({ documents: [atomDoc], query: { query: "skill-system" } });
assert.equal(metadataOnly.results.length, 1, "typed metadata can make the exact atom-backed section discoverable even when the source body omits the query");
assert.equal(metadataOnly.results[0].handle.rangeId, routing.id, "metadata from one atom must not bleed into adjacent ranges");
assert.deepEqual(metadataOnly.results[0].metadataProjectionMatches?.[0]?.matches, [
  { field: "domain", value: "skill-system", queryTerms: ["skill-system"] },
]);
assert.match(metadataOnly.results[0].metadataProjectionMatches?.[0]?.projectionFingerprint ?? "", /^[0-9a-f]{64}$/);
assert.equal(metadataOnly.results[0].metadataProjectionMatches?.[0]?.provenanceIsCallerAsserted, true, "typed metadata fields remain caller-asserted even when their structure is validated");
assert.equal("evidenceAtoms" in metadataOnly.results[0].metadata, false, "full atoms are never copied into retrieval metadata");
const metadataFiltered = searchMssrLibrarianEvidence({
  documents: [atomDoc],
  query: { query: "routing", metadata: { domain: "skill-system" } },
});
assert.ok(metadataFiltered.results.some((item) => item.handle.rangeId === routing.id), "metadata filters can inspect the same exact typed atom projection as text search");
assert.equal(searchMssrLibrarianEvidence({
  documents: [atomDoc],
  query: { query: "routing", metadata: { domain: "filesystem" } },
}).results.length, 0, "metadata filters reject ranges without an exact matching projected value");
const staleRoutingAtom = { ...routingAtom, source: { ...routingAtom.source, freshness: "stale" } };
const staleSearch = searchMssrLibrarianEvidence({
  documents: [{ ...atomDoc, evidenceAtoms: [staleRoutingAtom] }],
  query: { query: "stale" },
});
assert.equal(staleSearch.results[0]?.handle.rangeId, routing.id, "stale EvidenceAtom freshness remains discoverable for explicit review");
assert.ok(staleSearch.results[0]?.metadataProjectionMatches?.[0]?.matches.some((match) => match.field === "freshness" && match.value === "stale"));
const staleFiltered = searchMssrLibrarianEvidence({
  documents: [{ ...atomDoc, evidenceAtoms: [staleRoutingAtom] }],
  query: { query: "routing", metadata: { freshness: "stale" } },
});
assert.equal(staleFiltered.results[0]?.handle.rangeId, routing.id, "an exact freshness filter can find stale ranges");
assert.deepEqual(staleFiltered.results[0]?.metadataProjectionMatches?.[0]?.filterMatches, [
  { field: "freshness", value: "stale" },
], "results identify the caller-asserted freshness field that satisfied metadata filtering");
const signalOnly = searchMssrLibrarianEvidence({ documents: [atomDoc], query: { query: "reusable-pattern" } });
assert.equal(signalOnly.results[0]?.metadataProjectionMatches?.[0]?.matches[0]?.field, "signal");
const changedProjectionAtom = evidenceAtomFromLibrarianCatalogRecord({
  record,
  sourceClass: "observed",
  canonicalOwner: owner,
  authorityClass: "observed",
  privacyClass: "project-metadata",
  headingPath: routing.headingPath,
  range: { startLine: routing.startLine, endLine: routing.endLine, startOffset: routing.startOffset, endOffset: routing.endOffset },
  attributes: { domain: "coding", signal: "reusable-pattern" },
});
assert.equal(changedProjectionAtom.id, routingAtom.id, "EvidenceAtom identity remains stable when non-identity attributes change");
const changedProjection = searchMssrLibrarianEvidence({ documents: [{ ...atomDoc, evidenceAtoms: [changedProjectionAtom] }], query: { query: "coding" } });
assert.notEqual(changedProjection.results[0]?.metadataProjectionMatches?.[0]?.projectionFingerprint, metadataOnly.results[0]?.metadataProjectionMatches?.[0]?.projectionFingerprint, "the search projection fingerprint changes independently from the atom id");

const bodyOnlyWithoutAtoms = searchMssrLibrarianEvidence({ documents: [{ ...doc, searchableMetadata: undefined }], query: { query: "routing declared capabilities" } }).results;
const bodyOnlyWithAtoms = searchMssrLibrarianEvidence({ documents: [{ ...doc, searchableMetadata: undefined, evidenceAtoms: [routingAtom] }], query: { query: "routing declared capabilities" } }).results;
assert.deepEqual(
  bodyOnlyWithAtoms.map(({ handle, score, title, snippet }) => ({ handle, score, title, snippet })),
  bodyOnlyWithoutAtoms.map(({ handle, score, title, snippet }) => ({ handle, score, title, snippet })),
  "absence of a matching projection must preserve existing retrieval behavior",
);

const mismatchedAtoms = [
  { ...routingAtom, provenance: { ...routingAtom.provenance, canonicalOwner: "project:other" } },
  { ...routingAtom, source: { ...routingAtom.source, ref: "docs/other.md" } },
  { ...routingAtom, source: { ...routingAtom.source, revision: "0".repeat(64) } },
  { ...routingAtom, subject: { ...routingAtom.subject, identity: `${sourceRef}#${surface.headings.find((item) => item.title === "Storage").id}` } },
  { ...routingAtom, subject: { ...routingAtom.subject, kind: "document" } },
  { ...routingAtom, fingerprints: { ...routingAtom.fingerprints, record: "0".repeat(64) } },
  { ...routingAtom, fingerprints: { ...routingAtom.fingerprints, payload: "0".repeat(64) } },
  { ...routingAtom, provenance: { ...routingAtom.provenance, producer: "other-producer" } },
  { ...routingAtom, source: { ...routingAtom.source, range: { ...routingAtom.source.range, startOffset: routingAtom.source.range.startOffset + 1 } } },
  { ...routingAtom, source: { ...routingAtom.source, range: undefined } },
  { ...routingAtom, privacyClass: "operational-metadata" },
];
for (const mismatchedAtom of mismatchedAtoms) {
  const result = searchMssrLibrarianEvidence({ documents: [{ ...atomDoc, evidenceAtoms: [mismatchedAtom] }], query: { query: "skill-system" } });
  assert.equal(result.results.length, 0, "atom projections with any owner/ref/revision/identity/kind/payload/range/privacy mismatch must not match");
}

const invalidDomainAtom = { ...routingAtom, attributes: { ...routingAtom.attributes, domain: "not-a-domain" } };
assert.equal(searchMssrLibrarianEvidence({ documents: [{ ...atomDoc, evidenceAtoms: [invalidDomainAtom] }], query: { query: "not-a-domain" } }).results.length, 0, "attribute keys outside the allowlist and values outside the closed vocabulary do not become search text");

const surfaceOnlyRecord = catalogMssrLibrarianRecord({
  namespace: "document", kind: "surface", identity: `${sourceRef}#surface`, sourceRef,
  revision: surface.revision, payloadFingerprint: surface.revision,
  metadata: { area: "whole-document" }, provenance: { producer: "document-surface" },
});
assert.equal(searchMssrLibrarianEvidence({ documents: [{ ...doc, records: [surfaceOnlyRecord], searchableMetadata: undefined }], query: { query: "routing", namespace: "document" } }).results.length, 0, "a surface record does not become an implicit record for every range");

const genericMetadataRecord = catalogMssrLibrarianRecord({
  namespace: "document", kind: "section", identity: `${sourceRef}#${routing.id}`, sourceRef,
  revision: surface.revision, payloadFingerprint: routing.fingerprint,
  metadata: { internalTopic: "phantommetadata" }, provenance: { producer: "document-surface" },
});
assert.equal(searchMssrLibrarianEvidence({ documents: [{ ...doc, records: [genericMetadataRecord], searchableMetadata: undefined }], query: { query: "phantommetadata" } }).results.length, 0, "generic catalog metadata is not searchable by itself");

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
assert.equal(searchMssrLibrarianEvidence({
  documents: [{ ...spanishLanguageDoc, markdown: "# Calibration\n\n## Notes\n\nAn earlier live test was exploratory and uncalibrated.\n" }],
  query: { query: "How many planets fit inside an underwater house?" },
}).results.length, 0, "an incidental English article must not make an unrelated natural-language query return a candidate");
assert.equal(searchMssrLibrarianEvidence({
  documents: [spanishLanguageDoc],
  query: { query: "¿Qué hay de la casa bajo el agua?" },
}).results.length, 0, "incidental Spanish function words must not make an unrelated natural-language query return a candidate");
assert.equal(searchMssrLibrarianEvidence({
  documents: [spanishLanguageDoc],
  query: { query: "the and as for from to" },
}).results.length, 0, "a query made only of English function words has no searchable content terms");

const spanishLibrarianDoc = {
  owner,
  sourceRef: "docs/bibliotecario.md",
  markdown: "# Bibliotecario\n\n## Evidencia y referencias\n\nEl bibliotecario organiza evidencia y referencias exactas para cada documento.\n",
  privacyClass: "project-metadata",
};
const spanishVariantResult = searchMssrLibrarianEvidence({
  documents: [spanishLibrarianDoc],
  query: { query: "evidence librarian", queryVariants: ["bibliotecario evidencia"] },
}).results.find((item) => item.title === "Evidencia y referencias");
assert.ok(spanishVariantResult, "an explicit host-supplied Spanish query variant can find exact Spanish ranges");
assert.equal(spanishVariantResult.scoreQueryIndex, 1, "the result identifies the variant that supplies its lexical score");
assert.deepEqual(spanishVariantResult.queryMatches, [
  { queryIndex: 1, score: 1, matchedTerms: ["bibliotecario", "evidencia"] },
]);
assert.equal(spanishVariantResult.handle.id, mssrLibrarianEvidenceHandleId({
  version: 1,
  owner,
  sourceRef: spanishLibrarianDoc.sourceRef,
  revision: spanishVariantResult.handle.revision,
  rangeId: spanishVariantResult.handle.rangeId,
  rangeKind: spanishVariantResult.handle.rangeKind,
  startLine: spanishVariantResult.handle.startLine,
  endLine: spanishVariantResult.handle.endLine,
  startOffset: spanishVariantResult.handle.startOffset,
  endOffset: spanishVariantResult.handle.endOffset,
  fingerprint: spanishVariantResult.handle.fingerprint,
  privacyClass: "project-metadata",
}), "query variants do not change exact source handle identity");
assert.equal(fetchMssrLibrarianEvidence({
  handle: spanishVariantResult.handle,
  owner,
  sourceRef: spanishLibrarianDoc.sourceRef,
  markdown: spanishLibrarianDoc.markdown,
  privacyClass: "project-metadata",
}).text, "## Evidencia y referencias\n\nEl bibliotecario organiza evidencia y referencias exactas para cada documento.\n");

const duplicateSpanishDocs = [spanishLibrarianDoc, { ...spanishLibrarianDoc }];
const duplicateWithoutVariants = searchMssrLibrarianEvidence({
  documents: duplicateSpanishDocs,
  query: { query: "bibliotecario evidencia", maxResults: 20 },
}).results;
assert.equal(duplicateWithoutVariants.filter((item) => item.handle.id === spanishVariantResult.handle.id).length, 2, "omitting variants preserves legacy duplicate-document results");
const duplicateWithVariants = searchMssrLibrarianEvidence({
  documents: duplicateSpanishDocs,
  query: { query: "evidence librarian", queryVariants: ["bibliotecario evidencia"], maxResults: 20 },
}).results;
const coalescedDuplicate = duplicateWithVariants.find((item) => item.handle.id === spanishVariantResult.handle.id);
assert.equal(duplicateWithVariants.filter((item) => item.handle.id === spanishVariantResult.handle.id).length, 1, "variant mode coalesces repeated exact handles");
assert.deepEqual(coalescedDuplicate?.queryMatches?.map((match) => match.queryIndex), [1], "coalescing repeated documents does not duplicate query lineage");

const primaryRanked = searchMssrLibrarianEvidence({
  documents: [
    { owner, sourceRef: "docs/primary.md", markdown: "# Primary\n\n## Routing\n\nOnly routing appears here.\n", privacyClass: "project-metadata" },
    { owner, sourceRef: "docs/variant.md", markdown: "# Variant\n\n## Signal\n\nOnly signal appears here.\n", privacyClass: "project-metadata" },
    { owner, sourceRef: "docs/both.md", markdown: "# Both\n\n## Routing and signal\n\nRouting and signal appear here.\n", privacyClass: "project-metadata" },
  ],
  query: { query: "routing architecture and declared decision policy", queryVariants: ["signal"] },
}).results;
assert.ok(primaryRanked.slice(0, 2).every((item) => item.scoreQueryIndex === 0), "all primary-query matches rank ahead of a short variant with a higher lexical ratio");
assert.equal(primaryRanked.find((item) => item.scoreQueryIndex === 1)?.handle.sourceRef, "docs/variant.md", "variant-only matches follow the primary-query result group");
const bothCandidate = primaryRanked.find((item) => item.handle.sourceRef === "docs/both.md");
assert.deepEqual(bothCandidate?.queryMatches?.map((match) => match.queryIndex), [0, 1], "one exact handle deduplicates across queries while preserving match lineage");

const projectionVariant = searchMssrLibrarianEvidence({
  documents: [atomDoc],
  query: { query: "unrelated terminology", queryVariants: ["skill-system"] },
}).results[0];
assert.equal(projectionVariant?.metadataProjectionMatches?.[0]?.matches[0]?.queryIndex, 1, "metadata projection matches retain the query-variant index");
assert.equal(searchMssrLibrarianEvidence({
  documents: [atomDoc],
  query: { query: "unrelated terminology", queryVariants: ["skill-system"], metadata: { domain: "filesystem" } },
}).results.length, 0, "query variants do not relax exact structured metadata filters");

assert.throws(() => searchMssrLibrarianEvidence({ documents: [spanishLibrarianDoc], query: { query: "evidence librarian", queryVariants: ["the and for"] } }), /searchable terms/i);
assert.throws(() => searchMssrLibrarianEvidence({ documents: [spanishLibrarianDoc], query: { query: "evidence librarian", queryVariants: ["evidence the librarian"] } }), /distinct after normalization/i);
assert.throws(() => searchMssrLibrarianEvidence({ documents: [spanishLibrarianDoc], query: { query: "evidence librarian", queryVariants: Array(5).fill("bibliotecario evidencia") } }), /at most 4/);
assert.throws(() => searchMssrLibrarianEvidence({ documents: [spanishLibrarianDoc], query: { query: "evidence librarian", queryVariants: ["b".repeat(501)] } }), /500/);

const decomposedSpanishDoc = {
  owner,
  sourceRef: "docs/decomposed-spanish.md",
  markdown: `# Información\n\n## Año fiscal\n\n${"Contexto general sin el término buscado. ".repeat(18)}La verificación del an\u0303o fiscal requiere contrastar la evidencia original.`,
  privacyClass: "project-metadata",
};
const decomposedSpanishMatch = searchMssrLibrarianEvidence({ documents: [decomposedSpanishDoc], query: { query: "verificación del año fiscal", maxSnippetChars: 100 } }).results.find((item) => item.handle.rangeKind === "block");
assert.ok(decomposedSpanishMatch, "composed query ñ should match an n plus combining tilde in source text");
assert.ok(decomposedSpanishMatch.snippet.includes("an\u0303o fiscal"), "the source-offset map should center snippets on a decomposed ñ without rewriting source text");

const fetchLimit = MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars;
const oversizedParentWithFetchableMatch = {
  owner,
  sourceRef: "docs/oversized-parent-with-match.md",
  markdown: `# Large index\n\n${"evidence filler ".repeat(Math.ceil((fetchLimit + 100) / 16))}\n\n## Owner calibration\n\nOwner labels, holdout evidence remain blank.\n`,
  privacyClass: "project-metadata",
};
const actionableMatches = searchMssrLibrarianEvidence({
  documents: [oversizedParentWithFetchableMatch],
  query: { query: "owner labels holdout evidence", maxResults: 10 },
}).results;
assert.equal(actionableMatches[0]?.title, "Owner calibration", "a fetchable exact section wins a lexical score tie with an oversized un-fetchable parent range");
assert.equal(actionableMatches[0]?.exactFetchable, true);

const tiedDocuments = ["a", "b", "c"].map((name) => ({
  owner,
  sourceRef: `docs/tied-${name}.md`,
  markdown: `# Evidence ${name}\n\n## Relevant ${name}\n\nNeedle evidence appears in document ${name}.\n\n## More ${name}\n\nNeedle evidence appears again in document ${name}.\n`,
  privacyClass: "project-metadata",
}));
const diversifiedTie = searchMssrLibrarianEvidence({
  documents: tiedDocuments,
  query: { query: "needle evidence", maxResults: 4 },
}).results;
assert.deepEqual(
  diversifiedTie.slice(0, 3).map((item) => item.handle.sourceRef),
  tiedDocuments.map((item) => item.sourceRef),
  "equal-score, equally fetchable ranges surface one candidate per source before a second range from the same source",
);
assert.equal(
  diversifiedTie[3]?.handle.sourceRef,
  tiedDocuments[0]?.sourceRef,
  "after each tied source contributes once, subsequent ranges retain their within-source order",
);

const exactBoundaryDocument = {
  owner,
  sourceRef: "docs/exact-fetch-boundary.md",
  markdown: `# Boundary\n\n${"x".repeat(fetchLimit - "# Boundary\n\n".length)}`,
  privacyClass: "project-metadata",
};
const exactBoundaryResult = searchMssrLibrarianEvidence({ documents: [exactBoundaryDocument], query: { query: "boundary" } }).results.find((item) => item.handle.rangeKind === "section");
assert.ok(exactBoundaryResult, "the exact fetch boundary document should be searchable");
assert.equal(exactBoundaryResult.rangeCodeUnits, fetchLimit);
assert.equal(exactBoundaryResult.exactFetchable, true, "an exact range at the fetch cap remains fetchable");
const exactBoundaryFetch = fetchMssrLibrarianEvidence({
  handle: exactBoundaryResult.handle,
  owner,
  sourceRef: exactBoundaryDocument.sourceRef,
  markdown: exactBoundaryDocument.markdown,
  privacyClass: "project-metadata",
});
assert.equal(exactBoundaryFetch.text.length, fetchLimit, "fetch returns the entire exact boundary range");

const overBoundaryDocument = {
  ...exactBoundaryDocument,
  sourceRef: "docs/exact-fetch-over-boundary.md",
  markdown: `${exactBoundaryDocument.markdown}y`,
};
const overBoundaryResult = searchMssrLibrarianEvidence({ documents: [overBoundaryDocument], query: { query: "boundary" } }).results.find((item) => item.handle.rangeKind === "section");
assert.ok(overBoundaryResult, "the over-boundary exact range should remain discoverable as a search candidate");
assert.equal(overBoundaryResult.rangeCodeUnits, fetchLimit + 1);
assert.equal(overBoundaryResult.exactFetchable, false, "search explicitly marks an oversized exact range as un-fetchable");
assert.throws(() => fetchMssrLibrarianEvidence({
  handle: overBoundaryResult.handle,
  owner,
  sourceRef: overBoundaryDocument.sourceRef,
  markdown: overBoundaryDocument.markdown,
  privacyClass: "project-metadata",
}), /Exact evidence range exceeds fetch size limit/);

const unicodeBoundaryDocument = {
  owner,
  sourceRef: "docs/unicode-fetch-boundary.md",
  markdown: `# Unicode\n\n${"😀".repeat(Math.floor((fetchLimit - "# Unicode\n\n".length) / 2))}${"x".repeat((fetchLimit - "# Unicode\n\n".length) % 2)}`,
  privacyClass: "project-metadata",
};
const unicodeBoundaryResult = searchMssrLibrarianEvidence({ documents: [unicodeBoundaryDocument], query: { query: "unicode" } }).results.find((item) => item.handle.rangeKind === "section");
assert.ok(unicodeBoundaryResult);
assert.equal(unicodeBoundaryResult.rangeCodeUnits, fetchLimit, "the limit and offsets are consistently measured in JavaScript UTF-16 code units for astral Unicode text");
assert.equal(unicodeBoundaryResult.exactFetchable, true);

console.log("librarian retrieval tests passed");
