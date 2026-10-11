# Adjudication report

## Result

A live TypeSafe Jev 1.13.0 call through the isolated Bridge 0.6.169 adapter selected the exact child heading `B. Búsqueda, archivos y recuperación de conocimiento` from the real MSSR source `.mssr/knowledge/research/jev-decision-model-use-cases.md`. It made one Choice call over 20 heading candidates, returned raw Choice confidence 1.00 and evidence sufficiency/Noul 0.92, and completed in about 1.03 seconds end to end. The exact fetch passed with matching selected/fetched fingerprint `92c9d6e1…b279a851`; the fetched text is 791 characters and contains all ten enumerated cases (items 11–20).

A blind Luna exact-text review judged the fetched range full with low overbreadth against the frozen rubric. This is model-assisted review, not independent owner adjudication.

## Classification correction

The runner’s copied static `summary.json` incorrectly calls the source synthetic. The manifest and source snapshot prove this is real MSSR project knowledge, but it was previously exposed in a linked diagnostic. See the append-only [run erratum](RUN-ERRATUM.md); frozen evidence was not rewritten.

## Boundaries

This is one request on one previously exposed source cluster. It confirms a real-provider retrieval/selection/exact-fetch path for this specific heading, not general reliability, a holdout result, owner-gold, or calibrated confidence. No threshold was inferred or changed. Jev selected evidence; the host did not synthesize an answer. The isolated candidate package was used; the production Bridge remained on MSSR 0.2.121 during the run.

The query asked which cases category B enumerates. The fetch includes cases 11–20: candidate grep selection, route inspection ordering, ref/document prioritization, relevance ranking, duplicate/near/unique classification, authority by owner/provenance, stale-ref review, next retrieval action, citation support, and result sufficiency.
