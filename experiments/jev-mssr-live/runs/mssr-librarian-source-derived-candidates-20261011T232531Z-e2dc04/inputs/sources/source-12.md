# 0.2.126 - 2026-10-11

## Contract

- Summary: keep heading-mode Jev excerpts aligned with canonical Markdown offsets across newline variants and keep current diagnostic history within its loadable Project Context budget.
- Areas: Librarian Jev selection, Project Context modularization
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Normalize heading-mode source Markdown once and use that same LF string for Document Surface offsets, heading boundaries, and excerpt slicing.
- Preserve the existing exact-fetch validation and byte/fingerprint checks; only the excerpt supplied to Jev changes for newline variants whose raw offsets previously diverged.
- Add regression coverage for LF, CRLF, bare CR, mixed line endings, supplementary Unicode before a target heading, and missing trailing newline.
- Move the three 2026-10-11 connected diagnostics into a separately indexed reference module; preserve the existing earlier run history and its caveats verbatim.
- Record both verified findings in the MSSR incident ledger with the runtime-adoption gate explicit.

## Verification

- `npm run check` passes.
- `npm run test:document-surface` passes.
- `npm run test:librarian-contract` passes, including Jev selection and exact-fetch regression coverage.
- `npm run verify` passes after the context-history split; all repository tests, cross-host conformance, and the skill audit pass.
- `npm run release:gate` passes and records the exact package fingerprint in `.mssr/runtime/releases/0.2.126.json`.
- No production Bridge restart or runtime adoption occurred.
