import assert from "node:assert/strict";

import {
  MSSR_NOTICE_SCHEMA_VERSION,
  evaluateMssrOperationalNoticeTransition,
  mssrNoticeV1Schema,
} from "../dist/operational-notices.js";
import {
  evaluateMssrContextFreshnessOperationalAttention,
  evaluateMssrInfrastructureOperationalAttention,
  evaluateMssrProjectKnowledgeOperationalAttention,
  evaluateMssrProviderOperationalAttention,
  evaluateMssrTraceLifecycleOperationalAttention,
} from "../dist/operational-projections.js";

function evaluate(overrides = {}) {
  return evaluateMssrOperationalNoticeTransition({
    subject: "fixture",
    source: "mssr-test",
    code: "mssr-test-review",
    resolutionCode: "mssr-test-resolved",
    currentLevel: "ok",
    previousLevel: null,
    currentFingerprint: "current",
    previousFingerprint: null,
    message: "Review fixture.",
    resolutionMessage: "Fixture resolved.",
    recommendation: "Review the bounded evidence.",
    ...overrides,
  });
}

const initialOk = evaluate({ currentLevel: "ok" });
assert.equal(initialOk.shouldNotify, false);
assert.equal(initialOk.notice, null);

const initialWatch = evaluate({ currentLevel: "watch" });
assert.equal(initialWatch.shouldNotify, false, "WATCH is quiet by default");

const initialReview = evaluate({ currentLevel: "review" });
assert.equal(initialReview.shouldNotify, true);
assert.equal(initialReview.event, "opened");
assert.equal(initialReview.notice?.severity, "warning");
assert.equal(initialReview.notice?.details.previousLevel, null);
assert.equal(initialReview.notice?.details.currentLevel, "review");
assert.equal(initialReview.notice?.details.advisoryOnly, true);
assert.ok(initialReview.notice);
assert.equal(initialReview.notice.schemaVersion, MSSR_NOTICE_SCHEMA_VERSION);
assert.equal(initialReview.notice.kind, "operational-attention");
assert.equal(initialReview.notice.origin, "mssr");
assert.equal(initialReview.notice.attentionLevel, "review");
assert.equal(initialReview.notice.advisoryOnly, true);
assert.deepEqual(mssrNoticeV1Schema.parse(initialReview.notice), initialReview.notice);
assert.equal(mssrNoticeV1Schema.safeParse({ ...initialReview.notice, ttl: 30_000 }).success, false, "delivery metadata must not enter MssrNotice v1");

const producerA = evaluate({ currentLevel: "review", source: "producer-a", currentFingerprint: "shared-evidence" });
const producerB = evaluate({ currentLevel: "review", source: "producer-b", currentFingerprint: "shared-evidence" });
assert.ok(producerA.notice && producerB.notice);
assert.notEqual(producerA.notice.noticeId, producerB.notice.noticeId, "different producers must have different notice lifecycle identities");
assert.notEqual(producerA.notice.dedupeKey, producerB.notice.dedupeKey, "dedupe identity must include the producer lifecycle identity");
assert.match(producerA.notice.dedupeKey, /^mssr-notice-dedupe:sha256:[a-f0-9]{64}$/);
assert.equal(producerA.notice.details.fingerprint, "shared-evidence", "small bounded fingerprints remain inspectable inline");

const longFingerprint = `long:${"x".repeat(4_000)}`;
const longNoticeA = evaluate({ currentLevel: "review", currentFingerprint: longFingerprint });
const longNoticeB = evaluate({ currentLevel: "review", currentFingerprint: longFingerprint });
const longNoticeChanged = evaluate({ currentLevel: "review", currentFingerprint: `${longFingerprint}-changed` });
assert.ok(longNoticeA.notice && longNoticeB.notice && longNoticeChanged.notice);
assert.match(longNoticeA.notice.details.fingerprint, new RegExp(`^sha256:${longFingerprint.length}:[a-f0-9]{64}$`), "oversized semantic fingerprints must be compacted in the portable envelope");
assert.ok(longNoticeA.notice.details.fingerprint.length <= 240);
assert.equal(longNoticeA.notice.details.fingerprint, longNoticeB.notice.details.fingerprint, "same raw fingerprint must compact deterministically");
assert.equal(longNoticeA.notice.dedupeKey, longNoticeB.notice.dedupeKey, "same semantic event must dedupe deterministically");
assert.notEqual(longNoticeA.notice.details.fingerprint, longNoticeChanged.notice.details.fingerprint, "changed oversized evidence must retain distinct portable identity");
assert.notEqual(longNoticeA.notice.dedupeKey, longNoticeChanged.notice.dedupeKey);

const stableReview = evaluate({
  currentLevel: "review",
  previousLevel: "review",
  currentFingerprint: "same",
  previousFingerprint: "same",
});
assert.equal(stableReview.shouldNotify, false, "stable actionable evidence must not spam every observation");

