import assert from "node:assert/strict";

import {
  CapabilityRegistry,
  CodexMssrAdapter,
  OpenCodeMssrAdapter,
  deliverMssrNoticeV1,
  evaluateMssrOperationalNoticeTransition,
  hasSameMssrNoticeV1Semantics,
  mssrNoticeV1Schema,
  serializeMssrNoticeV1,
} from "../dist/index.js";

const decision = evaluateMssrOperationalNoticeTransition({
  subject: "project:gate-e4-fixture",
  source: "mssr-gate-e4-fixture",
  code: "mssr-gate-e4-review",
  resolutionCode: "mssr-gate-e4-resolved",
  previousLevel: "ok",
  currentLevel: "review",
  previousFingerprint: "old",
  currentFingerprint: "new",
  message: "Gate E4 fixture requires direct-host attention.",
  recommendation: "Inspect bounded evidence before acting.",
});

assert.ok(decision.notice, "fixture must produce one portable MssrNotice");
const original = decision.notice;
const semanticJson = serializeMssrNoticeV1(original);

const nativeResult = await deliverMssrNoticeV1(original, async (notice) => {
  assert.equal(serializeMssrNoticeV1(notice), semanticJson);
  notice.message = "host attempted mutation";
  return {
    host: "native-mssr",
    boundary: "embedded-api",
    deliveredAt: "2026-08-18T03:00:00.000Z",
  };
});

const cliResult = await deliverMssrNoticeV1(original, (notice) => ({
  host: "cli-style",
  boundary: "stderr",
  printedAt: "2026-08-18T03:00:01.000Z",
  bytes: Buffer.byteLength(JSON.stringify(notice), "utf8"),
}));

const emptyRegistry = (id) => new CapabilityRegistry([{
  id,
  async refresh() {
    return { capabilities: [] };
  },
}]);

const codex = new CodexMssrAdapter(emptyRegistry("gate-e4-codex"), {
  noticeDelivery: async (notice) => ({
    host: "codex-local",
    boundary: "host-callback",
    callId: "codex-call-17",
    deliveredAt: "2026-08-18T03:00:02.000Z",
    semantic: serializeMssrNoticeV1(notice),
  }),
});
await codex.initialize();
const codexResult = await codex.deliverNotice(original);

const opencode = new OpenCodeMssrAdapter(emptyRegistry("gate-e4-opencode"), {
  noticeDelivery: (notice) => ({
    host: "opencode-local",
    boundary: "plugin-callback",
    sessionId: "oc-session-9",
    attempts: 1,
    semantic: serializeMssrNoticeV1(notice),
  }),
});
await opencode.initialize();
const opencodeResult = await opencode.deliverNotice(original);

const deliveries = [nativeResult, cliResult, codexResult, opencodeResult];
for (const delivery of deliveries) {
  assert.equal(delivery.advisoryOnly, true);
  assert.equal(mssrNoticeV1Schema.safeParse(delivery.notice).success, true);
  assert.equal(serializeMssrNoticeV1(delivery.notice), semanticJson);
  assert.equal(hasSameMssrNoticeV1Semantics(original, delivery.notice), true);
  assert.equal("queue" in delivery.notice, false);
  assert.equal("ttl" in delivery.notice, false);
  assert.equal("attempts" in delivery.notice, false);
  assert.equal("deliveredAt" in delivery.notice, false);
  assert.equal("receipt" in delivery.notice, false);
}

assert.equal(nativeResult.receipt.host, "native-mssr");
assert.equal(cliResult.receipt.boundary, "stderr");
assert.equal(codexResult.receipt.callId, "codex-call-17");
assert.equal(opencodeResult.receipt.attempts, 1);
assert.notDeepEqual(nativeResult.receipt, cliResult.receipt);
assert.notDeepEqual(codexResult.receipt, opencodeResult.receipt);

// Host delivery metadata may differ freely, but none of those wrappers is MSSR semantics.
for (const delivery of deliveries) {
  assert.equal(mssrNoticeV1Schema.safeParse(delivery).success, false);
}

// Mutation inside a host callback must not mutate the original or returned portable notice.
assert.equal(original.message, "Gate E4 fixture requires direct-host attention.");
assert.equal(nativeResult.notice.message, original.message);

// An adapter without an explicit host boundary must fail closed rather than invent transport.
const unconfigured = new CodexMssrAdapter(emptyRegistry("gate-e4-unconfigured"));
await assert.rejects(
  () => unconfigured.deliverNotice(original),
  /delivery boundary is not configured/,
);

// A host transport failure stays a delivery failure; MSSR does not retry or reinterpret it.
let attempts = 0;
await assert.rejects(
  () => deliverMssrNoticeV1(original, () => {
    attempts += 1;
    throw new Error("host transport unavailable");
  }),
  /host transport unavailable/,
);
assert.equal(attempts, 1, "portable MSSR must not add retry policy");

console.log("MSSR Operational Notice Gate E4 direct-host delivery parity: PASS");
