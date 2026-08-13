# MSSR project state

## Current release
MSSR source release is `0.2.8`. Release `0.2.7` delivered the portable closure evaluator: required-skill, verification, persistence, close, maintenance, and outcome obligations reject `success` while an applicable gate is pending without coupling the core to a host. `0.2.8` now also ships the five bundled first-party skill trees, their manifest/reserved precedence, native/Codex/OpenCode provider discovery, an opt-in Codex installer, package/installer/registry conformance tests, and custom-catalog shadow guards. Bridge `0.6.88` source integration is pending controlled runtime restart and live catalog/version readback, so it is not yet recorded as a live runtime fact. Publication remains separate from source verification.

## Learning dataset state
Strict `learning-digest-v1` collection remains active through Bridge in `observe-only` mode with `routingInfluence=false`. Historical priors are metrics only. Dataset-quality audit, replay/holdout, calibration, shadow, explicit versioned feature flag, and tested rollback are all required before any future influence; no learned score is consumed by routing or context selection today.

## Core skill package state

The first-party package is complete for its bounded source scope: `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and `mssr-observability-maintenance` are canonical in-package trees named by a versioned manifest. The provider gives those names reserved precedence; aliases to the same real path are informational and divergent shadows fail audit. Codex installation is opt-in and scoped to manifest names; native, Codex-local, and OpenCode-local source discovery are covered by conformance tests. Pending work remains broader: Bridge live restart/readback for 0.6.88, ChatGPT Web runtime validation, and cross-host lifecycle/digest/replay parity and rollback proof.
