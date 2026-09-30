import assert from "node:assert/strict";

import {
  benchmarkMssrSemanticExperience,
  createMssrSemanticExperienceObservation,
} from "../dist/index.js";

function observation({ projectKey, index, value = "select", proposalValue = value, decisionKind = "context-selection" }) {
  return createMssrSemanticExperienceObservation({
    projectKey,
    decisionKind,
    feature: {
      subjectKind: "project-context-candidate",
      candidateKinds: ["project"],
      signals: ["task-match"],
      flags: {},
      buckets: { role: "state", fixture: "shared" },
    },
    evidenceUnits: [{ sourceRef: `fixture:${projectKey}:${index}`, role: "candidate", selected: value === "select" }],
    proposal: { value: proposalValue, confidence: 0.9, provider: "shef", modelId: "system-one" },
    verification: {
      status: proposalValue === value ? "confirmed" : "corrected",
      value,
      evidenceRef: `review:${projectKey}:${index}`,
      verificationId: `verification-benchmark-${projectKey}-${index}`,
      verifier: {
        kind: "test",
        id: "semantic-benchmark-fixture-verifier",
        provider: "benchmark-test-runner",
        traceId: `mssr-benchmark-verifier-${projectKey}-${index}`,
      },
      independent: true,
      verifiedAt: `2026-09-${String(1 + index).padStart(2, "0")}T12:00:00.000Z`,
    },
    observedAt: `2026-09-${String(1 + index).padStart(2, "0")}T11:00:00.000Z`,
  });
}

const projects = ["a", "b", "c", "d", "e"];
const stable = projects.flatMap((projectKey) => Array.from({ length: 10 }, (_, index) => observation({ projectKey, index })));
const eligible = benchmarkMssrSemanticExperience({ observations: stable, evaluatedAt: "2026-09-29T03:00:00.000Z" });
assert.equal(eligible.projects, 5);
assert.equal(eligible.verifiedTruth, 50);
assert.equal(eligible.fallback.wrong, 0);
assert.equal(eligible.fallback.correct, 50);
assert.equal(eligible.fallback.precision, 1);
assert.equal(eligible.fallback.coverage, 1);
assert.equal(eligible.promotion.eligible, true);
assert.equal(eligible.promotion.status, "eligible-shadow-primary");
assert.equal(eligible.promotion.autoApplyAllowed, false);
assert.equal(eligible.promotion.authorityInfluence, false);

const sparse = stable.slice(0, 3);
const blockedSparse = benchmarkMssrSemanticExperience({ observations: sparse, evaluatedAt: "2026-09-29T03:01:00.000Z" });
assert.equal(blockedSparse.promotion.eligible, false);
assert.ok(blockedSparse.promotion.reasons.some((reason) => reason.startsWith("verified-holdout:")));
assert.ok(blockedSparse.promotion.reasons.some((reason) => reason.startsWith("distinct-projects:")));

const correctedProvider = projects.flatMap((projectKey) => Array.from({ length: 10 }, (_, index) => observation({
  projectKey,
  index,
  value: "select",
  proposalValue: index % 2 === 0 ? "skip" : "select",
})));
const providerComparison = benchmarkMssrSemanticExperience({ observations: correctedProvider, evaluatedAt: "2026-09-29T03:02:00.000Z" });
assert.equal(providerComparison.fallback.precision, 1, "Fallback learns verified truth, not raw provider proposal");
assert.equal(providerComparison.provider.accuracy, 0.5);
assert.equal(providerComparison.promotion.eligible, true);

const mixedWrong = [...stable];
for (let index = 0; index < 10; index += 1) {
  mixedWrong.push(observation({ projectKey: "holdout-z", index, value: "skip", proposalValue: "skip" }));
}
const blockedWrong = benchmarkMssrSemanticExperience({ observations: mixedWrong, evaluatedAt: "2026-09-29T03:03:00.000Z" });
assert.equal(blockedWrong.promotion.eligible, false);
assert.ok(blockedWrong.fallback.wrong > 0);
assert.ok(blockedWrong.promotion.reasons.some((reason) => reason.startsWith("fallback-wrong:")));

console.log("semantic-experience benchmark tests passed");
