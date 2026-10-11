# Fresh-source Jev retrieval diagnostic: event-trigger acceptance matrix

## Frozen setup

One real MSSR source document was frozen before the live provider request. Its source SHA-256 is `cc1469488ff63b316a88769d608d9237150c2c7b2699424ae973c3d16fdee4fa`; the source was not found in recent experiment ledger entries 23–27 or sampled recent manifests. This is a source-new exploratory diagnostic, not a statistical holdout or owner-gold case. The expected structural target and nine checklist facets were frozen and were not sent to Jev.

Question: “¿Qué validaciones de la matriz de aceptación especifica para el primer adaptador portable de eventos?”

## Live selection and exact fetch

Active Bridge 0.6.170 / MSSR 0.2.121 made one real Jev 1.13.0 Choice request. It selected `Acceptance matrix` (`h009`) among 11 headings plus `none`; this matched the frozen target. Choice was 0.63, evidence sufficiency 0.43, and usage was 2,043 input / 157 output tokens. The selected revision-bound section exact-fetched successfully at the same source revision and fingerprint, returning 666 UTF-16 code units. Offered ranges had 10 nested parent/child overlaps and no partial overlaps.

The fetched section contains all nine frozen checklist facets: duplicate/idempotency, stale events, unverified sources, native-event polling, bounded labeled polling fallback, restart recovery, missing capability/replan, mutation lifecycle, and cross-host evaluator conformance.

## Blind review and interpretation

A Luna reviewer saw only the question and fetched text. It marked `Partial`, with low overbreadth, sufficient evidence, and no explicitly missing facet; its reason was that the matrix lists checks but does not explain each one. The structural heading target and exact fetch are therefore successful, while semantic answer depth is ambiguous. The review label is preserved rather than overwritten.

This is one source cluster and one request. The 0.63 / 0.43 values are uncalibrated provider scores; they are not probabilities of correctness or thresholds. The result does not establish reliability, calibration, or a general version effect. No policy or adoption decision follows.

## Files

`FREEZE-SHA256SUMS` binds the pre-call manifest, case, label, and source snapshot. `records.jsonl` stores normalized provider/fetch evidence and the fetched source range; `blind-review.json` preserves the independent review; `SHA256SUMS` binds the completed packet.
