import { createHash } from "node:crypto";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import { parseMssrNoticeV1 } from "./mssr-notice.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Adapt one strict portable MssrNotice v1 into Librarian ingress.
 *
 * The Librarian keeps notice identity/transition semantics but does not become a
 * second notice-history store. Human-facing message/recommendation prose is
 * represented only by presence/fingerprints so semantic text remains owned by
 * the Notice plane/host history. Host queue ids, TTL, delivery attempts,
 * receipts, UI state and executable actions are outside MssrNotice v1 already
 * and therefore cannot cross this adapter.
 */
export function librarianRecordFromMssrNotice(input: unknown): MssrLibrarianIngressRecord {
  const notice = parseMssrNoticeV1(input);
  const messageFingerprint = sha256(notice.message);
  const recommendationFingerprint = notice.recommendation ? sha256(notice.recommendation) : null;

  return {
    namespace: "notice",
    kind: notice.details.event,
    identity: notice.noticeId,
    sourceRef: `notice/${notice.origin}/${notice.noticeId}`,
    revision: notice.dedupeKey,
    payloadFingerprint: notice.dedupeKey,
    metadata: {
      schemaVersion: notice.schemaVersion,
      kind: notice.kind,
      origin: notice.origin,
      attentionLevel: notice.attentionLevel,
      severity: notice.severity,
      code: notice.code,
      source: notice.source,
      subject: notice.subject,
      dedupeKey: notice.dedupeKey,
      event: notice.details.event,
      previousLevel: notice.details.previousLevel,
      currentLevel: notice.details.currentLevel,
      fingerprint: notice.details.fingerprint,
      advisoryOnly: notice.advisoryOnly,
      hasRecommendation: Boolean(notice.recommendation),
      messageFingerprint,
      recommendationFingerprint,
    },
    provenance: {
      producer: "operational-notices",
      host: notice.origin,
    },
  };
}
