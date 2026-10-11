# 0.2.124 - 2026-10-11

## Contract

- Summary: prevent the Librarian Jev selector from producing malformed Unicode when excerpt budgets truncate text, and preserve a bounded exploratory live-source diagnostic.
- Areas: Librarian Jev selection, experiment evidence
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Apply the existing heading-mode excerpt limit in Unicode code points, consistently with query-centered excerpt construction.
- When per-option metadata pressure requires a UTF-16 length truncation, move the boundary back one code unit if it would split a surrogate pair.
- Keep the public selector schema and production 260-character cap unchanged. No experimental cap override was added.
- Persist five live Jev selection calls across three source-document clusters, with exact fetch checks for selected handles and a blind model-assisted review. The run is exploratory, not preregistered, owner-gold, or calibration evidence; all scores remain uncalibrated.

## Verification

- `npm run build` passed.
- `npm run test:librarian-contract` passed, including Unicode excerpt and metadata-compaction regressions.
- `npm run test:semantic-curation-mcp` passed; public MCP behavior remains unchanged.
- Source package release gate and exact tarball receipt are recorded in `.mssr/runtime/releases/0.2.124.json`.
- No Bridge restart or runtime adoption occurred.
