# Context Plane ownership history

## Current persistence review boundary (0.2.54)

- Context Plane gate C (0.2.54) gives native, Codex and OpenCode one identical persistence-proposal review boundary. Fresh evidence may become `review-ready`; unknown/stale evidence requires refresh; conflicting/unavailable evidence blocks. Every decision remains `reviewRequired=true`, `advisoryOnly=true`, and `autoWriteAllowed=false`; proposal delivery never edits PROJECT_*, an ADR, changelog, incident, skill or routing fixture.

## Context Messages foundation (v1, 0.2.10)

- Context Messages v1 is owned by portable MSSR: bounded schemas, deterministic intent/stage selection, evidence provenance/freshness, continuation receipts, dedupe/accounting, and review-only persistence proposals. Repositories remain the canonical owners of facts; adapters own reads and delivery only.
- Context Plane phase 2 (0.2.10) adds the portable strict producers, the bounded repository collector over ADR/incident/changelog/PROJECT_* facts plus supplied Git/provider receipts, freshness revalidation, and a durable explicit-ack advisory-only JSON inbox.
## Host delivery and canonical project-context cutover (0.2.11, 0.2.18)

- Context Plane host delivery began in 0.2.11 with keyed repository facts, selector-driven project context, shared `loadProjectContextHost`, and explicit `mssr_context_ack`. MSSR 0.2.18 makes `.mssr/project-context.json` the single active manifest, removes `.bridge` retrieval fallback, separates indexed project knowledge under `.mssr/knowledge/` from ephemeral `.mssr/runtime/`, and owns portable initialization, Project Context Health, reviewed capture planning, and hash-addressed project-context modularization planning. Per-entry `maxChars` bounds the materialized section selection while the backing authority remains protected by the global source cap; a phase replan may explicitly set `contextIncludeCore: false` only after that host already delivered core, so newly relevant modules can use the bounded budget without hidden session inference. Bridge consumes this contract only through versioned packaged MSSR artifacts rather than a workspace junction. Source/runtime adoption must always be proven by host package version plus restart/readback, never inferred from the sibling MSSR working tree.
## Inbox tombstone semantics (0.2.12)

- Context Plane inbox tombstones (0.2.12): an acknowledged delivery receipt acts as a temporary tombstone for the same evidence — enqueue suppresses only a message whose `messageId` and stable content `fingerprint` (sha256 over the validated message, identity excluded) both match an already-acknowledged receipt. Content/revision changes or a new id reappear; `receiptRetentionMs` pruning lets identical evidence be delivered again. Inbox state schema is v2 with transparent v1 migration; migrated receipts carry no fingerprint and never suppress.


## Canonical-owner migration reconciliation (0.2.64)

- A project-local inbox may outlive a filesystem move and therefore retain pending repository messages whose only identity drift is an older path-based `canonicalOwner`. Before current repository facts are enqueued, MSSR 0.2.64 reconciles only subjects proven equivalent by the current repository provider: exact message id/kind plus exact project evidence kind/ref/provenance identity. Owner/path/basename similarity by itself is never sufficient. Historical delivery receipts remain unchanged; only stale pending selection state is superseded, and bounded `reconciledOwners` metadata makes the migration observable.
