# MSSR roadmap

## Release boundary (0.2.8)

- `0.2.7` delivered the portable route-closure evaluator and the success-outcome
  gate. `0.2.8` records its release boundary, project state, and package scope;
  it does not add a new routing algorithm or relax a closure obligation.
- The first-party package now contains five canonical skill trees, a versioned
  reserved-name manifest, native/Codex/OpenCode provider discovery, opt-in Codex
  installation, and source-level conformance tests. Bridge `0.6.88` completed a
  controlled full restart and live catalog/version readback on 2026-08-13.
- Historical learning remains `observe-only` with `routingInfluence=false`.
  Dataset audit, replay/holdout, calibration, shadow evaluation, a versioned
  feature flag, and tested rollback remain separate future gates.

## Release boundary (0.2.10)

- `0.2.9` published the portable Context Messages v1 contract and cross-host
  selection parity. `0.2.10` adds the Context Plane phase 2 portable core:
  strict producers, a bounded repository collector over ADR/incident/changelog/
  PROJECT_* facts plus supplied Git/provider receipts, evidence freshness
  revalidation, and a durable explicit-ack advisory-only JSON inbox.
- Host delivery integration — draining the inbox or piggybacking receipts on
  native, Codex, OpenCode, or Bridge — is still pending. This release proves
  the portable core and repository scan, not restart/runtime adoption on any
  host.

## Release boundary (0.2.11)

- `0.2.11` wires the durable Context Plane into native, Codex, and OpenCode
  delivery and makes project context keyed. Repositories now receive explicit
  per-fact selectors with source-kind defaults plus an optional
  `.bridge/context-messages.json` manifest, a modular
  `.bridge/project-context-modules.json` loader, and a shared
  `loadProjectContextHost` that resolves one advisory plane
  (`projectContext`, `contextMessages`, `inbox`, `repository`) on route and
  bootstrap with an explicit `mssr_context_ack`.
- Six-probe activation evidence moves from 0/8 before this release to passing
  targeted activation tests (native/Codex/OpenCode route and bootstrap plus
  explicit ack), including an unrelated-domain negative.
- Bridge adapter delivery remains pending: its local dependency junction
  crosses the OpenCode workspace authority boundary, so it must consume a
  packaged 0.2.11 artifact instead of an in-place junction. This release
  claims no Bridge and no live/restart adoption on any host.

## v0.1 — independent foundation

- [x] Independent repository, package metadata, routing contract, and docs.
- [x] Transversal agent bootstrap and idempotent `AGENTS.md` installer.
- [x] Advisory protocol for intent, phases, signals, re-planning, and chaining.
- [x] Complete extraction of the existing deterministic router into `src/`.
- [x] Keep Bridge as a thin adapter and compatibility surface.

## v0.2 — registry reliability

- [x] Provider interface plus a filesystem provider for local/system/plugin
  skills; generic providers can supply MCP catalogs and host capabilities.
- [ ] Native MCP `tools/list` / `listChanged` provider and host-provided
  capabilities.
- [x] Concurrent refresh single-flight, immutable snapshots, provenance, health,
  and stale-but-usable degradation.
- [x] Search/inspect APIs and routing fixtures for missing capability and
  additional-tool chains.
- [ ] Provider TTL policy and change notifications.

## v0.3 — optional MCP facade

- [x] Standalone `mssr-mcp` process exposing registry status/refresh, search,
  inspect, plan, and audit tools.
- [ ] Dynamic provider registration without making MSSR an execution proxy.
- [x] Bundled first-party provider discovery for the native facade, Codex-local,
  and OpenCode-local adapters, plus opt-in Codex junction installation. The
  manifest reserves five canonical names and a divergent external shadow blocks
  the audit.
- [x] Complete Bridge 0.6.88 runtime restart/catalog/version readback.
- [ ] Complete ChatGPT Web runtime validation; source and local Bridge proof do
  not establish every external host path.

## v0.4 — activation observability and durable learning

