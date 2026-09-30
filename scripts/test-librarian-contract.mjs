import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  buildMssrMarkdownDocumentSurface,
  canonicalizeMssrLibrarianMetadata,
  catalogMssrLibrarianRecord,
  librarianRecordsFromDocumentSurface,
} from "../dist/index.js";

assert.equal(
  canonicalizeMssrLibrarianMetadata({ b: 2, a: { z: true, y: [2, 1] } }),
  canonicalizeMssrLibrarianMetadata({ a: { y: [2, 1], z: true }, b: 2 }),
  "object key order must not change metadata identity",
);

const base = {
  namespace: "trace",
  kind: "outcome",
  identity: "trace-1",
  sourceRef: ".mssr/traces/trace-1.json",
  revision: "r1",
  payloadFingerprint: "payload-a",
  metadata: { status: "success", score: 1 },
  provenance: { producer: "trace-store", host: "bridge" },
};

const catalogued = catalogMssrLibrarianRecord(base);
assert.equal(catalogued.contractKey, "trace:outcome:trace-1");
assert.equal(catalogued.normalizedSourceRef, ".mssr/traces/trace-1.json");
assert.ok(catalogued.metadataFingerprint?.length === 64);
assert.equal(catalogued.recordFingerprint.length, 64);

const audit = auditMssrLibrarianCatalog([
  base,
  { ...base },
  {
    ...base,
    identity: "trace-2",
    sourceRef: ".mssr\\traces\\trace-1.json",
  },
  {
    ...base,
    namespace: "notice",
    kind: "outcome-copy",
    identity: "notice-1",
    sourceRef: "notices/notice-1.json",
    revision: "n1",
  },
  {
    ...base,
    metadata: { status: "corrected", score: 1 },
    revision: "r2",
    payloadFingerprint: "payload-b",
  },
]);

assert.equal(audit.audit.jevUsed, false);
assert.equal(audit.audit.advisoryOnly, true);
assert.equal(audit.audit.canonicalRewriteAllowed, false);
assert.equal(audit.audit.semanticComparisonBoundary, "different-normalized-evidence-requires-semantic-review");
assert.ok(audit.audit.exactDuplicateGroups >= 1);
assert.ok(audit.audit.sourceRevisionDuplicateGroups >= 1);
assert.ok(audit.audit.payloadDuplicateGroups >= 1);
assert.ok(audit.audit.metadataDuplicateGroups >= 1);
assert.ok(audit.audit.identityCollisionGroups >= 1);
assert.ok(audit.audit.duplicateGroups.every((group) => group.deterministic && !group.jevRequired));

const surfaceA = buildMssrMarkdownDocumentSurface({
  sourceRef: "docs/a.md",
  markdown: "# Alpha\n\n## Shared\n\nSame exact section body.\n",
});
const surfaceB = buildMssrMarkdownDocumentSurface({
  sourceRef: "docs/b.md",
  markdown: "# Beta\n\n## Shared\n\nSame exact section body.\n",
});
const records = [
  ...librarianRecordsFromDocumentSurface({ surface: surfaceA }),
  ...librarianRecordsFromDocumentSurface({ surface: surfaceB }),
];
const surfaceAudit = auditMssrLibrarianCatalog(records);
assert.equal(
  surfaceAudit.audit.sourceRevisionDuplicateGroups,
  0,
  "distinct sections from one document revision are not duplicates merely because they share a source",
);
const samePayload = surfaceAudit.audit.duplicateGroups.filter((group) => group.classification === "same-payload");
assert.ok(samePayload.length >= 1, "exact duplicate section payloads across documents should be found without Jev");
assert.ok(samePayload.some((group) => group.sourceRefs.includes("docs/a.md") && group.sourceRefs.includes("docs/b.md")));

const semanticallySimilarButDifferent = auditMssrLibrarianCatalog([
  {
    namespace: "document",
    kind: "section",
    identity: "a",
    sourceRef: "a.md",
    revision: "1",
    payloadFingerprint: "hash-a",
    metadata: { label: "strict-verification-before-release" },
    provenance: { producer: "document-surface" },
  },
  {
    namespace: "document",
    kind: "section",
    identity: "b",
    sourceRef: "b.md",
    revision: "1",
    payloadFingerprint: "hash-b",
    metadata: { label: "release-verification-first" },
    provenance: { producer: "document-surface" },
  },
]);
assert.equal(semanticallySimilarButDifferent.audit.deterministicDuplicateGroups, 0, "semantic similarity must not be guessed by the deterministic contract");

assert.throws(
  () => canonicalizeMssrLibrarianMetadata({ bad: Number.NaN }),
  /finite/,
);
assert.throws(() => canonicalizeMssrLibrarianMetadata({ prompt: "private prompt" }), /excluded/);
assert.throws(() => canonicalizeMssrLibrarianMetadata({ source: { raw_body: "private source text" } }), /excluded/);
assert.throws(() => canonicalizeMssrLibrarianMetadata({ tag: "x".repeat(241) }), /240 characters/);

console.log("librarian contract tests passed");
