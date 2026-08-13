# MSSR project state

## Current release
MSSR `0.2.10` is the current release in progress at `D:\Dev\mssr`. It adds the Context Plane phase 2 portable core: strict producers, a bounded repository collector over ADR/incident/changelog/PROJECT_* facts plus supplied Git/provider receipts, evidence freshness revalidation (`fresh`/`stale`/`conflicting`/`unavailable`/`unknown`), and a durable explicit-ack advisory-only JSON inbox with atomic fail-closed file persistence. Host delivery integration is still pending: the native facade, Codex-local, OpenCode-local, and Bridge adapters are not yet wired to drain the inbox or piggyback receipts, so 0.2.10 claims no restart/runtime inbox adoption. Public artifacts are `be597269a64fb60c61de8925216c2f6ffebdbcef` (0.2.9).

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. Historical priors are metrics only. Dataset-quality audit, replay/holdout, calibration, shadow, explicit versioned feature flag, and tested rollback are all required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The first-party package is complete for its bounded source scope: `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and `mssr-observability-maintenance` are canonical in-package trees named by a versioned manifest. The provider gives those names reserved precedence; aliases to the same real path are informational and divergent shadows fail audit. Codex installation is opt-in and scoped to manifest names; native, Codex-local, OpenCode-local, and live Bridge discovery are covered. Context Messages now have portable source parity, but provider-produced message collection, durable inbox delivery, restart freshness readback, real ChatGPT Web evidence, and learning replay/activation remain future gates.
