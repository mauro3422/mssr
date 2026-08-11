# Changelog

## Unreleased

- Added privacy-bounded structured intent fields to portable route telemetry;
  task text, context, intent summaries, capability prose, transcripts, and
  private reasoning remain excluded.
- Added a deterministic telemetry analyzer with explicit denominators for
  routing, skill-load, verification, persistence, outcome, success, and
  acceptance metrics. It emits thresholded review candidates for recurring
  exact signals and missing required-skill loads, never automatic rewrites.

## 0.2.4 — 2026-08-08

- Added one bounded read-only exact-session lookup when an OpenCode terminal
  tool event arrives before lifecycle metadata. A parent is recorded only when
  the host returns that same session with an explicit `parentID`; lifecycle
  evidence always takes precedence over an in-flight fallback.
- Preserved physical-call cardinality and privacy boundaries: no relationship
  is inferred from recency, ordering, agent names, task delegation, or sibling
  sessions, and a missing/mismatched/timed-out response remains unknown.
- Hardened the non-blocking OpenCode retry scheduler so transient or shutdown-time
  spool I/O failures remain best-effort instead of surfacing as unhandled promise
  rejections; the Windows cleanup regression now retries transient recursive-removal
  races without changing plugin execution semantics.
- Hardened host-metadata hashing: when no salt is supplied, the OpenCode plugin
  now resolves a random machine-local secret (`host-metadata-salt.key`) instead of
  a predictable public default, so low-entropy IDs still correlate across OpenCode
  processes on one host without being dictionary-attackable. Cross-process locking
  heals empty or partial salt files without races; persistence failures emit a
  bounded diagnostic and degrade to an ephemeral secret rather than a public
  constant.
- Require explicit OpenCode hash salts to use a canonical 32-byte hexadecimal
  secret with structural diversity/anti-repetition checks, add synchronized
  atomic persistence and opt-in one-generation rotation, honor conventional
  macOS/XDG state storage, and enforce POSIX `0600` or a verified current-user-only
  Windows DACL with bounded diagnostics.
- Added a portable, read-only audit mode (`audit-skills.py --check`) that analyzes
  the configured roots, prints a summary, and exits non-zero on routing-contract
  warnings (missing/invalid frontmatter or description), dependency cycles,
  unreadable routing, or a missing schema without writing any files. Length
  warnings remain visible but advisory.
- Rebased the `verify` script onto the read-only `audit:check` (and the `test`
  chain now includes the portable `test:audit`), so verification no longer emits a
  dashboard.
- Made Python audit commands portable through a Node launcher and made
  `audit:check` validate both schema and overrides with Ajv Draft 2020-12,
  including an explicitly declared `$schema` annotation and strict rejection of
  all other unknown properties.
- Refreshed the README to cover the OpenCode CLI facade and optional host plugin,
  the `mssr-host-call-v1` attribution boundary and its `global`-project limitation,
  and to align the status section with the current `0.2.4` release.
- Updated the documented routing-maintenance loop to use the read-only audit gate;
  explicit `npm run audit` remains the dashboard-generation workflow.

## 0.2.3 — 2026-08-08

- Added a bounded, privacy-safe local retry spool for failed OpenCode host-call
  telemetry. It retries asynchronously with exponential backoff, cleans up on
  delivery, expires old/over-retried records, and never blocks an OpenCode hook.
  Concurrent local OpenCode processes use a bounded lock with stale recovery so
  their queue read/modify/write cycles do not drop each other's events.
- Added optional `parentSessionKey` to `mssr-host-call-v1`, populated only from
  OpenCode `session.created` or `session.updated` events that explicitly expose
  a `parentID`. The raw parent session identifier is never persisted or sent.
- Documented the OpenCode 1.18.15 `global` project limitation: MSSR lifecycle
  remains available from the config root, but host plugin hooks are not emitted;
  repository workspaces remain the supported attribution path.
- Clarified that a parent `task` delegation is observable while delegated
  internal tool events/parent identity remain unknown unless OpenCode emits
  them to the plugin lifecycle surface.

## 0.2.2 — 2026-08-08

