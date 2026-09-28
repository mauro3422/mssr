# MSSR project state

## Current release
MSSR `0.2.80` is the verified local release for deterministic package-byte reproduction. The canonical `0.2.79` artifact remains immutable evidence and was not rewritten. `release:gate` previews npm's bounded package file set, materializes that set through an isolated temporary Git index so `.gitattributes` produces canonical bytes without touching the developer index/worktree, and provides canonical build inputs plus the already-verified dependency tree for npm's `prepare` lifecycle before the final pack. A real regression proves opposite physical LF/CRLF worktrees produce the same `.tgz` SHA-256 while preserving the declared PowerShell CRLF contract. Final `0.2.80` identity is `pkg:0.2.80#2ed92e4a`: `mauroprime-mssr-0.2.80.tgz`, 801928 bytes, SHA-256 `2ed92e4a7093d290f6ee37371d7b613e0174c9c9dc88b676f6868aaedffa7394`, npm shasum `9deced66705dd4e373e5a862723be41043e95b40`; `npm run verify` and `npm run release:gate` both passed. Bridge `0.6.141` currently runs the provisional byte-distinct MSSR `0.2.78` package `pkg:0.2.78#3431c74d`; Bridge adoption of `0.2.80` remains a separate exact-byte rebuild/restart/readback gate.

## Active execution priority — 2026-09-19

The near-term reliability program remains explicit in `ROADMAP.md`. **R1 Trace Identity Integrity, R2 Automatic Lifecycle Coverage, and R3 Context Economy v2 are complete end-to-end.** R4 ADR 0006 remains in its longitudinal measurement phase: portable Gates A-F and Bridge packaged adoption of the 0.2.72 baseline are complete, while representative precision/recall, abstention/noise and context-cost evidence must still accumulate. `0.2.73` does not broaden R4 semantic authority; it is a routing precision release for the applied Jev decision-system skill. Gate H remains shadow-only: no NLI/cross-encoder has been promoted, validated, or granted routing/notice/write authority. Detailed current-truth policy is indexed as `mssr-semantic-consistency-decision`; relation/retrieval/message/shadow policy is indexed separately as `mssr-semantic-relations-retrieval-decision`. Project Context Health is `ok` within existing budgets.

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.80 -->
<!-- mssr-version:bridge.live=0.6.141 -->
<!-- mssr-version:bridge.mssr=0.2.78 -->
<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

Strict `learning-digest-v1` collection remains observe-only with `routingInfluence=false`. MSSR `0.2.73` does not change learning influence: dataset-quality audit, replay/calibration and shadow evaluation remain separate, and no learned score or R4 model-shadow observation is consumed by routing, lifecycle activation, context selection, semantic-consistency truth, or direct notice authority.

## Core skill package state

The five first-party MSSR skill package roots remain unchanged in `0.2.80`. Routing metadata from `0.2.76`, human-task identity from `0.2.77`, and the proportional context/routing semantics reconciled in `0.2.79` remain intact; `0.2.80` changes release-package construction only. The release gate now canonicalizes the bounded npm file set through Git attributes before packing so package identity is independent of physical checkout EOL state. Live Bridge `0.6.141` currently consumes the provisional byte-distinct MSSR `0.2.78` package and remains a separate adoption gate for the final `0.2.80` bytes.

## Context-economy follow-up

The earlier Project Context segmentation work remains intact: parent-internal baseline+optional segments keep history pressure bounded without changing logical identity or raising selected-payload budgets. R3 `0.2.70` applies the same economy principle to procedural skill guidance across replans through exact host-attested retained unit ids plus content fingerprints. `0.2.79` extends the principle to inheritance and arbitrary Markdown while reconciling routing proportionality: parent authority no longer promotes optional descendants into required paging, adjacent document manifests expose compact authority cores plus proportional relevant/deep modules, broad domain breadth is capped, and read-only friction does not create maintenance by itself. Historical delivery is never retention evidence; omitted or stale receipts re-enable normal delivery. Architecture Core slimming still preserves universal invariants and the existing 5,000-character core budget.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.63` semantic-segmentation contract.

## Repository reconciliation — 2026-09-17

The canonical repository is now mainline-only after a branch/worktree audit. `C:\Dev\mssr` is a junction to `D:\Dev\mssr`. `feat/context-semantic-segmentation` was exactly `main`; `feat/context-auto-modularization` was one commit behind with zero unique commits. Both local and remote feature refs were removed after containment checks. Detached Codex worktree `5142` was inactive since 2026-09-03; all substantive routing, schema, fixture, host-gated test and documentation additions in that tree are already present on current `main`, while its remaining unmatched state/index text was obsolete. The worktree was removed without merge/cherry-pick. Three unreachable `NO` commits are duplicate snapshots of that superseded tree and require no recovery. Bridge `0.6.128` is aligned to MSSR `0.2.63`. Independent dirty work in `D:\Dev\mauroprime-skills` remains outside this repository and must not be reset from MSSR maintenance. See `docs/HANDOFF_REPOSITORY_RECONCILIATION_2026-09-17.md`.