const changedReview = evaluate({
  currentLevel: "review",
  previousLevel: "review",
  currentFingerprint: "new-evidence",
  previousFingerprint: "old-evidence",
});
assert.equal(changedReview.shouldNotify, true);
assert.equal(changedReview.event, "changed");
assert.match(changedReview.notice?.dedupeKey ?? "", /^mssr-notice-dedupe:sha256:[a-f0-9]{64}$/);

const escalation = evaluate({
  currentLevel: "error",
  previousLevel: "review",
  currentFingerprint: "error-evidence",
  previousFingerprint: "review-evidence",
});
assert.equal(escalation.shouldNotify, true);
assert.equal(escalation.event, "escalated");
assert.equal(escalation.notice?.severity, "error");

const deescalation = evaluate({
  currentLevel: "review",
  previousLevel: "error",
  currentFingerprint: "review-evidence",
  previousFingerprint: "error-evidence",
});
assert.equal(deescalation.shouldNotify, true);
assert.equal(deescalation.event, "deescalated");
assert.equal(deescalation.notice?.severity, "warning");

const resolvedToWatch = evaluate({
  currentLevel: "watch",
  previousLevel: "review",
  currentFingerprint: "watch-evidence",
  previousFingerprint: "review-evidence",
});
assert.equal(resolvedToWatch.shouldNotify, true);
assert.equal(resolvedToWatch.attention, "resolved");
assert.equal(resolvedToWatch.event, "resolved");
assert.equal(resolvedToWatch.notice?.code, "mssr-test-resolved");
assert.equal(resolvedToWatch.notice?.severity, "info");
assert.equal(resolvedToWatch.notice?.message, "Fixture resolved.");
assert.ok(resolvedToWatch.notice);
assert.equal(resolvedToWatch.notice.noticeId, initialReview.notice.noticeId, "resolution must preserve the semantic notice lifecycle identity");
assert.notEqual(resolvedToWatch.notice.dedupeKey, initialReview.notice.dedupeKey, "event/fingerprint-specific dedupe identity must change across lifecycle events");
assert.equal(resolvedToWatch.notice.attentionLevel, "watch");

const watchOptIn = evaluate({
  currentLevel: "watch",
  previousLevel: "ok",
  notifyOnWatch: true,
});
assert.equal(watchOptIn.shouldNotify, true);
assert.equal(watchOptIn.event, "opened");
assert.equal(watchOptIn.notice?.severity, "info");

assert.equal(initialReview.notice?.recommendation, "Review the bounded evidence.");
assert.equal(initialReview.notice?.details.advisoryOnly, true);

const freshContext = evaluateMssrContextFreshnessOperationalAttention(["fresh", "fresh"]);
assert.equal(freshContext.level, "ok");
assert.equal(freshContext.issueCount, 0);
const unknownContext = evaluateMssrContextFreshnessOperationalAttention(["fresh", "unknown"]);
assert.equal(unknownContext.level, "watch");
const staleContext = evaluateMssrContextFreshnessOperationalAttention(["fresh", "stale", "unavailable"]);
assert.equal(staleContext.level, "review");
assert.equal(staleContext.issueCount, 2);
const conflictingContext = evaluateMssrContextFreshnessOperationalAttention(["conflicting"]);
assert.equal(conflictingContext.level, "error");
assert.notEqual(staleContext.fingerprint, conflictingContext.fingerprint);

const lifecycleBase = {
  stage: "implement",
  requiredSkills: [],
  selectedSkills: [],
  loadedSkills: [],
  requiredPhases: ["verification"],
  completedPhases: [],
  routeCount: 1,
  closed: false,
  maintenanceRequired: true,
  lifecycleRevision: 2,
  closeRevision: 0,
  maintenanceRevision: 0,
};
const idleLifecycle = evaluateMssrTraceLifecycleOperationalAttention(lifecycleBase, { idleObserved: true });
assert.equal(idleLifecycle.level, "review");
assert.equal(idleLifecycle.nextRequiredAction, "verify");
const activeLifecycle = evaluateMssrTraceLifecycleOperationalAttention(lifecycleBase, { idleObserved: false });
assert.equal(activeLifecycle.level, "ok", "host activity resolves idle attention without synthesizing an outcome");
const closedLifecycle = evaluateMssrTraceLifecycleOperationalAttention({ ...lifecycleBase, closed: true }, { idleObserved: true });
assert.equal(closedLifecycle.level, "ok");

