# Fresh changelog clusters and linked facet diagnostic

## Result

Three previously unexposed changelog documents were queried through live
Bridge 0.6.169 / MSSR 0.2.121 and Jev 1.13.0. All three questions were judged
answerable by two blind model-assisted reviewers. Jev selected and exact-fetched
two cases; one broad compound query abstained. That abstention was
inappropriate against the frozen rubric. A manually decomposed follow-up on
that same document retrieved four exact facets whose union was judged to cover
the parent question.

This supports manual host-side decomposition and exact evidence union for this
single diagnostic case. It does not demonstrate automatic decomposition,
semantic coverage gating by MSSR, production confidence, or generalized
reliability.

## Frozen primary cases

| Case | Jev result | Choice confidence / evidence sufficiency | Exact fetch | Blind semantic grade |
| --- | --- | --- | --- | --- |
| `changelogs/0.2.121.md` | abstained | 0.43 / 0.30 | none | answerable; inappropriate abstention |
| `changelogs/0.2.124.md` | `heading-3`, lines 11–17 | 0.69 / 0.76 | fingerprint matched | full enough; fetched section includes mild unrelated run metadata |
| `changelogs/0.2.125.md` | `block-2/item-2`, line 14 | 0.90 / 0.66 | fingerprint matched | partial; omitted line 13's structural-only/semantic-coverage distinction |

The source-cluster denominator is three. Primary outcomes: one full-enough
selection, one partial selection, one inappropriate abstention. Exact fetch and
fingerprint verification passed 2/2 selected cases. Raw provider scores are
descriptive and uncalibrated.

## Linked decomposition of 0.2.121

Four calls were linked to the same `changelogs/0.2.121.md` source cluster, not
counted as new independent cases:

| Facet | Exact selected range | Confidence / sufficiency | Blind grade | Result |
| --- | --- | --- | --- | --- |
| A: item boundaries and sibling behavior | `block-2/item-2`, line 14 | 0.63 / 0.80 | partial | omitted indentation membership/stopping rule from line 13 |
| B: unchanged/unproven behavior | `block-2/item-4`, line 16 | 0.85 / 0.86 | partial | omitted preserved `block-N` identity from line 15 |
| C: aggregate identity | `block-2/item-3`, line 15 | 0.78 / 0.80 | full for facet | exact identity claim recovered |
| D: indentation membership | `block-2/item-1`, line 13 | 0.77 / 0.88 | full for facet | exact continuation/nesting condition and stopping boundaries recovered |

Exact fetches and selected fingerprints matched 6/6 across the two primary
selections and four linked facets. Two blind reviewers, unaware of Jev outputs,
judged the union of lines 13–16 to support every required parent-question
facet. The union also contains supported details about trailing blank
separators and shared-index roles. These extra details were not treated as
unsupported inference.

This is a useful failure diagnosis: the initial compound request failed at
retrieval/selection by abstaining, and narrower facets recovered exact evidence.
The source and cluster are reused; the follow-ups do not increase the
independent sample size. The composed answer itself was not generated or
evaluated in this run.

## Receipts and accounting

- Provider/model: `typesafe-jev` / `jev-1.13.0`.
- Runtime: Bridge 0.6.169, MSSR 0.2.121, boot
  `adf97c06-a668-4ff9-a187-c12ab058bff2`.
- Primary calls: 3; linked follow-ups: 4; total: 7 Jev calls.
- Primary searches returned 10 candidates each. Linked facet requests also used
  fresh exact-source search results; the selected item range was then fetched
  through Bridge.
- Six selections had exact fetches with matching fingerprints. The abstention
  did not fetch.
- Total token usage: 13,024 input / 1,026 output. Sum of provider-reported
  elapsed times: 5,106.6 ms.
- The calls ran under active trace
  `mssr-codex-6fa7ae20-eb87-4652-996b-20fd7e64c7b2`.
- Raw provider/tool records are in `records/`; source snapshots and primary
  rubric are under `inputs/` and `adjudication/`. The primary pre-call hashes
  are preserved in `PRECALL-SHA256SUMS`; derived artifact hashes are listed in
  `DERIVED-SHA256SUMS`.
- Timestamp discrepancies in linked plans are preserved and corrected only by
  the [append-only timestamp erratum](TIMESTAMP-ERRATUM-20261011.md).

## Limits and next step

This run uses one repository and authoring context, three primary source
clusters, and model-assisted reviews. The follow-up sequence is an adaptive,
linked diagnostic, not a preregistered independent holdout. The reviewers are
not owner-gold. No score threshold, confidence mapping, system prompt, excerpt
cap, production behavior, or runtime activation was changed. No semantic
coverage decision was delegated to MSSR. A next evaluation should use fresh
source clusters, preregister a bounded compound-vs-facets comparison, preserve
pre-call receipts, and include owner-adjudicated labels before drawing a
reliability or calibration conclusion.
