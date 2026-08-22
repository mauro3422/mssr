# MSSR project state

## Current release
MSSR `0.2.53` is the current source release. It restores core/module duplicate suppression to the `0.2.52` paged context contract: material already contained in a skill core or earlier selected material is recorded as `already-covered-by-loaded-context`, omitted from duplicate page delivery and counted in `duplicateCharsAvoided`. Typecheck plus paging, stale/tampered/oversize and duplicate regressions passed; the 23,310-under-18,000 page contract remains covered. `0.2.52` has already been packaged by the coordinated release path and must remain immutable; no package, release-gate receipt, Bridge adoption, restart or live-host readback has been performed for `0.2.53`.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. Historical priors are metrics only. Dataset-quality audit, replay/holdout, calibration, shadow, explicit versioned feature flag, and tested rollback are all required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The first-party package is complete for its bounded source scope: `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and `mssr-observability-maintenance` are canonical in-package trees named by a versioned manifest. The provider gives those names reserved precedence; byte-identical package/runtime aliases are informational and divergent shadows fail audit. Codex installation is opt-in and scoped to manifest names; native, Codex-local, OpenCode-local, and live Bridge discovery are covered. Context Plane repository collection, durable inbox delivery, explicit ack, restart/package readback, and real ChatGPT Web selection have live evidence. Operational learning remains separate: replay/holdout, calibration, shadow evaluation, explicit feature flag and rollback are still future gates before any routing influence.
