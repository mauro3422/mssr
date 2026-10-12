# Results: independent four-project Librarian/JeV pilot

Run: mssr-librarian-independent-four-project-cohort-20261012T2000Z-v1
Provider: TypeSafe Jev through the connected MauroPrime Bridge MCP, model jev-1.13.0
Status: completed; read-only
Labels: two independent source-only reviewers; analyst labels, not repository-owner gold

## What was measured

Eight Spanish source-scoped questions across four separate project repositories: four answerable positives and four controls asking for information absent from the exact source file. Each request explicitly supplied one Markdown source, with metadata mode off. This measures lexical search, Jev range choice/abstention, and exact fetch/pack; it does not measure automatic atom discovery or context routing.

## Results

- Search returned a target range in the top eight for **3/4 positives**. BeeIncremental's Spanish positive had no lexical candidates.
- There were **5 live Jev calls**. Search returned no handles for Bee's two questions and the Kairos negative, so Jev was not called on empty pools.
- Jev selected evidence for **2/4 positive questions**. It abstained on the ConMap positive despite the target being in the top eight; that response also reported raw evidence sufficiency 0.91, a facet-selection diagnostic rather than a calibrated score.
- Jev abstained on the two negative controls that had candidate pools; the other two negatives had no candidates and no Jev call. End to end there was no selected evidence for **4/4 negatives**.
- Both positive selections included their independently labeled spans, but **0/2 were exact-range selections**: Proyectox selected lines 9–20 (label 13–17); Kairos selected 209–233 (labels 212–214 and 227).
- Exact fetch and evidence-pack integrity passed **2/2**: selected fingerprint, fetched fingerprint, pack citation handle/fingerprint, and packed text matched. Both packs were verbatim and disallowed canonical rewrite.
- Jev usage was **15,326 input tokens / 1,176 output tokens** across five calls; provider-reported latency totaled **4.10 s**. These are sample-specific, not service-level estimates.

## Interpretation

The bounded evidence pipeline (exact fetch, fingerprint validation, verbatim pack, citation binding) behaved strongly in this tiny sample. Retrieval and range selection remain weaker: one cross-language miss, a compound-query false abstention, and two broad selections. The negative controls are encouraging but only four cases. Raw confidence and evidence-sufficiency remain uncalibrated provider scores; do not read them as percentages.

## Follow-up

1. The separate post-hoc probes found the Bee answer with an English query and selected exact one-line ranges for both ConMap facets. They reuse the same documents and are excluded from the primary counts; see POSTHOC_FOLLOWUPS.md.
2. Test explicit bilingual query variants through the full atom/context route. The Bee result supports a language-mismatch hypothesis, not a general multilingual claim.
3. Add more owner-reviewed source clusters before estimating reliability or changing decision thresholds.
4. Keep the Kairos documentation-disconnection and Bee .bridge authority drift visible; this run used explicit tracked files and did not modify those repositories.

No canonical document, atom, threshold, or production behavior was modified.
