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
