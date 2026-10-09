# 0.2.104 — 2026-10-04

## Contract

- Summary: prevent common English/Spanish function words from alone generating Librarian search candidates.
- Areas: Librarian retrieval and search quality
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: updated
- PROJECT_STATE: updated

## Bilingual query term filtering

- Filter a bounded English/Spanish function-word set from query terms only; indexed Markdown and exact fetched source retain their original words.
- Queries with no remaining content terms return no candidates. Remaining scores continue to measure lexical term overlap, not semantic relevance or calibrated confidence.
- Add English and Spanish unrelated-query regressions plus an all-stopword regression while preserving accented/decomposed Spanish retrieval and `ñ`/`n` distinction.
- A direct MCP smoke before the query fix projected 2/2 current sidecar declarations and completed Spanish/English search → exact fetch → evidence-pack checks; both fetched ranges matched their pack text and citation fingerprints. This proves tool composition for the observed MCP route, not active Bridge package identity.
- A post-fix local build repeated the real sidecar projection/search/fetch/pack path, preserved the exact 7,728-character Spanish range, and returned zero candidates for the reproduced unrelated English query. No user labels, Jev provider call, threshold, host deployment, or npm publication was used.

## Verification

- `npm run build` — PASS.
- `npm run test:librarian-contract` — PASS.
- `npm run test:project-context-librarian` — PASS.
- `npm run verify` — PASS, including full MSSR, cross-host conformance and skill audit suites.
- `npm run release:gate` — PASS; a local package artifact was generated and remains unpublished. Its exact integrity receipt is stored under `.mssr/runtime/releases/0.2.104.json` and summarized in `.mssr/PROJECT_STATE.md`.
