import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendMssrSemanticExperienceObservations,
  applyMssrSemanticExperienceFeedback,
  attachMssrSemanticExperienceTrace,
  buildMssrSemanticExperienceProfile,
  classifyMssrSemanticExperienceDeterministically,
  classifyAndObserveMssrSemanticExperienceFromStore,
  createMssrSemanticExperienceObservation,
  distillMssrSemanticExperience,
  persistMssrLearningDigestSemanticExperiences,
  projectMssrLearningDigestSemanticExperiences,
  projectMssrSemanticTraceLearning,
  semanticExperienceFeatureSignature,
  summarizeMssrSemanticExperienceLearning,
} from "../dist/index.js";

const contextFeature = {
  subjectKind: "project-context-candidate",
  candidateKinds: ["phase", "state"],
  signals: ["task-match", "current-authority"],
  flags: { required: false, protected: false },
  buckets: { stage: "implement", relevance: "strong", authority: "state" },
};

function independentVerification({ status, value, evidenceRef, verifiedAt, id }) {
  return {
    status,
    ...(value ? { value } : {}),
    evidenceRef,
    verificationId: `verification-${id}`,
    verifier: {
      kind: "test",
      id: "semantic-experience-fixture-verifier",
      provider: "fixture-test-runner",
      traceId: `mssr-verifier-${id}`,
    },
    independent: true,
    verifiedAt,
  };
}

const shadow = createMssrSemanticExperienceObservation({
  projectKey: "project-shadow",
  decisionKind: "context-selection",
  feature: contextFeature,
  evidenceUnits: [{ sourceRef: ".mssr/PROJECT_STATE.md", role: "candidate", selected: true, reasonCode: "selected" }],
  proposal: { value: "select", confidence: 0.98, provider: "shef", modelId: "system-one" },
  observedAt: "2026-09-20T12:00:00.000Z",
});
const shadowProfile = distillMssrSemanticExperience({ observations: [shadow], minObservations: 3, minDistinctProjects: 1 });
assert.equal(shadowProfile.metrics.shadow, 1);
assert.equal(shadowProfile.metrics.eligible, 0);
assert.equal(shadowProfile.rules.length, 0, "Raw Shef/Jev proposal must never become training truth");

const confirmed = Array.from({ length: 8 }, (_, index) => createMssrSemanticExperienceObservation({
  projectKey: index % 2 === 0 ? "project-a" : "project-b",
  decisionKind: "context-selection",
  feature: contextFeature,
  evidenceUnits: [{ sourceRef: `.mssr/knowledge/phase/candidate-${index}.md`, role: "candidate", selected: true, reasonCode: "selected" }],
  proposal: { value: "select", confidence: 0.82 + index * 0.01, provider: "shef", modelId: "system-one" },
  verification: independentVerification({ status: "confirmed", value: "select", evidenceRef: `fixture:${index}`, verifiedAt: `2026-09-${String(10 + index).padStart(2, "0")}T13:00:00.000Z`, id: `confirmed-${index}` }),
  observedAt: `2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
}));
const profile = distillMssrSemanticExperience({ observations: [shadow, ...confirmed] });
assert.equal(profile.rules.length, 1);
assert.equal(profile.rules[0].decisionKind, "context-selection");
assert.equal(profile.rules[0].value, "select");
assert.equal(profile.rules[0].support, 8);
assert.equal(profile.rules[0].distinctProjects, 2);
assert.ok(profile.rules[0].lowerBound95 >= 0.65);
assert.equal(profile.policy.rawProviderIsTrainingTruth, false);
assert.equal(profile.policy.authorityInfluence, false);
assert.equal(profile.policy.autoApplyAllowed, false);

const learned = classifyMssrSemanticExperienceDeterministically({ decisionKind: "context-selection", feature: contextFeature, profile });
assert.equal(learned.value, "select");
assert.equal(learned.basis, "distilled-rule");
assert.equal(learned.authorityInfluence, false);
assert.equal(learned.autoApplyAllowed, false);

const unknownFeature = { ...contextFeature, buckets: { ...contextFeature.buckets, relevance: "weak" } };
const abstained = classifyMssrSemanticExperienceDeterministically({ decisionKind: "context-selection", feature: unknownFeature, profile });
assert.equal(abstained.value, null);
assert.equal(abstained.basis, "abstain");
assert.equal(abstained.reviewRequired, true);

const correctedPlacement = Array.from({ length: 8 }, (_, index) => createMssrSemanticExperienceObservation({
  projectKey: index % 2 === 0 ? "project-c" : "project-d",
  decisionKind: "placement",
  feature: {
    subjectKind: "project-context-section",
    candidateKinds: ["baseline", "knowledge-ref"],
    signals: ["historical", "historical-support"],
    flags: { protected: false, verifierPresent: true },
    buckets: { baselineNeed: "low", referenceValue: "high", parentKind: "memory" },
  },
  evidenceUnits: [{ sourceRef: `.mssr/knowledge/history/section-${index}.md`, role: "historical", selected: true, reasonCode: "verified-move" }],
  proposal: { value: "keep", confidence: 0.7, provider: "shef", modelId: "system-one" },
  verification: independentVerification({ status: "corrected", value: "move-reference", evidenceRef: `apply-readback:${index}`, verifiedAt: `2026-09-${String(10 + index).padStart(2, "0")}T14:00:00.000Z`, id: `placement-${index}` }),
  observedAt: `2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
}));
const placementProfile = distillMssrSemanticExperience({ observations: correctedPlacement });
assert.equal(placementProfile.rules.length, 1);
assert.equal(placementProfile.rules[0].value, "move-reference", "Fallback must learn the verified correction, not blindly clone Shef");
assert.equal(placementProfile.rules[0].providerAgreementRate, 0);

