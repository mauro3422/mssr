import assert from "node:assert/strict";
import { buildMssrMarkdownDocumentSurface } from "../dist/document-surface.js";
import { projectMssrProjectContextLibrarianMetadata } from "../dist/project-context-librarian.js";
import { fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";
import { SKILL_NEEDS } from "../dist/skill-routing.js";

const sourcePath = ".mssr/knowledge/architecture/example.md";
const markdown = [
  "# Library",
  "",
  "## Architecture",
  "",
  "### Section metadata",
  "",
  "The section describes one exact architecture range.",
  "",
  "### Neighbor",
  "",
  "This adjacent section must not inherit the same tags.",
  "",
  "## Retrieval",
  "",
  "This section is outside the Project Context source selector.",
  "",
].join("\n");
const surface = buildMssrMarkdownDocumentSurface({ sourceRef: sourcePath, markdown });
const target = surface.headings.find((heading) => heading.title === "Section metadata");
const neighbor = surface.headings.find((heading) => heading.title === "Neighbor");
const retrieval = surface.headings.find((heading) => heading.title === "Retrieval");
assert.ok(target && neighbor && retrieval);

const projectContextManifest = {
  schemaVersion: 1,
  core: [],
  modules: [
    {
      id: "mssr-library-current",
      kind: "context",
      description: "Example module with broader routing selectors that must not be inherited.",
      source: { path: sourcePath, sections: ["## Architecture"] },
      domains: ["coding"],
      actions: ["review"],
      artifacts: ["repository"],
      needs: ["version-control"],
      signals: ["uncertainty"],
      required: false,
      priority: 1,
    },
  ],
};

const declaration = (heading, overrides = {}) => ({
  entryId: "mssr-library-current",
  sourcePath,
  headingPath: heading.headingPath,
  expectedFingerprint: heading.fingerprint,
  selectors: {
    domains: ["skill-system", "agent-orchestration"],
    actions: ["analyze"],
    artifacts: ["document"],
    needs: ["integrity-verification"],
    signals: ["reusable-pattern"],
  },
  ...overrides,
});

const projection = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
  projectKey: "demo",
});
assert.equal(projection.projected, 1);
assert.equal(projection.omitted, 0);
assert.equal(projection.advisoryOnly, true);
assert.equal(projection.truthAuthority, false);
assert.equal(projection.canonicalRewriteAllowed, false);
assert.equal(projection.records.length, 1);
assert.equal(projection.evidenceAtoms.length, 1);
assert.equal(projection.records[0].identity, `${sourcePath}#${target.id}`);
assert.equal(projection.records[0].payloadFingerprint, target.fingerprint);
assert.equal(projection.records[0].revision, surface.revision);
assert.deepEqual(projection.evidenceAtoms[0].source.headingPath, target.headingPath);
assert.deepEqual(projection.evidenceAtoms[0].source.range, {
  startLine: target.startLine,
  endLine: target.endLine,
  startOffset: target.startOffset,
  endOffset: target.endOffset,
});
assert.equal(projection.evidenceAtoms[0].source.freshness, "unknown", "the pure projector must not claim a host-observed fresh state");
assert.equal(projection.evidenceAtoms[0].attributes.domain, "agent-orchestration+skill-system");
assert.equal(projection.evidenceAtoms[0].attributes.action, "analyze");
assert.equal(JSON.stringify(projection.records).includes("The section describes one exact architecture range"), false, "catalog records never copy Markdown bodies");
assert.equal(JSON.stringify(projection.evidenceAtoms).includes("The section describes one exact architecture range"), false, "EvidenceAtoms never copy Markdown bodies");

