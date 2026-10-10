# 0.2.120 — 2026-10-10

## Contract

- Summary: make exact Librarian metadata filter semantics and EvidenceAtom projection keys explicit in the public search schema.
- Areas: librarian, metadata-search, tool-schema, regression-tests
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Document that metadata filters use exact field/value equality and may match caller-supplied document/range metadata, `searchableMetadata`, or a matching EvidenceAtom projection.
- Enumerate the closed singular EvidenceAtom projection keys in the query schema and clarify that Project Context selector declarations such as `domains`/`actions` map to filter keys such as `domain`/`action`.
- Preserve generic exact metadata filtering and all search behavior; this change adds no new authority, candidate ranking, confidence interpretation, or data ingestion.

## Verification

- `npm run build` passed with `mssr-build:sha256:c0b0df2f3eeccf0f`.
- Focused Librarian contract/retrieval/Jev-selection/evidence-pack tests, Project Context Librarian tests, MCP tests (48 tools), and change-history tests passed.
- Full `npm run verify` passed, including the complete suite, cross-host conformance, and read-only skill audit.
- `npm run release:gate` passed and wrote `.mssr/runtime/releases/0.2.120.json`; the exact package hash and size are recorded in that receipt to avoid a self-referential hash in the packaged changelog.
- The live Bridge wrapper has not adopted this description update; its independent repository has unrelated uncommitted and untracked work, so no Bridge files were changed.
- Not published to npm or activated in Bridge.
