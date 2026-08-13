import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MSSR_CONTEXT_INBOX_SCHEMA_VERSION,
  acknowledgeMssrContextMessages,
  createEmptyMssrContextInboxState,
  enqueueMssrContextMessages,
  loadMssrContextInboxStateFromFile,
  mssrContextInboxActionSchema,
  mssrContextInboxConfigSchema,
  mssrContextInboxStateSchema,
  mssrContextMessageSchema,
  pruneMssrContextInbox,
  reduceMssrContextInbox,
  saveMssrContextInboxStateToFile,
  selectMssrContextInboxMessages,
  structuredSkillIntentSchema,
} from "../dist/index.js";

const message = (overrides = {}) => mssrContextMessageSchema.parse({
  id: "inbox-msg",
  kind: "architecture-decision",
  title: "Inbox message",
  summary: "A bounded context message for the inbox.",
  evidence: [{ kind: "architecture-decision", ref: "adr-inbox", summary: "Inbox evidence.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "abc123" }],
  advisoryActions: ["load-context"],
  domains: ["skill-system"],
  actions: ["edit"],
  dedupeKey: "inbox-dedupe",
  ...overrides,
});

const intent = structuredSkillIntentSchema.parse({
  domains: ["skill-system"],
  actions: ["edit"],
  artifacts: ["code"],
  needs: ["unit-tests"],
  signals: ["nominal"],
  risk: "write",
});

// --- Empty state is schema-versioned and advisory-only ---

const empty = createEmptyMssrContextInboxState();
assert.equal(empty.schemaVersion, MSSR_CONTEXT_INBOX_SCHEMA_VERSION);
assert.equal(empty.advisoryOnly, true);
assert.deepEqual(empty.pending, []);
assert.deepEqual(empty.deliveries, []);
assert.equal(mssrContextInboxStateSchema.safeParse(empty).success, true);

// --- State schema is strict and fail-closed ---

assert.equal(mssrContextInboxStateSchema.safeParse({ ...empty, schemaVersion: 99 }).success, false);
assert.equal(mssrContextInboxStateSchema.safeParse({ ...empty, advisoryOnly: false }).success, false);
assert.equal(mssrContextInboxStateSchema.safeParse({ ...empty, secret: "raw" }).success, false);
const tooMany = Array.from({ length: 33 }, (_, index) => ({
  message: message({ id: `pending-${index}`, dedupeKey: `pending-key-${index}` }),
  enqueuedAt: "2026-08-13T12:00:00.000Z",
}));
assert.equal(mssrContextInboxStateSchema.safeParse({ ...empty, pending: tooMany }).success, false);

// --- Enqueue appends, dedupes deterministically, and reports overflow ---

const now = "2026-08-13T12:00:00.000Z";
const enqueuedResult = enqueueMssrContextMessages(empty, [
  message({ id: "one", dedupeKey: "key-a" }),
  message({ id: "two", dedupeKey: "key-b" }),
], now);
assert.deepEqual(enqueuedResult.enqueued, ["one", "two"]);
assert.equal(enqueuedResult.state.pending.length, 2);

const dedupeBatch = enqueueMssrContextMessages(empty, [
  message({ id: "first", dedupeKey: "same-key" }),
  message({ id: "second", dedupeKey: "same-key" }),
  message({ id: "third", dedupeKey: "third-key" }),
], now);
assert.deepEqual(dedupeBatch.enqueued, ["first", "third"]);
assert.deepEqual(dedupeBatch.deduplicated, ["second"]);
assert.deepEqual(dedupeBatch.state.pending.map((entry) => entry.message.id), ["first", "third"]);

const dedupePending = enqueueMssrContextMessages(enqueuedResult.state, [
  message({ id: "one-new", dedupeKey: "key-a" }),
  message({ id: "three", dedupeKey: "key-c" }),
], now);
assert.deepEqual(dedupePending.deduplicated, ["one-new"]);
assert.deepEqual(dedupePending.enqueued, ["three"]);
assert.equal(dedupePending.state.pending.length, 3);

// --- Enqueue is bounded at 32 pending with deterministic arrival order ---

const firstThirtyTwo = Array.from({ length: 32 }, (_, index) => message({
  id: `many-${index}`,
  dedupeKey: `many-key-${index}`,
}));
const bounded = enqueueMssrContextMessages(empty, firstThirtyTwo, now);
assert.equal(bounded.state.pending.length, 32);
const boundedOverflow = enqueueMssrContextMessages(bounded.state, [
  message({ id: "many-32", dedupeKey: "many-key-32" }),
  message({ id: "many-33", dedupeKey: "many-key-33" }),
], now);
assert.deepEqual(boundedOverflow.overflow, ["many-32", "many-33"]);
assert.equal(boundedOverflow.state.pending.length, 32);

// --- Select uses selectMssrContextMessages and records bounded receipts ---

const ready = enqueueMssrContextMessages(empty, [
  message({ id: "sel-a", dedupeKey: "sel-a-key", required: true, continuation: {
    traceId: "trace-inbox",
    freshness: "unknown",
    currentStage: "implement",
    nextGate: "Verify the inbox.",
    summary: "Inbox continuation.",
  } }),
  message({ id: "sel-b", dedupeKey: "sel-b-key" }),
  message({ id: "unrelated", dedupeKey: "unrelated-key", domains: ["godot"], actions: ["review"] }),
], now);
const selected = selectMssrContextInboxMessages(ready.state, { now, intent, stage: "implement" });
assert.deepEqual(selected.selection.selected.map((item) => item.id), ["sel-a", "sel-b"]);
assert.equal(selected.selection.advisoryOnly, true);
assert.deepEqual(selected.selection.decisions.find((item) => item.id === "unrelated")?.reason, "intent-mismatch");
assert.equal(selected.state.pending.length, 3);
assert.equal(selected.state.pending.some((entry) => entry.message.id === "sel-a"), true);

const receipt = selected.state.deliveries.find((item) => item.messageId === "sel-a");
assert.equal(receipt?.messageKind, "architecture-decision");
assert.equal(receipt?.selectedCount, 1);
assert.equal(receipt?.traceId, "trace-inbox");
assert.equal(receipt?.nextGate, "Verify the inbox.");
assert.equal(receipt?.sources[0]?.ref, "adr-inbox");
assert.equal(receipt?.acknowledgedAt, undefined);
assert.equal(receipt?.sources.some((source) => "prompt" in source), false);

// --- Re-selection updates the receipt but keeps the message pending ---

const reselect = selectMssrContextInboxMessages(selected.state, { now, intent, stage: "implement" });
const reselectReceipt = reselect.state.deliveries.find((item) => item.messageId === "sel-a");
assert.equal(reselectReceipt?.selectedCount, 2);
assert.equal(reselectReceipt?.lastSelectedAt, now);
assert.equal(reselect.state.pending.length, 3);

// --- maxDeliveries 0 records nothing but still returns the full advisory selection ---

const zeroCapConfig = mssrContextInboxConfigSchema.parse({ maxDeliveries: 0 });
const zeroReady = enqueueMssrContextMessages(empty, [
  message({ id: "zero-a", dedupeKey: "zero-a-key" }),
  message({ id: "zero-b", dedupeKey: "zero-b-key" }),
], now);
const zeroSelect = selectMssrContextInboxMessages(zeroReady.state, { now, intent, stage: "implement" }, zeroCapConfig);
assert.deepEqual(zeroSelect.selection.selected.map((item) => item.id), ["zero-a", "zero-b"]);
assert.equal(zeroSelect.selection.advisoryOnly, true);
assert.equal(zeroSelect.state.deliveries.length, 0);
assert.deepEqual(zeroSelect.receiptOverflow, ["zero-a", "zero-b"]);
assert.equal(zeroSelect.state.pending.length, 2);

// --- Saturated unacknowledged receipts refuse new receipts without deleting live proof ---

const saturatedConfig = mssrContextInboxConfigSchema.parse({ maxDeliveries: 2 });
const saturated = enqueueMssrContextMessages(empty, [
  message({ id: "sat-a", dedupeKey: "sat-a-key" }),
  message({ id: "sat-b", dedupeKey: "sat-b-key" }),
  message({ id: "sat-c", dedupeKey: "sat-c-key" }),
  message({ id: "sat-d", dedupeKey: "sat-d-key" }),
], now);
const firstSelect = selectMssrContextInboxMessages(saturated.state, { now, intent, stage: "implement" }, saturatedConfig);
assert.equal(firstSelect.state.deliveries.length, 2);
assert.deepEqual(firstSelect.state.deliveries.map((item) => item.messageId), ["sat-a", "sat-b"]);
assert.deepEqual(firstSelect.receiptOverflow, ["sat-c", "sat-d"]);

const secondSelect = selectMssrContextInboxMessages(firstSelect.state, { now, intent, stage: "implement" }, saturatedConfig);
assert.equal(secondSelect.state.deliveries.length, 2);
assert.deepEqual(secondSelect.state.deliveries.map((item) => item.messageId), ["sat-a", "sat-b"]);
assert.equal(secondSelect.state.deliveries.find((item) => item.messageId === "sat-a")?.selectedCount, 2);
assert.deepEqual(secondSelect.receiptOverflow, ["sat-c", "sat-d"]);

const legacyCapConfig = mssrContextInboxConfigSchema.parse({ maxDeliveries: 64 });
const legacySelect = selectMssrContextInboxMessages(saturated.state, { now, intent, stage: "implement" }, legacyCapConfig);
assert.equal(legacySelect.state.deliveries.length, 4);
assert.deepEqual(legacySelect.receiptOverflow, []);

const shrinkSelect = selectMssrContextInboxMessages(legacySelect.state, { now, intent, stage: "implement" }, saturatedConfig);
assert.equal(shrinkSelect.state.deliveries.length, 4);
assert.deepEqual(shrinkSelect.state.deliveries.map((item) => item.messageId), ["sat-a", "sat-b", "sat-c", "sat-d"]);
assert.deepEqual(shrinkSelect.receiptOverflow, []);

const ackSaturated = acknowledgeMssrContextMessages(legacySelect.state, ["sat-a", "sat-b"], now, saturatedConfig);
assert.deepEqual(ackSaturated.acknowledged, ["sat-a", "sat-b"]);
assert.deepEqual(ackSaturated.state.deliveries.map((item) => item.messageId), ["sat-c", "sat-d"]);

// --- Acknowledge only affects known delivered, unacknowledged ids ---

const ack = acknowledgeMssrContextMessages(reselect.state, ["sel-a", "unknown-id"], now);
assert.deepEqual(ack.acknowledged, ["sel-a"]);
assert.deepEqual(ack.unknown, ["unknown-id"]);
assert.equal(ack.state.pending.some((entry) => entry.message.id === "sel-a"), false);
assert.equal(ack.state.deliveries.find((item) => item.messageId === "sel-a")?.acknowledgedAt, now);
assert.equal(ack.state.pending.length, 2);

const ackAgain = acknowledgeMssrContextMessages(ack.state, ["sel-a"], now);
assert.deepEqual(ackAgain.acknowledged, []);
assert.deepEqual(ackAgain.unknown, ["sel-a"]);

const neverDelivered = acknowledgeMssrContextMessages(empty, ["never-delivered"], now);
assert.deepEqual(neverDelivered.acknowledged, []);
assert.deepEqual(neverDelivered.unknown, ["never-delivered"]);
assert.equal(neverDelivered.state.pending.length, 0);

// --- Acknowledged receipt is a temporary tombstone for identical content ---

const tombEnqueued = enqueueMssrContextMessages(empty, [
  message({ id: "tomb-a", dedupeKey: "tomb-a-key" }),
], now);
const tombSelected = selectMssrContextInboxMessages(tombEnqueued.state, { now, intent, stage: "implement" });
const tombAcked = acknowledgeMssrContextMessages(tombSelected.state, ["tomb-a"], now);
const tombReceipt = tombAcked.state.deliveries.find((item) => item.messageId === "tomb-a");
assert.equal(tombReceipt?.acknowledgedAt, now);
assert.match(tombReceipt?.fingerprint ?? "", /^[a-f0-9]{64}$/);

const reEnqueueIdentical = enqueueMssrContextMessages(tombAcked.state, [
  message({ id: "tomb-a", dedupeKey: "tomb-a-key" }),
], now);
assert.deepEqual(reEnqueueIdentical.deduplicated, ["tomb-a"]);
assert.deepEqual(reEnqueueIdentical.enqueued, []);
assert.equal(reEnqueueIdentical.state.pending.length, 0);

// --- Same id with changed revision/content reappears after ack ---

const reEnqueueChanged = enqueueMssrContextMessages(tombAcked.state, [
  message({
    id: "tomb-a",
    dedupeKey: "tomb-a-key",
    summary: "Revised summary after ack.",
    evidence: [{
      kind: "architecture-decision",
      ref: "adr-inbox",
      summary: "Revised evidence.",
      canonicalOwner: "mssr",
      provenance: "project",
      freshness: "fresh",
      revision: "rev-2",
    }],
  }),
], now);
assert.deepEqual(reEnqueueChanged.enqueued, ["tomb-a"]);
assert.deepEqual(reEnqueueChanged.deduplicated, []);
assert.equal(reEnqueueChanged.state.pending.length, 1);
assert.equal(reEnqueueChanged.state.pending[0]?.message.summary, "Revised summary after ack.");

// --- Same content under a different id reappears after ack ---

const reEnqueueNewId = enqueueMssrContextMessages(tombAcked.state, [
  message({ id: "tomb-a-2", dedupeKey: "tomb-a-2-key" }),
], now);
assert.deepEqual(reEnqueueNewId.enqueued, ["tomb-a-2"]);
assert.equal(reEnqueueNewId.state.pending.length, 1);

// --- Retention cleanup lets identical content be delivered again ---

const retentionConfig = mssrContextInboxConfigSchema.parse({ receiptRetentionMs: 0 });
const retentionEnqueued = enqueueMssrContextMessages(empty, [
  message({ id: "ret-a", dedupeKey: "ret-a-key" }),
], now, retentionConfig);
const retentionSelected = selectMssrContextInboxMessages(retentionEnqueued.state, { now, intent, stage: "implement" }, retentionConfig);
const retentionAcked = acknowledgeMssrContextMessages(retentionSelected.state, ["ret-a"], now, retentionConfig);
const retentionPruned = pruneMssrContextInbox(retentionAcked.state, "2026-08-13T12:00:02.000Z", retentionConfig);
assert.deepEqual(retentionPruned.prunedReceiptIds, ["ret-a"]);
const reDeliverIdentical = enqueueMssrContextMessages(retentionPruned.state, [
  message({ id: "ret-a", dedupeKey: "ret-a-key" }),
], now, retentionConfig);
assert.deepEqual(reDeliverIdentical.enqueued, ["ret-a"]);
assert.deepEqual(reDeliverIdentical.deduplicated, []);

// --- Pruning is deterministic for acknowledged/expired entries with a supplied now ---

const ttlConfig = mssrContextInboxConfigSchema.parse({
  messageTtlMs: 1000,
  deliveryTtlMs: 1000,
  receiptRetentionMs: 1000,
});
const older = "2026-08-13T12:00:00.000Z";
const later = "2026-08-13T12:00:02.000Z";
const toPrune = enqueueMssrContextMessages(empty, [
  message({ id: "expired-pending", dedupeKey: "expired-pending-key" }),
  message({ id: "stays-pending", dedupeKey: "stays-pending-key" }),
], older, ttlConfig);
const delivered = selectMssrContextInboxMessages(toPrune.state, { now: older, intent, stage: "implement" }, ttlConfig);
const acked = acknowledgeMssrContextMessages(delivered.state, ["expired-pending"], older, ttlConfig);
const pruned = pruneMssrContextInbox(acked.state, later, ttlConfig);
assert.deepEqual(pruned.prunedMessageIds, ["stays-pending"]);
assert.deepEqual(pruned.prunedReceiptIds, ["expired-pending", "stays-pending"]);
assert.equal(pruned.state.pending.length, 0);
assert.equal(pruned.state.deliveries.length, 0);

const sameNowPruned = pruneMssrContextInbox(acked.state, later, ttlConfig);
assert.deepEqual(sameNowPruned.state, pruned.state);

const unexpiredPrune = pruneMssrContextInbox(acked.state, older, ttlConfig);
assert.equal(unexpiredPrune.state.pending.length, 1);
assert.equal(unexpiredPrune.state.pending[0]?.message.id, "stays-pending");
assert.equal(unexpiredPrune.state.deliveries.length, 2);

// --- Reducer dispatches strict discriminated actions and preserves advisoryOnly ---

const reduceEnqueued = reduceMssrContextInbox(empty, {
  type: "enqueue",
  now,
  messages: [message({ id: "red-a", dedupeKey: "red-a-key" })],
});
assert.equal(reduceEnqueued.type, "enqueue");
assert.equal(reduceEnqueued.enqueued[0], "red-a");
assert.equal(reduceEnqueued.state.advisoryOnly, true);

const reduceSelected = reduceMssrContextInbox(reduceEnqueued.state, {
  type: "select",
  now,
  intent,
  stage: "implement",
});
assert.equal(reduceSelected.type, "select");
assert.equal(reduceSelected.selection.advisoryOnly, true);
assert.equal(reduceSelected.selection.selected[0]?.id, "red-a");
assert.equal(reduceSelected.state.advisoryOnly, true);
assert.deepEqual(reduceSelected.receiptOverflow, []);

const reduceOverflowed = reduceMssrContextInbox(saturated.state, {
  type: "select",
  now,
  intent,
  stage: "implement",
}, saturatedConfig);
assert.equal(reduceOverflowed.type, "select");
assert.deepEqual(reduceOverflowed.receiptOverflow, ["sat-c", "sat-d"]);

const reduceAcked = reduceMssrContextInbox(reduceSelected.state, {
  type: "acknowledge",
  now,
  messageIds: ["red-a"],
});
assert.equal(reduceAcked.type, "acknowledge");
assert.deepEqual(reduceAcked.acknowledged, ["red-a"]);
assert.equal(reduceAcked.state.advisoryOnly, true);

const reducePruned = reduceMssrContextInbox(reduceAcked.state, { type: "prune", now }, ttlConfig);
assert.equal(reducePruned.type, "prune");
assert.equal(reducePruned.state.advisoryOnly, true);

assert.equal(mssrContextInboxActionSchema.safeParse({ type: "explode" }).success, false);
assert.equal(mssrContextInboxActionSchema.safeParse({
  type: "enqueue",
  now,
  messages: [{
    id: "bad-extra",
    kind: "architecture-decision",
    title: "Bad",
    summary: "Strict schema rejects raw payload fields.",
    dedupeKey: "bad-extra-key",
    secret: "raw",
  }],
}).success, false);

// --- Persistence proposal messages are stored but never executed ---

const proposalMessage = message({
  id: "proposal-msg",
  dedupeKey: "proposal-key",
  kind: "persistence-proposal",
  persistenceProposal: {
    target: "incident",
    summary: "Proposed incident ledger update, never an automatic write.",
    evidence: [{ kind: "incident", ref: "MSSR-1", summary: "Evidence note.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "abc" }],
    reviewRequired: true,
  },
});
const proposalState = enqueueMssrContextMessages(empty, [proposalMessage], now).state;
assert.equal(proposalState.pending[0]?.message.persistenceProposal?.reviewRequired, true);
assert.equal(proposalState.advisoryOnly, true);

// --- Determinism: same inputs produce deep-equal states ---

assert.deepEqual(
  enqueueMssrContextMessages(empty, [message({ id: "d-a", dedupeKey: "d-a" })], now).state,
  enqueueMssrContextMessages(empty, [message({ id: "d-a", dedupeKey: "d-a" })], now).state,
);
assert.deepEqual(
  reduceMssrContextInbox(empty, { type: "enqueue", now, messages: [message({ id: "d-a", dedupeKey: "d-a" })] }).state,
  reduceMssrContextInbox(empty, { type: "enqueue", now, messages: [message({ id: "d-a", dedupeKey: "d-a" })] }).state,
);

// --- JSON file adapter: fail-closed load and atomic temp+rename save ---

const directory = await mkdtemp(join(tmpdir(), "mssr-inbox-"));
try {
  const inboxPath = join(directory, "inbox.json");

  const missing = await loadMssrContextInboxStateFromFile(join(directory, "missing.json"));
  assert.deepEqual(missing, empty);

  const populated = enqueueMssrContextMessages(empty, [message({ id: "file-msg", dedupeKey: "file-key" })], now).state;
  await saveMssrContextInboxStateToFile(inboxPath, populated);
  const reloaded = await loadMssrContextInboxStateFromFile(inboxPath);
  assert.deepEqual(reloaded, populated);

  const leftovers = (await readdir(directory)).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);

  const malformedPath = join(directory, "malformed.json");
  await writeFile(malformedPath, "{not json", "utf8");
  await assert.rejects(() => loadMssrContextInboxStateFromFile(malformedPath), /not valid JSON/);
  assert.match(await readFile(malformedPath, "utf8"), /not json/);

  const badVersionPath = join(directory, "bad-version.json");
  await writeFile(
    badVersionPath,
    JSON.stringify({ ...empty, schemaVersion: 99 }),
    "utf8",
  );
  await assert.rejects(() => loadMssrContextInboxStateFromFile(badVersionPath), /failed validation/);

  const legacyV1Path = join(directory, "legacy-v1.json");
  await writeFile(
    legacyV1Path,
    JSON.stringify({
      schemaVersion: 1,
      pending: [],
      deliveries: [{
        messageId: "legacy-ack",
        messageKind: "architecture-decision",
        selectedCount: 1,
        firstSelectedAt: now,
        lastSelectedAt: now,
        acknowledgedAt: now,
        sources: [],
      }],
      advisoryOnly: true,
    }),
    "utf8",
  );
  const migrated = await loadMssrContextInboxStateFromFile(legacyV1Path);
  assert.equal(migrated.schemaVersion, MSSR_CONTEXT_INBOX_SCHEMA_VERSION);
  assert.equal(migrated.deliveries.length, 1);
  assert.equal(migrated.deliveries[0]?.messageId, "legacy-ack");
  assert.equal(migrated.deliveries[0]?.fingerprint, undefined);
  const reEnqueueLegacy = enqueueMssrContextMessages(migrated, [
    message({ id: "legacy-ack", dedupeKey: "legacy-ack-key" }),
  ], now);
  assert.deepEqual(reEnqueueLegacy.enqueued, ["legacy-ack"]);

  await assert.rejects(() => saveMssrContextInboxStateToFile(inboxPath, { ...empty, schemaVersion: 99 }));
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("context message inbox tests passed");
