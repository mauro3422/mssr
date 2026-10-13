# Metadata-key false-match diagnosis and ADR 0007 follow-up

## Finding

Before the source fix, a document that did not contain `revision` returned three Librarian ranges for a search for that word. The lexical index included JSON object keys from generated metadata (`sourceRef`, `revision`, `startLine`, and similar) as if they were source text. This created false candidates with no evidence in the Markdown.

MSSR 0.2.131 now indexes recursively collected metadata values and omits property names. Structured exact filters are unchanged. `searchableMetadata` values remain searchable, while their keys remain filter labels. The existing primary-query-before-variant ordering is unchanged.

## Real-source diagnostic

On the exposed ADR 0007 source, the weak Spanish-only query returned zero candidates after the fix. Before the fix, its apparent rank-27 “match” was supported only by the generated `revision` key; it was not a semantically valid retrieval. Adding an explicit English query variant produced 35 candidates under a 54-result cap. The exact line-38 target was rank 5, including within the top-20 pool.

One captured live TypeSafe Jev selection chose `block-9/item-7`, lines 38–38, with provider confidence 1.00 and Noul sufficiency 0.92. Exact fetch then verified the source revision and range fingerprint and returned the unmodified line. These scores remain uncalibrated. This is one exposed source cluster, not owner-gold or holdout evidence.

Two identical direct Jev calls were made while collecting the result. The first returned selected status, but its response was truncated by the host-side display before the selected handle and usage were retained. The report preserves only the captured repeat's metrics; total token usage across both calls is unknown. The duplicate does not count as another evaluation unit.

## Bridge boundary

The Bridge-backed selector did not reach Jev. Its lifecycle preflight first required a routed trace; after that was supplied through the wrapper, it rejected a handle whose locally asserted owner did not match Bridge's caller-derived document owner. This is a valid ownership guard. A real Bridge end-to-end rerun must begin with Bridge Librarian search and pass its returned exact handles to Bridge Jev selection.

## Verification and limits

The build and all four Librarian contract, retrieval, Jev-selection, and evidence-pack suites passed. The full `npm run verify` and `npm run release:gate` also passed. The local package artifact is 1,186,924 bytes with SHA-256 `11d31ecfad4af694a3aa930db4909078034f9d57f976071a14619a4d9df64b82`. It has not been published or adopted by Bridge. No runtime threshold, policy, canonical source, or production behavior changed.
