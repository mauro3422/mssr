# MyceliumFront query-variant ranking implementation replay

Run: `myceliumfront-query-variant-ranking-implementation-20261013T152745Z-v1`
Implementation: MSSR `0.2.132`
Source run: `myceliumfront-retrieval-only-20261013141145Z-v1` (four files, commit `6bc411943c80be6ef844e4b5ac6847ae57465926`)
Query packet SHA-256: `00F58CB646A590050D9D370E8EE9D5A9EC0DBEE2D7D47C39B9E2EA60363DAA8D`

## Scope and limits

This is a deterministic implementation replay over the nine English top-8 misses from the previously exposed 35-case MyceliumFront packet, in both primary-language directions (18 query arms). The implementation returns top 16 once per policy and derives top-8 by slicing the same ranking. All anchors remain provisional and owner adjudication is pending. There was no Jev/provider call. These are correlated arms from one project, not independent reliability samples, owner gold, or a holdout.

`primary-only` is the deterministic baseline. `primary-first` and `round-robin` use the same explicit paired query variant; round-robin keeps the per-query score streams separate and reports the ranking lane. Metrics measure overlap/containment/exactness against candidate anchors only.

## Results

| Primary | Cap | Policy | Anchor overlap | Full anchor contained | Exact range | Rescued vs primary-only | Lost primary anchor | Truncated |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| es | 8 | primary-only | 9/9 | 9/9 | 3/9 | 0 | 0 | 9/9 |
| es | 8 | primary-first | 9/9 | 9/9 | 3/9 | 0 | 0 | 9/9 |
| es | 8 | round-robin | 9/9 | 9/9 | 2/9 | 0 | 0 | 9/9 |
| es | 16 | primary-only | 9/9 | 9/9 | 5/9 | 0 | 0 | 9/9 |
| es | 16 | primary-first | 9/9 | 9/9 | 5/9 | 0 | 0 | 9/9 |
| es | 16 | round-robin | 9/9 | 9/9 | 5/9 | 0 | 0 | 9/9 |
| en | 8 | primary-only | 0/9 | 0/9 | 0/9 | 0 | 0 | 1/9 |
| en | 8 | primary-first | 8/9 | 8/9 | 2/9 | 8 | 0 | 9/9 |
| en | 8 | round-robin | 9/9 | 9/9 | 2/9 | 9 | 0 | 9/9 |
| en | 16 | primary-only | 1/9 | 1/9 | 0/9 | 0 | 0 | 1/9 |
| en | 16 | primary-first | 9/9 | 9/9 | 5/9 | 8 | 0 | 9/9 |
| en | 16 | round-robin | 9/9 | 9/9 | 5/9 | 8 | 0 | 9/9 |

For English-primary queries, top-8 anchor overlap was 0/9 with no variant, 8/9 with the default policy, and 9/9 with round-robin. Exact ranges stayed 2/9 versus 2/9. D10's first anchor moved from rank 10 to 4.
For Spanish-primary queries on the same nine cases, overlap stayed 9/9 and there were no fully lost anchors, but exact top-8 ranges changed from 3/9 to 2/9. Top-16 exact counts were equal at 5/9. This is a measurable tradeoff, not a universal improvement.

## Interpretation

The result supports or rejects only the retrieval-rank hypothesis for this frozen corpus. Higher provisional-anchor coverage does not establish that Jev will choose the right range, that the excerpt is sufficient, or that a composition is accurate. A production default change still requires owner-adjudicated, project-grouped evidence. `primary-first` remains the compatibility default.

Reproduction: `node derived/replay-query-variant-ranking.mjs`. The script verifies every frozen source SHA-256 before querying and writes `derived/IMPLEMENTATION-REPLAY.json`.
