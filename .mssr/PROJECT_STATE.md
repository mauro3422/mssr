# MSSR project state

## Current release

MSSR `0.2.61` is the current published source/package release line at Git commit `0c3d9c58c073aea746394387532496bdca474fe4`. Its canonical release artifact is `mauroprime-mssr-0.2.61.tgz` (`688166` bytes, SHA-256 `946ba46fbcbb9f7faf712dd0421a0ccffdf85f3c611fa133bd55f3ee3c03ca8a`). Bridge `0.6.125` is published at commit `cee7b735483b40184906682c87373e539789d584` and is live on that exact vendored/installed artifact; controlled HTTP restart ack `8718ff71-e018-4016-b5b7-cf467d44e6a1` adopted PID `20104`, boot `9ceced40-a835-4248-a793-3b3b35c5cd2a`, with 162 tools and the Secure MCP tunnel `live/ready`. No public npm-registry publication is claimed.

## Learning dataset state

Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. MSSR `0.2.61` retains dataset-quality audit, chronological/frozen-holdout replay, support-aware calibration and shadow evaluation, but sparse or unrepresentative evidence may still abstain. Any future routing influence still requires an explicit reviewed/versioned feature flag, exploration floor and tested rollback; no learned score is consumed by routing or context selection today.

## Core skill package state

The five first-party package roots remain compact routed control planes with parent-owned references selected by structured intent/stage/signals. The `0.2.58`–`0.2.61` line deliberately changes routing conditions, lifecycle activation, selected maintenance/reference context, route/bootstrap transport envelopes and their fixtures/tests; those changes are owned by the versioned routing contract and first-party skill sources rather than runtime junction copies. Bridge `0.6.124` consumes the exact `0.2.61` package. Current release verification and publication evidence belongs to the release gate/trace and Git readback rather than being inferred from this state file.

## Context-economy follow-up

The durable investigation handoffs under `docs/skill-routing/` remain useful after `0.2.61`: small-task/resume context economy, lifecycle proportionality, envelope pressure and canonical-owner alias observations should continue to be measured without treating transport character reductions as model-quality proof. The `0.2.61` envelope compaction resolves part of that pressure but does not close the broader research question.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate: portable MSSR would evaluate normalized, deduplicated event envelopes while Bridge/other hosts own webhook/provider transport, authentication and secrets. Native events should avoid polling when available; sources without a push channel remain explicit bounded polling fallbacks. This design is not part of the `0.2.61` runtime contract.
