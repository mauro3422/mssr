# MyceliumFront retrieval-only diagnostic

Run: `myceliumfront-retrieval-only-20261013141145Z-v1`
Date: 2026-10-13 14:11:45 UTC
System: Bridge 0.6.178 / MSSR 0.2.131; live `mssr_librarian_search` only.

## Scope and integrity

35 paired cases (70 separate query arms) over four explicitly supplied Markdown files pinned to commit `6bc411943c80be6ef844e4b5ac6847ae57465926`. The current commit and all four source SHA-256 values matched the frozen references before the run and again before copying. Search was metadata-off, top 8, snippet limit 160. Jev was not called; no source file was modified.

The candidate anchor ranges are provisional and await owner adjudication. This measures overlap with those anchors, not gold recall, answer accuracy, Jev selection, sufficiency, calibration, reliability, or holdout performance. Both languages belong to one project cluster.

## Baseline: separate language searches, top 8

| Language | Arms | Nonempty | Any provisional anchor overlap | Full anchor contained | Exact anchor range | Mean first overlap rank |
|---|---:|---:|---:|---:|---:|---:|
| Spanish | 35 | 35 | 35 | 35 | 13 | 1.4 |
| English | 35 | 29 | 26 | 26 | 8 | 1.65 |

Paired anchor overlap: 26 both, 0 English-only, 9 Spanish-only, 0 neither. Search errors: 0.

## Explicit bilingual query-variant follow-up

For the nine English arms that missed a provisional anchor in top 8, a paired Spanish query was supplied explicitly as a search variant. With a combined top-8 limit, 8/9 anchors appeared; `D10` remained absent because all eight slots held primary-query results. With top 16, the anchor appeared in 9/9 cases; all nine contained their full provisional anchor, while 5/9 matched an exact anchor range. The D10 anchor was at rank 10. All nine top-16 responses remained truncated, so this is a useful recovery signal, not an exhaustive pool.

At an uncapped-to-100 follow-up, the Spanish variant matched an anchor in all nine responses; eight had no English-primary anchor even in that larger returned pool, while D10's English result appeared beyond top 8. No query was sent to Jev.

## Case-level baseline

| Case | ES overlap | ES rank | EN overlap | EN rank |
|---|---:|---:|---:|---:|
| P01 | true | 1 | true | 1 |
| P02 | true | 1 | true | 3 |
| P03 | true | 2 | true | 3 |
| P04 | true | 1 | false | — |
| P05 | true | 2 | false | — |
| P06 | true | 1 | true | 2 |
| P07 | true | 2 | true | 3 |
| P08 | true | 2 | true | 2 |
| P09 | true | 3 | true | 3 |
| P10 | true | 1 | true | 1 |
| P11 | true | 1 | true | 1 |
| P12 | true | 1 | true | 1 |
| P13 | true | 4 | true | 4 |
| P14 | true | 1 | true | 1 |
| P15 | true | 1 | true | 2 |
| D01 | true | 1 | true | 3 |
| D02 | true | 1 | false | — |
| D03 | true | 1 | false | — |
| D04 | true | 1 | true | 1 |
| D05 | true | 1 | false | — |
| D06 | true | 1 | false | — |
| D07 | true | 1 | true | 1 |
| D08 | true | 1 | true | 1 |
| D09 | true | 1 | true | 1 |
| D10 | true | 3 | false | — |
| D11 | true | 1 | true | 1 |
| D12 | true | 2 | true | 2 |
| D13 | true | 1 | false | — |
| D14 | true | 1 | true | 1 |
| D15 | true | 1 | true | 1 |
| U01 | true | 1 | true | 1 |
| U02 | true | 1 | true | 1 |
| U03 | true | 3 | false | — |
| U04 | true | 1 | true | 1 |
| U05 | true | 1 | true | 1 |

## Interpretation and limits

The source language strongly affects lexical anchor retrieval on this Spanish-heavy corpus. Explicit host-supplied Spanish variants plus a larger candidate limit recovered the nine English top-8 misses in this diagnostic, but exact anchor ranges were less frequent than anchor containment, and the 16-result pools were still truncated. The tests support a host-query strategy to evaluate next; they do not establish that Jev will select the right passage or abstain correctly. Owner review, exact-range adjudication, and a genuinely independent cohort are still required before any confidence or production-reliability claim.
