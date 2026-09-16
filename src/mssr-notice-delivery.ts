import { evaluateMssrOperationalNoticeTransition, type MssrOperationalNoticeDecision, type MssrOperationalNoticeTransitionInput } from "./operational-notices.js";
import { parseMssrNoticeV1, type MssrNotice } from "./mssr-notice.js";

/**
 * Host-owned immediate delivery boundary for one validated portable notice.
 * The receipt is opaque to MSSR: queue ids, timestamps, UI state, retry data,
 * CLI stream information, or any other transport metadata remain host-owned.
 */
export type MssrNoticeHostBoundary<Receipt = unknown> = (notice: MssrNotice) => Receipt | Promise<Receipt>;

export type MssrNoticeHostDelivery<Receipt = unknown> = {
  notice: MssrNotice;
  receipt: Receipt;
  advisoryOnly: true;
};

/**
 * Validate and hand one MssrNotice to an explicit host boundary immediately.
 *
 * This helper owns no queue, TTL, retry, history, persistence, scheduler, UI,
 * executable action, or permission semantics. A boundary failure is surfaced to
 * the caller and is never interpreted as a change to the portable notice.
 */
export async function deliverMssrNoticeV1<Receipt>(
  notice: unknown,
  boundary: MssrNoticeHostBoundary<Receipt>,
): Promise<MssrNoticeHostDelivery<Receipt>> {
  const semanticNotice = parseMssrNoticeV1(notice);

  // Give the host its own validated copy so accidental mutation inside the
  // boundary cannot rewrite the semantic payload returned by MSSR.
  const receipt = await boundary(parseMssrNoticeV1(semanticNotice));

  return {
    notice: parseMssrNoticeV1(semanticNotice),
    receipt,
    advisoryOnly: true,
  };
}

/**
 * Real host-log delivery boundary for stdio MCP servers. MCP frames own
 * stdout, so one bounded JSON line goes to stderr where the host captures
 * child logs. The receipt stays opaque to MSSR. Agent-visible presentation
 * travels separately via piggybacked response notices.
 */
export function createStderrMssrNoticeBoundary(serverName: string): MssrNoticeHostBoundary<Readonly<{ via: string; deliveredAt: string }>> {
  return (notice) => {
    process.stderr.write(`${JSON.stringify({
      "mssr-notice": {
        server: serverName,
        noticeId: notice.noticeId,
        code: notice.code,
        level: notice.details.currentLevel,
        event: notice.details.event,
        dedupeKey: notice.dedupeKey,
      },
    })}\n`);
    return { via: "host-stderr", deliveredAt: new Date().toISOString() };
  };
}

/** Transport symptoms that mean "not delivered", never "delivered" nor "failed". */
export function isMssrTransportClosedError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return /transport closed|connection closed|ECONNRESET|EPIPE|socket hang up|channel closed/i.test(text);
}

export type MssrNoticeDeliveryStatus = "delivered" | "pending" | "boundary-unconfigured" | "failed" | "none";

export type MssrNoticeTrackObservation = Omit<MssrOperationalNoticeTransitionInput, "previousLevel" | "previousFingerprint">;

export type MssrNoticeTrackResult = Readonly<{
  decision: MssrOperationalNoticeDecision;
  /** Notice to present (piggyback), or null when quiet. */
  notice: MssrNotice | null;
  /**
   * Honest delivery outcome. `delivered` means the boundary accepted the
   * handoff — never that an agent received it. `none` means no delivery was
   * attempted (quiet observation). Presentation (piggyback) is unconfirmed by
   * construction: a response lost after prepare is invisible here unless the
   * host reports it via `markResponseLost`.
   */
  delivery: MssrNoticeDeliveryStatus;
  receipt?: unknown;
  warning?: string;
}>;

export type MssrNoticeTrackerSnapshot = Record<string, {
  level: string | null;
  fingerprint: string | null;
  pendingDedupeKey: string | null;
  pendingNotice: MssrNotice | null;
}>;

