# Run report — fresh skill-reference Jev selection

Run: `mssr-librarian-fresh-skill-refs-20261012T115056Z-v1`
Provider: `typesafe-jev / jev-1.13.0` via the connected Bridge MCP.
Status: exploratory live run; no threshold or production calibration change.

## Design limits

Twelve English prompts used six MSSR skill-reference files in one repository. Each source has one answerable and one unanswerable query; pairs within a file are linked. Labels were frozen before provider calls by one analyst, are not owner-adjudicated, and are not gold. This is not a certified holdout or evidence of generalization across projects. Jev received neither labels nor rationales.

The active Bridge reported version 0.6.173, while the inspected local Bridge checkout reported package version 0.6.144 at `3b2f63c` and was dirty. Calls were therefore made directly through the connected Bridge MCP; this run does not certify an exact source/build match or a locally reproducible host build.

## Results

- Live Jev calls: **12/12** (one per query).
- Selected answerable cases: **6/6**; abstained on unanswerable controls: **6/6**. This matches the analyst labels on this small set only; it is not an accuracy or calibration estimate.
- Positive selections fetched byte-for-byte from the frozen snapshots: **6/6**. Each evidence pack had one citation bound to its selected handle: **6/6**.
- Search candidate pools totaled **246** results across the 12 source-scoped searches. Complete labelled support was present in the union candidate pools for **6/6** positives; top-1 had complete labelled support in **6/6**.
- The selected single range covered all analyst-marked supporting lines in **3/6** positives. This line-count measure is only a mechanical check against single-analyst annotations, not a semantic recall score.
- Reviewer A rated **3 full / 3 partial**; Reviewer B rated **4 full / 2 partial**. Both called ROUTE-POS partial because fixture specifics were absent, and LIFECYCLE-POS partial because close criteria were missing. PUB-POS split (one full, one partial); the other three cases were rated full by both. This is excerpt-answer fit, not a truth check.
- Provider scores remain **uncalibrated**. No threshold, trust policy, atom metadata or production setting changed.

## Case-level findings

| Caso | Jev | Selección | Reviewer A / B | Señal |
|---|---|---|---|---|
| PUB-POS | selected; c=1.00, s=.91 | block-2 L5–12 | partial / full | disagreement on sufficiency |
| PUB-NEG | abstained | — | — | correct vs analyst label |
| ROUTE-POS | selected; c=.59, s=.58 | item L10 | partial / partial | misses fixture facet |
| ROUTE-NEG | abstained | — | — | correct vs analyst label |
| INCIDENT-POS | selected; c=.86, s=.89 | block-3 L7–10 | full / full | citation exact |
| INCIDENT-NEG | abstained | — | — | correct vs analyst label |
| LIFECYCLE-POS | selected; c=.48, s=.68 | block-3 L10–13 | partial / partial | misses close facet (L17–25) |
| LIFECYCLE-NEG | abstained | — | — | correct vs analyst label |
| SAFE-SKILL-POS | selected; c=1.00, s=.82 | block-2 L5–11 | full / full | citation exact |
| SAFE-SKILL-NEG | abstained | — | — | correct vs analyst label |
| MODULAR-POS | selected; c=.58, s=.94 | block-3 L15 | full / full | short exact answer |
| MODULAR-NEG | abstained | — | — | correct vs analyst label |

Scores shown are provider outputs with no calibration guarantee. They should not be compared as probabilities or used as thresholds.

## Next calibration iteration

Keep compound-query coverage as the next target. Compare the current one-range path with facet-split Jev selections plus a multi-citation evidence pack for ROUTE-POS and LIFECYCLE-POS. Include a blind reviewer check on whether the combined cited excerpts cover every requested facet. Keep the current abstention controls and do not tune score cutoffs from this run.

## Durable evidence

- Full live selection responses: `raw/jev-results.json`
- Full exact-fetch and citation responses: `raw/fetch-and-evidence-pack.json`
- Per-case derived record: `derived/case-results.json`
- Two blind reviews: `derived/blind-review.json`
- Counts and limits: `derived/metrics.json`
