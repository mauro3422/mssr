# Changelog

All notable changes to MSSR are documented here.

## Unreleased

- Hardened `visual-evidence-lifecycle` so `visual-evidence-pruning` remains required during explicit `verify` and `persist` replans after an approved pruning, instead of disappearing after implementation.
- Restricted direct pruning activation to `human-approval`; integrity/version-control needs alone can no longer authorize hash-only destructive cleanup or transitively pull the visual audit.
- Added seven regressions for cross-camera capture collisions, physical-versus-logical counts, historical-canon conflicts, reference-copy protection, postflight idempotence, persistence and hash-only auto-delete rejection; routing now covers 154 cases.

- Defined `trace-contract-v1`: host adapters may keep local session continuity plus a bounded process-shared lease for stateless calls, propagate only a unique compatible trace through direct and delegated calls, close it on outcome, and emit bounded ambiguity/continuity notices without changing the stateless deterministic core.
- Added logical observability epochs so current metrics start from a clean persisted baseline while `scope=all` preserves legacy evidence for comparison.
- Added the canonical end-to-end contract for route→required loads→replan→verification→persistence→outcome plus negative cases for orphan loads, mismatches, omitted requirements, outcomes without routes, and premature trace replacement.
- Expanded close-phase incident routing so structured, lexical and bounded-continuation requests activate `skill-maintenance-loop` only when observable non-nominal signals exist; nominal closes remain excluded.
- Recorded MSSR-015 and added four regressions for long-iteration incident logging, lexical fallback, short continuation context and nominal no-op closure.

- Unified the Bridge compatibility `skill_recommend` entrypoint with the deterministic MSSR phase router; structured intent now produces the same active/deferred plan as `skill_route_plan`, while missing intent is visibly marked lexical fallback.
- Added trace correlation for route plans, skill loads, replans, context sources, verification, persistence, outcomes and user corrections through the privacy-preserving Bridge MSSR Observatory. Raw prompts and transcripts are not stored.
- Added explicit routing and positive/continuation/negative fixtures for `conversation-history-review`, which reconstructs prior work only from currently available conversation, personal-context, project, Git, telemetry, upload or connected-session evidence.
- Narrowed `visual-evidence-cataloging` with a required visual-artifact gate after it polluted a non-visual MSSR observability task.
- Added `oversizeReviewed` so an intentionally large owned skill remains visible in audit output without forcing perpetual maintenance after an explicit size review.
- Expanded the deterministic suite to 103 effective cases and 35 explicitly routed local skills.

- Clarified the host activation contract: substantial specialized work must load bounded project context, emit structured intent with explicit signals, route only the active stage, and preserve a trace across required loads, replans, verification, persistence, and outcome checkpoints.
- Defined the context-budget boundary between project-owned facts, reusable global skills, and resumable execution checkpoints so the skill catalog can grow without injecting every procedure or conversation into each task.
- Added the reviewed friction-promotion ladder and v0.4 roadmap for host compliance, project-context preflight, privacy-preserving observability, historical replay, and safe promotion from local regression to owning skill or MSSR fixtures.
- Updated the managed `AGENTS.md` bootstrap template so friction and capability changes trigger evidence, re-planning, and visible maintenance rather than silent self-modification.
- Added explicit routing and a phase workflow for `mauroprime-bridge-tool-authoring`, with positive implementation/verification, bounded continuation and nearby existing-tool/one-off-command negatives.
- Added a Bridge-backed `skill_route_vocabulary` preflight so routing authors can consult the canonical closed enum before writing intents or fixtures; command-shaped labels remain outside the semantic protocol.
- Tightened the new route after regression discovery: it now requires `agent-orchestration`, the exact MCP artifact, an authoring action and a safe-editing/unit-test need; its workflow is also bounded by active stages and nominal signals, preventing generic coding, skill-maintenance, OpenCode and incident-recovery pollution.
- Added the reusable `requireArtifactMatch` metadata gate to TypeScript, JSON schema, audit output and deterministic scoring, then applied it to Bridge tool authoring and visual-reference replication so generic needs cannot override the real artifact target.
- Expanded the routing suite to 83 effective cases, 33 explicitly routed local skills and 6 workflows with no owned skill left unconfigured.

