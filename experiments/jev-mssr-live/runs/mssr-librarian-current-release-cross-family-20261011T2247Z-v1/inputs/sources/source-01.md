# 0.2.127 — 2026-10-11

## Contract

- Summary: preserve complete bounded context-selection evidence when a trace learning digest closes.
- Areas: trace learning digest, lifecycle learning persistence
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Raise the strict `contextSelections` digest bound from 96 to 128 so observed skill and project selections from real multi-phase traces are not discarded when the digest is created.
- Preserve fail-closed behavior above the explicit bound; no silent truncation or partial learning digest is introduced.
- Add regressions proving 102 entries survive unchanged and 129 entries are rejected.
- Raise the selected recent Jev connected-diagnostics module budget to 4,000 after the preserved run history grew to 3,670 characters and exceeded its prior 3,500-character bound; this restores the already-tested selector behavior without dropping evidence.
- Correct the context-loader assertions to match the canonical run report's actual findings and caveats, rather than stale wording about a compound query and independent evaluation.
- Keep semantic experience shadow evidence advisory; digest persistence does not promote a Jev judgment or modify routing.

## Verification

- `npm run check` passes.
- `npm run test:learning-evaluation` passes, including the 102/129 schema boundary.
- `npm run test:project-context-loader` passes with the recent diagnostic module selected again.
- `npm run verify` and `npm run release:gate` pass with the exact package artifact recorded in `.mssr/runtime/releases/0.2.127.json`.
- Bridge adoption and live digest recovery are separate host gates; no runtime claim is made by this package release.
