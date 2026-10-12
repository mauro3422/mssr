# Empty-search implicit-heading fallback audit

Date: 2026-10-12. Scope: persisted `records.jsonl` packets under `experiments/jev-mssr-live/runs/`.

## Finding

Six records across four runs have `search.resultCount = 0` and `jev.candidateCount > 0`. Each affected runner used the conditional `...(candidateHandles.length > 0 ? { candidateHandles } : {})`. When search returned no handles, the runner omitted the field. The Jev selector interprets omission as its separate implicit-heading mode and enumerates headings from the full supplied document.

| Run | Case | Search results | Jev candidates | Jev result |
|---|---|---:|---:|---|
| `mssr-librarian-answerability-dev-20261012T0210Z-v2` | `104-neg-es` | 0 | 4 | abstained |
| `mssr-librarian-answerability-dev-20261012T0210Z-v2` | `115-neg-es` | 0 | 4 | abstained |
| `mssr-librarian-crosslang-low-overlap-20261011T121909Z-v1` | `mssr-work-es-primary-only` | 0 | 1 | abstained |
| `mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f` | `confidence-raw-threshold` | 0 | 2 | abstained |
| `mssr-librarian-spanish-source-holdout-pilot-20261012T161950Z-v1` | `farm-real-days-negative-es` | 0 | 7 | abstained |
| `mssr-librarian-spanish-source-holdout-pilot-20261012T161950Z-v1` | `zomboid-watch-loss-result-es` | 0 | 9 | abstained |

## Interpretation

- The retrieval misses are real observations: the lexical/search stage returned no candidates.
- The six Jev outcomes are not zero-candidate abstention tests. Jev saw whole-document heading candidates in the affected calls.
- All six calls abstained. This audit found no selected unsupported range in these cases; the defect affects what the experiment claims to measure, not an observed wrong selection.
- Run59 still records answerability 5/6, positive selections 2/3, negative abstentions 3/3, positive search recall 2/3, exact positive range 1/3, and fetch/pack 2/2. Those are descriptive of the actual mixed-mode calls. Two abstentions used implicit whole-document headings, so they do not establish behavior for a strict search→selection chain with an empty pool.
- The selector's implicit-heading mode may be useful, but experiments must request and label it explicitly rather than reaching it by omitting an empty search pool.

## Correction

The reusable `experiments/jev-mssr-live/runner-template.mjs` now stops before Jev when no search handles exist and records `status: not-run`, `reason: no-search-candidates`, `candidateCount: 0`, and `jevCallMade: false`. `scripts/test-jev-run-summarizer.mjs` adds a mock case that throws if Jev is called after an empty search. The focused test failed before the template change and passed afterward.

Historical manifests, raw request/response records, and run-specific source snapshots remain unchanged. Run59's derived adjudication/erratum and the experiment ledger were corrected to describe the mixed candidate modes. No production selector behavior, score threshold, or runtime configuration changed; no Jev call was made as part of this harness repair.
