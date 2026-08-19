import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { z } from "zod";
import {
  MSSR_CONTEXT_MESSAGE_KINDS,
  mssrContextEvidenceReferenceSchema,
  mssrContextMessageSchema,
  selectMssrContextMessages,
  type MssrContextMessage,
  type MssrContextMessageSelection,
} from "./context-messages.js";
import {
  SKILL_STAGES,
  structuredSkillIntentSchema,
  type SkillStage,
} from "./skill-routing.js";

export const MSSR_CONTEXT_INBOX_SCHEMA_VERSION = 2 as const;
export const MSSR_CONTEXT_INBOX_LEGACY_SCHEMA_VERSION = 1 as const;

const boundedId = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/);
const timestamp = z.string().datetime({ offset: true });
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);

export const mssrContextInboxConfigSchema = z.object({
  maxPending: z.number().int().min(0).max(32).default(32),
  maxDeliveries: z.number().int().min(0).max(64).default(64),
  messageTtlMs: z.number().int().min(0).max(365 * 24 * 60 * 60 * 1000).default(7 * 24 * 60 * 60 * 1000),
  deliveryTtlMs: z.number().int().min(0).max(365 * 24 * 60 * 60 * 1000).default(7 * 24 * 60 * 60 * 1000),
  receiptRetentionMs: z.number().int().min(0).max(3650 * 24 * 60 * 60 * 1000).default(30 * 24 * 60 * 60 * 1000),
}).strict();
export type MssrContextInboxConfig = z.infer<typeof mssrContextInboxConfigSchema>;

export const mssrContextInboxEntrySchema = z.object({
  message: mssrContextMessageSchema,
  enqueuedAt: timestamp,
}).strict();
export type MssrContextInboxEntry = z.infer<typeof mssrContextInboxEntrySchema>;

/**
 * A bounded delivery receipt.  It records only references and bounded summary
 * fields derived from the delivered message, never raw prompts, transcripts,
 * secrets, or private reasoning.
 */
export const mssrContextDeliveryReceiptSchema = z.object({
  messageId: boundedId,
  messageKind: z.enum(MSSR_CONTEXT_MESSAGE_KINDS),
  selectedCount: z.number().int().min(1).max(255),
  firstSelectedAt: timestamp,
  lastSelectedAt: timestamp,
  expiresAt: timestamp.optional(),
  acknowledgedAt: timestamp.optional(),
  /**
   * Stable content signature of the validated message at delivery time.  It
   * identifies "the same evidence" so an acknowledged receipt can act as a
   * temporary tombstone: enqueue suppresses a message only when a receipt with
   * the same messageId and the same fingerprint is already acknowledged.
   * Migrated legacy v1 receipts carry no fingerprint and never suppress.
   */
  fingerprint: fingerprint.optional(),
  sources: z.array(mssrContextEvidenceReferenceSchema).max(8).default([]),
  traceId: boundedId.optional(),
  nextGate: z.string().min(1).max(240).optional(),
}).strict();
export type MssrContextDeliveryReceipt = z.infer<typeof mssrContextDeliveryReceiptSchema>;

export const mssrContextInboxStateSchema = z.object({
  schemaVersion: z.literal(MSSR_CONTEXT_INBOX_SCHEMA_VERSION),
  pending: z.array(mssrContextInboxEntrySchema).max(32),
  deliveries: z.array(mssrContextDeliveryReceiptSchema).max(64),
  advisoryOnly: z.literal(true),
}).strict();
export type MssrContextInboxState = z.infer<typeof mssrContextInboxStateSchema>;

export const mssrContextInboxEnqueueActionSchema = z.object({
  type: z.literal("enqueue"),
  now: timestamp,
  messages: z.array(mssrContextMessageSchema).max(32),
}).strict();

