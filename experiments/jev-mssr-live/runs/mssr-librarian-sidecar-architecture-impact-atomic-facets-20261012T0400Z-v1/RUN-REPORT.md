# Run report — atomic architecture-impact facets

Run: `mssr-librarian-sidecar-architecture-impact-atomic-facets-20261012T0400Z-v1`
Parent: `mssr-librarian-sidecar-architecture-impact-narrowed-followup-20261012T0353Z-v1`.
Provider: live Jev 1.13.0 through MauroPrime Bridge 0.6.172 / MSSR 0.2.127.

## Protocol

The metadata sidecar selected the same architecture-impact document used by
the parent runs. The same three revision-bound candidate handles were offered
for two separately labeled atomic questions: (1) what distinguishes `WATCH`
from `REVIEW`; and (2) how structurally inferred dependency relationships are
treated when deciding whether to elevate architecture attention. Source
revision and candidate fingerprints were frozen before provider calls. The
local preflight made zero network requests; the two live Jev calls were made
sequentially through the connected Bridge.

## Results

Both searches surfaced the target range, and both Jev decisions selected an
answerable range. The `WATCH`/`REVIEW` facet selected exact `block-2` (Choice
0.97; evidence sufficiency 0.64). The inferred-edge facet selected the broader
`heading-1` section (Choice 0.36; evidence sufficiency 0.56). These are
uncalibrated provider scores. Both exact fetches matched the frozen source
revision and fingerprints; both evidence packs preserved the selected text
and citations. The two packs contain 3,436 fetched characters total. Usage
was 1,892 input and 154 output tokens. The runner did not capture per-call
wall-clock timestamps; provider-reported durations were 816.2 ms and 814.6 ms.

Mechanically, answerability disposition was 2/2, exact accepted-range
selection was 1/2, and explicitly relevant-range selection was 1/2. Both
selected ranges were judged useful in a blind literal-text review; the first
was tight and the second moderately broad. See
[`derived/BLIND-REVIEW.md`](derived/BLIND-REVIEW.md) and
[`derived/validation.json`](derived/validation.json).

## Interpretation and limits

This is a linked query-decomposition diagnostic on one exposed source-document
cluster, not two independent samples. The result supports trying atomic facets
followed by exact fetch and evidence union; it does not show automatic facet
planning, semantic-coverage gating, host paragraph composition, compaction,
owner-gold, calibration, or general reliability. Blind review was model-
assisted, not owner adjudication. No threshold or production behavior changed.

`SHA256SUMS` protects the frozen packet. Post-run analysis and this report are
covered separately by `DERIVED-SHA256SUMS`.
