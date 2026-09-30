import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  createMssrSemanticExperienceObservation,
  getMssrLibrarianCoverageInventory,
  librarianRecordsFromSemanticExperienceObservation,
} from "../dist/index.js";

const base = createMssrSemanticExperienceObservation({
  projectKey: "D:/Dev/mssr",
  decisionKind: "context-selection",
  feature: {
    subjectKind: "context-module",
    candidateKinds: ["architecture", "memory"],
    signals: ["reusable-pattern"],
    flags: { required: false, stale: false },
    buckets: { stage: "verify", pressure: "medium" },
  },
  evidenceUnits: [
    {
      sourceRef: ".mssr/PROJECT_CONTEXT.md",
      sha256: "a".repeat(64),
      startLine: 10,
      endLine: 18,
      role: "candidate",
      selected: true,
      reasonCode: "intent-match",
    },
  ],
  proposal: {
    value: "select",
    confidence: 0.82,
    provider: "structured-jev",
    modelId: "jev-fixture",
  },
  trace: {
    traceId: "mssr-semantic-exp-fixture-001",
    workflowKey: "semantic-exp-fixture",
    semanticSignatureHash: "b".repeat(64),
    finalStage: "verify",
    outcomeStatus: "success",
    accepted: true,
    verificationPassed: true,
    persisted: false,
    userCorrections: 0,
    evidenceRefHashes: ["c".repeat(64)],
  },
  observedAt: "2026-09-29T19:25:00.000-03:00",
});

const shadowRecords = librarianRecordsFromSemanticExperienceObservation(base);
assert.equal(shadowRecords.length, 1, "unknown verification must remain one shadow observation atom");
const shadow = shadowRecords[0];
assert.equal(shadow.namespace, "experience");
assert.equal(shadow.kind, "observation");
assert.equal(shadow.identity, base.id);
assert.equal(shadow.payloadFingerprint, base.decisionSignature);
assert.equal(shadow.provenance.producer, "semantic-experience");
assert.equal(shadow.provenance.traceId, "mssr-semantic-exp-fixture-001");
assert.equal(shadow.metadata.mode, "verified-shadow-experience");
assert.equal(shadow.metadata.proposal.value, "select");
assert.equal(shadow.metadata.proposal.provider, "structured-jev");
assert.equal(shadow.metadata.feature.subjectKind, "context-module");
assert.equal(shadow.metadata.evidenceUnits[0].sourceRef, ".mssr/PROJECT_CONTEXT.md");
assert.equal(shadow.metadata.advisoryOnly, true);
assert.equal(shadow.metadata.authorityInfluence, false);
assert.equal(shadow.metadata.routingInfluence, false);
assert.equal(shadow.metadata.canonicalRewriteAllowed, false);
assert.equal(shadow.metadata.autoApplyAllowed, false);
assert.equal(Object.hasOwn(shadow.metadata, "verification"), false, "verification is a separate atom, not proposal truth");

const cataloguedShadow = catalogMssrLibrarianRecord(shadow);
assert.equal(cataloguedShadow.contractKey, `experience:observation:${base.id}`);
assert.equal(cataloguedShadow.metadataFingerprint.length, 64);
assert.equal(cataloguedShadow.recordFingerprint.length, 64);

const confirmed = {
  ...base,
  verification: {
    status: "confirmed",
    value: "select",
    evidenceRef: "verifier:independent:fixture-001",
    verifiedAt: "2026-09-29T19:30:00.000-03:00",
  },
};
const confirmedRecords = librarianRecordsFromSemanticExperienceObservation(confirmed);
assert.equal(confirmedRecords.length, 2);
assert.equal(confirmedRecords[0].revision, shadow.revision, "later verification must not mutate the proposal atom");
assert.deepEqual(confirmedRecords[0].metadata, shadow.metadata);
const verification = confirmedRecords[1];
assert.equal(verification.kind, "verification");
assert.equal(verification.metadata.observationId, base.id);
assert.equal(verification.metadata.status, "confirmed");
assert.equal(verification.metadata.value, "select");
assert.equal(verification.metadata.evidenceRef, "verifier:independent:fixture-001");
assert.equal(verification.metadata.proposalProvider, "structured-jev");
assert.equal(verification.metadata.proposalValue, "select");
assert.equal(verification.metadata.advisoryOnly, true);
assert.equal(verification.metadata.authorityInfluence, false);
assert.equal(verification.metadata.routingInfluence, false);
assert.equal(verification.metadata.canonicalRewriteAllowed, false);
assert.equal(verification.metadata.autoApplyAllowed, false);
assert.ok(verification.identity.startsWith(`${base.id}:`));
assert.equal(verification.payloadFingerprint.length, 64);

const corrected = {
  ...base,
  verification: {
    status: "corrected",
    value: "skip",
    evidenceRef: "verifier:independent:fixture-002",
    verifiedAt: "2026-09-29T19:35:00.000-03:00",
  },
};
const correctedRecords = librarianRecordsFromSemanticExperienceObservation(corrected);
assert.equal(correctedRecords.length, 2);
assert.equal(correctedRecords[0].revision, shadow.revision);
assert.notEqual(correctedRecords[1].revision, verification.revision, "different verifier evidence must produce a distinct verification atom");
assert.equal(correctedRecords[1].metadata.status, "corrected");
assert.equal(correctedRecords[1].metadata.value, "skip");
assert.equal(correctedRecords[1].metadata.proposalValue, "select", "proposal and correction remain visibly distinct");

const rejected = {
  ...base,
  verification: {
    status: "rejected",
    evidenceRef: "verifier:independent:fixture-003",
    verifiedAt: "2026-09-29T19:40:00.000-03:00",
  },
};
const rejectedRecords = librarianRecordsFromSemanticExperienceObservation(rejected);
assert.equal(rejectedRecords[1].metadata.status, "rejected");
assert.equal(rejectedRecords[1].metadata.value, null);

const exactAudit = auditMssrLibrarianCatalog([shadow, shadow]);
assert.ok(exactAudit.audit.duplicateGroups.some((group) => group.classification === "exact-record"));

const evolutionAudit = auditMssrLibrarianCatalog([shadow, ...confirmedRecords.slice(1), ...correctedRecords.slice(1)]);
assert.equal(
  evolutionAudit.audit.duplicateGroups.some((group) => group.classification === "identity-collision"),
  false,
  "verification evolution must not masquerade as an identity collision",
);

assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, rawPrompt: "MUST NOT ENTER" }),
  /Unrecognized key|unrecognized/i,
);
assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, privateReasoning: "MUST NOT ENTER" }),
  /Unrecognized key|unrecognized/i,
);
assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, advisoryOnly: false }),
  /Invalid literal value|Invalid input|expected true/i,
);
assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, routingInfluence: true }),
  /Invalid literal value|Invalid input|expected false/i,
);
assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, canonicalRewriteAllowed: true }),
  /Invalid literal value|Invalid input|expected false/i,
);
assert.throws(
  () => librarianRecordsFromSemanticExperienceObservation({ ...base, autoApplyAllowed: true }),
  /Invalid literal value|Invalid input|expected false/i,
);

const coverage = getMssrLibrarianCoverageInventory(["semantic-experience"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-semantic-experience-adapter.ts#librarianRecordsFromSemanticExperienceObservation");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian semantic experience adapter tests passed");
