# MSSR project state

## Current release
MSSR `0.2.77` is the current verified local source release candidate. It preserves the verified R1/R2/R3 and portable R4 baseline, the 0.2.74 project-document reference lifecycle, the 0.2.75 delivery-receipt ceiling fix, and the 0.2.76 `blender-pose-authoring` routing release while adding explicit stable human-task identity above traces. Hosts may supply `taskKey` plus optional `parentTraceId` / `supersedesTraceId`; portable MSSR keeps those fields additive and immutable per trace, exposes them through route/status/telemetry, and does not infer them from prose, workflow similarity, recency, or inactivity. Trace lineage is correlation evidence only and never closes/cancels another trace or invents task completion. The final `npm run release:gate` passes after preserving a plain structural MCP schema for `tools/list` and applying relational task-lineage refinement at handler parse time. Release receipt `.mssr/runtime/releases/0.2.77.json` identifies `mauroprime-mssr-0.2.77.tgz` as `pkg:0.2.77#32f2fd9d` (788977 bytes, SHA-256 `32f2fd9d86db8a9479efe4fad89eb7a812d13ac76ebf238834c1eff8df191317`). Bridge `0.6.141` has now completed the separate packaged-host adoption gate for MSSR `0.2.77`: the live Human Cockpit consumes explicit task identity/lineage and preserves raw trace provenance. Future MSSR source releases still require their own package-byte parity and live host readback before being treated as adopted.

## Active execution priority — 2026-09-19

The near-term reliability program remains explicit in `ROADMAP.md`. **R1 Trace Identity Integrity, R2 Automatic Lifecycle Coverage, and R3 Context Economy v2 are complete end-to-end.** R4 ADR 0006 remains in its longitudinal measurement phase: portable Gates A-F and Bridge packaged adoption of the 0.2.72 baseline are complete, while representative precision/recall, abstention/noise and context-cost evidence must still accumulate. `0.2.73` does not broaden R4 semantic authority; it is a routing precision release for the applied Jev decision-system skill. Gate H remains shadow-only: no NLI/cross-encoder has been promoted, validated, or granted routing/notice/write authority. Detailed current-truth policy is indexed as `mssr-semantic-consistency-decision`; relation/retrieval/message/shadow policy is indexed separately as `mssr-semantic-relations-retrieval-decision`. Project Context Health is `ok` within existing budgets.

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.77 -->
<!-- mssr-version:bridge.live=0.6.141 -->
<!-- mssr-version:bridge.mssr=0.2.77 -->
<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

Strict `learning-digest-v1` collection remains observe-only with `routingInfluence=false`. MSSR `0.2.73` does not change learning influence: dataset-quality audit, replay/calibration and shadow evaluation remain separate, and no learned score or R4 model-shadow observation is consumed by routing, lifecycle activation, context selection, semantic-consistency truth, or direct notice authority.

## Core skill package state

The five first-party MSSR skill package roots remain unchanged in `0.2.77`. Routing metadata from `0.2.76` remains intact, including `jev-decision-systems` and `blender-pose-authoring`; `0.2.77` changes the portable trace-correlation contract instead of skill activation. Explicit `taskKey`/lineage metadata is observable only and does not change learned activation influence, permissions, or lifecycle completion semantics. Live Bridge `0.6.141` remains a separate consuming-host adoption gate; source `0.2.77` must not be treated as live until package bytes and route/bootstrap readback prove it.

## Context-economy follow-up

The earlier Project Context segmentation work remains intact: parent-internal baseline+optional segments keep history pressure bounded without changing logical identity or raising selected-payload budgets. R3 `0.2.70` now applies the same economy principle to procedural skill guidance across replans through exact host-attested retained unit ids plus content fingerprints. Historical delivery is never retention evidence; omitted or stale receipts re-enable normal delivery. Architecture Core slimming also moved subsystem detail into selective modules while preserving universal invariants and the existing 5,000-character core budget.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.63` semantic-segmentation contract.

## Repository reconciliation — 2026-09-17

The canonical repository is now mainline-only after a branch/worktree audit. `C:\Dev\mssr` is a junction to `D:\Dev\mssr`. `feat/context-semantic-segmentation` was exactly `main`; `feat/context-auto-modularization` was one commit behind with zero unique commits. Both local and remote feature refs were removed after containment checks. Detached Codex worktree `5142` was inactive since 2026-09-03; all substantive routing, schema, fixture, host-gated test and documentation additions in that tree are already present on current `main`, while its remaining unmatched state/index text was obsolete. The worktree was removed without merge/cherry-pick. Three unreachable `NO` commits are duplicate snapshots of that superseded tree and require no recovery. Bridge `0.6.128` is aligned to MSSR `0.2.63`. Independent dirty work in `D:\Dev\mauroprime-skills` remains outside this repository and must not be reset from MSSR maintenance. See `docs/HANDOFF_REPOSITORY_RECONCILIATION_2026-09-17.md`.
