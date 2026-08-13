# MSSR project context

## Architecture

MSSR is the portable deterministic/advisory control layer for skill routing, modular skill/project context, trace contracts, telemetry analysis, and external operational learning. It must remain host-agnostic where possible. Bridge, Codex, and OpenCode adapters may observe filesystem/runtime state, but portable MSSR owns the schemas and pure decision/evaluation logic.

## Canonical ownership

- Routing contract and fixtures: `config/skill-routing/`.
- Portable routing/context/learning implementation: `src/`.
- Host-specific filesystem/runtime integration belongs in the host adapter, not in portable core.
- `config/first-party-skills.json` names five bundled MSSR operational skills under `skills/`. `MssrFirstPartySkillProvider` is the canonical source for those reserved names; external, user, project, and plugin skills remain separate catalogs.
- A bundled source wins precedence. A runtime mount to the same real source is an alias; a divergent external source with a reserved name is a blocking shadow conflict rather than an alternative editable owner.
- Codex mounting is opt-in through `scripts/install-first-party-skills.ps1`; installation never runs implicitly at package install time and only mutates manifest-named targets.
- Versioned release history lives in `changelogs/`; root `CHANGELOG.md` is a compatibility pointer.
- Context Messages v1 is owned by portable MSSR: bounded schemas, deterministic intent/stage selection, evidence provenance/freshness, continuation receipts, dedupe/accounting, and review-only persistence proposals. Repositories remain the canonical owners of facts; adapters own reads and delivery only.
- Context Plane phase 2 (0.2.10) adds the portable strict producers, the bounded repository collector over ADR/incident/changelog/PROJECT_* facts plus supplied Git/provider receipts, freshness revalidation, and a durable explicit-ack advisory-only JSON inbox.
- Context Plane host delivery (0.2.11) keys repository facts (explicit per-fact selectors with source-kind defaults plus an optional `.bridge/context-messages.json` manifest), adds a modular `.bridge/project-context-modules.json` loader, and wires the durable plane into native `mssr_route_plan`, Codex `skill_route_plan`/`skill_bootstrap`, and OpenCode `mssr_route_plan`/`mssr_skill_bootstrap` through the shared `loadProjectContextHost` helper with an explicit `mssr_context_ack` on all three host surfaces. Bridge adapter delivery is pending: its local dependency junction crosses the OpenCode workspace authority boundary and must consume a packaged 0.2.11 artifact instead. No host claims live/restart inbox adoption beyond the targeted activation probes.
- Context Plane inbox tombstones (0.2.12): an acknowledged delivery receipt acts as a temporary tombstone for the same evidence — enqueue suppresses only a message whose `messageId` and stable content `fingerprint` (sha256 over the validated message, identity excluded) both match an already-acknowledged receipt. Content/revision changes or a new id reappear; `receiptRetentionMs` pruning lets identical evidence be delivered again. Inbox state schema is v2 with transparent v1 migration; migrated receipts carry no fingerprint and never suppress.

## Project knowledge governance

Project-local facts, decisions, and mutable state are explicit `.bridge` authorities. Metrics, telemetry, learning digests, and audits may recommend maintenance but never silently rewrite project memory, routing, skills, or changelog content.

Architecture decisions live under `docs/decisions/`. A Context Message may reference an ADR, incident, changelog, context/state authority, Git revision, provider observation, or trace receipt, but its summary never replaces the referenced owner.
