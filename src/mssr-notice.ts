import { z } from "zod";

/** Portable Operational Notice semantic protocol introduced by Gate E1. */
export const MSSR_NOTICE_SCHEMA_VERSION = "mssr-notice-v1" as const;
export const MSSR_NOTICE_KINDS = ["operational-attention"] as const;
export const MSSR_NOTICE_ORIGINS = ["mssr"] as const;
export const MSSR_OPERATIONAL_NOTICE_LEVELS = ["ok", "watch", "review", "error"] as const;
export const MSSR_OPERATIONAL_NOTICE_SEVERITIES = ["info", "warning", "error"] as const;
export const MSSR_OPERATIONAL_NOTICE_EVENTS = ["opened", "changed", "escalated", "deescalated", "resolved"] as const;
export const MSSR_NOTICE_INLINE_FINGERPRINT_MAX_CHARS = 240 as const;

export type MssrNoticeKind = typeof MSSR_NOTICE_KINDS[number];
export type MssrNoticeOrigin = typeof MSSR_NOTICE_ORIGINS[number];
export type MssrOperationalNoticeLevel = typeof MSSR_OPERATIONAL_NOTICE_LEVELS[number];
export type MssrOperationalNoticeSeverity = typeof MSSR_OPERATIONAL_NOTICE_SEVERITIES[number];
export type MssrOperationalNoticeEvent = typeof MSSR_OPERATIONAL_NOTICE_EVENTS[number];

const boundedSingleLine = (max: number) => z.string().min(1).max(max).refine(
  (value) => !/[\r\n]/.test(value),
  "MSSR notice identities and bounded evidence must be single-line values.",
);

/**
 * MssrNotice v1 contains portable semantic meaning only.
 *
 * Delivery state (queue ids, TTL, attempts/timestamps, recent history, UI
 * projection, executable host actions) is deliberately excluded and remains
 * owned by the consuming host.
 */
export const mssrNoticeV1Schema = z.object({
  schemaVersion: z.literal(MSSR_NOTICE_SCHEMA_VERSION),
  noticeId: boundedSingleLine(480),
  kind: z.enum(MSSR_NOTICE_KINDS),
  origin: z.enum(MSSR_NOTICE_ORIGINS),
  attentionLevel: z.enum(MSSR_OPERATIONAL_NOTICE_LEVELS),
  severity: z.enum(MSSR_OPERATIONAL_NOTICE_SEVERITIES),
  code: boundedSingleLine(120),
  source: boundedSingleLine(120),
  subject: boundedSingleLine(160),
  message: z.string().min(1).max(600),
  recommendation: z.string().min(1).max(600).optional(),
  dedupeKey: boundedSingleLine(120),
  details: z.object({
    event: z.enum(MSSR_OPERATIONAL_NOTICE_EVENTS),
    previousLevel: z.enum(MSSR_OPERATIONAL_NOTICE_LEVELS).nullable(),
    currentLevel: z.enum(MSSR_OPERATIONAL_NOTICE_LEVELS),
    fingerprint: boundedSingleLine(MSSR_NOTICE_INLINE_FINGERPRINT_MAX_CHARS).nullable(),
    advisoryOnly: z.literal(true),
  }).strict(),
  advisoryOnly: z.literal(true),
}).strict();

export type MssrNotice = z.infer<typeof mssrNoticeV1Schema>;

/** Strict read/relay validation for a portable notice payload. */
export function parseMssrNoticeV1(value: unknown): MssrNotice {
  return mssrNoticeV1Schema.parse(value);
}

/**
 * Deterministic semantic serialization for preservation/parity checks.
 *
 * Hosts may wrap this payload with arbitrary delivery metadata, but they must
 * compare/preserve the validated semantic notice itself rather than treating
 * their transport envelope as part of MssrNotice.
 */
export function serializeMssrNoticeV1(value: unknown): string {
  return JSON.stringify(parseMssrNoticeV1(value));
}

/** Compare only portable notice semantics; host delivery envelopes stay outside. */
export function hasSameMssrNoticeV1Semantics(left: unknown, right: unknown): boolean {
  return serializeMssrNoticeV1(left) === serializeMssrNoticeV1(right);
}