export const mssrContextInboxSelectActionSchema = z.object({
  type: z.literal("select"),
  now: timestamp,
  intent: structuredSkillIntentSchema,
  stage: z.enum(SKILL_STAGES),
  maxMessages: z.number().int().min(0).max(32).optional(),
  maxChars: z.number().int().min(0).max(20_000).optional(),
}).strict();

export const mssrContextInboxAcknowledgeActionSchema = z.object({
  type: z.literal("acknowledge"),
  now: timestamp,
  messageIds: z.array(boundedId).min(1).max(32),
}).strict();

export const mssrContextInboxPruneActionSchema = z.object({
  type: z.literal("prune"),
  now: timestamp,
}).strict();

export const mssrContextInboxActionSchema = z.discriminatedUnion("type", [
  mssrContextInboxEnqueueActionSchema,
  mssrContextInboxSelectActionSchema,
  mssrContextInboxAcknowledgeActionSchema,
  mssrContextInboxPruneActionSchema,
]);
export type MssrContextInboxAction = z.infer<typeof mssrContextInboxActionSchema>;

export function createEmptyMssrContextInboxState(): MssrContextInboxState {
  return {
    schemaVersion: MSSR_CONTEXT_INBOX_SCHEMA_VERSION,
    pending: [],
    deliveries: [],
    advisoryOnly: true,
  };
}

function toTimestampMs(value: string): number {
  return Date.parse(value);
}

function dedupeKeyOf(message: MssrContextMessage): string {
  return message.dedupeKey ?? message.id;
}

/**
 * Deterministic canonical form: object keys sorted, `undefined` omitted, arrays
 * sorted by their canonical serialization, so the same bounded content always
 * hashes identically regardless of key or element ordering.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort((left, right) => {
      const l = JSON.stringify(left);
      const r = JSON.stringify(right);
      return l < r ? -1 : l > r ? 1 : 0;
    });
  }
  if (value !== null && typeof value === "object") {
    const record: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) continue;
      record[key] = canonicalize(child);
    }
    return record;
  }
  return value;
}

/**
 * Stable, bounded fingerprint of a validated message's advisory content.
 * Identity (`id`) and the caller budget hint (`estimatedChars`) are excluded so
 * the same evidence under a different delivery identity hashes the same; any
 * content or revision change (summary, evidence revision, selectors, ...)
 * produces a different fingerprint.
 */
export function fingerprintMssrContextMessage(message: MssrContextMessage): string {
  const { id: _id, estimatedChars: _estimatedChars, ...content } = message;
  return createHash("sha256").update(JSON.stringify(canonicalize(content))).digest("hex");
}

/**
 * The acknowledged-receipt tombstone set: `messageId:fingerprint` pairs that an
 * enqueue must suppress.  Only receipts with a stored fingerprint can act as
 * tombstones; migrated legacy receipts cannot and never suppress.
 */
function acknowledgedTombstones(deliveries: readonly MssrContextDeliveryReceipt[]): Set<string> {
  return new Set(
    deliveries
      .filter((receipt) => receipt.acknowledgedAt && receipt.fingerprint)
      .map((receipt) => `${receipt.messageId}:${receipt.fingerprint}`),
  );
}

function resolveConfig(config?: MssrContextInboxConfig): MssrContextInboxConfig {
  return mssrContextInboxConfigSchema.parse(config ?? {});
}

function validateState(state: MssrContextInboxState): MssrContextInboxState {
  return mssrContextInboxStateSchema.parse(state);
}

/**
 * Bounds the acknowledged receipt trail to the configured capacity.  Live
 * unacknowledged receipts are never deleted; they represent delivery proof.
 * Acknowledged receipts are dropped oldest-first only when that is enough to
 * meet the cap.  If unacknowledged receipts alone exceed the cap, the capacity
 * relaxes for exactly those live receipts (still bounded by the strict schema
 * maximum) rather than silently discarding delivery proof.
 */