- Added a privacy-bounded OpenCode host plugin and strict
  `mssr-host-call-v1` envelope for actual agent/model/tool-call attribution.
- Correlates terminal OpenCode tool calls with a session's MSSR trace when a
  route/bootstrap result exposes one, without storing prompts, arguments,
  outputs, error text, transcripts, secrets, or private reasoning.
- Keeps host telemetry best-effort so Bridge or telemetry degradation cannot
  break OpenCode execution.

## 2026-07-28 — Visual routing precision

- Require `visual-reference-replication` to match `visual-qa` or `scene-analysis`; generic `integrity-verification` plus a `ui` artifact no longer activates visual replication during Bridge telemetry/dashboard maintenance.
- Add a structured negative fixture reproducing process-observability work and asserting that visual replication and its integrity dependency remain inactive and undeferred.

## 2026-07-28 — Global host context planning

- Documented the host-side `global-required-core-first` contract while preserving MSSR ownership of deterministic module scoring and filtering.
- Added duplicate-context avoidance, allocation-tier, and context-pressure observability requirements.
- Recorded MSSR-026 for sequential host budgeting and the evidence-driven migration of `conversation-history-review`.

## 0.2.0 — 2026-07-27

- Added the portable `skill-context` contract and deterministic module selector.
- Added versioned `context-modules.json` schema plus stage, intent, budget, and negative-selection fixtures.
- Defined selective bootstrap semantics without turning internal references into independent routing nodes.
- Preserved explicit full-file loading and compatibility fallback for skills that are not modularized yet.
- Added exclusive module groups: tied top candidates are reported without injecting multiple ambiguous procedures.
- Defined hard optional-context budgeting while allowing only required context to overflow with explicit evidence.


## 2026-07-27 — Visual reference integrity routing

- Added explicit routing for `visual-reference-integrity`, including positive, continuation and generation-only negative fixtures.
- Made persisted reference authoring and reference-driven replication require byte/role/provenance validation before handoff or modeling.
- Composed the integrity gate with Roblox forge, Blender reference setup, visual audit and cataloging without forcing it onto ordinary image generation or capture-only work.

All notable changes to MSSR are documented here.

## 0.2.1 — 2026-08-08

- Added a stateful `mssr-opencode-mcp` host adapter with canonical
  `opencode-local` attribution, explicit lifecycle checkpoints, and an optional
  authenticated `mssr-telemetry-v1` sink. The sink transmits hashes and bounded
  routing/load/checkpoint metadata, never task text, transcripts, secrets, or
  inferred outcomes.
- Extended the Codex-local adapter to use the same optional telemetry sink while
  preserving explicit, evidence-backed outcome recording.

- Added a strict, versioned operator provider file selected by
  `MSSR_MCP_PROVIDERS_PATH`, allowing standalone Codex and portable MCP hosts to
  discover real local stdio catalogs through metadata-only `tools/list`.
- Documented the OpenCode CLI adapter while preserving host-owned execution.
- Aligned the MCP SDK dependency with Bridge at `^1.30.0`.

- Moved selective skill-context materialization into the portable package via
  `planCodexSkillContexts` and `assembleCodexSkillContext`, allowing Bridge and
  Codex-local adapters to share one bounded loader without moving host state or
  permissions into MSSR.

- Added `McpToolsProvider` for dynamic, metadata-only MCP `tools/list`
  discovery with native `tools/list_changed` refreshes, immutable provenance,
  timestamped health and last-known-good degradation behavior. MCP tool
  execution remains host-owned and is not exposed through MSSR.

- Added canonical `component-reuse` intent need and explicit routing for `asset-component-reuse`, separating healthy reuse of validated 3D components from maintenance signals such as `reusable-pattern` and `repeated-friction`.
- Added positive, nearby-negative and continuation/migration regressions for component reuse plus a close-stage Blender friction regression proving `skill-maintenance-loop` activates on reusable non-nominal lessons; the deterministic suite now passes 186 cases with 46 owned skills explicitly routed.
- Modularized the heaviest Blender procedural skills with selective `context-modules.json`, so reference/session/review guidance can remain routable under bounded host context budgets instead of being skipped as whole optional files.