const sameTrace = Array.from({ length: 8 }, (_, index) => createMssrSemanticExperienceObservation({
  projectKey: index % 2 ? "project-a" : "project-b",
  decisionKind: "document-role",
  feature: {
    subjectKind: "markdown-section",
    candidateKinds: ["current-state", "history"],
    signals: ["version-range"],
    flags: { protected: false },
    buckets: { temporalRole: "historical" },
  },
  proposal: { value: "history", confidence: 0.9, provider: "shef", modelId: "system-one" },
  trace: { traceId: "mssr-semantic-experience-retry-001", evidenceRefHashes: [] },
  verification: independentVerification({ status: "confirmed", value: "history", evidenceRef: `retry:${index}`, verifiedAt: `2026-08-${String(1 + index).padStart(2, "0")}T11:00:00.000Z`, id: `retry-${index}` }),
  observedAt: `2026-08-${String(1 + index).padStart(2, "0")}T10:00:00.000Z`,
}));
const retryProfile = distillMssrSemanticExperience({ observations: sameTrace, minObservations: 3, minDistinctProjects: 1 });
assert.equal(retryProfile.metrics.eligible, 1, "Repeated observations from one trace/feature must not inflate support");
assert.equal(retryProfile.rules.length, 0);

const contradictionFeature = {
  subjectKind: "cross-document-pair",
  candidateKinds: ["state", "phase"],
  signals: ["same-scope"],
  flags: { currentBoth: true },
  buckets: { relationScope: "same" },
};
const contradictions = Array.from({ length: 10 }, (_, index) => createMssrSemanticExperienceObservation({
  projectKey: index % 2 ? "project-x" : "project-y",
  decisionKind: "semantic-relation",
  feature: contradictionFeature,
  proposal: { value: "contradicts", confidence: 0.99, provider: "shef", modelId: "system-one" },
  verification: independentVerification({ status: "confirmed", value: "contradicts", evidenceRef: `contradiction:${index}`, verifiedAt: `2026-07-${String(1 + index).padStart(2, "0")}T11:00:00.000Z`, id: `contradiction-${index}` }),
  observedAt: `2026-07-${String(1 + index).padStart(2, "0")}T10:00:00.000Z`,
}));
const contradictionProfile = distillMssrSemanticExperience({ observations: contradictions });
assert.equal(contradictionProfile.rules.length, 0, "semantic-relation=contradicts must remain review-only");

const traceProjection = projectMssrSemanticTraceLearning({
  traceId: "mssr-semantic-experience-test-001",
  workflowKey: "semantic-experience-test",
  evidenceRefs: ["qa:green", "receipt:abc"],
  digest: {
    version: "learning-digest-v1",
    semanticSignature: "stage=verify|d=coding|a=test|r=code|n=unit-tests|s=reusable-pattern",
    finalStage: "close",
    signals: ["reusable-pattern"],
    recommendedSkills: [],
    loadedSkills: [],
    skillDecisions: [],
    skillTransitions: [],
    contextSelections: [],
    findings: [],
    outcome: { status: "success", accepted: true, verificationPassed: true, persisted: true, userCorrections: 0, supportingSkills: [] },
  },
});

