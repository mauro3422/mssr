# Jev bilingual shortlist repeatability smoke (exploratory)

- **Run:** `mssr-librarian-jev-shortlist-repeatability-20261002T143234Z-v1`
- **Frozen MSSR source:** `b080317aacb3db170711f317a58e155137055de7` / build `mssr-build:sha256:bc288853f02be406`
- **Provider:** TypeSafe Jev `jev-1.13.0` through the explicit Bridge Librarian selector
- **Corpus:** `docs/decisions/0009-semantic-evidence-plane.md` and `docs/ARCHITECTURE.md` at their revision fingerprints in `manifest.json`
- **Class:** repeatability and exact-fetch smoke; same paired question and documents were already exposed earlier in this trace

## Procedure

Two frozen paired-language queries were passed to `mssr_librarian_jev_select` with exact handles previously returned by deterministic search. The Spanish set contained 66 fetchable handles out of 67 search results; English contained 99 out of 100, with the English list truncated at the 100-result cap. One range per language exceeded the exact-fetch limit of 20,000 characters and was excluded before Jev. The ordered handles, source revisions, and exclusions are frozen in `inputs/candidate-handles.json`.

This repeat checks whether Jev repeats the earlier selected handle and whether the returned handle can still be fetched exactly. It does not score semantic correctness: no independently adjudicated or pre-registered answer labels were used, and the same query/source pair was already seen. English and Spanish are paired variants of one conceptual case, not two independent examples.

## Results

The same-source section handle `heading-7` appeared at rank 10/67 for Spanish
and 4/100 for English. Jev selected the smaller exact range `block-26`; its
search ranks were 54/67 for Spanish and 11/100 for English. These block ranks
are derived from its position in the frozen ordered fetchable handles plus
the one oversized result recorded as excluded before each position (rank 4
Spanish; rank 1 English). English was truncated at 100. These post-hoc ranks
describe retrieval context for this one query, not frozen relevance labels.

| Language | Fetchable options | Repeated handle | Exact fetch | Raw provider score |
|---|---:|---|---|---:|
| Spanish | 66 | `block-26`, same handle as prior probe | pass; fingerprint matched | 0.81 |
| English | 99 | `block-26`, same handle as prior probe | pass; fingerprint matched | 0.63 |

Both calls selected `docs/decisions/0009-semantic-evidence-plane.md`, revision `8eece079…`, and exact range `block-26`. Both fetches returned fingerprint `b6a2b7a2…ef4426`, matching the selected handle. Jev used 18,275 input / 1,704 output tokens total; mean provider-reported latency was 822.6 ms. Scores remain uncalibrated and are recorded only as raw output.

## Interpretation and limits

This confirms the explicit search-handle → Jev choice → exact-fetch path repeated the same selection for this one paired query, with intact revision/fingerprint checks. The selected text was relevant to the Librarian/selector boundary. It does **not** establish bilingual quality, top-k recall, answer completeness, generalization, superiority over full-heading selection, a confidence threshold, or production reranking.

The archived provider record identifies the model and returned usage/latency,
but SDK, timeout and retry settings were unavailable (`null`) in the host
receipt. The provider call therefore cannot be replayed byte-for-byte from this
archive; the frozen options, source revisions, and returned observations remain
inspectable.

The earlier broader MSSR experiment remains the useful quality context: on 26 paired queries the 0.2.97 direct Jev Choice runs scored 35/52 and 34/52 with 50/50 fetches; the 64k hierarchical run scored 31/52 with 49/49 fetches. Those labels were Luna-reviewed, not human-owner adjudicated, and the same corpus/queries were reused. The lexical query-rewrite runs from October 2 are offline, made zero Jev calls, improved Spanish development recall but failed the already-open Spanish holdout and degraded English; do not ship their dictionary.

## Operational recommendation

Keep deterministic Librarian search as the exact-text candidate source. If its language-specific results omit likely evidence or return weak candidates, an authorized host can explicitly invoke Jev over a bounded high-recall set (full headings while within the choice budget, or a measured hierarchy for larger catalogs), then exact-fetch the selected handle and compose an answer with citations. For an unfetchable oversized range, exclude it or query smaller exact blocks; do not pass it through and hope Jev can repair it. Keep Jev confidence descriptive until a fresh, document-grouped, independently adjudicated bilingual evaluation supports calibration and any routing policy.

Jev selects finite options. The host still owns intelligent grep, repeated evidence gathering, compaction/paragraph generation, relation checks, verification and writes. Those steps must retain exact citations and their own outcome gates.

## Artifacts

- `manifest.json`: frozen protocol, source/build identity, tool schema hashes, input hashes and plan.
- `inputs/cases.json`, `inputs/candidate-handles.json`: frozen query and ordered exact-handle inputs; no private text or expected answer labels.
- `records.jsonl`: two provider requests and two exact-fetch checks; raw vendor bodies and fetched text are not persisted.
- `summary.json`, `run-completion.json`: derived metrics and terminal receipt.
- `SHA256SUMS`: integrity inventory.
