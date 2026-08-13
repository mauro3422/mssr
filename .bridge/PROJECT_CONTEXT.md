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

## Project knowledge governance

Project-local facts, decisions, and mutable state are explicit `.bridge` authorities. Metrics, telemetry, learning digests, and audits may recommend maintenance but never silently rewrite project memory, routing, skills, or changelog content.
