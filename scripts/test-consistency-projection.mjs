import assert from "node:assert/strict";

import { evaluateMssrConsistencyOperationalAttention } from "../dist/consistency-projection.js";
import { evaluateMssrOperationalNoticeTransition } from "../dist/operational-notices.js";

const releaseAuthority = {
  key: "bridge.release-version",
  observer: "package.json",
  role: "source",
  authority: "canonical",
  state: "observed",
  value: "0.6.102",
};

function project(observations, boundary = "ordinary") {
  return evaluateMssrConsistencyOperationalAttention({ boundary, observations });
}

const healthy = project([
  releaseAuthority,
  { key: "bridge.release-version", observer: "src/config.ts", role: "source", authority: "replica", state: "observed", value: "0.6.102", required: true },
  { key: "bridge.release-version", observer: "dist/config.js", role: "generated", authority: "replica", state: "observed", value: "0.6.102", required: true },
  { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "observed", value: "0.6.102", required: true },
], "post-restart");
assert.equal(healthy.level, "ok");
assert.equal(healthy.evidenceComplete, true);
assert.deepEqual(healthy.reasonCodes, []);
assert.deepEqual(healthy.mismatches, []);

const staleExecutable = project([
  releaseAuthority,
  { key: "bridge.release-version", observer: "src/config.ts", role: "source", authority: "replica", state: "observed", value: "0.6.102", required: true },
  { key: "bridge.release-version", observer: "dist/config.js", role: "generated", authority: "replica", state: "observed", value: "0.6.101", required: true },
  { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "observed", value: "0.6.101", required: true },
], "post-restart");
assert.equal(staleExecutable.level, "error", "required generated/runtime parity is critical after restart");
assert.equal(staleExecutable.reasonCodes.includes("generated-artifact-mismatch"), true);
assert.equal(staleExecutable.reasonCodes.includes("runtime-state-mismatch"), true);
assert.equal(staleExecutable.reasonCodes.includes("replica-mismatch"), true);
assert.equal(staleExecutable.recommendedActions.includes("rebuild-generated-artifact"), true);
assert.equal(staleExecutable.recommendedActions.includes("verify-live-runtime"), true);
assert.equal(staleExecutable.mismatches.length, 2);

const historicalReceipt = project([
  releaseAuthority,
  { key: "bridge.release-version", observer: "receipt:old-execution", role: "receipt", authority: "historical", state: "observed", value: "0.6.99" },
], "context-load");
assert.equal(historicalReceipt.level, "review", "historical evidence can remain valid history while being stale for current operation");
assert.deepEqual(historicalReceipt.reasonCodes, ["historical-claim-stale", "receipt-claim-mismatch"]);
assert.equal(historicalReceipt.recommendedActions.includes("review-stale-claim"), true);
assert.equal(historicalReceipt.recommendedActions.includes("revalidate-context-evidence"), true);
assert.equal(historicalReceipt.recommendedActions.includes("replan-current-context"), true);

const canonicalConflict = project([
  releaseAuthority,
  { ...releaseAuthority, observer: ".mssr/PROJECT_STATE.md", role: "state", value: "0.6.103" },
]);
assert.equal(canonicalConflict.level, "error");
assert.deepEqual(canonicalConflict.reasonCodes, ["canonical-authority-conflict"]);
assert.equal(canonicalConflict.recommendedActions.includes("inspect-canonical-authorities"), true);

const noBaseline = project([
  { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "observed", value: "0.6.102" },
]);
assert.equal(noBaseline.level, "watch");
assert.equal(noBaseline.evidenceComplete, false);
assert.deepEqual(noBaseline.reasonCodes, ["canonical-baseline-missing"]);
assert.equal(noBaseline.notifyOnWatch, false);

const noBaselineCritical = project([
  { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "observed", value: "0.6.102", required: true },
], "pre-release");
assert.equal(noBaselineCritical.level, "review", "critical closure without canonical baseline must not silently pass");