type TrackedSubject = {
  level: MssrOperationalNoticeTransitionInput["previousLevel"];
  fingerprint: string | null;
  pendingDedupeKey: string | null;
  pendingNotice: MssrNotice | null;
  piggybackedKeys: Set<string>;
  lastNotice: MssrNotice | null;
  rearmDedupeKey: string | null;
};

/**
 * Host-side delivery memory for operational notices. Pure state machine, no
 * timers, no persistence, no queue: one boundary attempt per observation.
 *
 * - First attention → deliver once (dedupeKey covers instance + fingerprint).
 * - Stable repeats → quiet, no second delivery (no spam).
 * - Transport-closed boundary failure → `pending`: the notice is neither
 *   delivered nor dropped; the next observation re-attempts delivery without
 *   re-presenting it. Pending survives `snapshot`/`restore` until delivered,
 *   superseded, or resolved.
 * - New fingerprint → supersedes pending and re-notifies as `changed`.
 * - Leaving the threshold → `resolved` through the same boundary.
 * - A response lost after piggyback prepare is unobservable here; only an
 *   explicit host report via `markResponseLost` re-arms one re-presentation.
 * - Client recovery (reconnect/respawn) stays host-owned and separate; this
 *   tracker never triggers it.
 *
 * Presentation (piggybacking the returned notice on a host response) stays a
 * separate host decision; this tracker only records delivery outcomes.
 */
export class MssrNoticeDeliveryTracker {
  private readonly subjects = new Map<string, TrackedSubject>();

  constructor(private readonly boundary: MssrNoticeHostBoundary<unknown> | null) {}

  /** Export opaque per-subject memory so a reconnecting host may carry it over, pending included. */
  snapshot(): MssrNoticeTrackerSnapshot {
    return Object.fromEntries([...this.subjects.entries()].map(([subject, state]) => [
      subject,
      {
        level: state.level ?? null,
        fingerprint: state.fingerprint,
        pendingDedupeKey: state.pendingDedupeKey,
        pendingNotice: state.pendingNotice,
      },
    ]));
  }

  /**
   * Restore memory previously exported by `snapshot()`. Pending notices are
   * conserved: a transport-closed delivery is re-attempted, never dropped.
   * Malformed entries are skipped without failing the restore.
   */
  restore(snapshot: unknown): void {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return;
    for (const [subject, state] of Object.entries(snapshot as Record<string, unknown>)) {
      if (!state || typeof state !== "object") continue;
      const record = state as { level?: unknown; fingerprint?: unknown; pendingDedupeKey?: unknown; pendingNotice?: unknown };
      const current = this.subjects.get(subject) ?? {
        level: null, fingerprint: null, pendingDedupeKey: null, pendingNotice: null,
        piggybackedKeys: new Set<string>(), lastNotice: null, rearmDedupeKey: null,
      };
      if (record.level === null || record.level === "ok" || record.level === "watch" || record.level === "review" || record.level === "error") {
        current.level = record.level;
      }
      if (record.fingerprint === null || typeof record.fingerprint === "string") current.fingerprint = record.fingerprint;
      if (typeof record.pendingDedupeKey === "string" && record.pendingDedupeKey) {
        try {
          const pendingNotice = parseMssrNoticeV1(record.pendingNotice);
          current.pendingDedupeKey = record.pendingDedupeKey;
          current.pendingNotice = pendingNotice;
        } catch {
          // A corrupt carried pending is dropped; the next observation with
          // the same condition re-opens it instead of failing the restore.
        }
      }
      this.subjects.set(subject, current);
    }
  }

  /**
   * Host report that a response carrying a presented notice was lost after
   * prepare. Re-arms exactly one re-presentation of that same notice on the
   * next observation with an unchanged condition. Returns false for unknown
   * keys (no effect, no spam).
   */
  markResponseLost(dedupeKey: string): boolean {
    for (const state of this.subjects.values()) {
      if (state.lastNotice?.dedupeKey === dedupeKey) {
        state.rearmDedupeKey = dedupeKey;
        return true;
      }
    }
    return false;
  }

