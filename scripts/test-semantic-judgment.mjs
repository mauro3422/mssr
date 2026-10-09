import assert from "node:assert/strict";
import {
  buildMssrEvidenceAtom,
} from "../dist/evidence-atom.js";
import {
  buildMssrSemanticJudgment,
  evaluateMssrSemanticJudgment,
  mssrSemanticJudgmentSchema,
} from "../dist/semantic-judgment.js";

function atom(suffix, options = {}) {
  const revision = options.revision ?? "rev-001";
  return buildMssrEvidenceAtom({
    subject: { namespace: "document", kind: "section", identity: `docs/${suffix}.md#claim` },
    source: { ref: `docs/${suffix}.md`, revision, freshness: options.freshness ?? "fresh", freshnessEvidence: options.freshness === "stale" ? undefined : {
      canonicalOwner: "docs",
      ref: `docs/${suffix}.md`,
      revision,
      observedAt: "2026-09-30T10:00:00Z",
    } },
    provenance: { producer: "fixture", sourceClass: "canonical", canonicalOwner: "docs", projectKey: "fixture-project" },
    fingerprints: { record: (suffix === "a" ? "a" : "b").repeat(64), payload: `payload-${suffix}` },
    reasonCodes: [],
    lineage: { parentAtomIds: [], relatedAtomIds: [], supersedesAtomIds: [] },
    dedupeKey: `fixture:${suffix}:${revision}`,
    authorityClass: "observed",
    privacyClass: "project-metadata",
    usage: { selection: "selected", consumed: true, outcome: "unknown", reasonCodes: [] },
    attributes: {},
  });
}

const a = atom("a");
const b = atom("b");
const inputs = [a, b];
const base = {
  schemaVersion: 1,
  immutable: true,
  advisoryOnly: true,
  canonicalRewriteAllowed: false,
  decisionFamily: "relation",
  inputs: [a, b].map((item) => ({
    atomId: item.id,
    sourceRef: item.source.ref,
    revision: item.source.revision,
    fingerprints: { record: item.fingerprints.record, payload: item.fingerprints.payload },
  })),
  heads: [
    { head: "relation-kind", candidates: ["supports", "contradicts"], selectedId: "supports", rawConfidence: 0.91, probabilities: [{ candidateId: "supports", probability: 0.91 }, { candidateId: "contradicts", probability: 0.09 }] },
    { head: "relation-direction", candidates: ["left-to-right", "right-to-left"], selectedId: "left-to-right", rawConfidence: 0.82, probabilities: [{ candidateId: "left-to-right", probability: 0.82 }, { candidateId: "right-to-left", probability: 0.18 }] },
  ],
  calibratedConfidence: {
    value: 0.77,
    projectKey: "fixture-project",
    decisionFamily: "relation",
    calibrationId: "calibration-001",
    calibrationVersion: "v1",
    holdoutFingerprint: "c".repeat(64),
    calibratedAt: "2026-09-30T10:30:00Z",
  },
  claim: { validity: "current", scope: "project-release", validFrom: "2026-01-01T00:00:00Z", validUntil: null },
  citations: [
    { atomId: a.id, sourceRef: a.source.ref, revision: a.source.revision, fingerprint: a.fingerprints.record, role: "supports" },
    { atomId: b.id, sourceRef: b.source.ref, revision: b.source.revision, fingerprint: b.fingerprints.record, role: "supports" },
  ],
  relations: [{ leftAtomId: a.id, rightAtomId: b.id, kind: "supports", rawConfidence: 0.91, citedAtomIds: [a.id, b.id], comparability: {
    scope: { left: "project-release", right: "project-release" },
    temporal: { leftValidity: "current", leftValidFrom: "2026-01-01T00:00:00Z", leftValidUntil: null, rightValidity: "current", rightValidFrom: "2026-01-01T00:00:00Z", rightValidUntil: null },
  }, status: "candidate" }],
  evidenceCoverage: { requestedAtomIds: [a.id, b.id], returnedAtomIds: [a.id, b.id], complete: true },
  abstainReasons: [],
  reviewReasons: [],
  provider: "fixture-provider",
  model: "fixture-model",
  promptVersion: "relation-prompt-v1",
  providerSchemaVersion: "provider-schema-v1",
  traceId: "proposal-trace-001",
  verificationEvidence: null,
};

