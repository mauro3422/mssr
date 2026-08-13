import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acknowledgeProjectContextInbox,
  loadProjectContextHost,
  mssrContextMessageSchema,
  structuredSkillIntentSchema,
} from "../dist/index.js";

const intent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["review"],
  artifacts: ["code"],
  needs: ["unit-tests"],
  signals: ["nominal"],
  risk: "read-only",
});

const message = (overrides = {}) => mssrContextMessageSchema.parse({
  id: "host-msg",
  kind: "architecture-decision",
  title: "Host decision",
  summary: "Advisory host message.",
  evidence: [{
    kind: "architecture-decision",
    ref: "adr-host",
    summary: "Host evidence.",
    canonicalOwner: "host-fixture",
    provenance: "project",
    freshness: "fresh",
    revision: "rev-1",
  }],
  advisoryActions: ["load-context"],
  domains: ["coding"],
  actions: ["review"],
  dedupeKey: "host-dedupe",
  ...overrides,
});

const stage = "verify";
const now = "2026-08-13T12:00:00.000Z";
const later = "2026-08-13T12:00:10.000Z";

const root = await mkdtemp(join(tmpdir(), "mssr-plane-host-"));
try {
  await mkdir(join(root, ".bridge"), { recursive: true });

  // --- First delivery, then explicit ack persists ---

  const first = await loadProjectContextHost({ projectRoot: root, intent, stage, now, contextMessages: [message()] });
  assert.deepEqual(first.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.equal(first.advisoryOnly, true);
  const ack = await acknowledgeProjectContextInbox({ projectRoot: root, messageIds: ["host-msg"], now });
  assert.equal(ack.advisoryOnly, true);
  assert.deepEqual(ack.acknowledged, ["host-msg"]);
  assert.deepEqual(ack.unknown, []);
  assert.equal(ack.saved, true);

  // --- Acknowledged receipt suppresses the identical message ---

  const identical = await loadProjectContextHost({ projectRoot: root, intent, stage, now, contextMessages: [message()] });
  assert.deepEqual(identical.contextMessages.selected.map((item) => item.id), []);
  assert.deepEqual(identical.inbox.deduplicated, ["host-msg"]);
  assert.deepEqual(identical.inbox.enqueued, []);

  // --- A content/revision change reappears after ack ---

  const changed = await loadProjectContextHost({
    projectRoot: root,
    intent,
    stage,
    now,
    contextMessages: [message({
      summary: "Revised host message.",
      evidence: [{
        kind: "architecture-decision",
        ref: "adr-host",
        summary: "Revised evidence.",
        canonicalOwner: "host-fixture",
        provenance: "project",
        freshness: "fresh",
        revision: "rev-2",
      }],
    })],
  });
  assert.deepEqual(changed.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.deepEqual(changed.inbox.enqueued, ["host-msg"]);
  assert.deepEqual(changed.inbox.deduplicated, []);
  const ackChanged = await acknowledgeProjectContextInbox({ projectRoot: root, messageIds: ["host-msg"], now });
  assert.deepEqual(ackChanged.acknowledged, ["host-msg"]);

  // --- Retention cleanup prunes the tombstone and identical content reappears ---

  const retentionConfig = {
    receiptRetentionMs: 0,
    messageTtlMs: 1_000_000,
    deliveryTtlMs: 1_000_000,
  };
  const afterRetention = await loadProjectContextHost({
    projectRoot: root,
    intent,
    stage,
    now: later,
    inboxConfig: retentionConfig,
    contextMessages: [message()],
  });
  assert.deepEqual(afterRetention.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.deepEqual(afterRetention.inbox.enqueued, ["host-msg"]);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("context plane host tests passed");