- Renamed the expanded architecture to **MSSR — Modular Semantic Skill Router**, preserving the acronym while making modularity and semantic selection explicit.
- Added the portable modular project-context contract: `.bridge/project-context.json`, minimal core context, stage/intent-selected `context`/`memory`/`state`/`directive` modules, bounded budgeting, exclusive alternatives, and a documented legacy fallback.
- Extracted the generic semantic context selector and canonical intent normalizer into `@mauroprime/mssr`, reducing Bridge-owned routing logic and allowing skill context and project context to share one deterministic primitive without sharing authority.
- Added project-context and intent-normalization regressions plus the project memory/update discipline that separates stable facts, durable decisions, mutable state, scoped directives, AGENTS rules, and cross-project skills.
- Added portable stable-section update helpers for durable project knowledge and manifest module upserts so host writers can implement optimistic concurrency and bounded Markdown+manifest transactions without moving filesystem mutation into MSSR core.

- Hardened `trace-contract-v1` with a fresh-close invariant: when `maintenance` is required, `status=success` outcomes must follow a close/maintenance pass newer than the latest continuation or persistence checkpoint; stale success closes are rejected while partial/failed/skipped outcomes remain recordable.
- Defined `mssr-success-outcome-blocked-stale-close` and restart-safe lifecycle reconstruction from existing route/checkpoint observability, without moving state into the deterministic MSSR core or hard-coding a maintenance skill name.

- Added explicit routing for `asset-completion-gate` and the transversal `asset-production-completion` workflow so 3D model creation/revision cannot close before its review-card, evidence, catalog and dashboard gates are complete.
- Added Blender, Roblox and Godot positives, a continuation case, and read-only/reference-authoring negatives; the routing suite now passes 182 structured cases with all 45 owned skills explicitly configured.
- Kept activation scoped to `model-3d` production work so ordinary image/reference authoring and read-only model inspection do not inherit the completion workflow.

- Classified duplicate skills by ownership and provenance: duplicate owned skills are audit errors, equivalent cached plugin versions are informational, and divergent external contracts are maintenance warnings.
- Clarified selective-context budget semantics so optional skill/module omissions remain observable without reporting a required bootstrap overflow.
- Added a transversal user-visible progress contract for long/multi-phase work: bounded phase/owner/next-gate checkpoints, an 8–10 minute return-to-control rule, and an explicit boundary between backend MSSR telemetry and host-visible communication.
- Kept `mssr-observability-maintenance` on-demand for real telemetry diagnosis instead of injecting its full procedure into every routed task.
- Hardened `visual-reference-authoring` routing for existing-package continuations: added `recover` and `history-recovery`, made `read-only` a strict negative for authoring, and added positive repair/extend plus inventory-only regressions. The deterministic suite now passes 176 cases.

- Added explicit MSSR metadata for `visual-reference-authoring`, separating pre-modeling reference creation from real Roblox capture and later fidelity iteration.
- Added positive, continuation and nearby text-only negative coverage plus a structured handoff case that routes `modeling-context.json` into `visual-reference-replication` and `roblox-visual-asset-forge`.
- The deterministic routing suite now covers 159 cases with all 39 owned skills explicitly configured and positive/negative fixture coverage complete.

- Hardened `visual-evidence-lifecycle` so `visual-evidence-pruning` remains required during explicit `verify` and `persist` replans after an approved pruning, instead of disappearing after implementation.
- Restricted direct pruning activation to `human-approval`; integrity/version-control needs alone can no longer authorize hash-only destructive cleanup or transitively pull the visual audit.
- Added seven regressions for cross-camera capture collisions, physical-versus-logical counts, historical-canon conflicts, reference-copy protection, postflight idempotence, persistence and hash-only auto-delete rejection; routing now covers 154 cases.
- Made `visual-evidence-cataloging` required during destructive visual-evidence implementation and verification, preventing capture-run identity work from losing the optional-skill budget.
- Added `visual-evidence-capture-successor-same-semantic-version`, proving audit + cataloging + pruning compose when a technical recapture replaces a collided batch without creating a new art version; the router suite now covers 155 cases.

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