const optionalUnavailable = project([
  releaseAuthority,
  { key: "bridge.release-version", observer: "optional-reference", role: "reference", authority: "replica", state: "unavailable" },
]);
assert.equal(optionalUnavailable.level, "watch");
assert.deepEqual(optionalUnavailable.reasonCodes, ["observer-unavailable"]);

const requiredUnavailableCritical = project([
  releaseAuthority,
  { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "unavailable", required: true },
], "post-restart");
assert.equal(requiredUnavailableCritical.level, "error");
assert.deepEqual(requiredUnavailableCritical.reasonCodes, ["required-observer-unavailable"]);

const revisionStale = project([
  { key: "project.context-revision", observer: ".mssr/project-context.json", role: "state", authority: "canonical", state: "observed", revision: "rev-12" },
  { key: "project.context-revision", observer: "receipt:resume", role: "receipt", authority: "historical", state: "observed", revision: "rev-11" },
], "context-load");
assert.equal(revisionStale.level, "review");
assert.equal(revisionStale.mismatches[0].kind, "revision");

const deterministicA = project([
  { key: "k2", observer: "replica-b", role: "reference", authority: "replica", state: "observed", value: "b" },
  { key: "k1", observer: "authority-a", role: "source", authority: "canonical", state: "observed", value: "a" },
  { key: "k2", observer: "authority-b", role: "source", authority: "canonical", state: "observed", value: "b" },
  { key: "k1", observer: "replica-a", role: "reference", authority: "replica", state: "observed", value: "a" },
]);
const deterministicB = project([
  { key: "k1", observer: "replica-a", role: "reference", authority: "replica", state: "observed", value: "a" },
  { key: "k2", observer: "authority-b", role: "source", authority: "canonical", state: "observed", value: "b" },
  { key: "k1", observer: "authority-a", role: "source", authority: "canonical", state: "observed", value: "a" },
  { key: "k2", observer: "replica-b", role: "reference", authority: "replica", state: "observed", value: "b" },
]);
assert.equal(deterministicA.fingerprint, deterministicB.fingerprint, "fingerprint must not depend on caller observation ordering");

const opened = evaluateMssrOperationalNoticeTransition({
  subject: "consistency:bridge.release-version",
  source: "fixture",
  code: "mssr-consistency-review",
  resolutionCode: "mssr-consistency-resolved",
  currentLevel: historicalReceipt.level,
  previousLevel: healthy.level,
  currentFingerprint: historicalReceipt.fingerprint,
  previousFingerprint: healthy.fingerprint,
  message: "Review consistency.",
});
assert.equal(opened.event, "opened");
const stable = evaluateMssrOperationalNoticeTransition({
  subject: "consistency:bridge.release-version",
  source: "fixture",
  code: "mssr-consistency-review",
  currentLevel: historicalReceipt.level,
  previousLevel: historicalReceipt.level,
  currentFingerprint: historicalReceipt.fingerprint,
  previousFingerprint: historicalReceipt.fingerprint,
  message: "Review consistency.",
});
assert.equal(stable.shouldNotify, false, "stable mismatch fingerprint must not spam");
const resolved = evaluateMssrOperationalNoticeTransition({
  subject: "consistency:bridge.release-version",
  source: "fixture",
  code: "mssr-consistency-review",
  resolutionCode: "mssr-consistency-resolved",
  currentLevel: healthy.level,
  previousLevel: historicalReceipt.level,
  currentFingerprint: healthy.fingerprint,
  previousFingerprint: historicalReceipt.fingerprint,
  message: "Review consistency.",
  resolutionMessage: "Consistency recovered.",
});
assert.equal(resolved.event, "resolved");
assert.equal(resolved.notice?.code, "mssr-consistency-resolved");

const empty = project([]);
assert.equal(empty.level, "watch");
assert.deepEqual(empty.reasonCodes, ["consistency-evidence-empty"]);
assert.equal(empty.advisoryOnly, true);

console.log("MSSR C2c consistency projection: PASS");
