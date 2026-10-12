# Linked scope-miss diagnostic — 2026-10-12

Run: mssr-librarian-scope-miss-linked-20261012T0002Z-v1
Frozen source commit: 138293dcec588005a83a45b6f6bbe0bd0740ab12
Adapter: Bridge 0.6.172 / MSSR 0.2.127; Jev 1.13.0
Source clusters: 2 (two linked query variants per source; not independent samples).

## What happened

All four requests completed, and the expected target was present in search results for all four. Jev selected and exact-fetched three ranges and abstained on one request. Post-run checks against frozen source bytes confirmed all three selected ranges, fingerprints and verbatim cited evidence packs.

A single independent Luna reviewer read only anonymized query/text pairs for the three fetched excerpts. It rated them: **1 direct/full, 1 partial, 1 unsupported**. The review is model-assisted and is not owner-gold. The fourth request was an abstention and had no excerpt to grade.

| Query variant | Jev outcome | Fetched range | Blind text review |
| --- | --- | --- | --- |
| Typed Claim IR: what does confidence represent? | Selected; Choice 0.34, evidence sufficiency 0.48 | ADR 0006 section “6. Evidence tiers and abstention”, lines 154–164 | Partial: discusses evidence classes, not the Typed Claim IR confidence field |
| Focused Typed Claim IR confidence-field question | Abstained; Choice 0.57, evidence sufficiency 0.25 | None | No excerpt; target was searchable, but Jev did not select one |
| What must be verified before a Document Surface body is materialized? | Selected; Choice 0.54, evidence sufficiency 0.71 | ADR 0009 block 26, line 106 | Direct/full: lists snapshot, privacy, revision, range and fingerprint checks |
| Focused question about materializing the exact body for a source revision | Selected; Choice 0.35, evidence sufficiency 0.71 | ADR 0009 block 27, line 108 | Unsupported: describes evidence-pack composition, not the requested materialization check |

## Interpretation

The focused wording did not consistently improve selection. In the Typed Claim pair, Jev moved from a related but incomplete section to abstention; that is safer than asserting unsupported evidence, but it did not answer a query whose target was in search. In the Document Surface pair, the baseline selected an excerpt the reviewer judged sufficient, while the more specific wording selected the neighboring evidence-pack block instead. This is a scope/neighbor confusion in a tiny linked diagnostic, not evidence for a general query-rewriting rule.

Choice and evidence-sufficiency values remain descriptive and uncalibrated. The run has two source clusters, is below its predeclared support floor of 30 requests, and uses exposed, source-derived targets. It cannot establish reliability, generalization, calibration, production readiness, or a threshold. Provider request IDs were absent, so the underlying transport invocation count is not independently evidenced here.

This run tests source-pinned search → Jev selection/abstention → exact fetch → verbatim evidence packing. It does not test cross-corpus search, metadata filters, compaction, multi-range union, semantic coverage gates, paragraph composition or synthesis. No threshold or runtime behavior was changed.

## Next experiment

Use a fresh, previously unseen document cluster with a preregistered answer-bearing range and a query requiring two distinct facets. Compare (a) one compound query, (b) host-split facet queries with separately fetched exact ranges, and (c) a verbatim union followed by host-authored composition with citation checks. Freeze the acceptable range set and literal review rubric before provider calls. Report retrieval, exact-range union coverage and semantic review separately; do not treat offsets or scores as proof of semantic coverage.

See POST-RUN-HARNESS-REVALIDATION.json, BLIND-LITERAL-INPUT.json, BLIND-LITERAL-KEY.json (mapping kept separate from reviewer input), and DERIVED-SHA256SUMS.
