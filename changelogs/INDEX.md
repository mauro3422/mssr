# MSSR changelog index

Versioned release notes are the canonical project change-history surface. Hosts may load this index selectively for debugging, recovery, maintenance, or release verification.

## Current releases

- [0.2.13](0.2.13.md) - Godot routing tightening: `godot-graph-ux-audit` drops `coding` from its declared domains so the existing domain gate excludes the Godot block from non-Godot tasks; no new gate or contract surface added, with architecture-negative and Godot-positive fixtures.
- [0.2.12](0.2.12.md) - acknowledged inbox receipts act as temporary tombstones for identical evidence: enqueue suppresses only acknowledged same-id+same-fingerprint messages, content/revision changes reappear, retention pruning re-enables delivery, and the inbox schema moves to v2 with transparent v1 migration.
- [0.2.11](0.2.11.md) - keyed project context delivery: repository facts receive explicit selectors, defaults, and an optional manifest; a modular project-context loader; a durable context plane wired into native/Codex/OpenCode route and bootstrap plus explicit `mssr_context_ack`. Bridge adapter delivery remains pending on a packaged artifact.
- [0.2.10](0.2.10.md) - portable strict producers, bounded repository collector, freshness revalidation, and a durable explicit-ack advisory-only JSON inbox; host delivery integration remains pending.
- [0.2.9](0.2.9.md) - portable Context Messages v1, continuation receipts, cross-host selection parity, and reviewed documentation-persistence guidance.
- [0.2.8](0.2.8.md) - five bundled first-party skills, reserved-name/provider guards, opt-in Codex installation, and explicit live-adapter boundary.
- [0.2.7](0.2.7.md) - portable route-closure obligations and success validation.

- [0.2.6](0.2.6.md) — portable change-history contract, project-memory consistency evaluation, learning rollout documentation.

## Historical archive

- [LEGACY](LEGACY.md) — preserved monolithic changelog for releases before the per-version migration. Do not load by default; inspect only for a specific historical regression/version.

## Release contract

Every new `X.Y.Z.md` must contain:

- `Summary`
- `Areas`
- `PROJECT_CONTEXT`: `updated`, `reviewed-none`, or `pending`
- `PROJECT_MEMORY`: `updated`, `reviewed-none`, or `pending`
- `PROJECT_STATE`: `updated`, `reviewed-none`, or `pending`

`pending` blocks persistence. `reviewed-none` records that project-knowledge impact was explicitly reviewed and no durable update was required.
