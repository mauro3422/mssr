import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  createArchitectureImpactReviewedBaseline,
  documentFreshnessManifestSchema,
  evaluateArchitectureImpactProjection,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromArchitectureImpactProjection,
  librarianRecordFromSituationModel,
  librarianRecordsFromDocumentFreshness,
  librarianRecordsFromSemanticConsistency,
  normalizeArchitectureImpactObservationEvidence,
} from "../dist/index.js";

const SITUATION_VALUE_SENTINEL = "PRIVATE-SCALAR-SHOULD-NOT-CROSS";
const situationRecord = librarianRecordFromSituationModel({
  snapshotId: "situation-fixture-1",
  traceId: "mssr-situation-fixture-1",
  host: "test-host",
  input: {
    boundary: "pre-execution",
    observations: [{
      key: "project.fact",
      observer: "fixture-observer",
      role: "reference",
      authority: "replica",
      state: "observed",
      value: SITUATION_VALUE_SENTINEL,
      revision: "rev-1",
      category: "other",
      evidenceClass: "inferred",
      sourceRef: "fixture/source",
    }],
  },
});
assert.equal(situationRecord.namespace, "consistency");
assert.equal(situationRecord.kind, "situation-model");
assert.equal(situationRecord.provenance.producer, "situation-consistency");
assert.equal(situationRecord.metadata.observations[0].valuePresent, true);
assert.equal(situationRecord.metadata.observations[0].revision, "rev-1");
assert.equal(JSON.stringify(situationRecord).includes(SITUATION_VALUE_SENTINEL), false, "Situation comparable values must remain at the evaluator/source owner");
assert.equal(Object.hasOwn(situationRecord.metadata, "recommendations"), false);

const SEMANTIC_VALUE_A = "VALUE-A-DO-NOT-RETAIN";
const SEMANTIC_VALUE_B = "VALUE-B-DO-NOT-RETAIN";
const semanticRecords = librarianRecordsFromSemanticConsistency({
  evaluationId: "semantic-fixture-1",
  claims: [
    {
      kind: "state-value",
      subject: "roadmap.r5",
      source: "project-state",
      sourceRef: ".mssr/PROJECT_STATE.md#roadmap.r5",
      authority: "canonical",
      value: SEMANTIC_VALUE_A,
    },
    {
      kind: "state-value",
      subject: "roadmap.r5",
      source: "project-context",
      sourceRef: ".mssr/PROJECT_CONTEXT.md#roadmap.r5",
      authority: "canonical",
      value: SEMANTIC_VALUE_B,
    },
  ],
});
assert.equal(semanticRecords.length, 2, "semantic contradiction fixture should emit evaluation + one finding");
const semanticSummary = semanticRecords[0];
const semanticFinding = semanticRecords[1];
assert.equal(semanticSummary.kind, "semantic-evaluation");
assert.equal(semanticSummary.metadata.contradictionProven, true);
assert.equal(semanticFinding.kind, "semantic-finding");
assert.equal(semanticFinding.metadata.type, "canonical-contradiction");
assert.equal(semanticFinding.metadata.evidenceTier, "proven");
assert.equal(semanticFinding.metadata.sourceA.valuePresent, true);
assert.equal(semanticFinding.metadata.sourceB.valuePresent, true);
assert.equal(semanticFinding.metadata.recommendedActionCount > 0, true);
const semanticSerialized = JSON.stringify(semanticRecords);
assert.equal(semanticSerialized.includes(SEMANTIC_VALUE_A), false);
assert.equal(semanticSerialized.includes(SEMANTIC_VALUE_B), false);
assert.equal(semanticSerialized.includes("recommendedActions"), false, "human/procedural recommendation prose must not cross Librarian ingress");
assert.ok(semanticSerialized.includes(".mssr/PROJECT_STATE.md#roadmap.r5"));

const freshnessManifest = documentFreshnessManifestSchema.parse({
  schemaVersion: 1,
  documents: [{
    documentId: "r5-roadmap",
    documentRef: "docs/r5/ROADMAP.md",
    kind: "roadmap",
    impactRefs: ["src/r5.ts"],
  }],
});
const freshnessRecords = librarianRecordsFromDocumentFreshness({
  evaluationId: "freshness-fixture-1",
  manifest: freshnessManifest,
  observations: [{
    documentId: "r5-roadmap",
    documentRef: "docs/r5/ROADMAP.md",
    documentAvailable: true,
    documentRevision: "doc-a",
    impactRefs: [{
      ref: "src/r5.ts",
      available: true,
      revision: "src-b",
      relationToDocument: "newer",
    }],
  }],
});
assert.equal(freshnessRecords.length, 2);
assert.equal(freshnessRecords[0].metadata.level, "review");
assert.equal(freshnessRecords[1].metadata.code, "impact-ref-newer");
assert.equal(Object.hasOwn(freshnessRecords[1].metadata, "message"), false, "generated freshness prose must stay outside Librarian ingress");

const architectureManifest = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "librarian-plane",
    authorityRef: "docs/librarian.md",
    contextRef: "librarian-context",
    impactRefs: ["src/librarian.ts"],
  }],
};
function architectureEvidence(revision = "sha256:source-a") {
  return normalizeArchitectureImpactObservationEvidence(architectureManifest, {
    schemaVersion: 1,
    architectureId: "librarian-plane",
    authority: { ref: "docs/librarian.md", availability: "available", revision: "sha256:authority-a" },
    impacts: [{ ref: "src/librarian.ts", availability: "available", revision }],
  });
}
const architectureBaseline = createArchitectureImpactReviewedBaseline(architectureEvidence(), { reviewed: true });
const architectureProjection = evaluateArchitectureImpactProjection({
  baseline: architectureBaseline,
  current: architectureEvidence("sha256:source-b"),
});
const architectureRecord = librarianRecordFromArchitectureImpactProjection({ projection: architectureProjection });
assert.equal(architectureRecord.kind, "architecture-impact");
assert.equal(architectureRecord.metadata.status, "possible-impact");
assert.deepEqual(architectureRecord.metadata.reasonCodes, ["impact-revision-changed"]);
assert.equal(architectureRecord.metadata.advisoryOnly, true);
assert.throws(
  () => librarianRecordFromArchitectureImpactProjection({ projection: { ...architectureProjection, arbitraryProse: "MUST FAIL" } }),
  /Unrecognized key|unrecognized/i,
  "architecture impact adapter must re-parse the strict projection contract",
);

const duplicateAudit = auditMssrLibrarianCatalog([
  semanticFinding,
  { ...semanticFinding, identity: "semantic-fixture-2:1:copy" },
]);
assert.ok(duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "same-payload"), "same typed finding payload should remain structurally detectable without Jev");

const coverage = getMssrLibrarianCoverageInventory(["situation-consistency"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-situation-consistency-adapter.ts");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian situation/consistency adapter tests passed");