const proposalId = buildMssrSemanticJudgment({ judgment: base, inputAtoms: inputs }).id;
const independentVerification = {
  schemaVersion: 1,
  verificationId: "verification-judgment-001",
  subject: {
    namespace: "mssr",
    kind: "semantic-judgment",
    identity: proposalId,
    proposalProvider: "fixture-provider",
    proposalTraceId: "proposal-trace-001",
  },
  status: "confirmed",
  value: "supports",
  evidenceRef: "readback:fixture-001",
  evidenceRevision: "verify-rev-001",
  verifier: { kind: "test", id: "independent-checker", provider: "test-runner", traceId: "verifier-trace-001" },
  observedAt: "2026-09-30T11:00:00Z",
};
base.verificationEvidence = independentVerification;

const judgment = buildMssrSemanticJudgment({ judgment: base, inputAtoms: inputs });
const make = (overrides = {}, inputAtoms = inputs) => {
  const relations = overrides.relations ?? base.relations;
  const relationKind = relations[0]?.kind;
  const confidence = relations[0]?.rawConfidence ?? 0.91;
  const generatedHead = relationKind ? [{
    head: "relation-kind",
    candidates: [relationKind, relationKind === "supports" ? "contradicts" : "supports"],
    selectedId: relationKind,
    rawConfidence: confidence,
    probabilities: [
      { candidateId: relationKind, probability: confidence },
      { candidateId: relationKind === "supports" ? "contradicts" : "supports", probability: Number((1 - confidence).toFixed(6)) },
    ],
  }, base.heads[1]] : base.heads;
  return buildMssrSemanticJudgment({ judgment: { ...base, ...overrides, ...(!Object.hasOwn(overrides, "heads") ? { heads: generatedHead } : {}) }, inputAtoms });
};
assert.equal(Object.isFrozen(judgment), true);
assert.equal(Object.isFrozen(judgment.inputs), true);
assert.equal(judgment.heads[0].rawConfidence, 0.91);
assert.ok(Array.isArray(judgment.heads[0].probabilities));
assert.equal(Object.hasOwn(judgment.heads[0], "calibrated"), false, "raw confidence is never labeled calibrated");
assert.equal(judgment.calibratedConfidence.value, 0.77);
assert.match(judgment.id, /^semantic-judgment:[0-9a-f]{24}$/);
assert.equal(make().id, judgment.id, "same proposal bytes produce a stable content-addressed id");
const selectedConfidenceOnly = make({ heads: [{ ...base.heads[0], probabilities: null }, base.heads[1]] });
assert.equal(selectedConfidenceOnly.heads[0].probabilities, null, "providers without a full class distribution keep that absence explicit");
assert.notEqual(make({ reviewReasons: ["different-proposal"] }).id, judgment.id, "proposal changes produce a different id");
assert.equal(evaluateMssrSemanticJudgment({ judgment, inputAtoms: inputs }).disposition, "candidate");

const needsReview = make({ claim: { ...base.claim, validity: null, scope: null } });
const review = evaluateMssrSemanticJudgment({ judgment: needsReview, inputAtoms: inputs });
assert.equal(review.disposition, "review");
assert.ok(review.reasons.includes("missing-claim-scope"));
assert.ok(review.reasons.includes("missing-claim-validity"));

const contradiction = make({ relations: [{ ...base.relations[0], kind: "contradicts" }] });
assert.equal(evaluateMssrSemanticJudgment({ judgment: contradiction, inputAtoms: inputs }).disposition, "review");

const unresolved = make({ relations: [{ ...base.relations[0], kind: "unresolved", status: "unresolved" }] });
assert.ok(evaluateMssrSemanticJudgment({ judgment: unresolved, inputAtoms: inputs }).reasons.includes("unresolved-relations"));

