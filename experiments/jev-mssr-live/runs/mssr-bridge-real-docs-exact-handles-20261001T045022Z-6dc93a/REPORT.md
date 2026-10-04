# Jev MSSR live exact-handle run

Run: mssr-bridge-real-docs-exact-handles-20261001T045022Z-6dc93a

Runtime: Bridge 0.6.144 + MSSR 0.2.96

Provider/model: typesafe-jev / jev-1.13.0

## Result

| Case | Jev selection | Provider score | Exact fetch |
|---|---|---:|---|
| selector_validation | ADR 0009, block-26, line 105 | 0.94 | valid |
| negative_coverage | ADR 0009, block-32, lines 119–127 | 0.99 | valid |
| contradiction_preview | Semantic Evidence Plane, block-12, line 33 | 0.42 | valid |

Jev made 3 live calls and selected an author-expected handle in 3/3 cases. All selected handles passed the exact-fetch path (3/3). There were no abstentions or provider failures. Aggregate usage was 2,371 input and 171 output tokens. Mean provider latency was 777.2 ms.

The third answer was adjudicated correct from its evidence despite a provider confidence score of 0.42. These scores are uncalibrated. A 0.5 cutoff would have rejected that answer in this sample; this run does not support choosing a production threshold.

## Independent blind evidence review

A Luna reviewer inspected the frozen cases and corpus snapshots without reading author labels or provider records and without calling Jev. It found the selected evidence directly answers all three queries. It also found overlapping section/block handles that express equivalent evidence. In particular, selector_validation had an equivalent ADR section in search results that was not among the three frozen candidates.

The 3/3 author-handle match is a narrow exact-handle metric, not a complete semantic quality score. Future runs should freeze an acceptable set of evidence ranges per case before inference, retain exact-handle match separately, and adjudicate range relevance independently.

## Scope and limits

This was a three-case live smoke over one project and two documents. Candidate sets were manually curated from deterministic search results, so the run does not measure retrieval recall. It does not establish confidence calibration, a production cutoff, auto-application safety, or readiness for promotion. The selector remains advisory; exact fetch and host verification remain required.

See records.jsonl for privacy-minimized per-call results, review.json for blind adjudication, and SHA256SUMS for file integrity.

The manifest remains status=prepared because it is the immutable pre-inference run descriptor. Final execution status is recorded in run-completion.json, and that receipt is included in SHA256SUMS. The runtime reported model jev-1.13.0; it did not expose a separate request ID, SDK revision, timeout or retry record. Provider request bodies were not persisted, so this archive cannot independently reconstruct the exact prompt sent to Jev.
