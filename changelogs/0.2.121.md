# 0.2.121 - 2026-10-11

## Contract

- Summary: derive exact Librarian list-item ranges across blank-line-separated Markdown continuations and nested lists, including visually equivalent mixed tab/space sibling indentation, while preserving sibling boundaries and aggregate Document Surface block IDs; compact and split over-budget Project Context references without changing evidence bytes.
- Areas: librarian-retrieval, document-surface, Jev evidence validation, evidence packs, project-context
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: updated
- PROJECT_STATE: updated

## Behavior

- Rebuild child list-item ranges from original source lines across blank separators only while indentation keeps the lines inside the list; stop before unindented prose or a heading.
- Keep same-level siblings in separate exact ranges by visual indentation columns, preserve nested and continuation lines with their parent item, and exclude trailing blank separators from the fetched range.
- Preserve aggregate `block-N` identities. The shared index remains the source for search, Jev candidate validation, exact fetch, and cited evidence packs.
- Confidence, authority, privacy, and canonical-write policy are unchanged. This fixes evidence-range completeness and does not establish semantic answer quality or score calibration.
- Relocated four already-indexed knowledge sections byte-for-byte with hash verification, condensed the current-release state summary, and section-indexed the dated live diagnostic by existing headings so historical runtime evidence stays distinct from current runtime state.

## Verification

- The new retrieval regression failed before the implementation change on the blank-line-separated parent/continuation/nested/sibling case.
- `npm run build` passed after implementation.
- `npm run test:librarian-contract` passed, including contract, retrieval, Jev selection, and evidence-pack tests.
- Full `npm run verify` passed with exit code 0 after the Project Context maintenance.
- `npm run release:gate` passed and generated `mauroprime-mssr-0.2.121.tgz`; the ignored receipt at `.mssr/runtime/releases/0.2.121.json` records its exact size, SHA-256, npm shasum, and integrity. Keeping the package hash in the excluded current-state authority avoids a self-referential changelog hash.
- At MSSR package publication, Bridge adoption and a live Jev run through 0.2.121 were pending; the later runtime readback is in `.mssr/PROJECT_STATE.md` and the exploratory selection details are in the indexed Bridge 0.6.169 smoke report.