const searchDoc = {
  owner: "project:demo",
  sourceRef: sourcePath,
  markdown,
  records: projection.records,
  evidenceAtoms: projection.evidenceAtoms,
  privacyClass: "project-metadata",
};
const domainSearch = searchMssrLibrarianEvidence({ documents: [searchDoc], query: { query: "agent-orchestration" } });
assert.equal(domainSearch.results.length, 1, "explicit multi-value sidecar metadata should make the exact section searchable");
assert.equal(domainSearch.results[0].handle.rangeId, target.id);
assert.deepEqual(domainSearch.results[0].metadataProjectionMatches?.[0]?.matches, [
  { field: "domain", value: "agent-orchestration", queryTerms: ["agent-orchestration"] },
]);
const exactFetch = fetchMssrLibrarianEvidence({
  handle: domainSearch.results[0].handle,
  owner: "project:demo",
  sourceRef: sourcePath,
  markdown,
  privacyClass: "project-metadata",
});
assert.equal(exactFetch.fingerprint, target.fingerprint);
assert.equal(exactFetch.text, markdown.slice(target.startOffset, target.endOffset));
for (const [query, field, value] of [
  ["skill-system", "domain", "skill-system"],
  ["analyze", "action", "analyze"],
  ["document", "artifact", "document"],
  ["integrity-verification", "need", "integrity-verification"],
  ["reusable-pattern", "signal", "reusable-pattern"],
]) {
  const result = searchMssrLibrarianEvidence({ documents: [searchDoc], query: { query } }).results[0];
  assert.equal(result?.handle.rangeId, target.id, `multi-value ${field} metadata must remain bound to the exact heading`);
  assert.ok(result.metadataProjectionMatches?.[0]?.matches.some((match) => match.field === field && match.value === value));
}
assert.equal(searchMssrLibrarianEvidence({ documents: [searchDoc], query: { query: "coding" } }).results.length, 0, "module-level selectors are never inherited by the heading");
assert.equal(searchMssrLibrarianEvidence({ documents: [searchDoc], query: { query: "agent-orchestration", metadata: { domain: "skill-system" } } }).results[0]?.handle.rangeId, target.id);
assert.equal(searchMssrLibrarianEvidence({ documents: [searchDoc], query: { query: "agent-orchestration", metadata: { domain: "coding" } } }).results.length, 0);

const omitted = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: {
    schemaVersion: 1,
    entries: [
      declaration(target, { expectedFingerprint: "0".repeat(64) }),
      declaration(retrieval),
      declaration(neighbor, { entryId: "missing-entry" }),
      declaration(target, { sourcePath: ".mssr/knowledge/other.md" }),
    ],
  },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
});
assert.equal(omitted.projected, 0);
assert.deepEqual(omitted.items.map((item) => item.issue), [
  "stale-fingerprint",
  "outside-manifest-section",
  "unknown-entry",
  "source-path-mismatch",
]);

const indirect = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  segmentsManifest: { schemaVersion: 1, modules: [{ moduleId: "mssr-library-current", segments: [
    { id: "baseline", sections: ["## Architecture"], baseline: true },
    { id: "optional", sections: ["## Retrieval"], baseline: false, terms: ["retrieval"] },
  ] }] },
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
});
assert.equal(indirect.items[0].issue, "indirect-source", "segmented modules do not gain an overlapping independent index");

const missingSource = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [],
  owner: "project:demo",
});
assert.equal(missingSource.items[0].issue, "source-not-provided");

const repeatedHeadingMarkdown = "# Library\n\n## Architecture\n\n### Shared\n\nFirst occurrence.\n\n## Architecture\n\n### Shared\n\nSecond occurrence.\n";
const repeatedHeadingSurface = buildMssrMarkdownDocumentSurface({ sourceRef: sourcePath, markdown: repeatedHeadingMarkdown });
const repeatedHeading = repeatedHeadingSurface.headings.find((heading) => heading.title === "Shared");
const ambiguousHeading = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: {
    schemaVersion: 1,
    entries: [declaration(repeatedHeading, { expectedFingerprint: repeatedHeading.fingerprint })],
  },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown: repeatedHeadingMarkdown }],
  owner: "project:demo",
});
assert.equal(ambiguousHeading.items[0].issue, "ambiguous-heading", "a repeated heading path must not bind by traversal order");

const duplicateSource = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }, { path: sourcePath, markdown }],
  owner: "project:demo",
});
assert.equal(duplicateSource.items[0].issue, "ambiguous-source-input");

const directiveManifest = {
  schemaVersion: 1,
  core: [],
  modules: [{
    id: "mssr-library-current", kind: "directive", description: "Conditional instructions.",
    source: { path: sourcePath }, required: false, priority: 1,
  }],
};
const directiveProjection = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest: directiveManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
});
assert.equal(directiveProjection.items[0].issue, "unsupported-directive");

assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target, { selectors: { domains: ["not-a-domain"] } })] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /not-a-domain/);
assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target, { sourcePath: "../outside.md" })] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /project-relative Markdown path/);
assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target, { sourcePath: ".mssr/project-context.json" })] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /Markdown path/);
const longestNeeds = [...SKILL_NEEDS].sort((left, right) => right.length - left.length).slice(0, 12);
assert.ok(longestNeeds.join("+").length > 120, "fixture reaches the EvidenceAtom attribute encoding boundary");
assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target, { selectors: { needs: longestNeeds } })] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /120-character EvidenceAtom attribute limit/);
assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target), declaration(target)] },
  segmentsManifest: null,
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /may be declared only once/);
assert.throws(() => projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest: { schemaVersion: 1, entries: [declaration(target)] },
  referencesManifest: null,
  sourceFiles: [{ path: sourcePath, markdown }],
  owner: "project:demo",
}), /requires observed segment\/reference sidecar inputs/);

console.log("project-context Librarian selector tests passed");
