# Host-composed paragraph (review candidate)

An acknowledged inbox receipt suppresses a message only when both its `messageId` and stable content `fingerprint` match; changed content or revisions, a new ID, or retention expiry allow the evidence to reappear, while migrated v1 receipts without fingerprints never suppress. During canonical-owner migration, reconciliation is limited to provider-proven matches on the exact message ID/kind and project evidence kind/ref/provenance; owner, path, or basename similarity alone is insufficient. Historical delivery receipts remain unchanged, while only stale pending selection state is superseded and `reconciledOwners` metadata makes the migration observable. [context-plane-history.md:L16] [context-plane-history.md:L21]

**Construction:** The host paraphrased and joined facts from two exact fetched ranges. Jev selected ranges; Jev did not write this paragraph. Each citation points to the unchanged source range.
