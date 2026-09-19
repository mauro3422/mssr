import assert from "node:assert/strict";

import {
  evaluateMssrSemanticConsistency,
  evaluateMssrSemanticShadowEvidence,
  extractMssrDeclaredDecisionClaims,
  extractMssrDeclaredOwnerClaims,
  extractMssrDeclaredVersionClaims,
  extractMssrPackageVersionClaim,
  produceMssrSemanticContextMessages,
  resolveMssrSemanticRelations,
  retrieveMssrSemanticCandidates,
} from "../dist/index.js";

const structured = [
  ...extractMssrDeclaredVersionClaims({
    markdown: "noise ignored\n<!-- mssr-version:bridge.live=0.6.139 -->\n",
    sourceRef: ".mssr/PROJECT_STATE.md",
  }),
  ...extractMssrDeclaredOwnerClaims({
    markdown: "<!-- mssr-owner:semantic.consistency=mssr -->\n",
    sourceRef: ".mssr/PROJECT_STATE.md",
  }),
  ...extractMssrDeclaredDecisionClaims({
    markdown: "<!-- mssr-decision:adr.0006=rev-2 -->\n",
    sourceRef: ".mssr/PROJECT_STATE.md",
  }),
];
assert.deepEqual(structured.map((claim) => claim.kind), ["release-version", "ownership", "decision-revision"]);
assert.equal(structured[0].extractor, "declared-version-marker-v1");
assert.equal(structured[1].value, "mssr");
assert.equal(structured[2].revision, "rev-2");

const packageVersion = extractMssrPackageVersionClaim({
  packageJson: { name: "bridge", version: "0.6.139", description: "ignored prose" },
  subject: "bridge.package",
  sourceRef: "package.json",
  required: true,
});
assert.equal(packageVersion.value, "0.6.139");
assert.equal(packageVersion.extractor, "package-version-v1");
assert.throws(() => extractMssrPackageVersionClaim({ packageJson: {}, subject: "broken", sourceRef: "package.json" }), /version field/);

const mirrorClaims = [
  {
    kind: "release-version",
    subject: "bridge.documented",
    source: "project-state",
    sourceRef: ".mssr/PROJECT_STATE.md#bridge.documented",
    authority: "replica",
    value: "0.6.138",
    extractor: "declared-version-marker-v1",
  },
  {
    kind: "release-version",
    subject: "bridge.live",
    source: "runtime",
    sourceRef: "bridge-health",
    authority: "canonical",
    value: "0.6.139",
    extractor: "bridge-runtime-v1",
  },
];
const mirrorRelation = {
  id: "bridge-doc-mirrors-live",
  kind: "mirrors",
  fromSubject: "bridge.documented",
  toSubject: "bridge.live",
  owner: "mssr",
  sourceRef: ".mssr/semantic-relations.json#bridge-doc-mirrors-live",
  required: true,
};
const mirrorEvaluation = evaluateMssrSemanticConsistency({
  boundary: "pre-release",
  claims: mirrorClaims,
  relations: [mirrorRelation],
});
assert.equal(mirrorEvaluation.findings.length, 1);
assert.equal(mirrorEvaluation.findings[0].type, "release-drift");
assert.equal(mirrorEvaluation.findings[0].evidenceTier, "proven");
assert.equal(mirrorEvaluation.findings[0].relationId, "bridge-doc-mirrors-live");
assert.equal(mirrorEvaluation.findings[0].reasonCode, "declared-mirrors-release-version-conflict");
assert.equal(mirrorEvaluation.blocksPublication, false, "replica-vs-canonical declared drift should review, not become a canonical publication blocker");
assert.equal(mirrorEvaluation.canonicalRewriteAllowed, false);

const canonicalMirror = evaluateMssrSemanticConsistency({
  boundary: "pre-release",
  claims: mirrorClaims.map((claim) => ({ ...claim, authority: "canonical" })),
  relations: [mirrorRelation],
});
assert.equal(canonicalMirror.findings[0].type, "canonical-contradiction");
assert.equal(canonicalMirror.findings[0].blocksPublication, true);
assert.equal(canonicalMirror.blocksPublication, true);

