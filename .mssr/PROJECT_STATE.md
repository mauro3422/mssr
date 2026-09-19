# MSSR project state

## Current release

MSSR `0.2.68` is the current source release and starts R1 Trace Identity Integrity. The portable trace-owner contract now treats known project/workflow ownership as immutable: missing evidence may fill an unbound field, matching evidence may resume it, and a known mismatch is incompatible even when a caller supplies the trace id explicitly. `MssrAdapter` canonicalizes project roots at the host boundary and checks owner compatibility before routing or Project Context loading, with focused regressions for progressive binding, equivalent roots and project/workflow mismatches. ADR 0006 semantic-consistency direction and the 0.2.67 Document Freshness/C2e-D host adoption remain unchanged. Full verification and immutable package integrity remain owned by `npm run release:gate`; live Bridge adoption of 0.2.68 is a separate pending host gate and must be proven independently rather than inferred from this source repository.

## Active execution priority — 2026-09-18

The near-term reliability program is now explicit in `ROADMAP.md` and ordered R1 -> R4. **R1 Trace Identity Integrity is active now**: close the reproduced explicit-`traceId` owner-contamination hole by making known project/workflow ownership immutable for one logical trace and fail closed before unrelated project context can be selected. R2 Host Compliance Coverage, R3 obligation-level Context Economy v2, and R4 ADR 0006 semantic consistency remain planned and must not be reported as implemented. Architecture-core slimming is parallel maintenance because `mssr-architecture-core` is already under budget pressure; do not raise its budget to hide the signal.

## Learning dataset state

Strict `learning-digest-v1` collection remains observe-only with `routingInfluence=false`. MSSR `0.2.68` does not change learning influence: dataset-quality audit, replay/calibration and shadow evaluation remain separate, and no learned score is consumed by routing or context selection.

## Core skill package state

The five first-party skill packages remain unchanged in `0.2.68`. This release changes portable trace-owner identity semantics plus lifecycle documentation/tests; it does not change skill routing metadata or learned activation influence. Bridge's packaged MSSR adoption remains a separate deployment step and is never inferred from this repository working tree; live Bridge `0.6.135` still consumes exact MSSR `0.2.67` until the R1 host-adoption gate is completed.

## Context-economy follow-up

The two former whole-file history pressure cases are now parent-internally segmented in `0.2.63` without changing parent routing identity or raising selected-payload budgets. Health measures the worst selectable payload independently from physical backing-file growth; segmented sources retain a 65,536-byte physical maintenance budget and a 262,144-byte recovery hard limit so pressure remains observable and repairable instead of becoming a sudden loader failure. Representative recovery loads only the relevant baseline+deep history, and future semantic or physical segment pressure remains explicit review work rather than automatic semantic rewriting.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.63` semantic-segmentation contract.

## Repository reconciliation — 2026-09-17

The canonical repository is now mainline-only after a branch/worktree audit. `C:\Dev\mssr` is a junction to `D:\Dev\mssr`. `feat/context-semantic-segmentation` was exactly `main`; `feat/context-auto-modularization` was one commit behind with zero unique commits. Both local and remote feature refs were removed after containment checks. Detached Codex worktree `5142` was inactive since 2026-09-03; all substantive routing, schema, fixture, host-gated test and documentation additions in that tree are already present on current `main`, while its remaining unmatched state/index text was obsolete. The worktree was removed without merge/cherry-pick. Three unreachable `NO` commits are duplicate snapshots of that superseded tree and require no recovery. Bridge `0.6.128` is aligned to MSSR `0.2.63`. Independent dirty work in `D:\Dev\mauroprime-skills` remains outside this repository and must not be reset from MSSR maintenance. See `docs/HANDOFF_REPOSITORY_RECONCILIATION_2026-09-17.md`.