- [x] Bridge `trace-contract-v1`: local session continuity plus bounded process-shared recovery for stateless calls, unique-candidate propagation through direct and delegated calls, ambiguity protection, required-skill tracking, verification/persistence/outcome closure, and a multi-session MCP regression.
- [x] Logical observability epochs with a clean active baseline and preserved all-history telemetry instead of destructive metric deletion.
- [ ] Host compliance coverage proving that every eligible substantial task—not only traces already observed—loaded project context, produced a Routing Evidence Checkpoint, and invoked MSSR.
- [x] Privacy-preserving Bridge observatory for route plans, skill loads, context sources, verification, persistence, outcomes, user corrections, and friction signals without raw prompts or transcripts.
- [x] Transversal outcome attribution with one primary skill, supporting-skill contributions, latest-outcome-per-trace deduplication, success/acceptance rates, normalized scores, and an initial local dashboard.
- [x] Portable host-gated skill selection contract: deterministic recommendations remain metadata, required skills remain obligations, optional candidates can be explicitly `accepted`/`skipped` before context loading, and decision telemetry is analyzable by skill plus canonical semantic task signature.
- [x] Portable trace close preflight with `closureDue`, explicit missing gates / next action, ephemeral `until-outcome` working metadata, outcome purge, and regression coverage for the stale `maintenanceRevision` defect.
- [x] Bridge/ChatGPT Web adapter integration for host-gated bootstrap, temporary trace working metadata, closure notices, dashboard decision metrics, and outcome-time purge.
- [x] Privacy-bounded `learning-digest-v1`: before ephemeral RAM is purged at outcome, hosts may distill only canonical semantic signature, recommended/loaded/accepted-skipped skills, stage-to-skill transitions, context-module decisions, outcome metadata, and evidence-backed supported/rejected findings. `workingSummary`, active hypotheses, transcripts, prompts, secrets, and private reasoning are excluded by schema.
- [x] Exact-signature historical priors with minimum evidence threshold for skill activation/acceptance, stage-to-skill transitions, and selective skill/project context. Current mode is explicitly `observe-only`: priors are empirical observability outputs (`prefer` / `neutral` / `deprioritize` / `insufficient-evidence`) and do not affect deterministic routing, scores, context loading, or permissions.
- [x] Hard observe-only boundary: `routingInfluence=false`; current learning analysis has no consumption path from priors into deterministic route scoring or context selection. The minimum-evidence threshold is eligibility to analyze a pattern, not permission to activate it.
- [ ] Learning gate A — representative data collection: accumulate strict digests across domains, stages, callers, skill revisions and outcomes; track independent trace support, explicit-vs-default optional decisions, signature coverage and context-module coverage without changing runtime decisions.
- [ ] Learning gate B — dataset-quality audit: separate deliberate `accepted`/`skipped` evidence from `not-evaluated`, detect incomplete/ambiguous outcomes, retries/correlated traces, stale skill/routing revisions and host/model/runtime drift, and keep legacy selection telemetry distinct from strict learning digests unless explicitly migrated.
- [ ] Learning gate C — historical replay/holdout evaluation: using only evidence available before each historical decision, compare learned predictions against the unchanged deterministic baseline for activation precision/recall where measurable, over-activation/false-skip rates, required-load misses, outcome/acceptance lift, context cost/quality and calibration.
- [ ] Learning gate D — confidence calibration: replace raw empirical rates with support-aware bounded estimates before any decision use; evaluate smoothing, uncertainty intervals, minimum distinct-trace support, recency decay/staleness and sparse-signature back-off. Exact signatures remain the baseline; vector/semantic-neighbor retrieval is secondary and separately evaluated.
- [ ] Learning gate E — shadow decision model: compute what historical evidence *would* have suggested on new traces while continuing to execute the existing deterministic/host-gated route. Measure counterfactual disagreements and future predictive value without affecting skills, scores or context.
- [ ] Learning gate F — reviewed bounded activation, future only: only after replay plus shadow evidence shows repeatable net benefit, add an explicit versioned feature flag, bounded secondary historical score, exploration floor, explanations and instant rollback. Workflow-required skills, dependency invariants, safety/permissions and deterministic hard rules remain authoritative.
- [ ] Gate context-ranking influence separately from skill-ranking influence; module frequency alone must not count as usefulness without downstream outcome/evidence support.
- [ ] Context notice inbox covering provider/runtime failures, active agents,
  pending reviews, changed project state, missing routing compliance, and
  bounded context requests.
- [x] Documented MSSR Context Plane v1 ownership and safety contract: portable
  selection/continuity/message semantics; repository-owned facts; adapter and
  provider-owned I/O/delivery; provenance/freshness receipts; and
  review-only persistence proposals. This is an ADR/documentation boundary,
  not a claim of universal runtime message support.
- [x] Context Plane gate A — versioned portable message and
  continuation-receipt fixtures and cross-host selection parity, including
  source class, canonical owner, provenance, freshness, trace association,
  privacy bounds, and no-authority invariants (0.2.9).
- [x] Context Plane phase 2 — portable strict producers, bounded repository
  collector (ADR/incident/changelog/PROJECT_* facts plus supplied Git/provider
  receipts), evidence freshness revalidation, and a durable explicit-ack
  advisory-only JSON inbox (0.2.10).
