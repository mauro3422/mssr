import assert from "node:assert/strict";

import { evaluateMssrLifecycleActivation } from "../dist/lifecycle-activation.js";

function decide(overrides = {}) {
  return evaluateMssrLifecycleActivation({
    effect: "read",
    scale: "trivial",
    trace: "none",
    route: "none",
    projectScoped: true,
    phaseBoundary: false,
    ...overrides,
  });
}

const trivialRead = decide();
assert.equal(trivialRead.mode, "lightweight");
assert.equal(trivialRead.lifecycleRequired, false);
assert.equal(trivialRead.projectContextRequired, false);
assert.equal(trivialRead.action, "none");
assert.deepEqual(trivialRead.reasonCodes, ["lightweight-operation"]);

const trivialReadInsideTrace = decide({ trace: "compatible", route: "present" });
assert.equal(trivialReadInsideTrace.mode, "lightweight");
assert.equal(trivialReadInsideTrace.action, "inherit-active-trace");
assert.equal(trivialReadInsideTrace.lifecycleRequired, false);

const substantialRead = decide({ scale: "substantial" });
assert.equal(substantialRead.mode, "managed");
assert.equal(substantialRead.lifecycleRequired, true);
assert.equal(substantialRead.projectContextRequired, true);
assert.equal(substantialRead.action, "ensure-trace-and-route");
assert.deepEqual(substantialRead.reasonCodes, ["managed-trace-missing", "substantial-operation"]);

const mutationUnknownScale = decide({ effect: "mutate", scale: "unknown" });
assert.equal(mutationUnknownScale.mode, "managed");
assert.equal(mutationUnknownScale.lifecycleRequired, true);
assert.equal(mutationUnknownScale.action, "ensure-trace-and-route");
assert.deepEqual(mutationUnknownScale.reasonCodes, ["managed-trace-missing", "side-effectful-operation"]);

const verifyExistingTraceWithoutRoute = decide({
  effect: "verify",
  scale: "substantial",
  trace: "compatible",
  route: "none",
});
assert.equal(verifyExistingTraceWithoutRoute.mode, "managed");
assert.equal(verifyExistingTraceWithoutRoute.action, "ensure-route");
assert.deepEqual(verifyExistingTraceWithoutRoute.reasonCodes, ["managed-route-missing", "substantial-operation"]);

const managedExistingRoute = decide({
  effect: "execute",
  scale: "substantial",
  trace: "compatible",
  route: "present",
});
assert.equal(managedExistingRoute.mode, "managed");
assert.equal(managedExistingRoute.action, "continue-managed-route");

const phaseBoundary = decide({
  effect: "verify",
  scale: "trivial",
  trace: "compatible",
  route: "present",
  phaseBoundary: true,
});
assert.equal(phaseBoundary.mode, "managed");
assert.equal(phaseBoundary.action, "replan-managed-route");
assert.deepEqual(phaseBoundary.reasonCodes, ["managed-route-replan", "phase-boundary"]);

const controlPlane = decide({
  effect: "control-plane",
  scale: "substantial",
  trace: "none",
  route: "none",
  phaseBoundary: true,
});
assert.equal(controlPlane.mode, "lightweight", "control-plane calls must not recursively bootstrap lifecycle");
assert.equal(controlPlane.lifecycleRequired, false);
assert.equal(controlPlane.action, "none");
assert.deepEqual(controlPlane.reasonCodes, ["control-plane-exempt"]);

const ambiguousTrace = decide({
  effect: "mutate",
  scale: "trivial",
  trace: "ambiguous",
});
assert.equal(ambiguousTrace.mode, "review");
assert.equal(ambiguousTrace.lifecycleRequired, true);
assert.equal(ambiguousTrace.action, "inspect-traces");
assert.ok(ambiguousTrace.reasonCodes.includes("trace-ambiguous"));

const mismatchedTrace = decide({
  effect: "publish",
  scale: "trivial",
  trace: "mismatch",
});
assert.equal(mismatchedTrace.mode, "review");
assert.equal(mismatchedTrace.action, "inspect-traces");
assert.ok(mismatchedTrace.reasonCodes.includes("trace-owner-mismatch"));

const unknownTrace = decide({
  effect: "execute",
  scale: "substantial",
  trace: "unknown",
});
assert.equal(unknownTrace.mode, "review");
assert.equal(unknownTrace.action, "inspect-traces");
assert.ok(unknownTrace.reasonCodes.includes("trace-state-unknown"));

const inconsistentRoute = decide({
  effect: "read",
  scale: "trivial",
  trace: "none",
  route: "present",
});
assert.equal(inconsistentRoute.mode, "review");
assert.equal(inconsistentRoute.action, "inspect-traces");
assert.deepEqual(inconsistentRoute.reasonCodes, ["route-without-compatible-trace"]);

const unknownSemantics = decide({ effect: "unknown", scale: "unknown" });
assert.equal(unknownSemantics.mode, "review");
assert.equal(unknownSemantics.lifecycleRequired, false, "unknown semantics must abstain rather than create noisy lifecycle");
assert.equal(unknownSemantics.action, "none");
assert.deepEqual(unknownSemantics.reasonCodes, ["operation-semantics-unknown"]);

const nonProjectMutation = decide({ effect: "external-side-effect", scale: "trivial", projectScoped: false });
assert.equal(nonProjectMutation.mode, "managed");
assert.equal(nonProjectMutation.lifecycleRequired, true);
assert.equal(nonProjectMutation.projectContextRequired, false, "managed work need not fabricate Project Context when the host says it is not project-scoped");

const deterministicA = decide({ effect: "mutate", scale: "unknown", trace: "compatible", route: "present" });
const deterministicB = decide({ effect: "mutate", scale: "unknown", trace: "compatible", route: "present" });
assert.equal(deterministicA.fingerprint, deterministicB.fingerprint);
assert.equal(deterministicA.advisoryOnly, true);
assert.equal(deterministicA.automaticMutationAllowed, false);

console.log("MSSR automatic lifecycle activation policy: PASS");