const unknownScope = make({ relations: [{ ...base.relations[0], comparability: { ...base.relations[0].comparability, scope: { left: "project-release", right: null } } }] });
assert.ok(evaluateMssrSemanticJudgment({ judgment: unknownScope, inputAtoms: inputs }).reasons.includes("relation-scope-unknown"));
const scopeConflict = make({ relations: [{ ...base.relations[0], comparability: { ...base.relations[0].comparability, scope: { left: "project-release", right: "other-scope" } } }] });
assert.ok(evaluateMssrSemanticJudgment({ judgment: scopeConflict, inputAtoms: inputs }).reasons.includes("relation-scope-conflict"));
const timeConflict = make({ relations: [{ ...base.relations[0], comparability: { ...base.relations[0].comparability, temporal: { ...base.relations[0].comparability.temporal, rightValidity: "historical" } } }] });
assert.ok(evaluateMssrSemanticJudgment({ judgment: timeConflict, inputAtoms: inputs }).reasons.includes("relation-temporal-comparability-conflict"));
const supersedesTemporal = {
  ...base.relations[0],
  kind: "supersedes",
  comparability: { ...base.relations[0].comparability, temporal: {
    leftValidity: "current", leftValidFrom: "2026-10-06T00:00:00Z", leftValidUntil: null,
    rightValidity: "historical", rightValidFrom: "2026-10-02T00:00:00Z", rightValidUntil: "2026-10-05T23:59:59Z",
  } },
};
const chronologicalSupersedes = make({ relations: [supersedesTemporal], verificationEvidence: null });
const chronologicalEvaluation = evaluateMssrSemanticJudgment({ judgment: chronologicalSupersedes, inputAtoms: inputs });
assert.ok(!chronologicalEvaluation.reasons.includes("relation-temporal-comparability-conflict"), "a later left claim may supersede an earlier historical claim");
assert.ok(chronologicalEvaluation.reasons.includes("independent-verification-unavailable"), "temporal comparability does not remove independent verification requirements");
const unknownTemporalSupersedes = make({ relations: [{ ...supersedesTemporal, comparability: { ...supersedesTemporal.comparability, temporal: {
  ...supersedesTemporal.comparability.temporal, leftValidFrom: null,
} } }], verificationEvidence: null });
assert.ok(evaluateMssrSemanticJudgment({ judgment: unknownTemporalSupersedes, inputAtoms: inputs }).reasons.includes("relation-temporal-comparability-unknown"), "supersession still requires known temporal evidence");
const reverseChronologySupersedes = make({ relations: [{ ...supersedesTemporal, comparability: { ...supersedesTemporal.comparability, temporal: {
  ...supersedesTemporal.comparability.temporal, leftValidFrom: "2026-10-01T00:00:00Z", rightValidFrom: "2026-10-02T00:00:00Z",
} } }], verificationEvidence: null });
assert.ok(evaluateMssrSemanticJudgment({ judgment: reverseChronologySupersedes, inputAtoms: inputs }).reasons.includes("relation-temporal-comparability-conflict"), "a proposed supersession cannot point from an earlier left claim to a later right claim");
assert.throws(() => make({ heads: [{ ...base.heads[0], selectedId: "contradicts", rawConfidence: 0.91, probabilities: [{ candidateId: "supports", probability: 0.09 }, { candidateId: "contradicts", probability: 0.91 }] }] }), /Every relation edge must agree/i, "a contradictory relation edge cannot disagree with the selected relation head");

const abstaining = make({ abstainReasons: ["insufficient-evidence"] });
assert.equal(evaluateMssrSemanticJudgment({ judgment: abstaining, inputAtoms: inputs }).disposition, "abstain");