const digestFixture = {
  version: "learning-digest-v1",
  semanticSignature: "stage=implement|d=coding|a=edit,verify|r=project|n=integrity-verification|s=conflicting-evidence,reusable-pattern",
  finalStage: "close",
  signals: ["conflicting-evidence", "reusable-pattern"],
  recommendedSkills: [],
  loadedSkills: [],
  skillDecisions: [],
  skillTransitions: [],
  contextSelections: [
    { scope: "project", owner: "fixture-project", module: "current-state", selected: true, reasonCode: "selected" },
    { scope: "project", owner: "fixture-project", module: "uncertain-history", selected: false, reasonCode: "ambiguous" },
  ],
  findings: [
    { summary: "bounded drift fixture", status: "supported", evidenceRef: "fixture:drift-1", signals: ["conflicting-evidence"] },
  ],
  outcome: { status: "success", accepted: true, verificationPassed: true, persisted: true, userCorrections: 0, supportingSkills: [] },
};
const digestProjection = projectMssrLearningDigestSemanticExperiences({
  traceId: "mssr-semantic-digest-001",
  workflowKey: "semantic-digest-test",
  projectKey: "fixture-project",
  digest: digestFixture,
  evidenceRefs: ["qa:green"],
  observedAt: "2026-09-29T02:00:00.000Z",
});
assert.equal(digestProjection.contextSelections, 2);
assert.equal(digestProjection.abstentionPolicies, 1);
assert.equal(digestProjection.driftInterpretations, 1);
assert.equal(digestProjection.maintenanceDispositions, 1);
assert.equal(digestProjection.observations.length, 5);
assert.ok(digestProjection.observations.every((item) => item.verification.status === "unknown"), "Digest projection must remain shadow-only");
assert.ok(digestProjection.observations.every((item) => item.trace?.traceId === "mssr-semantic-digest-001"));
assert.equal(digestProjection.rawTraceLoaded, false);
assert.equal(digestProjection.rawSourceTextStored, false);

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-experience-"));
const storePath = path.join(root, "experience.json");
try {
  const storedShadow = createMssrSemanticExperienceObservation({
    projectKey: "store-project",
    decisionKind: "drift-interpretation",
    feature: {
      subjectKind: "state-vs-history",
      candidateKinds: ["supersedes", "contradicts"],
      signals: ["newer-state", "older-verification"],
      flags: { sameScope: true },
      buckets: { temporalHint: "newer-left" },
    },
    proposal: { value: "contradicts", confidence: 0.21, provider: "shef", modelId: "system-one" },
    trace: { traceId: "mssr-semantic-experience-test-001", workflowKey: "semantic-experience-test" },
    evidenceUnits: [
      { sourceRef: ".mssr/PROJECT_STATE.md", role: "current", selected: true },
      { sourceRef: ".mssr/knowledge/history/verification.md", role: "historical", selected: true },
    ],
    observedAt: "2026-09-28T12:00:00.000Z",
  });
  const appended = await appendMssrSemanticExperienceObservations({ observations: [storedShadow, storedShadow], storePath });
  assert.equal(appended.added, 1);
  assert.equal(appended.total, 1);
  const linked = await attachMssrSemanticExperienceTrace({ trace: traceProjection, storePath });
  assert.equal(linked.matched, 1);
  assert.equal(linked.updated, 1);
  const afterLink = await summarizeMssrSemanticExperienceLearning({ storePath });
  assert.equal(afterLink.shadow, 1);
  assert.equal(afterLink.verified, 0, "Trace success must not self-confirm a semantic experience");
  await assert.rejects(
    () => applyMssrSemanticExperienceFeedback({
      observationId: storedShadow.id,
      status: "confirmed",
      evidenceRef: "inspection:same-provider",
      verificationId: "verification-same-provider-store",
      verifier: { kind: "model", id: "same-provider-review", provider: "shef", traceId: "mssr-verifier-other-001" },
      storePath,
    }),
    /not independent: same-provider/,
  );
  await assert.rejects(
    () => applyMssrSemanticExperienceFeedback({
      observationId: storedShadow.id,
      status: "confirmed",
      evidenceRef: "inspection:same-trace",
      verificationId: "verification-same-trace-store",
      verifier: { kind: "test", id: "same-trace-review", provider: "fixture-test-runner", traceId: "mssr-semantic-experience-test-001" },
      storePath,
    }),
    /not independent: same-trace/,
  );
  const feedbackArgs = {
    observationId: storedShadow.id,
    status: "corrected",
    value: "supersedes",
    evidenceRef: "inspection:temporal-drift",
    evidenceRevision: "readback-rev-001",
    verificationId: "verification-store-correction-001",
    verifier: { kind: "test", id: "independent-store-review", provider: "fixture-test-runner", traceId: "mssr-verifier-store-002" },
    trace: traceProjection,
    storePath,
  };
  const feedback = await applyMssrSemanticExperienceFeedback(feedbackArgs);
  assert.equal(feedback.updated, true);
  assert.equal(feedback.observation.verification.status, "corrected");
  assert.equal(feedback.observation.verification.value, "supersedes");
  assert.equal(feedback.observation.verification.independent, true);
  assert.equal(feedback.observation.verification.verifier.provider, "fixture-test-runner");
  const retryFeedback = await applyMssrSemanticExperienceFeedback(feedbackArgs);
  assert.equal(retryFeedback.updated, false, "exact verification retry must dedupe instead of rewriting truth");
  const storeProfile = await buildMssrSemanticExperienceProfile({ storePath, minObservations: 3, minDistinctProjects: 1 });
  assert.equal(storeProfile.metrics.corrected, 1);
  assert.equal(storeProfile.rules.length, 0);
  const status = await summarizeMssrSemanticExperienceLearning({ storePath });
  assert.equal(status.rawTraceLoaded, false);
  assert.equal(status.rawSourceTextStored, false);
  assert.equal(status.rawProviderIsTrainingTruth, false);
  assert.equal(status.authorityInfluence, false);
  assert.equal(status.autoApplyAllowed, false);

  const digestStored = await persistMssrLearningDigestSemanticExperiences({
    traceId: "mssr-semantic-digest-001",
    workflowKey: "semantic-digest-test",
    projectKey: "fixture-project",
    digest: digestFixture,
    evidenceRefs: ["qa:green"],
    storePath,
    observedAt: "2026-09-29T02:00:00.000Z",
  });
  assert.equal(digestStored.added, 5);
  assert.equal(digestStored.counts["context-selection"], 2);
  const digestStatus = await summarizeMssrSemanticExperienceLearning({ storePath });
  assert.ok(digestStatus.byDecisionKind["context-selection"] >= 2);
  assert.ok(digestStatus.byDecisionKind["maintenance-disposition"] >= 1);
  assert.equal(digestStatus.verified, 0 + 0, "Digest-derived experiences must remain shadow until independent feedback");

  const fallbackTrace = { traceId: "mssr-fallback-abstain-001", workflowKey: "semantic-fallback-test", evidenceRefHashes: [] };
  const fallbackFirst = await classifyAndObserveMssrSemanticExperienceFromStore({
    decisionKind: "document-role",
    feature: { subjectKind: "unknown-document", candidateKinds: ["state", "history"], signals: ["uncertain"], flags: {}, buckets: {} },
    projectKey: "fixture-project",
    trace: fallbackTrace,
    storePath,
  });
  assert.equal(fallbackFirst.decision.basis, "abstain");
  assert.equal(fallbackFirst.abstentionRecorded, true);
  const fallbackSecond = await classifyAndObserveMssrSemanticExperienceFromStore({
    decisionKind: "document-role",
    feature: { subjectKind: "unknown-document", candidateKinds: ["state", "history"], signals: ["uncertain"], flags: {}, buckets: {} },
    projectKey: "fixture-project",
    trace: fallbackTrace,
    storePath,
  });
  assert.equal(fallbackSecond.decision.basis, "abstain");
  assert.equal(fallbackSecond.abstentionRecorded, false, "Same trace/feature abstention retry must dedupe");

  const persisted = await fs.readFile(storePath, "utf8");
  assert.ok(!persisted.includes("Current production mode is enabled"), "Experience store must never require copied source text");
  assert.ok(JSON.stringify(status).length < 16_000, "Semantic Experience status must remain a bounded context capsule");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

assert.equal(semanticExperienceFeatureSignature({ decisionKind: "context-selection", feature: contextFeature }).length, 64);
console.log("semantic-experience tests passed");