function enforceDeliveryCap(
  deliveries: MssrContextDeliveryReceipt[],
  maxDeliveries: number,
): MssrContextDeliveryReceipt[] {
  if (deliveries.length <= maxDeliveries) return deliveries;
  const unacknowledged = deliveries.filter((receipt) => !receipt.acknowledgedAt);
  const acknowledged = deliveries
    .filter((receipt) => receipt.acknowledgedAt)
    .sort(
      (left, right) =>
        toTimestampMs(left.acknowledgedAt as string) - toTimestampMs(right.acknowledgedAt as string)
        || left.messageId.localeCompare(right.messageId),
    );
  const keepAcknowledged = Math.max(0, maxDeliveries - unacknowledged.length);
  return [...unacknowledged, ...acknowledged.slice(0, keepAcknowledged)];
}

export function enqueueMssrContextMessages(
  state: MssrContextInboxState,
  messages: readonly MssrContextMessage[],
  now: string,
  config?: MssrContextInboxConfig,
): { state: MssrContextInboxState; enqueued: string[]; deduplicated: string[]; overflow: string[] } {
  const resolved = resolveConfig(config);
  const validatedMessages = z.array(mssrContextMessageSchema).max(32).parse(messages);
  const validated = validateState(state);
  const pending = [...validated.pending];
  const tombstones = acknowledgedTombstones(validated.deliveries);
  const pendingIndexByKey = new Map(
    pending.map((entry, index) => [dedupeKeyOf(entry.message), index] as const),
  );
  const enqueued: string[] = [];
  const deduplicated: string[] = [];
  const overflow: string[] = [];

  for (const message of validatedMessages) {
    if (tombstones.has(`${message.id}:${fingerprintMssrContextMessage(message)}`)) {
      deduplicated.push(message.id);
      continue;
    }
    const key = dedupeKeyOf(message);
    const pendingIndex = pendingIndexByKey.get(key);
    if (pendingIndex !== undefined) {
      const existing = pending[pendingIndex];
      if (
        existing
        && fingerprintMssrContextMessage(existing.message) === fingerprintMssrContextMessage(message)
      ) {
        deduplicated.push(message.id);
        continue;
      }

      // The dedupe key identifies one advisory subject, not immutable content.
      // When its authoritative source changes while an older revision is still
      // pending, replace that stale pending entry instead of suppressing the
      // updated evidence. Historical delivery receipts remain intact.
      pending[pendingIndex] = { message, enqueuedAt: now };
      enqueued.push(message.id);
      continue;
    }
    if (pending.length >= resolved.maxPending) {
      overflow.push(message.id);
      continue;
    }
    pendingIndexByKey.set(key, pending.length);
    pending.push({ message, enqueuedAt: now });
    enqueued.push(message.id);
  }

  return {
    state: validateState({ ...state, pending }),
    enqueued,
    deduplicated,
    overflow,
  };
}

/**
 * Selects pending context messages and records bounded delivery receipts.
 * Receipt capacity is enforced deterministically: existing receipts are only
 * ever updated (never evicted while unacknowledged), and new receipts are
 * recorded only while available slots remain under `maxDeliveries`.  Messages
 * that still appear in the advisory `selection` but whose delivery receipt is
 * omitted are listed in `receiptOverflow`, so a `maxDeliveries` of 0 records
 * nothing yet still returns the full advisory selection.  `advisoryOnly`
 * remains true and no persistence proposal is ever executed.
 */
