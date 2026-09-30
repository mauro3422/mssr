import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendMssrSemanticDistillationObservations,
  applyMssrSemanticDistillationFeedback,
  attachMssrSemanticDistillationTrace,
  buildMssrSemanticDistillationProfile,
  classifyMssrSemanticRelationDeterministically,
  createMssrSemanticDistillationObservation,
  distillMssrSemanticRelations,
  projectMssrSemanticTraceLearning,
  semanticDistillationFeatureSignature,
  summarizeMssrSemanticDistillationLearning,
} from "../dist/index.js";

const sha = (value) => createHash("sha256").update(String(value)).digest("hex");
const feature = {
  retrievalMethods: ["fact-anchor", "tfidf"],
  scoreBucket: "strong",
  sourceScoreBucket: "medium",
  orderingMethod: "mtime",
  priorityDirection: "left-higher",
  leftSourceKind: "project-state",
  rightSourceKind: "phase",
  leftValidity: "current",
  rightValidity: "unknown",
  leftProtected: false,
  rightProtected: false,
  sameHash: false,
  lengthRatio: "similar",
};

const shadow = createMssrSemanticDistillationObservation({
  projectKey: "project-shadow",
  edgeSignature: sha("shadow"),
  feature,
  observedAt: "2026-09-20T12:00:00.000Z",
  jev: { relation: "supports", confidence: 0.99, provider: "jev", modelId: "system-one" },
});
const shadowOnly = distillMssrSemanticRelations({ observations: [shadow], minObservations: 3, minDistinctProjects: 1 });
assert.equal(shadowOnly.metrics.shadow, 1);
assert.equal(shadowOnly.metrics.eligible, 0);
assert.equal(shadowOnly.rules.length, 0, "Raw Jev shadow output must never become a distilled rule");

