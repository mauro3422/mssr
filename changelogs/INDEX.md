# MSSR changelog index

Versioned release notes are the canonical project change-history surface. Hosts may load this index selectively for debugging, recovery, maintenance, or release verification.

## Current releases

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
