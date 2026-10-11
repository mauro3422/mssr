# Connected Jev relation batch — blind-labeled MSSR passages

Status: complete, exploratory. Captured 2026-10-11 UTC through Bridge 0.6.169.

## Cases and source integrity

The connected Librarian fetched six exact ranges from three current MSSR
documents. All six fetch fingerprints matched the revision-bound handles; the
relation endpoint then re-read every cited range from the selected project root.
The tested pairs were:

| Pair | Exact sources | Blind Luna label | Jev 1.13.0 | Raw score | MSSR disposition |
| --- | --- | --- | ---: | ---: | --- |
| 1 | ADR 0006 `block-28` ↔ ADR 0009 `block-65` | supports | unresolved | 0.54 | abstain |
| 2 | ADR 0006 `block-45` ↔ Librarian contract `block-6` | supports | unresolved | 0.66 | abstain |
| 3 | ADR 0009 `block-65` ↔ Librarian contract `block-7` | supports | supports | 0.71 | review |
| 4 | ADR 0006 `block-45` ↔ ADR 0009 `block-68` | supports | supports | 0.59 | review |

The blind Luna labels were prepared before the Jev call and were low-uncertainty,
but remain model-assisted labels rather than owner-gold. Pairs 1 and 2 expose a
useful distinction: broad thematic consistency can look like support to a
reviewer, while Jev abstains when the exact excerpts do not establish a common
claim scope or time. Pairs 3 and 4 received `supports`, but both stayed
review-only.

## Live execution

All four pairs completed in two provider requests, not one mixed request: the
portable reviewer correctly isolated the two disconnected evidence-graph
components. Each request carried two connected questions, concurrency was 1,
and no pair was rejected. Total use was 5,177 input tokens and 276 output
tokens; provider times were 789.2 ms and 643.5 ms. The provider returned no
class distributions, so none were inferred. All judgments are immutable,
source-bound, advisory-only, unverified, and `canonicalRewriteAllowed=false`.

The input intentionally left claim scope, validity, source freshness and
temporal comparability unknown. Jev selected `unresolved` at 0.54 and 0.66 for
pairs 1–2; for pairs 3–4 it selected `supports` at 0.71 and 0.59. The output
therefore does not show that a 0.54 score means “54% likely,” nor that support
at 0.71 is safe to merge.

## Synthesis-preview gate

Two previews exercised the downstream safety gate. Pair 1 returned `abstain`
for its unresolved relation. Pair 3 returned `review` despite Jev's `supports`
label, because 0.71 was below the exploratory 0.75 raw-score gate and scope or
valid-time comparability remained unknown. Both previews retained exact source
snapshots and were reversible; `applyAllowed=false` and
`canonicalRewriteAllowed=false` in both. The 0.75 gate is explicitly
uncalibrated and was not changed.

## Interpretation and next step

This is two correlated graph components over three documents, with four linked
pairs; it is not four independent benchmark cases or a reliability estimate.
The two `unresolved` outputs are defensible abstentions given the missing
scope/time facts, but they disagree with the blind Luna's broader `supports`
labels. The two `supports` outputs did not pass the deterministic synthesis
gate. This is evidence that the pipeline preserves review boundaries, not proof
that Jev can safely merge canonical documents.

Next, obtain owner-adjudicated labels for these exact pairs or freeze a separate
document-cluster holdout with explicit positive, negative, contradiction,
supersession and unresolved cases. Keep blind review and Jev input separate;
report relation coverage, abstention quality, calibration and preview gating as
separate metrics. Do not pool these pairs with the earlier capability-chaining
case or use them to tune thresholds.

Full bounded outputs and source handles are in `judgments.json`; `SHA256SUMS`
protects all three run artifacts. No canonical source was changed.
