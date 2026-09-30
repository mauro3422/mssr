import assert from "node:assert/strict";
import {
  MSSR_LIBRARIAN_PROJECT_MANIFEST_KINDS,
  auditMssrLibrarianCatalog,
  getMssrLibrarianCoverageInventory,
  librarianRecordsFromProjectManifest,
} from "../dist/index.js";

const projectContext = {
  schemaVersion: 1,
  core: [{
    id: "core-architecture",
    kind: "context",
    description: "PRIVATE DESCRIPTION MUST NOT ENTER RETAINED METADATA",
    source: { path: ".mssr/PROJECT_CONTEXT.md" },
    topic: "architecture",
    area: "core",
  }],
  modules: [{
    id: "semantic-evidence",
    kind: "context",
    description: "ANOTHER PRIVATE DESCRIPTION",
    source: { path: ".mssr/knowledge/architecture/semantic-evidence-plane.md" },
    topic: "architecture",
    area: "semantic-evidence",
    stages: [],
    domains: ["agent-orchestration"],
    actions: ["review"],
    artifacts: ["project"],
    needs: ["integrity-verification"],
    signals: ["reusable-pattern"],
    required: false,
    priority: 10,
  }],
};

const records = librarianRecordsFromProjectManifest({
  projectName: "mssr",
  manifestKind: "project-context",
  sourceRef: ".mssr/project-context.json",
  revision: "manifest-rev-001",
  manifest: projectContext,
  host: "chatgpt-web",
  traceId: "mssr-project-manifest-adapter-001",
});

assert.equal(records.length, 3);
const root = records[0];
assert.equal(root.namespace, "manifest");
assert.equal(root.kind, "project-context");
assert.equal(root.identity, "mssr:.mssr/project-context.json");
assert.equal(root.revision, "manifest-rev-001");
assert.equal(root.payloadFingerprint.length, 64);
assert.deepEqual(root.metadata.entryIds, ["core-architecture", "semantic-evidence"]);
assert.deepEqual(root.provenance, {
  producer: "project-manifests",
  host: "chatgpt-web",
  traceId: "mssr-project-manifest-adapter-001",
});

const moduleRecord = records.find((record) => record.metadata?.entryId === "semantic-evidence");
assert.ok(moduleRecord);
assert.equal(moduleRecord.payloadFingerprint.length, 64);
const serializedModule = JSON.stringify(moduleRecord);
assert.equal(serializedModule.includes("ANOTHER PRIVATE DESCRIPTION"), false);
assert.equal(serializedModule.includes("description"), false);
assert.equal(serializedModule.includes("semantic-evidence-plane.md"), true);
assert.equal(serializedModule.includes("agent-orchestration"), true);

const reordered = librarianRecordsFromProjectManifest({
  projectName: "mssr",
  manifestKind: "project-context",
  sourceRef: ".mssr/project-context-copy.json",
  manifest: {
    modules: projectContext.modules,
    core: projectContext.core,
    schemaVersion: 1,
  },
});
assert.equal(root.payloadFingerprint, reordered[0].payloadFingerprint, "canonical fingerprint must ignore object key order");
const duplicateAudit = auditMssrLibrarianCatalog([root, reordered[0]]);
assert.ok(duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-payload"));

const changedDescription = librarianRecordsFromProjectManifest({
  projectName: "mssr",
  manifestKind: "project-context",
  sourceRef: ".mssr/project-context-changed.json",
  manifest: {
    ...projectContext,
    core: [{ ...projectContext.core[0], description: "changed canonical declaration prose" }],
  },
});
assert.notEqual(root.payloadFingerprint, changedDescription[0].payloadFingerprint, "manifest fingerprint must still observe canonical declaration changes even when prose is not retained");
assert.equal(JSON.stringify(changedDescription[1]).includes("changed canonical declaration prose"), false);

const minimalByKind = new Map([
  ["project-context-segments", { schemaVersion: 1, modules: [] }],
  ["project-context-references", { schemaVersion: 1, modules: [] }],
  ["architecture-impact", { schemaVersion: 1, architectures: [] }],
  ["architecture-structure", { schemaVersion: 1, architectures: [] }],
  ["architecture-invariants", { schemaVersion: 1, invariants: [] }],
  ["document-freshness", { schemaVersion: 1, documents: [] }],
  ["document-context", { schemaVersion: 1, sourceClass: "project-context", core: { sections: ["# Core"] }, modules: [] }],
  ["context-messages", { schemaVersion: 1, entries: {} }],
  ["skill-context", { schemaVersion: 1, core: { sections: ["# Core"] }, modules: [] }],
]);

for (const kind of MSSR_LIBRARIAN_PROJECT_MANIFEST_KINDS) {
  if (kind === "project-context") continue;
  const manifest = minimalByKind.get(kind);
  assert.ok(manifest, `missing fixture for ${kind}`);
  const adapted = librarianRecordsFromProjectManifest({
    projectName: "fixture",
    manifestKind: kind,
    sourceRef: `.mssr/${kind}.json`,
    manifest,
  });
  assert.equal(adapted[0].kind, kind);
  assert.equal(adapted[0].payloadFingerprint.length, 64);
  assert.equal(adapted[0].metadata.manifestKind, kind);
}

assert.throws(
  () => librarianRecordsFromProjectManifest({
    projectName: "mssr",
    manifestKind: "project-context",
    sourceRef: ".mssr/project-context.json",
    manifest: { schemaVersion: 1, core: [], modules: [], rawSecret: "must fail strict schema" },
  }),
  /Unrecognized key|unrecognized/i,
  "declared manifest adapters must preserve each source schema's strictness",
);

assert.throws(
  () => librarianRecordsFromProjectManifest({
    projectName: "mssr",
    manifestKind: "unknown-manifest",
    sourceRef: ".mssr/unknown.json",
    manifest: {},
  }),
  /Invalid option|invalid/i,
);

const coverage = getMssrLibrarianCoverageInventory(["project-manifests"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-project-manifest-adapter.ts#librarianRecordsFromProjectManifest");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian project manifest adapter tests passed");
