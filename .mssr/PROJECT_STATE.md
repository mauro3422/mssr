# MSSR project state

## Current release
MSSR `0.2.56` is the current source/package release. It retains the 0.2.55 bounded maintenance-friction modules and now budgets Context Messages from the greater of `estimatedChars` and exact serialized size, preventing historical 320-character hints from materializing ~1.2 KB messages outside the declared envelope. Full `npm run verify` and `npm run release:gate` pass; the deterministic package is 619972 bytes with SHA-256 `413e544fd54e13147a7b3013543ff7e4ba0f44be361d2c9179381cd932fe6cd0`. Git publication and Bridge 0.6.117 adoption/readback remain active gates. No public npm-registry publication is claimed.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. MSSR 0.2.56 can audit dataset quality, replay chronologically/frozen-holdout, calibrate support-aware estimates and compute shadow disagreements, but representative real-data sufficiency may still abstain. An explicit versioned feature flag, exploration floor and tested rollback remain required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The five first-party package roots are compact control planes with direct parent-owned references selected by structured intent/stage/signals; routing metadata and fixtures are unchanged. `skill-maintenance-loop` uses a compact friction index plus nine topic modules, and a regression proves a generic warning selects none of the detailed modules or blocked units. Context-message budget accounting is now measured at selection. Bridge 0.6.117 package adoption plus runtime restart/readback are pending.
