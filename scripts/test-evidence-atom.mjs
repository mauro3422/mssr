import assert from "node:assert/strict";
import {
  buildMssrEvidenceAtom,
  catalogMssrLibrarianRecord,
  evidenceAtomFromLibrarianCatalogRecord,
  mssrEvidenceAtomSchema,
} from "../dist/index.js";

const base = {
  subject: { namespace: "document", kind: "section", identity: "docs/a.md#heading-2" },
  source: {
    ref: "docs\\a.md",
    revision: "rev-001",
    freshness: "fresh",
    headingPath: ["Architecture", "Routing"],
    range: { startLine: 10, endLine: 18, startOffset: 120, endOffset: 420 },
  },
  provenance: {
    producer: "document-surface",
    host: "bridge",
    traceId: "mssr-atom-trace-001",
    projectKey: "mssr",
  },
  fingerprints: {
    record: "a".repeat(64),
    payload: "payload-001",
    metadata: "b".repeat(64),
  },
  reasonCodes: ["route-selected", "exact-section", "route-selected"],
  lineage: {
    parentAtomIds: [],
    relatedAtomIds: [],
    supersedesAtomIds: [],
  },
  dedupeKey: "document:docs/a.md:heading-2:rev-001",
  authorityClass: "observed",
  privacyClass: "project-metadata",
  usage: {
    selection: "selected",
    consumed: true,
    outcome: "positive",
    reasonCodes: ["used-for-context", "used-for-context"],
  },
  attributes: {
    headingLevel: 2,
    required: true,
    role: "architecture",
  },
};

const atom = buildMssrEvidenceAtom(base);
assert.equal(atom.schemaVersion, 1);
assert.match(atom.id, /^evidence-atom:[0-9a-f]{24}$/);
assert.equal(atom.source.ref, "docs/a.md");
assert.deepEqual(atom.reasonCodes, ["exact-section", "route-selected"]);
assert.deepEqual(atom.usage.reasonCodes, ["used-for-context"]);
assert.equal(atom.advisoryOnly, true);
assert.equal(atom.canonicalRewriteAllowed, false);

const same = buildMssrEvidenceAtom({
  ...base,
  reasonCodes: [...base.reasonCodes].reverse(),
  usage: { ...base.usage, reasonCodes: [...base.usage.reasonCodes].reverse() },
  attributes: { role: "architecture", required: true, headingLevel: 2 },
});
assert.equal(same.id, atom.id, "ordering of non-identity metadata must not change atom identity");

const changedRevision = buildMssrEvidenceAtom({
  ...base,
  source: { ...base.source, revision: "rev-002" },
});
assert.notEqual(changedRevision.id, atom.id, "revision changes create a distinct evidence atom");

assert.equal(mssrEvidenceAtomSchema.safeParse({ ...atom, rawBody: "MUST NOT ENTER" }).success, false);
assert.equal(mssrEvidenceAtomSchema.safeParse({
  ...atom,
  source: { ref: "docs/a.md", freshness: "fresh", range: { startLine: 1, endLine: 2 } },
}).success, false, "exact range refs require a source revision");
assert.equal(mssrEvidenceAtomSchema.safeParse({
  ...atom,
  usage: { ...atom.usage, selection: "skipped", consumed: true },
}).success, false, "skipped evidence cannot be simultaneously consumed");
assert.equal(mssrEvidenceAtomSchema.safeParse({
  ...atom,
  source: { ...atom.source, range: { startLine: 20, endLine: 10 } },
}).success, false);

const secretMetadata = {
  lineCount: 42,
  internalSummary: "THIS FULL LIBRARIAN METADATA MUST NOT BE COPIED INTO THE ATOM",
};
const catalog = catalogMssrLibrarianRecord({
  namespace: "document",
  kind: "section",
  identity: "docs/a.md#heading-2",
  sourceRef: "docs/a.md",
  revision: "rev-001",
  payloadFingerprint: "payload-001",
  metadata: secretMetadata,
  provenance: {
    producer: "document-surface",
    host: "bridge",
    traceId: "mssr-atom-trace-001",
  },
});

const projected = evidenceAtomFromLibrarianCatalogRecord({
  record: catalog,
  authorityClass: "observed",
  privacyClass: "project-metadata",
  freshness: "fresh",
  headingPath: ["Architecture", "Routing"],
  range: { startLine: 10, endLine: 18 },
  reasonCodes: ["librarian-ingress"],
  projectKey: "mssr",
  attributes: { headingLevel: 2 },
});

assert.equal(projected.subject.identity, catalog.identity);
assert.equal(projected.fingerprints.record, catalog.recordFingerprint);
assert.equal(projected.fingerprints.metadata, catalog.metadataFingerprint);
assert.equal(projected.attributes.headingLevel, 2);
assert.equal(JSON.stringify(projected).includes("THIS FULL LIBRARIAN METADATA MUST NOT BE COPIED INTO THE ATOM"), false);
assert.equal(Object.hasOwn(projected, "metadata"), false);

const projectedAgain = evidenceAtomFromLibrarianCatalogRecord({
  record: catalog,
  authorityClass: "observed",
  privacyClass: "project-metadata",
  freshness: "fresh",
  headingPath: ["Architecture", "Routing"],
  range: { startLine: 10, endLine: 18 },
  reasonCodes: ["different-non-identity-reason"],
  projectKey: "mssr",
});
assert.equal(projectedAgain.id, projected.id, "semantic/usage labels do not rewrite stable evidence identity");

console.log("evidence atom tests passed");