const reviewAdvisory = {
  level: "review",
  due: true,
  targets: [{
    target: "context",
    level: "review",
    score: 4,
    reasons: ["control-plane-contract-changed"],
    authority: ".mssr/PROJECT_CONTEXT.md",
  }],
  recommendedSkills: ["skill-maintenance-loop"],
  advisoryOnly: true,
  policy: "fixture",
};
const pendingMaintenance = evaluateMssrProjectKnowledgeOperationalAttention(reviewAdvisory, lifecycleBase);
assert.equal(pendingMaintenance.level, "review");
assert.equal(pendingMaintenance.maintenancePending, true);
const freshMaintenance = evaluateMssrProjectKnowledgeOperationalAttention(reviewAdvisory, {
  ...lifecycleBase,
  stage: "close",
  closeRevision: 2,
  maintenanceRevision: 2,
});
assert.equal(freshMaintenance.level, "ok", "review attention resolves after maintenance closes the current lifecycle revision");
const requiredMaintenance = evaluateMssrProjectKnowledgeOperationalAttention({
  ...reviewAdvisory,
  level: "required",
  targets: [{ ...reviewAdvisory.targets[0], level: "required" }],
}, lifecycleBase);
const healthyInfrastructure = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "stable",
  restart: "none",
  transport: "healthy",
});
assert.equal(healthyInfrastructure.level, "ok");
assert.equal(healthyInfrastructure.notifyOnWatch, false);

const responseLostStableRuntime = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "stable",
  restart: "none",
  transport: "response-lost",
});
assert.equal(responseLostStableRuntime.level, "watch", "a lost HTTP response alone must not prove runtime failure");
assert.equal(responseLostStableRuntime.notifyOnWatch, true);
assert.deepEqual(responseLostStableRuntime.reasonCodes, ["transport-response-lost"]);

const responseLostAcrossRestart = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "restarted",
  restart: "none",
  transport: "response-lost",
});
assert.equal(responseLostAcrossRestart.level, "review", "response loss plus independently proven restart deserves review");
assert.equal(responseLostAcrossRestart.reasonCodes.includes("runtime-restarted"), true);

const pendingRestart = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "stable",
  restart: "pending",
});
assert.equal(pendingRestart.level, "review");

const tunnelUnavailable = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "unavailable",
  runtime: "stable",
  restart: "none",
});
assert.equal(tunnelUnavailable.level, "error");

const restartedWithoutTransportLoss = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "restarted",
  restart: "none",
});
assert.equal(restartedWithoutTransportLoss.level, "watch");
assert.equal(restartedWithoutTransportLoss.notifyOnWatch, true);

const stableTransportFingerprint = evaluateMssrInfrastructureOperationalAttention({
  tunnel: "healthy",
  runtime: "stable",
  restart: "none",
  transport: "response-lost",
});
assert.equal(stableTransportFingerprint.fingerprint, responseLostStableRuntime.fingerprint, "volatile host time/PID must not affect portable identity");
assert.notEqual(responseLostAcrossRestart.fingerprint, responseLostStableRuntime.fingerprint);

const infraOpened = evaluateMssrOperationalNoticeTransition({
  subject: "bridge-infrastructure",
  source: "fixture",
  code: "mssr-infrastructure-health",
  resolutionCode: "mssr-infrastructure-health-resolved",
  currentLevel: responseLostAcrossRestart.level,
  previousLevel: healthyInfrastructure.level,
  currentFingerprint: responseLostAcrossRestart.fingerprint,
  previousFingerprint: healthyInfrastructure.fingerprint,
  message: "Review infrastructure evidence.",
  resolutionMessage: "Infrastructure recovered.",
});
assert.equal(infraOpened.event, "opened");
const infraResolved = evaluateMssrOperationalNoticeTransition({
  subject: "bridge-infrastructure",
  source: "fixture",
  code: "mssr-infrastructure-health",
  resolutionCode: "mssr-infrastructure-health-resolved",
  currentLevel: healthyInfrastructure.level,
  previousLevel: responseLostAcrossRestart.level,
  currentFingerprint: healthyInfrastructure.fingerprint,
  previousFingerprint: responseLostAcrossRestart.fingerprint,
  message: "Review infrastructure evidence.",
  resolutionMessage: "Infrastructure recovered.",
});
assert.equal(infraResolved.event, "resolved");

const healthyProvider = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "healthy",
  target: "ready",
});
assert.equal(healthyProvider.level, "ok");

const degradedProvider = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "degraded",
  target: "not-applicable",
});
assert.equal(degradedProvider.level, "review");

const unavailableProvider = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "unavailable",
});
assert.equal(unavailableProvider.level, "error");

const targetMissing = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "healthy",
  target: "missing",
});
assert.equal(targetMissing.level, "review", "missing target must not be misclassified as unavailable provider");
assert.deepEqual(targetMissing.reasonCodes, ["target-missing"]);

const targetAmbiguous = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "healthy",
  target: "ambiguous",
});
assert.equal(targetAmbiguous.level, "review");
assert.notEqual(targetAmbiguous.fingerprint, targetMissing.fingerprint);

const targetInactive = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "healthy",
  target: "inactive",
});
assert.equal(targetInactive.level, "watch");
assert.equal(targetInactive.notifyOnWatch, false, "ordinary target selection debt stays quiet");

const targetWarming = evaluateMssrProviderOperationalAttention({
  providerKey: "roblox-studio-mcp",
  provider: "healthy",
  target: "warming",
});
assert.equal(targetWarming.level, "watch");
assert.equal(targetWarming.notifyOnWatch, false);
assert.equal(requiredMaintenance.level, "error");

console.log("MSSR operational notice transition tests PASS");
