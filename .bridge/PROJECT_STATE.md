# MSSR project state

## Current release
MSSR source release is `0.2.9`. It adds portable Context Messages v1: strict bounded evidence, intent/stage selection, dedupe and budgets, freshness/provenance, continuation receipts, and review-only persistence proposals. Native route, Codex route/bootstrap, and OpenCode route/bootstrap share golden parity coverage. Bridge source `0.6.89` adapts the same contract into response notices, while the currently live Bridge remains `0.6.88` until a later controlled publish/restart/readback. No durable inbox or real ChatGPT Web parity is claimed by this source release.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. Historical priors are metrics only. Dataset-quality audit, replay/holdout, calibration, shadow, explicit versioned feature flag, and tested rollback are all required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The first-party package is complete for its bounded source scope: `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and `mssr-observability-maintenance` are canonical in-package trees named by a versioned manifest. The provider gives those names reserved precedence; aliases to the same real path are informational and divergent shadows fail audit. Codex installation is opt-in and scoped to manifest names; native, Codex-local, OpenCode-local, and live Bridge discovery are covered. Context Messages now have portable source parity, but provider-produced message collection, durable inbox delivery, restart freshness readback, real ChatGPT Web evidence, and learning replay/activation remain future gates.