  pendingDedupeKeys(): string[] {
    return [...this.subjects.values()].map((state) => state.pendingDedupeKey).filter((key): key is string => key !== null);
  }

  private stateFor(subject: string): TrackedSubject {
    const current = this.subjects.get(subject);
    if (current) return current;
    const fresh: TrackedSubject = {
      level: null, fingerprint: null, pendingDedupeKey: null, pendingNotice: null,
      piggybackedKeys: new Set(), lastNotice: null, rearmDedupeKey: null,
    };
    this.subjects.set(subject, fresh);
    return fresh;
  }

  private async attempt(state: TrackedSubject, notice: MssrNotice): Promise<{ delivery: MssrNoticeDeliveryStatus; receipt?: unknown; warning?: string }> {
    if (!this.boundary) return { delivery: "boundary-unconfigured" };
    try {
      const receipt = await this.boundary(notice);
      state.pendingDedupeKey = null;
      state.pendingNotice = null;
      return { delivery: "delivered", receipt };
    } catch (error) {
      if (isMssrTransportClosedError(error)) {
        state.pendingDedupeKey = notice.dedupeKey;
        state.pendingNotice = notice;
        return { delivery: "pending", warning: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) };
      }
      return { delivery: "failed", warning: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) };
    }
  }

  async observe(input: MssrNoticeTrackObservation): Promise<MssrNoticeTrackResult> {
    const state = this.stateFor(input.subject);
    const decision = evaluateMssrOperationalNoticeTransition({
      ...input,
      previousLevel: state.level ?? null,
      previousFingerprint: state.fingerprint ?? null,
    });

    if (!decision.shouldNotify || !decision.notice) {
      // Stable repeats stay quiet, but a transport-closed delivery is
      // re-attempted (once per observation, silently) until it lands or the
      // condition is superseded by a new fingerprint or a resolution.
      if (state.pendingNotice && state.pendingDedupeKey) {
        const retried = await this.attempt(state, state.pendingNotice);
        return { decision, notice: null, delivery: retried.delivery, ...(retried.receipt !== undefined ? { receipt: retried.receipt } : {}), ...(retried.warning ? { warning: retried.warning } : {}) };
      }
      // A host-reported lost response re-presents the same notice exactly
      // once while the condition is unchanged. Anything else quiet claims no
      // delivery at all — never "delivered" by absence of pending.
      const fingerprint = input.currentFingerprint?.trim() ? input.currentFingerprint.trim() : null;
      if (state.rearmDedupeKey && state.lastNotice && state.lastNotice.dedupeKey === state.rearmDedupeKey
        && state.fingerprint === fingerprint) {
        state.rearmDedupeKey = null;
        state.piggybackedKeys.add(state.lastNotice.dedupeKey);
        return { decision, notice: state.lastNotice, delivery: "none" };
      }
      state.rearmDedupeKey = null;
      return { decision, notice: null, delivery: "none" };
    }

    // A new fingerprint supersedes any pending predecessor.
    if (state.pendingDedupeKey && state.pendingDedupeKey !== decision.notice.dedupeKey) {
      state.pendingDedupeKey = null;
      state.pendingNotice = null;
    }
    state.level = decision.notice.details.currentLevel;
    state.fingerprint = input.currentFingerprint?.trim() ? input.currentFingerprint.trim() : null;
    state.lastNotice = decision.notice;
    state.rearmDedupeKey = null;
    const present = state.piggybackedKeys.has(decision.notice.dedupeKey) ? null : decision.notice;
    if (present) state.piggybackedKeys.add(decision.notice.dedupeKey);
    const outcome = await this.attempt(state, decision.notice);
    return {
      decision,
      notice: present,
      delivery: outcome.delivery,
      ...(outcome.receipt !== undefined ? { receipt: outcome.receipt } : {}),
      ...(outcome.warning ? { warning: outcome.warning } : {}),
    };
  }
}