const confirmed = Array.from({ length: 8 }, (_, index) => createMssrSemanticDistillationObservation({
  projectKey: index % 2 === 0 ? "project-a" : "project-b",
  edgeSignature: sha(`confirmed-${index}`),
  feature,
  observedAt: `2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
  jev: { relation: "supports", confidence: 0.8 + index * 0.01, provider: "jev", modelId: "system-one" },
  verification: { status: "confirmed", relation: "supports", evidenceRef: `fixture:${index}`, verifiedAt: `2026-09-${String(10 + index).padStart(2, "0")}T13:00:00.000Z` },
}));
const profile = distillMssrSemanticRelations({ observations: [shadow, ...confirmed] });
assert.equal(profile.rules.length, 1);
assert.equal(profile.rules[0].relation, "supports");
assert.equal(profile.rules[0].support, 8);
assert.equal(profile.rules[0].distinctProjects, 2);
assert.ok(profile.rules[0].lowerBound95 >= 0.65);
assert.equal(profile.policy.rawJevIsTrainingTruth, false);
assert.equal(profile.policy.routingInfluence, false);

const learned = classifyMssrSemanticRelationDeterministically({ feature, profile });
assert.equal(learned.relation, "supports");
assert.equal(learned.basis, "distilled-rule");
assert.equal(learned.advisoryOnly, true);
assert.equal(learned.canonicalRewriteAllowed, false);

const exactFeature = { ...feature, retrievalMethods: ["exact-hash"], scoreBucket: "exact", sameHash: true };
const exact = classifyMssrSemanticRelationDeterministically({ feature: exactFeature, profile: null });
assert.equal(exact.relation, "duplicate");
assert.equal(exact.confidence, 1);
assert.equal(exact.reviewRequired, false);

const unknownFeature = { ...feature, leftSourceKind: "docs", rightSourceKind: "roadmap", scoreBucket: "weak" };
const abstained = classifyMssrSemanticRelationDeterministically({ feature: unknownFeature, profile });
assert.equal(abstained.relation, null);
assert.equal(abstained.basis, "abstain");
assert.equal(abstained.reviewRequired, true);

const sameTrace = Array.from({ length: 8 }, (_, index) => createMssrSemanticDistillationObservation({
  projectKey: index % 2 === 0 ? "project-a" : "project-b",
  edgeSignature: sha(`retry-${index}`),
  feature: unknownFeature,
  observedAt: `2026-09-${String(1 + index).padStart(2, "0")}T10:00:00.000Z`,
  jev: { relation: "unrelated", confidence: 0.9, provider: "jev", modelId: "system-one" },
  trace: { traceId: "mssr-retry-family-001", evidenceRefHashes: [] },
  verification: { status: "confirmed", relation: "unrelated", evidenceRef: `retry:${index}`, verifiedAt: `2026-09-${String(1 + index).padStart(2, "0")}T11:00:00.000Z` },
}));
const retryProfile = distillMssrSemanticRelations({ observations: sameTrace, minDistinctProjects: 1, minObservations: 3 });
assert.equal(retryProfile.metrics.eligible, 1, "Repeated observations from the same trace must not inflate evidence support");
assert.equal(retryProfile.rules.length, 0);

const contradictionFeature = { ...feature, sourceScoreBucket: "strong", lengthRatio: "different" };
const contradictions = Array.from({ length: 10 }, (_, index) => createMssrSemanticDistillationObservation({
  projectKey: index % 2 ? "project-a" : "project-b",
  edgeSignature: sha(`contradiction-${index}`),
  feature: contradictionFeature,
  observedAt: `2026-08-${String(1 + index).padStart(2, "0")}T10:00:00.000Z`,
  jev: { relation: "contradicts", confidence: 0.99, provider: "jev", modelId: "system-one" },
  verification: { status: "confirmed", relation: "contradicts", evidenceRef: `contradiction:${index}`, verifiedAt: `2026-08-${String(1 + index).padStart(2, "0")}T11:00:00.000Z` },
}));
const contradictionProfile = distillMssrSemanticRelations({ observations: contradictions });
assert.equal(contradictionProfile.rules.length, 0, "Contradictions must remain review-only even with repeated support");

const traceProjection = projectMssrSemanticTraceLearning({
  traceId: "mssr-test-trace-001",
  workflowKey: "semantic-distillation-test",
  evidenceRefs: ["qa:test:green", "qa:test:green", "receipt:abc"],
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
    outcome: {
      status: "success",
      accepted: true,
      verificationPassed: true,
      persisted: true,
      userCorrections: 0,
      supportingSkills: [],
    },
  },
});
assert.equal(traceProjection.traceId, "mssr-test-trace-001");
assert.equal(traceProjection.verificationPassed, true);
assert.equal(traceProjection.evidenceRefHashes.length, 2);
assert.equal("semanticSignature" in traceProjection, false, "Compact projection must hash semantic signature rather than retaining raw trace context");

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-distillation-"));
const storePath = path.join(root, "learning.json");
try {
  const storeShadow = createMssrSemanticDistillationObservation({
    projectKey: "store-project",
    edgeSignature: sha("store-edge"),
    feature,
    observedAt: "2026-09-28T12:00:00.000Z",
    jev: { relation: "contradicts", confidence: 0.21, provider: "jev", modelId: "system-one" },
    trace: { traceId: "mssr-test-trace-001", workflowKey: "semantic-learning-test" },
  });
  const appended = await appendMssrSemanticDistillationObservations({ observations: [storeShadow, storeShadow], storePath });
  assert.equal(appended.added, 1);
  assert.equal(appended.total, 1);
  const linked = await attachMssrSemanticDistillationTrace({ trace: traceProjection, storePath });
  assert.equal(linked.matched, 1);
  assert.equal(linked.updated, 1);
  const afterLink = await summarizeMssrSemanticDistillationLearning({ storePath });
  assert.equal(afterLink.shadow, 1, "Trace hydration must not promote or verify a shadow observation");
  assert.equal(afterLink.verified, 0, "Trace outcome metadata is calibration evidence, not semantic confirmation");
  const feedback = await applyMssrSemanticDistillationFeedback({
    observationId: storeShadow.id,
    status: "corrected",
    relation: "supersedes",
    evidenceRef: "inspection:temporal-drift",
    trace: traceProjection,
    storePath,
  });
  assert.equal(feedback.observation.verification.status, "corrected");
  assert.equal(feedback.observation.verification.relation, "supersedes");
  assert.equal(feedback.observation.trace.traceId, "mssr-test-trace-001");
  const storeProfile = await buildMssrSemanticDistillationProfile({ storePath, minObservations: 3, minDistinctProjects: 1 });
  assert.equal(storeProfile.metrics.corrected, 1);
  assert.equal(storeProfile.rules.length, 0);
  const status = await summarizeMssrSemanticDistillationLearning({ storePath });
  assert.equal(status.rawTraceLoaded, false);
  assert.equal(status.rawSourceTextStored, false);
  assert.equal(status.rawJevIsTrainingTruth, false);
  assert.equal(status.routingInfluence, false);
  assert.equal(status.canonicalRewriteAllowed, false);
  assert.ok(JSON.stringify(status).length < 12_000, "Learning status must remain a bounded context capsule");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

assert.equal(semanticDistillationFeatureSignature(feature).length, 64);
console.log("semantic-curation-distillation tests passed");