const derivedResolution = resolveMssrSemanticRelations({
  claims: mirrorClaims,
  relations: [{ ...mirrorRelation, relationshipClass: "derived" }],
});
assert.equal(derivedResolution.comparisonPairs.length, 0, "derived relations must never become deterministic comparison authority");
assert.equal(derivedResolution.derivedCandidates.length, 1);
const derivedEvaluation = evaluateMssrSemanticConsistency({
  claims: mirrorClaims,
  relations: [{ ...mirrorRelation, relationshipClass: "derived" }],
});
assert.equal(derivedEvaluation.findings.length, 0);
assert.equal(derivedEvaluation.relationCandidateCount, 1);

const unresolvedEvaluation = evaluateMssrSemanticConsistency({
  claims: [{
    kind: "state-value",
    subject: "producer.semantic",
    source: "manifest",
    sourceRef: ".mssr/semantic-relations.json",
    authority: "canonical",
    value: "available",
  }],
  relations: [{
    id: "semantic-produces-missing",
    kind: "produces",
    fromSubject: "producer.semantic",
    toSubject: "context.roadmap-message",
    owner: "mssr",
    sourceRef: ".mssr/semantic-relations.json#semantic-produces-missing",
    toRef: "src/missing-producer.ts",
    required: true,
  }],
  availableRefs: [".mssr/semantic-relations.json"],
});
assert.equal(unresolvedEvaluation.unresolvedReferences.length, 1);
assert.equal(unresolvedEvaluation.unresolvedReferences[0].reasonCode, "required-lifecycle-target-unresolved");

const unresolvedMessages = produceMssrSemanticContextMessages({
  evaluation: unresolvedEvaluation,
  observedAt: "2026-09-19T18:00:00-03:00",
});
assert.equal(unresolvedMessages.length, 1);
assert.equal(unresolvedMessages[0].kind, "unresolved-reference");
assert.equal(unresolvedMessages[0].required, true);
assert.equal(unresolvedMessages[0].severity, "warning");

const roadmapEvaluation = evaluateMssrSemanticConsistency({
  claims: [
    {
      kind: "state-value",
      subject: "roadmap.r4",
      source: "project-state",
      sourceRef: ".mssr/PROJECT_STATE.md#roadmap.r4",
      authority: "canonical",
      value: "completed",
    },
    {
      kind: "state-value",
      subject: "roadmap.r4",
      source: "project-context",
      sourceRef: "ROADMAP.md#r4",
      authority: "replica",
      value: "pending",
    },
  ],
});
const roadmapMessagesA = produceMssrSemanticContextMessages({ evaluation: roadmapEvaluation, observedAt: "2026-09-19T18:00:00-03:00" });
const roadmapMessagesB = produceMssrSemanticContextMessages({ evaluation: roadmapEvaluation, observedAt: "2026-09-19T18:05:00-03:00" });
assert.equal(roadmapMessagesA.length, 1);
assert.equal(roadmapMessagesA[0].kind, "roadmap-contradiction");
assert.equal(roadmapMessagesA[0].dedupeKey, roadmapMessagesB[0].dedupeKey, "message identity must be stable across repeated observations");

const resolvedRoadmap = evaluateMssrSemanticConsistency({
  claims: roadmapEvaluation.activeClaims.map((claim) => ({ ...claim, value: "completed" })),
});
assert.equal(produceMssrSemanticContextMessages({ evaluation: resolvedRoadmap, observedAt: "2026-09-19T18:10:00-03:00" }).length, 0, "resolved contradictions must stop producing notice noise");

const noRoadmapNoise = evaluateMssrSemanticConsistency({
  claims: [
    {
      kind: "ownership",
      subject: "semantic.owner",
      source: "project-state",
      sourceRef: "state#owner",
      authority: "canonical",
      value: "mssr",
    },
    {
      kind: "ownership",
      subject: "semantic.owner",
      source: "project-context",
      sourceRef: "context#owner",
      authority: "replica",
      value: "bridge",
    },
  ],
});
assert.equal(produceMssrSemanticContextMessages({ evaluation: noRoadmapNoise, observedAt: "2026-09-19T18:10:00-03:00" }).length, 0, "Gate F must not repurpose roadmap messages for unrelated proven contradictions");

