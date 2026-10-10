# 0.2.114 — 2026-10-10

## Contract

- Summary: disambiguate bounded Jev project-review summary counts while preserving the legacy numeric field.
- Areas: semantic curation, MCP summary contract, observability
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- `relationReviewRequired` counts pair judgments below the local relation threshold.
- `blockReviewRequired` counts jobs containing at least one block routed to review.
- `aggregateReviewRequired` counts jobs whose complete evaluator result requires review for either block or relation reasons.
- Legacy `reviewRequired` remains an alias for `relationReviewRequired` for compatibility; it no longer stands in for the aggregate gate.
- No thresholds, source authority, learning promotion, or canonical-write behavior change.

## Verification

- Add a focused regression covering accepted relation + block review and rejected relation without block review.
- `npm run build`: passed; focused `npm run test:semantic-curation-mcp`: passed.
- `npm run verify`: passed through `npm run release:gate`.
- `npm run release:gate`: passed. The local artifact's size and SHA-256 are recorded in `.mssr/runtime/releases/0.2.114.json`; this does not publish or adopt it in Bridge.
