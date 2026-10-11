# 0.2.122 - 2026-10-11

## Contract

- Summary: separate the current Jev/Librarian handoff from historical Git lineage and evaluation gates using exact heading selectors; preserve historical evidence in its original source file.
- Areas: project-context, Jev/Librarian operations
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Keep the active handoff bounded to repository preservation and current evaluation gates; current release/runtime facts remain owned by `.mssr/PROJECT_STATE.md`.
- Keep the existing logical handoff module and use its sidecar segments: one short current baseline plus at most one selected historical section per recovery query. This avoids growing the 48-module manifest and stays within the 5,000-byte entry limit.
- The stale earlier 2026-10-11 next-gates snapshot remains in the source file under a dated historical heading and is available only through its explicit historical selector.
- Preserve each selected source section byte-for-byte; only the old next-gates heading is relabeled, and a compact current next-gates section points to the current state and evaluation owners.
- No retrieval, Jev decision, score, threshold, permission, or runtime behavior changed.

## Verification

- `npm run build` passed with build receipt `mssr-build:sha256:0cf2c69f91b5679c`.
- Focused `test:project-context-loader`, `test:project-context-health`, `test:project-context-modularization`, and `test:project-context-maintenance` passed.
- Read-only loader probes selected the baseline at 1,082 bytes; candidate-branch, historical-evaluation, and pre-diagnostic recovery selections at 1,687, 2,492, and 3,494 bytes respectively. A normal implementation query did not select this resume-only handoff. Project Context Health returned `watch`, valid manifest, 48 modules, with the former handoff budget finding resolved.
- Full `npm run verify` passed, including typecheck, complete test suite, cross-host conformance, and skill audit.
- The first `npm run release:gate` attempt correctly blocked on the stale `CHANGELOG.md` current-release pointer; after correcting it, the gate passed and produced `mauroprime-mssr-0.2.122.tgz`. The release receipt records its exact package size and checksum; `.mssr/PROJECT_STATE.md` records the verified checksum.