export function selectMssrContextInboxMessages(
  state: MssrContextInboxState,
  args: {
    now: string;
    intent: z.infer<typeof structuredSkillIntentSchema>;
    stage: SkillStage;
    maxMessages?: number;
    maxChars?: number;
  },
  config?: MssrContextInboxConfig,
): { state: MssrContextInboxState; selection: MssrContextMessageSelection; receiptOverflow: string[] } {
  const resolved = resolveConfig(config);
  const validated = validateState(state);
  const selection = selectMssrContextMessages({
    messages: validated.pending.map((entry) => entry.message),
    intent: args.intent,
    stage: args.stage,
    ...(args.maxMessages !== undefined ? { maxMessages: args.maxMessages } : {}),
    ...(args.maxChars !== undefined ? { maxChars: args.maxChars } : {}),
  });

  if (selection.selected.length === 0) {
    return { state: validated, selection, receiptOverflow: [] };
  }

  const byId = new Map(validated.deliveries.map((receipt) => [receipt.messageId, receipt]));
  let availableSlots = resolved.maxDeliveries - validated.deliveries.length;
  const receiptOverflow: string[] = [];

  for (const message of selection.selected) {
    const existing = byId.get(message.id);
    if (existing) {
      const expiresAt = new Date(toTimestampMs(args.now) + resolved.deliveryTtlMs).toISOString();
      byId.set(message.id, {
        ...existing,
        lastSelectedAt: args.now,
        selectedCount: existing.selectedCount + 1,
        fingerprint: fingerprintMssrContextMessage(message),
        expiresAt,
        acknowledgedAt: undefined,
        sources: message.evidence.slice(0, 8),
        traceId: message.continuation?.traceId,
        nextGate: message.continuation?.nextGate,
      });
      continue;
    }
    if (availableSlots <= 0) {
      receiptOverflow.push(message.id);
      continue;
    }
    const expiresAt = new Date(toTimestampMs(args.now) + resolved.deliveryTtlMs).toISOString();
    byId.set(message.id, {
      messageId: message.id,
      messageKind: message.kind,
      selectedCount: 1,
      firstSelectedAt: args.now,
      lastSelectedAt: args.now,
      fingerprint: fingerprintMssrContextMessage(message),
      expiresAt,
      sources: message.evidence.slice(0, 8),
      traceId: message.continuation?.traceId,
      nextGate: message.continuation?.nextGate,
    });
    availableSlots -= 1;
  }

  return {
    state: validateState({ ...validated, deliveries: [...byId.values()] }),
    selection,
    receiptOverflow,
  };
}

export function acknowledgeMssrContextMessages(
  state: MssrContextInboxState,
  messageIds: readonly string[],
  now: string,
  config?: MssrContextInboxConfig,
): { state: MssrContextInboxState; acknowledged: string[]; unknown: string[] } {
  const resolved = resolveConfig(config);
  const validated = validateState(state);
  const pending = [...validated.pending];
  const byId = new Map(validated.deliveries.map((receipt) => [receipt.messageId, receipt]));
  const acknowledged: string[] = [];
  const unknown: string[] = [];

  for (const id of messageIds) {
    const receipt = byId.get(id);
    if (!receipt || receipt.acknowledgedAt) {
      unknown.push(id);
      continue;
    }
    acknowledged.push(id);
    byId.set(id, { ...receipt, acknowledgedAt: now });
  }

  const pendingById = new Map(pending.map((entry) => [entry.message.id, entry]));
  for (const id of acknowledged) pendingById.delete(id);

  return {
    state: validateState({
      ...validated,
      pending: [...pendingById.values()],
      deliveries: enforceDeliveryCap([...byId.values()], resolved.maxDeliveries),
    }),
    acknowledged,
    unknown,
  };
}

