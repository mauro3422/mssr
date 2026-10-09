# MSSR Librarian bilingual lexical expansion probe

- **Run:** `mssr-librarian-bilingual-expansion-20261002T135011Z-v2`
- **Source build:** `mssr-build:sha256:bc288853f02be406` at `b080317aacb3db170711f317a58e155137055de7`
- **Corpus:** 21 frozen MSSR documents; 26 bilingual query pairs
- **Mode:** offline; 156 deterministic searches; no provider or Jev calls
- **Status:** exploratory only; reuses a corpus and grouped holdout opened in the parent run

## Exact expected-section retrieval

Recall@100 is candidate presence, not semantic answer quality. The paired-language column is a reference query, not a runtime translation feature.

| Language | Variant | Recall @1 | Recall @5 | Recall @100 | MRR @100 | Missing / 26 |
|---|---|---:|---:|---:|---:|---:|
| EN | Current baseline | 0.0% | 3.8% | 69.2% | 0.0326 | 8 |
| EN | Lexicon rewrite | 0.0% | 0.0% | 53.8% | 0.0161 | 12 |
| EN | Paired-query reference | 0.0% | 7.7% | 15.4% | 0.0257 | 22 |
| EN | Baseline + rewrite merge | 0.0% | 0.0% | 69.2% | 0.0290 | 8 |
| ES | Current baseline | 0.0% | 7.7% | 15.4% | 0.0257 | 22 |
| ES | Lexicon rewrite | 0.0% | 7.7% | 34.6% | 0.0316 | 17 |
| ES | Paired-query reference | 0.0% | 3.8% | 69.2% | 0.0326 | 8 |
| ES | Baseline + rewrite merge | 0.0% | 7.7% | 26.9% | 0.0283 | 19 |

## Interpretation

The baseline, rewrite and merge share one frozen corpus and query set. The lexicon variant substitutes exact one-token equivalents and reruns the existing deterministic search; it neither changes the core search implementation nor lets Jev generate terms. The merge deduplicates exact handles, keeps the maximum score returned by either query, then applies stable tie-breaks.

Because this exact corpus and holdout were already scored in the parent run, all new results are exploratory regardless of the inherited split. Do not use them to set confidence thresholds or claim general bilingual performance. A fresh document-grouped holdout and owner-adjudicated acceptable evidence ranges are required before a production routing change.

See `manifest.json`, `predictions.json`, `evaluation.json`, `run-completion.json`, and `SHA256SUMS` for frozen inputs, label-blind predictions, separate scoring, and integrity evidence.
