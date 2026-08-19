import { createHash } from "node:crypto";
import {
  MSSR_NOTICE_KINDS,
  MSSR_NOTICE_ORIGINS,
  MSSR_NOTICE_INLINE_FINGERPRINT_MAX_CHARS,
  MSSR_NOTICE_SCHEMA_VERSION,
  MSSR_OPERATIONAL_NOTICE_EVENTS,
  MSSR_OPERATIONAL_NOTICE_LEVELS,
  MSSR_OPERATIONAL_NOTICE_SEVERITIES,
  parseMssrNoticeV1,
  type MssrNotice,
  type MssrOperationalNoticeEvent,
  type MssrOperationalNoticeLevel,
  type MssrOperationalNoticeSeverity,
} from "./mssr-notice.js";

export * from "./mssr-notice.js";

export type MssrOperationalNoticeAttention = "none" | "notify" | "resolved";

/** Compatibility name for Gate A-D callers; Gate E1 notices are MssrNotice v1. */
export type MssrOperationalNoticeCandidate = MssrNotice;

export type MssrOperationalNoticeTransitionInput = {
  subject: string;
  source: string;
  code: string;
  resolutionCode?: string;
  currentLevel: MssrOperationalNoticeLevel;
  previousLevel?: MssrOperationalNoticeLevel | null;
  currentFingerprint?: string | null;
  previousFingerprint?: string | null;
  message: string;
  resolutionMessage?: string;
  recommendation?: string;
  notifyOnWatch?: boolean;
};

export type MssrOperationalNoticeDecision = {
  attention: MssrOperationalNoticeAttention;
  event: MssrOperationalNoticeEvent | null;
  transition: string;
  shouldNotify: boolean;
  advisoryOnly: true;
  notice: MssrOperationalNoticeCandidate | null;
};

const LEVEL_RANK: Record<MssrOperationalNoticeLevel, number> = {
  ok: 0,
  watch: 1,
  review: 2,
  error: 3,
};

function normalizedFingerprint(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function levelSeverity(level: MssrOperationalNoticeLevel, event: MssrOperationalNoticeEvent): MssrOperationalNoticeSeverity {
  if (event === "resolved" || level === "watch") return "info";
  if (level === "error") return "error";
  return "warning";
}

function buildNoNotice(transition: string): MssrOperationalNoticeDecision {
  return {
    attention: "none",
    event: null,
    transition,
    shouldNotify: false,
    advisoryOnly: true,
    notice: null,
  };
}

function identityPart(value: string): string {
  return `${value.length}:${value}`;
}

function noticeLifecycleId(input: MssrOperationalNoticeTransitionInput): string {
  return `mssr-notice:${identityPart(input.source)}|${identityPart(input.code)}|${identityPart(input.subject)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function portableNoticeFingerprint(fingerprint: string | null): string | null {
  if (fingerprint === null) return null;
  if (fingerprint.length <= MSSR_NOTICE_INLINE_FINGERPRINT_MAX_CHARS && !/[\r\n]/.test(fingerprint)) return fingerprint;
  return `sha256:${fingerprint.length}:${sha256(fingerprint)}`;
}

function noticeDedupeKey(
  noticeId: string,
  event: MssrOperationalNoticeEvent,
  currentLevel: MssrOperationalNoticeLevel,
  fingerprint: string | null,
): string {
  const semanticIdentity = [noticeId, event, currentLevel, fingerprint || "no-fingerprint"]
    .map(identityPart)
    .join("|");
  return `mssr-notice-dedupe:sha256:${sha256(semanticIdentity)}`;
}

function buildCandidate(
  input: MssrOperationalNoticeTransitionInput,
  event: MssrOperationalNoticeEvent,
  previousLevel: MssrOperationalNoticeLevel | null,
  fingerprint: string | null,
): MssrOperationalNoticeDecision {
  const resolved = event === "resolved";
  const code = resolved ? (input.resolutionCode || `${input.code}-resolved`) : input.code;
  const message = resolved
    ? (input.resolutionMessage || `${input.subject} dejó el nivel que requería atención.`)
    : input.message;
  const noticeId = noticeLifecycleId(input);
  const notice = parseMssrNoticeV1({
    schemaVersion: MSSR_NOTICE_SCHEMA_VERSION,
    noticeId,
    kind: MSSR_NOTICE_KINDS[0],
    origin: MSSR_NOTICE_ORIGINS[0],
    attentionLevel: input.currentLevel,
    severity: levelSeverity(input.currentLevel, event),
    code,
    source: input.source,
    subject: input.subject,
    message,
    ...(input.recommendation ? { recommendation: input.recommendation } : {}),
    dedupeKey: noticeDedupeKey(noticeId, event, input.currentLevel, fingerprint),
    details: {
      event,
      previousLevel,
      currentLevel: input.currentLevel,
      fingerprint: portableNoticeFingerprint(fingerprint),
      advisoryOnly: true,
    },
    advisoryOnly: true,
  });

  return {
    attention: resolved ? "resolved" : "notify",
    event,
    transition: `${previousLevel ?? "unobserved"}->${input.currentLevel}:${event}`,
    shouldNotify: true,
    advisoryOnly: true,
    notice,
  };
}

/**
 * Pure, host-neutral attention policy for operational signals.
 *
 * MSSR decides whether a state transition deserves the agent's attention;
 * adapters decide how/when that candidate is delivered. Stable healthy/watch
 * states stay quiet, stable actionable states only re-notify when their bounded
 * fingerprint changes, and leaving the actionable threshold emits a resolution.
 * The result is advisory and never authorizes the recommended action.
 */
export function evaluateMssrOperationalNoticeTransition(
  input: MssrOperationalNoticeTransitionInput,
): MssrOperationalNoticeDecision {
  const previousLevel = input.previousLevel ?? null;
  const currentFingerprint = normalizedFingerprint(input.currentFingerprint);
  const previousFingerprint = normalizedFingerprint(input.previousFingerprint);
  const attentionThreshold = input.notifyOnWatch === true ? LEVEL_RANK.watch : LEVEL_RANK.review;
  const currentAttention = LEVEL_RANK[input.currentLevel] >= attentionThreshold;
  const previousAttention = previousLevel !== null && LEVEL_RANK[previousLevel] >= attentionThreshold;

  if (previousLevel === null) {
    return currentAttention
      ? buildCandidate(input, "opened", null, currentFingerprint)
      : buildNoNotice(`unobserved->${input.currentLevel}:quiet`);
  }

  if (!currentAttention) {
    return previousAttention
      ? buildCandidate(input, "resolved", previousLevel, currentFingerprint)
      : buildNoNotice(`${previousLevel}->${input.currentLevel}:quiet`);
  }

  if (!previousAttention) {
    return buildCandidate(input, "opened", previousLevel, currentFingerprint);
  }

  const currentRank = LEVEL_RANK[input.currentLevel];
  const previousRank = LEVEL_RANK[previousLevel];
  if (currentRank > previousRank) {
    return buildCandidate(input, "escalated", previousLevel, currentFingerprint);
  }
  if (currentRank < previousRank) {
    return buildCandidate(input, "deescalated", previousLevel, currentFingerprint);
  }
  if (currentFingerprint !== previousFingerprint) {
    return buildCandidate(input, "changed", previousLevel, currentFingerprint);
  }

  return buildNoNotice(`${previousLevel}->${input.currentLevel}:stable`);
}
