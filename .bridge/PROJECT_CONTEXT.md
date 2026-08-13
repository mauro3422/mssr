# MSSR project context

## Architecture

MSSR is the portable deterministic/advisory control layer for skill routing, modular skill/project context, trace contracts, telemetry analysis, and external operational learning. It must remain host-agnostic where possible. Bridge, Codex, and OpenCode adapters may observe filesystem/runtime state, but portable MSSR owns the schemas and pure decision/evaluation logic.

## Canonical ownership

- Routing contract and fixtures: `config/skill-routing/`.
- Portable routing/context/learning implementation: `src/`.
- Host-specific filesystem/runtime integration belongs in the host adapter, not in portable core.
- Reusable first-party MSSR operational skills are planned to move into this package; external/user/project skills remain separate catalogs.
- Versioned release history lives in `changelogs/`; root `CHANGELOG.md` is a compatibility pointer.

## Project knowledge governance

Project-local facts, decisions, and mutable state are explicit `.bridge` authorities. Metrics, telemetry, learning digests, and audits may recommend maintenance but never silently rewrite project memory, routing, skills, or changelog content.
