# Run 64 — bilingual retrieval and exact-target selection diagnostic

**Run:** `mssr-librarian-query-variant-replay-20261012T2326Z-v1`
**Date:** 2026-10-12
**Status:** completed diagnostic; no runtime, policy, or threshold changed.

## Question and method

This replay isolates two already-exposed Run 63 failures using the same two frozen MSSR source snapshots. It is not a new cohort. MSSR search ran with metadata off and up to 12 results. The A1 treatment added one explicit host-supplied English query variant to the original Spanish query. B1 retained the same Spanish query and added its English translation. Jev then received only the exact target handle plus the abstention option, so these Jev calls measure exact-target selection rather than ranking among competing candidates. Three further B1 calls held the same exact table fixed while changing the query from Spanish compound, to English compound, to two Spanish facets. Labels and answer values were not sent to Jev.

The frozen source snapshots are Run 63's copies: Godot Atlas (`ef0b0fa250c9b5e19e7f486dfc8e56cdb03c34b6d3323ab5d8d7cf49e8ef925d`) and NeoPSE (`aeb71416156ca39fb533e05982ca9283ace633a217e2a5316c81a1735ade6b3d`). Both are internal MSSR document examples, not an independently sampled or owner-adjudicated corpus.

## Results by stage

| Case / stage | Spanish primary | Explicit variant / probe | Result |
|---|---|---|---|
| A1 retrieval | 0 results | English variant: 12 results | Exact answer-bearing `heading-2`, lines 5–13, appeared at rank 3 (query index 1). |
| A1 Jev, exact target only | — | Original Spanish question | Selected; Choice 0.98, selected-option probability 0.99, Noul 0.85. |
| B1 retrieval | 12 results | English variant: 12 results | Both returned the exact `block-21` table, lines 88–91, at rank 3; scores and target rank did not improve. |
| B1 Jev, exact target only | Spanish compound question | — | Abstained; Choice 0.40, target probability 0.30, `none` 0.70, Noul 0.14. Candidate competition alone does not explain this abstention because only the exact table was offered. |
| B1 Jev, same target | — | English translation of compound question | Selected; Choice 0.68, target probability 0.84, Noul 0.27. |
| B1 Jev, same target | Spanish pass-count facet | — | Selected; Choice 0.98, target probability 0.99, Noul 0.89. |
| B1 Jev, same target | Spanish latency facet | — | Selected; Choice 0.58, target probability 0.79, Noul 0.28. |

All four search calls and all five Jev calls used the live `typesafe-jev` provider, model `jev-1.13.0`, through the current Bridge/MSSR path recorded in the frozen plan. The exact input/output token counts, elapsed times, probabilities, and request fingerprints are in [metrics.json](metrics.json); raw Bridge responses are retained under `raw/`.

## Evidence quality and integrity

The selected A1 section was fetched at its revision-bound handle and packed verbatim with citation to lines 5–13. B1's table was first fetched exactly for the diagnostic, then fetched again from the selected handle after the English probe; its fingerprint matched both times. The table contains the requested `gemma` and `gemmaQat` pass counts and average/P95 latencies. Both evidence packs are advisory, citation-bound, and explicitly have no truth or canonical-write authority.

An independent blind Luna reviewer, not shown the Jev scores or source-only labels, judged all five presented excerpts sufficient for their respective questions. The A1 excerpt was focused. The B1 table includes additional columns beyond the requested values, so it is somewhat broader than necessary. This is model-assisted review, not human owner adjudication or gold labeling. See [blind review](BLIND-REVIEW.md).

## Interpretation

- The explicit English search variant recovered the A1 target in this one exposed Spanish retrieval miss. B1 already retrieved its target at rank 3, so its variant did not improve retrieval.
- With B1's exact target held constant, Jev abstained on the Spanish compound question but selected the English compound translation and both Spanish facets. This is a useful query-language/compound-question sensitivity signal. The probe does not isolate language from phrasing or decomposition, and all B1 probes reuse one source and one handle.
- Noul varied from 0.14 to 0.89 across these same B1 probes, although the blind reviewer judged each excerpt sufficient. This is evidence that Noul must not be treated as a calibrated sufficiency probability or threshold from this sample.
- The 4/5 selected dispositions are repeated probes of only two unique, deliberately chosen source questions. They are not 4/5 accuracy, reliability, or independent-case success.

There were no negative questions, no owner-gold labels, no project-disjoint holdout, and no independent source cohort. These results diagnose the retrieval and selection stages; they do not establish general quality, confidence calibration, or production readiness. Do not adjust Choice/Noul thresholds or runtime behavior from Run 64. The next useful evaluation is a fixed candidate pool across a larger owner-adjudicated, project-grouped set, with compound and facet questions pre-registered and retrieval, selection, sufficiency, range breadth, exact fetch, and end-to-end answerability scored separately.

## Run accounting

Five live Jev calls used 3,898 input tokens and 282 output tokens, with 4,205.8 ms summed provider elapsed time. These are provider-reported usage and per-call elapsed values, not wall-clock end-to-end latency. The frozen pre-call manifest remains unchanged; the post-call status and its relationship to that manifest are documented in [POSTCALL-ERRATUM.md](POSTCALL-ERRATUM.md). Package checksums are in [POSTCALL-SHA256SUMS.json](POSTCALL-SHA256SUMS.json).