- [x] Context Plane gate B (native, Codex, OpenCode) — adapter delivery: one
  shared host helper drains the durable inbox on native/Codex/OpenCode route
  and bootstrap, returns `projectContext`/`contextMessages`/`inbox`/
  `repository`, and exposes explicit `mssr_context_ack`, without assuming
  server push creates a host turn and preserving `unknown`/`stale`/
  `unavailable` rather than fabricating facts (0.2.11).
- [ ] Context Plane gate B (Bridge/ChatGPT Web) — Bridge adapter delivery
  remains pending and must consume a packaged 0.2.11 artifact because its
  local dependency junction crosses the OpenCode workspace authority boundary.
- [ ] Context Plane gate C — prove continuation and persistence-proposal
  behavior across native, Codex, OpenCode, and Bridge/ChatGPT Web. A proposal
  must remain reviewable repository-owned work and never auto-write memory,
  skills, routing, or changelogs.
- [x] Portable modular project-context contract plus Bridge adapter: optional `.bridge/project-context.json`, minimal core loading, stage/intent-selected context-memory-state-directive modules, legacy full-document fallback, and shared semantic selection with skill context.
- [x] Portable versioned change-history contract: strict `changelogs/X.Y.Z.md` parser, PROJECT_CONTEXT/PROJECT_MEMORY/PROJECT_STATE impact declarations (`updated` / `reviewed-none` / `pending`), pure consistency evaluator, and deterministic history-loading predicate for debugging/recovery/release work.
- [x] Bridge project-authority/change-consistency host implementation: workspace audit distinguishes modular/legacy/invalid/empty/not-initialized authorities, project load surfaces migration debt, and persist-mode Git/changelog/memory drift can block publish readiness without auto-writing memory.
- [x] Keyed project-context resolution on native, Codex, and OpenCode route and
  bootstrap through the shared host helper: modular `.bridge` context modules,
  repository-fact selectors/defaults/manifest, and the durable inbox (0.2.11).
- [ ] Extend the same project bootstrap authority/staleness preflight to every
  host and add cross-workspace policy for which repositories are intentionally
  managed versus deliberately memory-free. Bridge preflight still requires a
  packaged artifact.
- [ ] Migrate remaining active managed repositories from legacy or missing project-memory authorities only after reading their real project evidence; do not mass-generate empty PROJECT_* files or manifests.
- [ ] Post-iteration learning/promotion pipeline: isolated evidence -> project regression/context-memory-state update, architecture/design decision, owning skill/tool/guide update, or MSSR fixture/metadata correction according to ownership; never assume every lesson belongs in a skill.
- [ ] Feed eligible historical priors back into route/context ranking as a bounded secondary score with an exploration floor, decay/staleness policy, and review-only proposals before durable routing semantics change. Exact deterministic metadata/fixtures remain authoritative; evaluate vector similarity only as a secondary retrieval signal for nearby signatures.
- [x] Established one canonical first-party MSSR skill source inside this package:
  `mssr-agent-routing`, `shared-skill-governance`,
  `skill-routing-maintainer`, `skill-maintenance-loop`, and on-demand
  `mssr-observability-maintenance`. The five directories exactly match the
  manifest and preserve explicit activation metadata; that does not make every
  listed skill required for every task.
- [x] Met the source admission gates: canonical owner/provenance manifest,
  bundled package inclusion, frontmatter/manifest conformance, provider
  precedence, reserved-shadow audit failure, opt-in installer, and custom
  catalog guards.
- [x] Added source conformance for native, Codex-local, and OpenCode-local
  discovery plus Codex mounting. External, user-created, project, and plugin
  skills remain separate catalogs and cannot silently shadow a reserved name.
- [ ] Complete the runtime conformance matrix: Bridge live discovery after
  restart is proven; ChatGPT Web discovery plus lifecycle, digest, replay, and
  rollback parity across all hosts remain. Source tests do not prove those
  broader gates.
- [ ] Historical replay benchmark measuring missed activation, over-activation,
  required-load compliance, phase continuity, latency, recovery, and outcome
  quality on confirmed real cases.
- [ ] Prove the same trace/checkpoint contract through the packaged host
  adapters while preserving caller-owned execution; do not infer this from a
  Bridge-only integration release.

## v1.0 — portable distribution

- [ ] Published or packaged distribution with reproducible installation.
- [ ] Compatibility matrix and migration guide for a new machine.
- [ ] Evaluation suite measuring route precision, recall, latency, and safe
  degradation rather than relying on anecdotal success rates.
