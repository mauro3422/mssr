# Run57 scoring erratum — 2026-10-12

The frozen provider packet, `inputs/labels.json`, `summary.json`, raw records,
and original `SHA256SUMS` are unchanged. This append-only note corrects the
interpretation of its strict heading-and-range metrics.

## Workflow case gold-heading mismatch

The frozen label for `jev-host-workflow-boundary` expects `Capabilities` at
lines 20–20. In the frozen Bridge 0.6.175 source (SHA-256
`8466dad2bd2848ec194dbc2028d4b4e927681f54c37fabc9a550690aa05fc742`), line 20
is under `Exact metadata filters`; `Capabilities` is the preceding sibling
heading at line 7. The strict scorer requires source, heading path, and exact
line range to match, so the incorrect heading made the search metric report a
miss even though the exact line-20 handle was returned at rank 3.

The handle was offered to Jev as `h003` (1,127 UTF-16 units). Jev selected
`h006`, lines 13–18 (3,626 UTF-16 units), with raw Choice confidence 0.59 and
evidence sufficiency 0.63. Two blind Luna reviews judged that excerpt partial:
it describes the tool chain and preview boundary, but does not directly explain
host-side iteration and answer-paragraph composition. The exact-range selection
remains a miss. Correcting only the gold heading changes strict search-target
recall from 0/2 to 1/2; it does not change Jev's exact-range selection (0/2) or
answerability-status accuracy (3/4). Scores remain uncalibrated.

## Capability-inventory search context

For `capability-inventory-inputs-and-gate`, the Spanish search returned the
whole-document heading (lines 1–191) and two ranges from P5, but not the narrow
P3 heading. Jev abstained. A separate provider-off local search using an
English translation surfaced the P3 heading range (lines 86–101), which
contains the accepted evidence span (lines 90–100). This is a small
search-language diagnostic, not a Jev result or an independent benchmark case.

The corresponding frozen source and query-only results are in
[`run56-57-bilingual-search-followup-20261012.json`](../../diagnostics/run56-57-bilingual-search-followup-20261012.json).
The query-only diagnostic made no Jev/provider calls and did not alter either
run packet.

## Interpretation

Run57 remains exploratory across two source documents. Its two negative cases
were correctly abstained; the two positive cases had one correct answerability
decision and one positive abstention. A positive decision does not establish
useful-range quality: exact/relevant Jev range selection was 0/2, with one
selected partial range. Fetch and citation-pack validation passed 1/1 for that
selected range, which proves integrity, not answer coverage. No runtime,
threshold, or production policy changed.
