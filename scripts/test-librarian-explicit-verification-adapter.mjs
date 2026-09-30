import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  evaluateMssrExplicitVerificationIndependence,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromExplicitVerification,
  mssrExplicitVerificationEvidenceSchema,
} from "../dist/index.js";

const independent = {
  schemaVersion: 1,
  verificationId: "verification-independent-001",
  subject: {
    namespace: "experience",
    kind: "observation",
    identity: "semantic-experience:0123456789abcdef01234567",
    proposalProvider: "shef",
    proposalTraceId: "mssr-proposal-trace-001",
  },
  status: "corrected",
  value: "review",
  evidenceRef: "readback:fixture-independent",
  evidenceRevision: "rev-independent-1",
  verifier: {
    kind: "test",
    id: "fixture-verifier",
    provider: "test-runner",
    traceId: "mssr-verifier-trace-002",
  },
  observedAt: "2026-09-29T21:45:00.000Z",
};

const independence = evaluateMssrExplicitVerificationIndependence(independent);
assert.equal(independence.independent, true);
assert.equal(independence.eligibleAsIndependentTruth, true);
assert.deepEqual(independence.reasons, []);

const record = librarianRecordFromExplicitVerification(independent);
assert.equal(record.namespace, "correction");
assert.equal(record.kind, "corrected");
assert.equal(record.identity, "verification-independent-001");
assert.equal(record.revision, "rev-independent-1");
assert.equal(record.metadata.independence.independent, true);
assert.equal(record.metadata.advisoryOnly, true);
assert.equal(record.metadata.authorityInfluence, false);
assert.equal(record.metadata.canonicalRewriteAllowed, false);
assert.equal(record.metadata.autoApplyAllowed, false);
assert.deepEqual(record.provenance, {
  producer: "explicit-corrections-verifiers",
  host: "test-runner",
  traceId: "mssr-verifier-trace-002",
});

const sameProvider = {
  ...independent,
  verificationId: "verification-same-provider-001",
  verifier: {
    ...independent.verifier,
    provider: "shef",
  },
};
const sameProviderResult = evaluateMssrExplicitVerificationIndependence(sameProvider);
assert.equal(sameProviderResult.independent, false);
assert.equal(sameProviderResult.eligibleAsIndependentTruth, false);
assert.ok(sameProviderResult.reasons.includes("same-provider"));
const sameProviderRecord = librarianRecordFromExplicitVerification(sameProvider);
assert.equal(sameProviderRecord.metadata.independence.eligibleAsIndependentTruth, false, "non-independent attempts remain visible but never become truth");

const sameTrace = {
  ...independent,
  verificationId: "verification-same-trace-001",
  verifier: {
    ...independent.verifier,
    traceId: "mssr-proposal-trace-001",
  },
};
const sameTraceResult = evaluateMssrExplicitVerificationIndependence(sameTrace);
assert.equal(sameTraceResult.independent, false);
assert.ok(sameTraceResult.reasons.includes("same-trace"));

assert.equal(mssrExplicitVerificationEvidenceSchema.safeParse({
  ...independent,
  verificationId: "verification-no-trace-001",
  verifier: { kind: "test", id: "fixture-verifier" },
}).success, false, "proposal trace requires verifier trace to prove independence");

assert.equal(mssrExplicitVerificationEvidenceSchema.safeParse({
  ...independent,
  verificationId: "verification-no-value-001",
  value: undefined,
}).success, false, "corrected verification requires value");

assert.equal(mssrExplicitVerificationEvidenceSchema.safeParse({
  ...independent,
  verificationId: "verification-model-no-provider-001",
  subject: { ...independent.subject, proposalTraceId: undefined },
  verifier: { kind: "model", id: "review-model" },
}).success, false, "model verifier requires provider identity");

assert.throws(
  () => librarianRecordFromExplicitVerification({ ...independent, rawPrompt: "MUST NOT ENTER" }),
  /Unrecognized key|unrecognized/i,
  "strict explicit verification contract rejects arbitrary/raw fields",
);

const duplicateAudit = auditMssrLibrarianCatalog([
  record,
  librarianRecordFromExplicitVerification({ ...independent }),
]);
assert.ok(duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "exact-record"));

const coverage = getMssrLibrarianCoverageInventory(["explicit-corrections-verifiers"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-explicit-verification-adapter.ts#librarianRecordFromExplicitVerification");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian explicit verification adapter tests passed");
