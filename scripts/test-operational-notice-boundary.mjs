import assert from "node:assert/strict";

import {
  evaluateMssrOperationalNoticeTransition,
  hasSameMssrNoticeV1Semantics,
  mssrNoticeV1Schema,
  serializeMssrNoticeV1,
} from "../dist/index.js";

const decision = evaluateMssrOperationalNoticeTransition({
  subject: "project:alpha",
  source: "project-health",
  code: "mssr-project-review",
  previousLevel: "ok",
  currentLevel: "review",
  previousFingerprint: "old",
  currentFingerprint: "new",
  message: "Project evidence requires review.",
  recommendation: "Inspect bounded evidence before acting.",
});

assert.ok(decision.notice, "fixture must emit a portable notice");
const notice = decision.notice;
const semanticJson = serializeMssrNoticeV1(notice);

// Host delivery envelopes may differ arbitrarily without becoming MSSR semantics.
const hostEnvelopes = [
  {
    host: "bridge-like",
    notice,
    queueId: "bridge-q-17",
    queuedAt: "2026-08-17T18:00:00.000Z",
    expiresAt: "2026-08-17T18:30:00.000Z",
    occurrences: 3,
  },
  {
    host: "cli-like",
    notice: structuredClone(notice),
    printedAt: "2026-08-17T18:00:01.000Z",
    stream: "stderr",
  },
  {
    host: "opencode-like",
    notice: JSON.parse(JSON.stringify(notice)),
    attempts: 2,
    deliveryState: "deferred",
  },
];

for (const envelope of hostEnvelopes) {
  assert.equal(serializeMssrNoticeV1(envelope.notice), semanticJson, `${envelope.host} changed portable notice semantics`);
  assert.equal(hasSameMssrNoticeV1Semantics(notice, envelope.notice), true, `${envelope.host} must preserve semantic parity`);
  assert.equal(mssrNoticeV1Schema.safeParse(envelope).success, false, `${envelope.host} delivery envelope must not parse as MssrNotice`);
}

const deliveryFields = {
  queue: "pending",
  queueId: "q-1",
  ttl: 30_000,
  ttlMs: 30_000,
  attempts: 1,
  queuedAt: "2026-08-17T18:00:00.000Z",
  createdAt: "2026-08-17T18:00:00.000Z",
  updatedAt: "2026-08-17T18:00:00.000Z",
  deliveredAt: "2026-08-17T18:00:02.000Z",
  expiresAt: "2026-08-17T18:30:00.000Z",
  history: [],
  ui: { badge: "warning" },
  actions: [{ label: "Run", command: "unsafe" }],
};

for (const [field, value] of Object.entries(deliveryFields)) {
  assert.equal(
    mssrNoticeV1Schema.safeParse({ ...notice, [field]: value }).success,
    false,
    `delivery field ${field} leaked into MssrNotice v1`,
  );
}

assert.equal(
  mssrNoticeV1Schema.safeParse({
    ...notice,
    details: { ...notice.details, queuedAt: "2026-08-17T18:00:00.000Z" },
  }).success,
  false,
  "delivery metadata must also be rejected inside semantic details",
);

const reorderedNotice = {
  advisoryOnly: notice.advisoryOnly,
  details: {
    advisoryOnly: notice.details.advisoryOnly,
    fingerprint: notice.details.fingerprint,
    currentLevel: notice.details.currentLevel,
    previousLevel: notice.details.previousLevel,
    event: notice.details.event,
  },
  dedupeKey: notice.dedupeKey,
  recommendation: notice.recommendation,
  message: notice.message,
  subject: notice.subject,
  source: notice.source,
  code: notice.code,
  severity: notice.severity,
  attentionLevel: notice.attentionLevel,
  origin: notice.origin,
  kind: notice.kind,
  noticeId: notice.noticeId,
  schemaVersion: notice.schemaVersion,
};
assert.equal(serializeMssrNoticeV1(reorderedNotice), semanticJson, "semantic serialization must canonicalize schema field order");
assert.equal(hasSameMssrNoticeV1Semantics(notice, reorderedNotice), true);

const changedDeliveryOnly = {
  ...hostEnvelopes[0],
  queueId: "bridge-q-99",
  occurrences: 99,
  expiresAt: "2026-08-17T19:00:00.000Z",
};
assert.equal(serializeMssrNoticeV1(changedDeliveryOnly.notice), semanticJson);
assert.equal(hasSameMssrNoticeV1Semantics(hostEnvelopes[0].notice, changedDeliveryOnly.notice), true);

const changedSemantic = { ...notice, message: `${notice.message} Updated.` };
assert.notEqual(serializeMssrNoticeV1(changedSemantic), semanticJson, "semantic changes must remain observable");
assert.equal(hasSameMssrNoticeV1Semantics(notice, changedSemantic), false);

console.log("MSSR Operational Notice Gate E2 semantic/delivery boundary: PASS");
