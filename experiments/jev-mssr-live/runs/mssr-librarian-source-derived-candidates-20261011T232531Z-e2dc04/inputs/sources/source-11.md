# 0.2.123 - 2026-10-11

## Contract

- Summary: correct Bridge adoption provenance in current state and record the controlled paired excerpt-cap study plan for Jev/Librarian.
- Areas: project-state, Jev/Librarian evaluation
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Identify `2ee6ddc` as the Bridge activation-documentation follow-up commit, not a runtime-adoption receipt. Keep the runtime boot, watchdog acknowledgement, artifact hash, and the absence of a separately persisted adoption receipt distinct.
- Record the 260-vs-larger excerpt comparison as planned only. Prior linked calls and the run corpus are exposed evidence, not holdout samples; no score, threshold, selector default, or runtime behavior changes.

## Verification

- `npm run release:gate` passed and ran `npm run verify` successfully (exit code 0).
- Exact artifact metadata is recorded in `.mssr/runtime/releases/0.2.123.json` and `.mssr/PROJECT_STATE.md`.
- This is source-package verification only. No Bridge restart or runtime adoption occurred.