assert.throws(() => buildMssrSemanticJudgment({ judgment: {
  ...base,
  citations: [{ atomId: "evidence-atom:ffffffffffffffffffffffff", sourceRef: "other.md", revision: "rev-001", fingerprint: "f".repeat(64), role: "supports" }],
}, inputAtoms: inputs }), /Citation|citation/i);
assert.throws(() => buildMssrSemanticJudgment({ judgment: base, inputAtoms: [a] }), /was not supplied/);
assert.equal(mssrSemanticJudgmentSchema.safeParse({ ...judgment, claim: { ...base.claim, validFrom: "2026-04-01T00:00:00Z", validUntil: "2026-03-01T00:00:00Z" } }).success, false, "invalid temporal ranges are rejected");
assert.throws(() => buildMssrSemanticJudgment({ judgment: { ...base, id: "semantic-judgment:ffffffffffffffffffffffff" }, inputAtoms: inputs }), /Unrecognized key|unrecognized/i, "provider cannot choose judgment id");
assert.throws(() => make({ heads: [{ ...base.heads[0], probabilities: [{ candidateId: "supports", probability: 0.91 }] }] }), /probabilities/i, "missing candidate probability is rejected");
assert.throws(() => make({ heads: [{ ...base.heads[0], candidates: ["supports", "contradicts", "other"] }] }), /probabilities/i, "extra candidate without returned probability is rejected");
assert.throws(() => make({ heads: [{ ...base.heads[0], probabilities: [{ candidateId: "supports", probability: 0.7 }, { candidateId: "contradicts", probability: 0.1 }] }] }), /sum to 1/i, "invalid probability distribution is rejected");
assert.throws(() => make({ relations: [{ ...base.relations[0], citedAtomIds: [b.id] }] }), /both endpoints/i, "relation citations must include exact evidence for both endpoints");

const changedRevision = atom("a", { revision: "rev-002" });
assert.throws(() => buildMssrSemanticJudgment({ judgment: base, inputAtoms: [changedRevision, b] }), /was not supplied|mismatched or stale provenance/);
const stale = atom("stale", { freshness: "stale" });
assert.throws(() => buildMssrSemanticJudgment({ judgment: { ...base, inputs: [{
  atomId: stale.id,
  sourceRef: stale.source.ref,
  revision: stale.source.revision,
  fingerprints: { record: stale.fingerprints.record, payload: stale.fingerprints.payload },
}, base.inputs[1]], citations: [], relations: [], evidenceCoverage: { requestedAtomIds: [stale.id, b.id], returnedAtomIds: [stale.id, b.id], complete: true } }, inputAtoms: [stale, b] }), /stale source provenance/);

const sameProvider = make({ verificationEvidence: { ...independentVerification, verificationId: "verification-same-provider", verifier: { ...independentVerification.verifier, provider: "fixture-provider" } } });
assert.equal(sameProvider.verification.status, "unverified");
assert.equal(evaluateMssrSemanticJudgment({ judgment: sameProvider, inputAtoms: inputs }).disposition, "review");
assert.ok(sameProvider.verification.independenceReasons.includes("same-provider"));
const sameTrace = make({ verificationEvidence: { ...independentVerification, verificationId: "verification-same-trace", verifier: { ...independentVerification.verifier, traceId: "proposal-trace-001" } } });
assert.equal(sameTrace.verification.status, "unverified");
assert.ok(sameTrace.verification.independenceReasons.includes("same-trace"));
const missingVerification = make({ verificationEvidence: null });
assert.equal(missingVerification.verification.status, "unverified");
assert.equal(evaluateMssrSemanticJudgment({ judgment: missingVerification, inputAtoms: inputs }).disposition, "review");
const missingProposalIdentity = make({ traceId: null, verificationEvidence: { ...independentVerification, subject: { ...independentVerification.subject, proposalTraceId: undefined } } });
assert.equal(missingProposalIdentity.verification.status, "unverified", "verification without proposal identities cannot be called independent");
assert.ok(missingProposalIdentity.verification.independenceReasons.includes("proposal-trace-unknown"));
const wrongSubject = make({ verificationEvidence: { ...independentVerification, subject: { ...independentVerification.subject, identity: "semantic-judgment:ffffffffffffffffffffffff" } } });
assert.equal(wrongSubject.verification.status, "unverified", "verification must identify this exact judgment id");
assert.ok(wrongSubject.verification.independenceReasons.includes("verification-subject-mismatch"));
const forgedAtom = { ...a, provenance: { ...a.provenance, producer: "forged-producer" } };
assert.throws(() => buildMssrSemanticJudgment({ judgment: base, inputAtoms: [forgedAtom, b] }), /identity does not match/i, "atom IDs are rederived from source/provenance identity fields");

console.log("semantic judgment tests passed");
