import assert from "node:assert/strict";
import {
  documentFreshnessManifestSchema,
  evaluateDocumentFreshness,
} from "../dist/index.js";

const manifest = documentFreshnessManifestSchema.parse({
  schemaVersion: 1,
  documents: [
    {
      documentId: "visual-capture-roadmap",
      documentRef: "docs/roblox-visual-capture/ROADMAP.md",
      kind: "roadmap",
      impactRefs: ["src/tools/roblox-photo-capture-tools.ts", "src/notices.ts"],
    },
  ],
});

const aligned = evaluateDocumentFreshness({
  manifest,
  observations: [{
    documentId: "visual-capture-roadmap",
    documentRef: "docs/roblox-visual-capture/ROADMAP.md",
    documentAvailable: true,
    documentRevision: "doc-a",
    impactRefs: [
      { ref: "src/tools/roblox-photo-capture-tools.ts", available: true, revision: "impl-a", relationToDocument: "not-newer" },
      { ref: "src/notices.ts", available: true, revision: "notice-a", relationToDocument: "not-newer" },
    ],
  }],
});
assert.equal(aligned.level, "ok");
assert.deepEqual(aligned.findings, []);
assert.equal(aligned.semanticContradictionProven, false);
assert.equal(aligned.canonicalRewriteAllowed, false);

const reviewDue = evaluateDocumentFreshness({
  manifest,
  observations: [{
    documentId: "visual-capture-roadmap",
    documentRef: "docs/roblox-visual-capture/ROADMAP.md",
    documentAvailable: true,
    documentRevision: "doc-a",
    impactRefs: [
      { ref: "src/tools/roblox-photo-capture-tools.ts", available: true, revision: "impl-b", relationToDocument: "newer" },
      { ref: "src/notices.ts", available: true, revision: "notice-a", relationToDocument: "not-newer" },
    ],
  }],
});
assert.equal(reviewDue.level, "review");
assert.deepEqual(reviewDue.reviewDocuments, ["docs/roblox-visual-capture/ROADMAP.md"]);
assert.equal(reviewDue.findings[0]?.code, "impact-ref-newer");
assert.match(reviewDue.findings[0]?.message ?? "", /does not prove a semantic contradiction/i);

const unknown = evaluateDocumentFreshness({
  manifest,
  observations: [{
    documentId: "visual-capture-roadmap",
    documentRef: "docs/roblox-visual-capture/ROADMAP.md",
    documentAvailable: true,
    documentRevision: "doc-a",
    impactRefs: [
      { ref: "src/tools/roblox-photo-capture-tools.ts", available: true, revision: "impl-a", relationToDocument: "unknown" },
      { ref: "src/notices.ts", available: true, revision: "notice-a", relationToDocument: "not-newer" },
    ],
  }],
});
assert.equal(unknown.level, "watch");
assert.equal(unknown.findings[0]?.code, "freshness-unknown");

const missing = evaluateDocumentFreshness({
  manifest,
  observations: [{
    documentId: "visual-capture-roadmap",
    documentRef: "docs/roblox-visual-capture/ROADMAP.md",
    documentAvailable: false,
    documentRevision: null,
    impactRefs: [],
  }],
});
assert.equal(missing.level, "review");
assert.equal(missing.findings[0]?.code, "document-missing");

assert.throws(() => documentFreshnessManifestSchema.parse({
  schemaVersion: 1,
  documents: [{
    documentId: "bad",
    documentRef: "../ROADMAP.md",
    impactRefs: ["src/x.ts"],
  }],
}));

console.log("document freshness tests passed");
