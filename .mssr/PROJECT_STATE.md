# MSSR project state

## Current release
MSSR `0.2.57` is the current source/package release. It retains measured Context Message budgets and now lets a compatible skill-context continuation vary its page budget while the cursor remains bound to version, selection, order and material bytes. Full `npm run verify` and `npm run release:gate` pass; the deterministic package is 620786 bytes with SHA-256 `c71289377739bb3e7285fb2e9bfe36e6227f42c6a1c1aa26380ecbc5424032ca`. Git commit `63943cedc6523f37febfba667756e77b5e74355c` is published on `origin/main`. Bridge `0.6.117` adopted the exact package, published its implementation and state readback through `a6b49d1246719fac214ef453bd377eb0320046b2`, and completed a live 32k context chain in four bounded pages without blocked units. No public npm-registry publication is claimed.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. MSSR 0.2.57 can audit dataset quality, replay chronologically/frozen-holdout, calibrate support-aware estimates and compute shadow disagreements, but representative real-data sufficiency may still abstain. An explicit versioned feature flag, exploration floor and tested rollback remain required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The five first-party package roots are compact control planes with direct parent-owned references selected by structured intent/stage/signals; routing metadata and fixtures are unchanged. `skill-maintenance-loop` uses a compact friction index plus nine topic modules, and a regression proves a generic warning selects none of the detailed modules or blocked units. Context-message budget accounting is measured at selection and skill continuation budgets are page-local. Bridge `0.6.117` is adopted, published and live; its final controlled restart reported version `0.6.117`, dashboard/readiness success and a complete four-page 32k continuation. Oversized notices remain queued for explicit inspection instead of consuming the routed context envelope.
