# MSSR roadmap

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
- [ ] Host adapters for Bridge, Codex-local, and ChatGPT-compatible MCP clients.

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
- [x] Exact-signature historical priors with minimum evidence threshold for skill activation/acceptance, stage-to-skill transitions, and selective skill/project context. Current mode is explicitly `observe-only`: priors are metrics/probability-like observability outputs (`prefer` / `neutral` / `deprioritize` / `insufficient-evidence`) and do not affect deterministic routing, scores, context loading, or permissions.
- [ ] Context notice inbox covering provider/runtime failures, active agents,
  pending reviews, changed project state, missing routing compliance, and
  bounded context requests.
- [x] Portable modular project-context contract plus Bridge adapter: optional `.bridge/project-context.json`, minimal core loading, stage/intent-selected context-memory-state-directive modules, legacy full-document fallback, and shared semantic selection with skill context.
- [ ] Complete project bootstrap authority/staleness preflight across hosts, including explicit reporting for missing or stale context authorities beyond manifest validity.
- [ ] Post-iteration learning/promotion pipeline: isolated evidence -> project regression/context-memory-state update, architecture/design decision, owning skill/tool/guide update, or MSSR fixture/metadata correction according to ownership; never assume every lesson belongs in a skill.
- [ ] Feed eligible historical priors back into route/context ranking as a bounded secondary score with an exploration floor, decay/staleness policy, and review-only proposals before durable routing semantics change. Exact deterministic metadata/fixtures remain authoritative; evaluate vector similarity only as a secondary retrieval signal for nearby signatures.
- [ ] Package MSSR first-party skills under one canonical `mssr` source tree instead of relying on Mauro's external Codex catalog for the router's own operation. Audit and strengthen at least `mssr-agent-routing`, `shared-skill-governance`, `skill-routing-maintainer`, `skill-maintenance-loop`, and on-demand `mssr-observability-maintenance`; distinguish "shipped first-party" from "required on every task".
- [ ] Add host installation/adapters for packaged MSSR core skills: Codex mount/junction support, OpenCode package/native adapter loading, and Bridge/ChatGPT Web direct package discovery. External/user-created/project/plugin skills remain separate provider catalogs and must not silently shadow reserved first-party names.
- [ ] Add a cross-host conformance matrix proving the same MSSR core skill versions, activation metadata, dependency closure, maintenance lifecycle, and digest semantics are visible from Codex, OpenCode, and ChatGPT Web without copying multiple editable sources.
- [ ] Historical replay benchmark measuring missed activation, over-activation,
  required-load compliance, phase continuity, latency, recovery, and outcome
  quality on confirmed real cases.
- [ ] Cross-host adapters that expose the same trace/checkpoint contract in
  Codex-local and ChatGPT web while preserving caller-owned execution.

## v1.0 — portable distribution

- [ ] Published or packaged distribution with reproducible installation.
- [ ] Compatibility matrix and migration guide for a new machine.
- [ ] Evaluation suite measuring route precision, recall, latency, and safe
  degradation rather than relying on anecdotal success rates.
