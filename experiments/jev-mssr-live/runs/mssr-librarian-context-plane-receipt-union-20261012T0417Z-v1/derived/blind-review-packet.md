# Blind review packet

Review the answer below against only the exact evidence excerpts. Do not infer missing facts from project familiarity. Judge directness, completeness for the two questions, unsupported claims, and whether the citations cover the clauses. Do not assess provider confidence or guess target labels.

## Question A

What does an acknowledged Context Plane inbox receipt suppress, and which identity fields must match?

## Question B

During canonical-owner migration, which pending messages may be reconciled, and what happens to historical receipts?

## Composed answer

An acknowledged inbox receipt suppresses a message only when both its `messageId` and stable content `fingerprint` match; changed content or revisions, a new ID, or retention expiry allow the evidence to reappear, while migrated v1 receipts without fingerprints never suppress. During canonical-owner migration, reconciliation is limited to provider-proven matches on the exact message ID/kind and project evidence kind/ref/provenance; owner, path, or basename similarity alone is insufficient. Historical delivery receipts remain unchanged, while only stale pending selection state is superseded and `reconciledOwners` metadata makes the migration observable. [L16] [L21]

## Exact fetched evidence

### Citation A — .mssr/knowledge/architecture/context-plane-history.md:L16-L16

- Context Plane inbox tombstones (0.2.12): an acknowledged delivery receipt acts as a temporary tombstone for the same evidence — enqueue suppresses only a message whose `messageId` and stable content `fingerprint` (sha256 over the validated message, identity excluded) both match an already-acknowledged receipt. Content/revision changes or a new id reappear; `receiptRetentionMs` pruning lets identical evidence be delivered again. Inbox state schema is v2 with transparent v1 migration; migrated receipts carry no fingerprint and never suppress.

### Citation B — .mssr/knowledge/architecture/context-plane-history.md:L21-L21

- A project-local inbox may outlive a filesystem move and therefore retain pending repository messages whose only identity drift is an older path-based `canonicalOwner`. Before current repository facts are enqueued, MSSR 0.2.64 reconciles only subjects proven equivalent by the current repository provider: exact message id/kind plus exact project evidence kind/ref/provenance identity. Owner/path/basename similarity by itself is never sufficient. Historical delivery receipts remain unchanged; only stale pending selection state is superseded, and bounded `reconciledOwners` metadata makes the migration observable.
