# MSSR project memory

## Learning activation decision

Operational learning remains external to model weights and currently runs in `observe-only` mode. Strict digests and empirical priors may be collected/analyzed, but historical influence on routing/context remains zero until representative data, dataset audit, historical replay/holdout evaluation, calibration, and shadow-mode evaluation demonstrate repeatable benefit. Activation requires an explicit reviewed versioned feature flag and rollback.

## Change-history contract

Every release uses `changelogs/X.Y.Z.md` with explicit PROJECT_CONTEXT/PROJECT_MEMORY/PROJECT_STATE impact. The portable core parses/evaluates this contract; host adapters observe Git/filesystem state. `reviewed-none` is a valid deliberate result, `updated` should correspond to an observed authority change, and `pending` blocks persistence. The evaluator never writes project knowledge automatically.

## First-party core skill direction

MSSR-owned operational skills have one canonical bundled source for the five names in `config/first-party-skills.json`. Native, Codex-local, and OpenCode-local source providers discover that package with reserved-name precedence; a custom catalog may not reclaim one of those names as an editable owner. The package boundary does not imply loading every first-party skill on every task; required/on-demand/closing activation remains explicit. Bridge 0.6.88 completed its controlled runtime restart and live catalog/version readback on 2026-08-13.

## Context-plane ownership decision

MSSR is the portable transport contract for bounded contextual guidance in addition to skill routing. It selects and accounts for messages by intent and stage, carries explicit evidence provenance/freshness and continuation receipts, and keeps persistence proposals review-only. Repository documents remain authoritative; Bridge and other hosts may piggyback or queue delivery but do not own project meaning. Unknown, stale, conflicting, or unavailable evidence triggers verification, context loading, or replanning rather than silent inference.

## Phase 2 core boundary

The 0.2.10 portable core (strict producers, repository collector, freshness revalidation, and a durable explicit-ack advisory-only JSON inbox) proves the portable message plane and repository scan. It is not proof of host delivery: draining the inbox or piggybacking receipts on native, Codex, OpenCode, or Bridge remains a separate pending gate, and the OpenCode adapter has not adopted the inbox at runtime. Prevent blocked `external_directory` approval waits by using/reading back the canonical session directory before writes and preserving/resuming only when aligned.