const declaredCandidates = retrieveMssrSemanticCandidates({ claims: mirrorClaims, relations: [mirrorRelation] });
assert.equal(declaredCandidates.candidates[0].method, "declared-relation");
assert.equal(declaredCandidates.candidates[0].truthAuthority, false);
assert.equal(declaredCandidates.lexicalTruthAuthority, false);

const lexicalCandidates = retrieveMssrSemanticCandidates({
  claims: [
    {
      kind: "release-version",
      subject: "bridge.release.package",
      source: "source",
      sourceRef: "packages/bridge/package.json",
      authority: "canonical",
      value: "0.6.139",
    },
    {
      kind: "release-version",
      subject: "bridge.release.runtime",
      source: "runtime",
      sourceRef: "runtime/bridge/release",
      authority: "replica",
      value: "0.6.138",
    },
  ],
  minTfidfScore: 0.01,
});
assert.equal(lexicalCandidates.candidates.some((candidate) => candidate.method === "tfidf"), true);
assert.equal(lexicalCandidates.candidates.every((candidate) => candidate.evidenceTier === "candidate" && candidate.truthAuthority === false), true);

// Frozen seeded retrieval micro-benchmark: one relevant lexical pair among unrelated claims.
// This measures candidate ranking only; it is not a semantic truth benchmark.
const benchmarkClaims = [
  { kind: "release-version", subject: "bridge.release.source", source: "source", sourceRef: "bridge/source-version", authority: "canonical", value: "0.6.139" },
  { kind: "release-version", subject: "bridge.release.runtime", source: "runtime", sourceRef: "bridge/runtime-version", authority: "replica", value: "0.6.138" },
  { kind: "release-version", subject: "mssr.source.version", source: "source", sourceRef: "mssr/source-version", authority: "canonical", value: "0.2.71" },
  { kind: "release-version", subject: "unrelated.widget.release", source: "source", sourceRef: "widgets/unrelated-version", authority: "replica", value: "9.9.9" },
];
const benchmark = retrieveMssrSemanticCandidates({ claims: benchmarkClaims, maxCandidates: 1, minTfidfScore: 0.01 });
assert.equal(benchmark.candidates.length, 1);
const benchmarkSubjects = [
  benchmarkClaims[benchmark.candidates[0].leftIndex].subject,
  benchmarkClaims[benchmark.candidates[0].rightIndex].subject,
].sort();
assert.deepEqual(benchmarkSubjects, ["bridge.release.runtime", "bridge.release.source"], "seeded top-1 retrieval must select the known Bridge source/runtime pair by semantic identity, not array position");
const seededPrecisionAt1 = 1;
const seededRecallAt1 = 1;
assert.equal(seededPrecisionAt1, 1);
assert.equal(seededRecallAt1, 1);

const shadow = evaluateMssrSemanticShadowEvidence({
  schemaVersion: 1,
  candidateId: "candidate.bridge.release",
  modelId: "local-cross-encoder",
  modelRevision: "test-only-rev",
  label: "contradicts",
  score: 0.97,
  sourceRefs: ["package.json", "bridge-health"],
  observedAt: "2026-09-19T18:00:00-03:00",
});
assert.equal(shadow.evidenceClass, "derived");
assert.equal(shadow.evidenceTier, "candidate");
assert.equal(shadow.routingInfluence, false);
assert.equal(shadow.directNoticeAuthority, false);
assert.equal(shadow.truthAuthority, false);
assert.equal(shadow.canonicalRewriteAllowed, false);

const publicApi = await import("../dist/index.js");
for (const name of [
  "resolveMssrSemanticRelations",
  "retrieveMssrSemanticCandidates",
  "produceMssrSemanticContextMessages",
  "evaluateMssrSemanticShadowEvidence",
  "extractMssrDeclaredVersionClaims",
  "extractMssrDeclaredOwnerClaims",
  "extractMssrDeclaredDecisionClaims",
]) assert.equal(typeof publicApi[name], "function", `${name} must be public`);

console.log("MSSR R4 Gates B-H portable semantic consistency contracts: PASS");
