# MSSR project state

## Current release
MSSR `0.2.9` is published at `be597269a64fb60c61de8925216c2f6ffebdbcef`. It adds portable Context Messages v1: strict bounded evidence, intent/stage selection, dedupe and budgets, freshness/provenance, continuation receipts, and review-only persistence proposals. Native route, Codex route/bootstrap, and OpenCode route/bootstrap share golden parity coverage. Bridge `0.6.89` is also published and live after controlled full restart/readback: version `0.6.89`, tunnel `live/ready`, 146 tools, and Context Messages schemas present on both route/bootstrap tools. Durable inbox and real ChatGPT Web end-to-end behavior remain separate future gates.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. Historical priors are metrics only. Dataset-quality audit, replay/holdout, calibration, shadow, explicit versioned feature flag, and tested rollback are all required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The first-party package is complete for its bounded source scope: `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and `mssr-observability-maintenance` are canonical in-package trees named by a versioned manifest. The provider gives those names reserved precedence; aliases to the same real path are informational and divergent shadows fail audit. Codex installation is opt-in and scoped to manifest names; native, Codex-local, OpenCode-local, and live Bridge discovery are covered. Context Messages now have portable source parity, but provider-produced message collection, durable inbox delivery, restart freshness readback, real ChatGPT Web evidence, and learning replay/activation remain future gates.
