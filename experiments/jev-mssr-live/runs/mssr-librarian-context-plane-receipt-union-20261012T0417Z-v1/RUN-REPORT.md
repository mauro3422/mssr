# Run 40: Context Plane receipt facets and evidence-pack control

## Question and scope

This live diagnostic checks whether Jev can select two source-exact facets from a small union of Librarian search candidates, whether those selections can be re-fetched and packed with exact citations, and whether the host can compose a compact answer. A separate control checks deterministic removal of a child range already contained by a parent section.

The source is `.mssr/knowledge/architecture/context-plane-history.md`, English, snapshot SHA-256 `e58610d13b3ed35537e30c0f5b16d03b7aa3033c868d4ed000cc183a71305fc7`, Librarian revision `ac6204112aa086bd9d25634792ebde3559e802617fc0fb004f69bcdc13f93392`. The source was not declared in the Project Context Librarian sidecar. The bounded exposure audit found no prior exact snapshot/hash but did find broad thematic exposure through earlier Context Plane work. Classify this as a **near-disjoint facet diagnostic**, not a clean holdout or independent source family.

## Frozen method and integrity

The immutable pre-call manifest, case/label files, candidate set, search outputs, source snapshot, and `PRECALL-SHA256SUMS` remain unchanged. Two deterministic source-local lexical queries each searched up to 20 results (17 returned per query). The union contained 13 distinct candidate handles after exact-fingerprint deduplication; each labeled target appeared at rank 3. Labels are source-derived and were not included in Jev requests.

Before calling Jev, exact fetch rejected the initially generated source snapshot because its line endings had changed and the handle was stale. The rejection is preserved in `inputs/precall-fetch-integrity.json`. The snapshot was then replaced with a byte-for-byte copy of the canonical source; SHA-256 matched the frozen source and both pre-call exact fetch checks passed. Jev was called only after this correction.

## Live Jev selections and exact fetches

| Facet | Jev result | Exact accepted range | Choice | Evidence sufficiency | Fetch |
|---|---|---|---:|---:|---|
| Acknowledged receipt tombstone identity | Selected | `block-4/item-1` (line 16) | 0.52 | 0.40 | Exact revision, range and fingerprint passed |
| Canonical-owner migration reconciliation | Selected | `block-5/item-1` (line 21) | 0.74 | 0.85 | Exact revision, range and fingerprint passed |

Both were single-pass selections with one Jev provider call each. Aggregate use was 5,001 input tokens and 354 output tokens (5,355 total); provider-reported call elapsed times sum to 1,067.3 ms. Scores are descriptive provider outputs and remain uncalibrated; they are not success probabilities or acceptance thresholds.

The validated two-facet evidence pack retained both disjoint exact ranges, removed none, and contained 1,165 text characters. Relative to the 3,576-character frozen source snapshot this is a 67.4% reduction in retrieved text. This is **source retrieval reduction**, not compaction of overlapping evidence.

## Separate containment/compaction control

A second evidence-pack call supplied the 548-character tombstone child together with its containing section. Strict contained-range deduplication retained the parent section (590 text characters) and removed the child handle, saving 548 duplicated characters. This demonstrates structural containment deduplication for this pair only; it does not establish semantic summarization or general compaction quality. The full result is preserved in `raw/evidence-pack-overlap-control.json`.

## Host composition and blind review

The host joined facts from the two exact fetched ranges into one paragraph with source-line citations. Jev selected evidence; it did not write or paraphrase the answer. A blind Luna reviewer, shown only the questions, paragraph, and exact excerpts, judged both facets sufficient and the citations complete, with no unsupported or overbroad clause found. This is model-assisted review, not independent owner adjudication or owner-gold. See `derived/composed-answer.md` and `derived/BLIND-REVIEW.md`.

## Result and limits

This run demonstrates a narrow live path: deterministic lexical search → Jev selection → exact fetch → cited evidence pack → host composition, plus a separate deterministic structural dedupe control. It is a positive result on two source-derived facets in one conceptually exposed source cluster. It does not test Jev-authored prose, automatic facet decomposition, semantic compaction, contradiction learning, downstream task success, a clean holdout, reliability, or calibrated confidence. No threshold, runtime policy, sidecar metadata, or production behavior changed.

The initial stale-snapshot rejection and an earlier route-key mismatch were caller-side orchestration friction; both were corrected before provider evaluation and neither is attributed to the Librarian or Jev product path. See `derived/validation.json` for reproducible integrity checks and `DERIVED-SHA256SUMS` for output hashes.
