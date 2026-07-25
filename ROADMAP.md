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

- [ ] Host compliance contract proving that substantial specialized work loaded
  project context, produced a Routing Evidence Checkpoint, routed the active
  phase, and carried the same trace through required skill loads/checkpoints.
- [x] Privacy-preserving Bridge observatory for route plans, skill loads,
  context sources, verification, persistence, outcomes, user corrections, and
  friction signals without raw prompts or transcripts.
- [x] Transversal outcome attribution with one primary skill, supporting-skill
  contributions, latest-outcome-per-trace deduplication, success/acceptance
  rates, normalized scores, and an initial local dashboard.
- [ ] Context notice inbox covering provider/runtime failures, active agents,
  pending reviews, changed project state, missing routing compliance, and
  bounded context requests.
- [ ] Project bootstrap preflight that distinguishes durable project facts from
  reusable global procedures and reports missing/stale context authorities.
- [ ] Friction checkpoint and promotion pipeline: isolated event -> project
  regression -> owning skill update -> MSSR fixture/metadata correction.
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
