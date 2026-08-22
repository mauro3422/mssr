import { z } from "zod";
import {
  mssrContextMessageBatchSchema,
  type MssrContextEvidenceReference,
  type MssrContextMessage,
} from "./context-messages.js";

export const MSSR_CONTEXT_PERSISTENCE_REVIEW_VERSION = "context-persistence-review-v1" as const;

export const mssrContextPersistenceReviewSchema = z.object({
  version: z.literal(MSSR_CONTEXT_PERSISTENCE_REVIEW_VERSION),
  messageId: z.string().min(2).max(120),
  target: z.string().min(1).max(80),
  disposition: z.enum(["review-ready", "refresh-required", "blocked"]),
  reasonCodes: z.array(z.enum([
    "fresh-evidence",
    "unknown-evidence",
    "stale-evidence",
    "conflicting-evidence",
    "unavailable-evidence",
  ])).min(1).max(5),
  canonicalOwners: z.array(z.string().min(1).max(120)).min(1).max(8),
  evidenceRefs: z.array(z.string().min(1).max(240)).min(1).max(8),
  reviewRequired: z.literal(true),
  autoWriteAllowed: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict();

export type MssrContextPersistenceReview = z.infer<typeof mssrContextPersistenceReviewSchema>;

function reasonForEvidence(evidence: readonly MssrContextEvidenceReference[]) {
  const freshness = new Set(evidence.map((item) => item.freshness));
  const reasonCodes: MssrContextPersistenceReview["reasonCodes"] = [];
  if (freshness.has("fresh")) reasonCodes.push("fresh-evidence");
  if (freshness.has("unknown")) reasonCodes.push("unknown-evidence");
  if (freshness.has("stale")) reasonCodes.push("stale-evidence");
  if (freshness.has("conflicting")) reasonCodes.push("conflicting-evidence");
  if (freshness.has("unavailable")) reasonCodes.push("unavailable-evidence");
  return reasonCodes;
}

function reviewProposal(message: MssrContextMessage): MssrContextPersistenceReview | null {
  if (message.kind !== "persistence-proposal") return null;
  if (!message.persistenceProposal) {
    throw new Error(`Persistence-proposal context message '${message.id}' is missing persistenceProposal.`);
  }
  const proposal = message.persistenceProposal;
  const reasons = reasonForEvidence(proposal.evidence);
  const disposition = reasons.some((item) => item === "conflicting-evidence" || item === "unavailable-evidence")
    ? "blocked" as const
    : reasons.some((item) => item === "unknown-evidence" || item === "stale-evidence")
      ? "refresh-required" as const
      : "review-ready" as const;
  return mssrContextPersistenceReviewSchema.parse({
    version: MSSR_CONTEXT_PERSISTENCE_REVIEW_VERSION,
    messageId: message.id,
    target: proposal.target,
    disposition,
    reasonCodes: reasons,
    canonicalOwners: [...new Set(proposal.evidence.map((item) => item.canonicalOwner))].sort(),
    evidenceRefs: [...new Set(proposal.evidence.map((item) => item.ref))].sort(),
    reviewRequired: true,
    autoWriteAllowed: false,
    advisoryOnly: true,
  });
}

/**
 * Turns selected persistence proposals into a bounded review queue. It never
 * chooses content, edits a canonical owner, or treats delivery as approval.
 */
export function planMssrContextPersistenceReviews(messagesInput: unknown): readonly MssrContextPersistenceReview[] {
  const messages = mssrContextMessageBatchSchema.parse(messagesInput);
  return messages.flatMap((message) => {
    const review = reviewProposal(message);
    return review ? [review] : [];
  });
}
