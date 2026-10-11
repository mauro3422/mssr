# 0.2.125 - 2026-10-11

## Contract

- Summary: make the composed Librarian experiment harness report exact facet-evidence completeness separately from semantic coverage and answer-synthesis readiness.
- Areas: Librarian experiment harness, verification fixtures
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- Keep line-span overlap as a structural metric only. The replay now reports whether every required facet has a selected, exact-fetched receipt, while semantic coverage remains `unknown` and owner gold remains false.
- Block answer synthesis when any facet abstains or lacks exact fetched evidence. When every facet has exact fetched evidence, report `pending-independent-semantic-review`; the harness never authorizes generated answer prose.
- Preserve the existing search, selection, exact-fetch and verbatim evidence-pack contracts. No retrieval, production selector, production Bridge, or runtime activation behavior changes.

## Verification

- `node scripts/test-composed-librarian-experiment.mjs` passes selected, abstained, all-abstain, exact-fetch and persisted replay gates.
- `npm run test:librarian-contract` passes.
- The composed replay regression is now included in `npm run test` and therefore in `npm run verify`.
- `npm run build` and `npm run release:gate` pass; package tarball and source receipt are recorded under `.mssr/runtime/releases/0.2.125.json`.
- No production Bridge restart or runtime adoption occurred.
