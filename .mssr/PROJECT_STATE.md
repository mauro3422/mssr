# MSSR project state

## Current release

MSSR `0.2.72` is the current source release candidate for the second portable R4 Deterministic Semantic Consistency slice on top of the verified R1/R2/R3 foundation. Gates B-F now add typed declared/derived relations, structured state/version/owner/decision/package-version extractors, temporal/scope-aware relation comparison, bounded declared/exact/TF-IDF candidate retrieval, and real `roadmap-contradiction` / `unresolved-reference` Context Message producers. Native/Codex/OpenCode expose the same I/O-free semantic evaluation/retrieval/message/shadow contracts. Candidate similarity and optional model output remain non-authoritative; only deterministic structured evidence can become PROVEN current-truth evidence. Live Bridge `0.6.139` already consumes exact MSSR `0.2.71`; adoption of `0.2.72` remains a separate host gate and is not inferred from source parity.

## Active execution priority — 2026-09-19

The near-term reliability program remains explicit in `ROADMAP.md`. **R1 Trace Identity Integrity, R2 Automatic Lifecycle Coverage, and R3 Context Economy v2 are complete end-to-end.** R4 ADR 0006 is now in its host-adoption/measurement phase: portable Gates A-F are implemented; native/Codex/OpenCode parity is covered; Gate G still requires the separate Bridge `0.2.72` adoption plus longitudinal real-incident measurement. Gate H has only the safe shadow-evidence contract: no NLI/cross-encoder has been promoted, validated, or granted routing/notice/write authority. Detailed current-truth policy is indexed as `mssr-semantic-consistency-decision`; relation/retrieval/message/shadow policy is indexed separately as `mssr-semantic-relations-retrieval-decision`. Project Context Health is `ok` within existing budgets.

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.72 -->
<!-- mssr-version:bridge.live=0.6.139 -->
<!-- mssr-version:bridge.mssr=0.2.71 -->
<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

Strict `learning-digest-v1` collection remains observe-only with `routingInfluence=false`. MSSR `0.2.72` does not change learning influence: dataset-quality audit, replay/calibration and shadow evaluation remain separate, and no learned score or R4 model-shadow observation is consumed by routing, lifecycle activation, context selection, semantic-consistency truth, or direct notice authority.

## Core skill package state

The five first-party skill package roots and routing metadata remain unchanged in `0.2.72`; this release changes portable semantic-consistency contracts/tests, not skill activation metadata. Learned activation influence and permission semantics remain unchanged. Live Bridge `0.6.139` consumes exact MSSR `0.2.71`; portable R4 `0.2.72` is released independently and does not imply Bridge host adoption until the separate Bridge gate passes.

## Context-economy follow-up

The earlier Project Context segmentation work remains intact: parent-internal baseline+optional segments keep history pressure bounded without changing logical identity or raising selected-payload budgets. R3 `0.2.70` now applies the same economy principle to procedural skill guidance across replans through exact host-attested retained unit ids plus content fingerprints. Historical delivery is never retention evidence; omitted or stale receipts re-enable normal delivery. Architecture Core slimming also moved subsystem detail into selective modules while preserving universal invariants and the existing 5,000-character core budget.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.63` semantic-segmentation contract.

## Repository reconciliation — 2026-09-17

The canonical repository is now mainline-only after a branch/worktree audit. `C:\Dev\mssr` is a junction to `D:\Dev\mssr`. `feat/context-semantic-segmentation` was exactly `main`; `feat/context-auto-modularization` was one commit behind with zero unique commits. Both local and remote feature refs were removed after containment checks. Detached Codex worktree `5142` was inactive since 2026-09-03; all substantive routing, schema, fixture, host-gated test and documentation additions in that tree are already present on current `main`, while its remaining unmatched state/index text was obsolete. The worktree was removed without merge/cherry-pick. Three unreachable `NO` commits are duplicate snapshots of that superseded tree and require no recovery. Bridge `0.6.128` is aligned to MSSR `0.2.63`. Independent dirty work in `D:\Dev\mauroprime-skills` remains outside this repository and must not be reset from MSSR maintenance. See `docs/HANDOFF_REPOSITORY_RECONCILIATION_2026-09-17.md`.
