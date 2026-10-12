# Run 47 — Fixed-pool query-language selection diagnostic

**Date:** 2026-10-12

**Status:** completed development diagnostic

**Provider:** TypeSafe Jev 1.13.0 (`typesafe-jev`)

## Question and protocol

Does changing only query language change Jev's select/abstain decision when source revision and the ordered candidate pool stay fixed? The run made six live calls: two query languages for each of two answerable cases and one nearby negative control. Each pair used the same exact candidate IDs, order, source reference, and revision. Jev received one query per call; labels were withheld.

The frozen manifest and `PRECALL-SHA256SUMS.json` remain unchanged. The manifest's `providerCallsCompleted: 0` is the pre-call value, not a post-call result; the six observed calls are in the raw receipts and reproducible aggregate. The manifest also declared an ERS Bridge route. In execution, the EF Bridge project-context gate stopped before Jev because the context exceeded its selection budget, so all six arms used portable MSSR to hold the adapter constant. This run therefore does not verify the Bridge execution path. That route discrepancy is recorded here rather than silently rewriting frozen inputs.

## Results

| Case | Primary query | Same-pool translated query | Exact-fetch and blind assessment |
|---|---|---|---|
| EF positive | English — abstained (`Choice .72`, sufficiency `.95`) | Spanish — selected `block-5`, lines 19–27 (`.95`, `.94`) | Exact fetch passed. Fresh-context blind review: **partial**; it lists the settings and repeat requirement but omits the framing sentence that establishes the list's scope. |
| ERS positive | Spanish — abstained (`.47`, `.43`) | English — selected `Layer 2 — functional module`, lines 43–56 (`.52`, `.68`) | Exact fetch passed. Independent blind review: **partial**; it identifies Layer 2 and its placement responsibility but omits Layers 1 and 3. |
| EF negative | English — abstained (`.97`, `.07`) | Spanish — abstained (`.89`, `.09`) | Both abstained on the analyst-labeled unanswerable-in-source control. |

Both translated positive queries changed the decision from abstain to select (2/2); the negative abstained in both languages (2/2). A fresh-context blind reviewer judged both positive selections partial (0/2 complete, 2/2 partial). The translated selections are nested ranges under their accepted target sections; exact fetch validates identity and bytes, not semantic completeness. This reviewer saw only the paired query and exact fetched passages, not `labels.json` or prior adjudication. A reviewer reused from an earlier task judged EF complete, but that reviewer inherited prior conversation context and is excluded from the blinded score; the disagreement remains visible in [`blind-review.json`](derived/blind-review.json).

The EF range begins after the source's “For direct comparisons” framing line. It contains the listed settings and repeat count, but the fresh-context reviewer could not determine from the excerpt alone whether those bullets are the exhaustive set for the queried scope. The ERS selection answers the Layer 2 subquestion but cannot satisfy the request for all three layers.

## Fetch and integrity notes

Both final exact fetches match the selected handle fingerprints and frozen source revisions. The first ERS fetch attempt used text that the tool rejected as stale; the local file SHA-256 still matched the frozen revision. Reconstructing the input from the original file bytes preserved the source representation and the retry passed. Both attempts are retained so the serialization friction is visible.

| Source | Frozen SHA-256 | Current SHA-256 | Result |
|---|---|---|---|
| EF `combat-lab/TEST_PROTOCOL.md` | `07d5ea38cf9af29c10d3c838a8a9428b478f9eecb6a8d6a812b1dfb8cc3c49fe` | same | passed |
| ERS `docs/ELECTRONICS_MODULAR_SYSTEM.md` | `4a5556680a4f395bdbc4e6b578d9fbc368c15483fdad6b6f57aeef3e84a5cd77` | same | passed |

The calls used 9,126 input and 770 output tokens (9,896 total); returned latency summed to 1,789.6 ms. Raw Choice and evidence-sufficiency values remain uncalibrated. In particular, the negative English abstention returned `.97` Choice with `.07` evidence sufficiency, which is not a correctness probability.

## Interpretation and limits

This small paired diagnostic supports query-language sensitivity on the tested pools: moving the query to the source language changed two positive decisions without changing candidate order. It does **not** establish that source-language queries are generally better, because there are only two positive pairs, one negative pair, two previously exposed source families, and no owner-adjudicated labels or protected holdout. The selected ERS range is demonstrably incomplete for its compound question. No threshold, runtime, route policy, atom metadata, contradiction handling, search, union, semantic compaction, or paragraph composition was tested or changed.

The next experiment should use separately frozen source-disjoint cases for (1) owner-adjudicated atom/contradiction positives and negatives, and (2) a reproducible multi-facet Librarian run that persists exact fetches, union, compaction, cited paragraph text, and blind coverage review before unblinding. Keep the KODE top-k miss as its own search arm. Do not calibrate scores or change production behavior until a protected, source-disjoint, owner-adjudicated cohort supports risk/coverage analysis.

## Artifacts

- [`RUN-PLAN.md`](RUN-PLAN.md) and immutable [`manifest.json`](manifest.json)
- Frozen inputs: [`query-pairs.json`](inputs/query-pairs.json), [`frozen-pools.json`](inputs/frozen-pools.json), [`labels.json`](inputs/labels.json)
- Raw provider and fetch receipts: [`raw/`](raw/)
- Reproducible aggregate: [`derived/aggregate.json`](derived/aggregate.json)
- Independent blind review: [`derived/blind-review.json`](derived/blind-review.json)
- Pre-call lock: [`PRECALL-SHA256SUMS.json`](PRECALL-SHA256SUMS.json)
- Post-call evidence index: [`derived/POSTCALL-SHA256SUMS.json`](derived/POSTCALL-SHA256SUMS.json)
- Validator: [`scripts/verify-run47.mjs`](scripts/verify-run47.mjs)
