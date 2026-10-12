# 0.2.117 — 2026-10-10

## Contract

- Summary: prevent self-extraction recommendations for knowledge modules and preserve Jev/Librarian history in selectively loaded, hash-verified modules.
- Areas: Project Context modularization, semantic evidence context, Jev selector history
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: updated
- PROJECT_STATE: updated

## Behavior

- The read-only modularization planner no longer proposes moving a section when its source already equals the canonical suggested knowledge path. Budget pressure remains visible for review.
- Split the exact Document Surface/Librarian contract from the semantic-evidence module while retaining the same seven term selectors in a separately budgeted module. The original parent module keeps its ID and selectors; its largest-target selection falls from 9,512 bytes to about 4,413 bytes.
- Preserve the full Jev 0.2.95 and 0.2.97 selector-history sections in a focused reference module; `PROJECT_MEMORY` now points there and retains the concise durable contract.
- No confidence calibration, source authority, or host runtime behavior changes.

## Verification

- `npm run test:project-context-loader`: passed, including exact source fingerprints, focused selector activation, and unrelated-intent exclusion.
- `npm run test:project-context-modularization`: passed, including canonical-path self-extraction regression.
- Full `npm run verify`: passed, including all repository tests, cross-host conformance, and skill audit.
- `npm run release:gate`: passed; final artifact identity and hash are recorded in `.mssr/runtime/releases/0.2.117.json`. The gate packages the candidate and does not publish or activate it.