- Added explicit persistence/verification routing for `git-change-publication`, the general owner of mixed-worktree classification, focused commit design, staged-index gates, large path-set handling, safe push recovery and direct remote-ref verification.
- Added a `git-change-publication` workflow plus positive publication, ambiguous `cannot lock ref`, bounded continuation, read-only explanation and unverified-implementation fixtures; the suite now proves nominal use, anomaly composition with `systematic-debugging`, and nearby exclusions.
- Kept the semantic protocol compact by mapping Git-specific language onto the existing `save`, `version`, `publish`, `coordinate`, `integrity-verification` and `version-control` vocabulary rather than expanding the public enum for command names.
- Added the explicit `requireSignalMatch` routing gate so transversal debugging, recovery and maintenance skills can require non-nominal evidence without relying on fragile negative prose.
- Added explicit routing for `capability-gap-recovery`, covering missing/degraded skills, tools, providers, permissions, verification paths and product-context handoffs across all supported domains.
- Generalized `systematic-debugging` to all routed domains and to discovery, implementation and verification, while preserving action and anomaly-signal gates so nominal review or feature work does not activate it.
- Added cross-domain Figma and Git/release regressions, context-switch and skill-route-repair cases, continuation variants and nominal negatives; the expanded routing suite now proves composition rather than isolated selection.
- Extended `systematic-debugging` to compose with Roblox and Blender domain skills when anomaly signals, debugging actions and integrity/history needs are present; added Roblox verification and nominal-feature regressions proving simultaneous activation without opening on ordinary work.
- Added explicit routing for the new transversal `systematic-debugging` skill, with positive root-cause/flow-tracing, bounded continuation, and nearby ordinary-feature negative fixtures.
- Recorded MSSR-010: corrected procedural Roblox QA that wrongly excluded `UnionOperation` from `RenderFidelity`, and added pre-import render-profile plus Atmosphere distance-isolation gates without changing skill activation or routing metadata.
- Added explicit routing metadata for `roblox-photo-rig-capture`, covering Photo Rig implementation and verification without activating for edit-only or inventory-only work.
- Added positive, bounded-context continuation, and negative regression fixtures for Roblox model photography.
- Verified 66 routing fixtures, 31 explicitly routed local skills, and a live audit with no owned skills left unconfigured.

## 0.1.0 — 2026-07-23

- Established MSSR as an independent Git repository and routing contract.
- Defined the advisory core, immutable multi-provider registry, and optional
  MCP facade boundaries.
- Added the transversal agent protocol and managed `AGENTS.md` bootstrap.
- Documented auto-registry behavior, capability chaining, re-planning, and the
  separation between routing recommendations and host permissions.
- Preserved a Bridge-compatible integration path while making Bridge a consumer
  rather than the canonical owner.
- Added deterministic routing signals for capability discovery, provider
  refresh, tool chaining, and re-planning.
- Restricted Roblox MCP incident recovery to the Roblox domain so generic MSSR
  recovery and tool-chain work cannot open a Roblox-only branch.
- Added filesystem/plugin skill discovery through junctions, concurrent
  single-flight provider refresh, immutable snapshots, and degraded cached
  capability semantics.
- Added five standalone MCP tools plus core, registry, MCP-handshake, junction,
  fixture, and routing-audit regressions.
- Recorded and recovered MSSR-008, where unsafe cleanup of a temporary
  `file:`-dependency junction traversed into the canonical repository.
- Added the canonical Codex/ChatGPT web/Bridge/MSSR architecture diagram and
  clarified that filesystem and application tools remain caller-owned direct
  execution routes.