export function pruneMssrContextInbox(
  state: MssrContextInboxState,
  now: string,
  config?: MssrContextInboxConfig,
): { state: MssrContextInboxState; prunedMessageIds: string[]; prunedReceiptIds: string[] } {
  const resolved = resolveConfig(config);
  const validated = validateState(state);
  const nowMs = toTimestampMs(now);

  const pending: MssrContextInboxEntry[] = [];
  const prunedMessageIds: string[] = [];
  for (const entry of validated.pending) {
    const expired = toTimestampMs(entry.enqueuedAt) + resolved.messageTtlMs <= nowMs;
    if (expired) prunedMessageIds.push(entry.message.id);
    else pending.push(entry);
  }

  const pendingIds = new Set(pending.map((entry) => entry.message.id));
  const deliveries: MssrContextDeliveryReceipt[] = [];
  const prunedReceiptIds: string[] = [];
  for (const receipt of validated.deliveries) {
    let remove = false;
    if (receipt.acknowledgedAt) {
      remove = toTimestampMs(receipt.acknowledgedAt) + resolved.receiptRetentionMs <= nowMs;
    } else {
      remove = receipt.expiresAt !== undefined && toTimestampMs(receipt.expiresAt) <= nowMs;
      if (!remove && !pendingIds.has(receipt.messageId)) remove = true;
    }
    if (remove) prunedReceiptIds.push(receipt.messageId);
    else deliveries.push(receipt);
  }

  return {
    state: validateState({
      ...validated,
      pending,
      deliveries: enforceDeliveryCap(deliveries, resolved.maxDeliveries),
    }),
    prunedMessageIds,
    prunedReceiptIds,
  };
}

export type MssrContextInboxReduction =
  | { type: "enqueue"; state: MssrContextInboxState; enqueued: string[]; deduplicated: string[]; overflow: string[] }
  | { type: "select"; state: MssrContextInboxState; selection: MssrContextMessageSelection; receiptOverflow: string[] }
  | { type: "acknowledge"; state: MssrContextInboxState; acknowledged: string[]; unknown: string[] }
  | { type: "prune"; state: MssrContextInboxState; prunedMessageIds: string[]; prunedReceiptIds: string[] };

export function reduceMssrContextInbox(
  state: MssrContextInboxState,
  action: MssrContextInboxAction,
  config?: MssrContextInboxConfig,
): MssrContextInboxReduction {
  const parsedAction = mssrContextInboxActionSchema.parse(action);
  switch (parsedAction.type) {
    case "enqueue":
      return {
        type: "enqueue",
        ...enqueueMssrContextMessages(state, parsedAction.messages, parsedAction.now, config),
      };
    case "select":
      return {
        type: "select",
        ...selectMssrContextInboxMessages(
          state,
          {
            now: parsedAction.now,
            intent: parsedAction.intent,
            stage: parsedAction.stage,
            ...(parsedAction.maxMessages !== undefined ? { maxMessages: parsedAction.maxMessages } : {}),
            ...(parsedAction.maxChars !== undefined ? { maxChars: parsedAction.maxChars } : {}),
          },
          config,
        ),
      };
    case "acknowledge":
      return {
        type: "acknowledge",
        ...acknowledgeMssrContextMessages(state, parsedAction.messageIds, parsedAction.now, config),
      };
    case "prune":
      return {
        type: "prune",
        ...pruneMssrContextInbox(state, parsedAction.now, config),
      };
  }
}

export async function loadMssrContextInboxStateFromFile(filePath: string): Promise<MssrContextInboxState> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return createEmptyMssrContextInboxState();
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`MSSR context inbox state at ${filePath} is not valid JSON; refusing to load malformed state.`);
  }

  const check = mssrContextInboxStateSchema.safeParse(parsed);
  if (!check.success) {
    const legacy = mssrContextInboxStateSchema
      .extend({ schemaVersion: z.literal(MSSR_CONTEXT_INBOX_LEGACY_SCHEMA_VERSION) })
      .safeParse(parsed);
    if (legacy.success) {
      return { ...legacy.data, schemaVersion: MSSR_CONTEXT_INBOX_SCHEMA_VERSION };
    }
    throw new Error(`MSSR context inbox state at ${filePath} failed validation; refusing to load malformed state.`);
  }
  return check.data;
}

export async function saveMssrContextInboxStateToFile(
  filePath: string,
  state: MssrContextInboxState,
): Promise<void> {
  mssrContextInboxStateSchema.parse(state);
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, filePath);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}
