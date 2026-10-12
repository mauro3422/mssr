## Next MSSR evaluation

Keep the axes separate: retrieval recall, source freshness,
claim validity/lifecycle, placement, move safety, contradiction detection,
relation classification, synthesis faithfulness, provenance retention,
reference/skill selection, and downstream task outcome. For the lifecycle
regression, freeze one Spanish rubric and compare: parent metadata; atom
provenance without exposing source freshness to Jev; explicit sourceFreshness
versus claimValidity; and those orthogonal fields plus
contradiction/supersession context. Use the same cases and independent
adjudication across variants.

For retrieval and merge, score search candidate recall separately from
pair-classifier precision/recall; then score citation support,
retained/rejected evidence, conflict handling, authority preservation,
reversibility, and harmful false-merge rate. Group holdouts by project/source
module. Repetitions measure stability, not sample size. Keep labels out of
requests and preserve the manifest, exact inputs, runner/build hashes, raw
responses and separate adjudication.

The 2026-10-10 cross-repository development sample put a bilingual target at
rank 32/74 with Spanish primary, and rank 2/20 with an English primary plus the
Spanish variant. A nested child missed one subclaim at Noul 0.97; sibling
sections selected the parent containing both. These source-derived cases are
not owner-gold or calibration. Keep primary-first until a grouped owner-labeled
comparison supports change; test host language ordering and non-overlapping
ranges, and track the dedicated connector schema drift separately.

## Run 35 evaluator invariant

Score answerability disposition (select versus abstain) and selected-range precision as separate outcomes. A valid Jev selection's exact/relevant range match must be scored from its selector status and returned range, independently of later fetch or evidence-pack success; keep exact-fetch fingerprint and pack integrity as separate pipeline metrics. Contradictory outputs such as selected with choice: none remain failed-or-unknown and must not count as valid range selections. This evaluator correction does not calibrate raw Choice/sufficiency or authorize a production threshold.

## Runs 37–39: project-specific sidecar and atomic facets (2026-10-12)

Three linked live Jev 1.13.0 diagnostics used one exposed MSSR
`architecture-impact-review-decision.md` source cluster through Bridge 0.6.172
/ MSSR 0.2.127. In run 37, the compound WATCH/REVIEW plus inferred-edge
question had its target in a 48-range search, but Jev selected an unrelated
range from another MSSR document; exact fetch integrity passed, while relevant
range selection did not. In run 38, the same query was scoped by sidecar
metadata to three candidates; Jev abstained on this source-labeled answerable
case. In run 39, two manually separated atomic facets were both selected,
exact-fetched, and packed with citations. Exact accepted-range selection was
1/2, explicitly relevant selection 1/2; a blind Luna literal-text review found
both excerpts sufficient, one tight and one moderately broad.

The comparison suggests that manual facet decomposition can recover useful
evidence where a compound query fails, but these linked repeats are not
independent cases and do not validate an automatic decomposition or coverage
gate. The labels are source-derived, blind review is model-assisted, and there
is no owner-gold or holdout. Raw Choice and evidence-sufficiency values remain
uncalibrated; no threshold or production behavior changed. See the
[experiment ledger](../../../experiments/jev-mssr-live/README.md), the
[run 37 report](../../../experiments/jev-mssr-live/runs/mssr-librarian-sidecar-architecture-impact-20261012T0346Z-v1/RUN-REPORT.md),
the [run 38 report](../../../experiments/jev-mssr-live/runs/mssr-librarian-sidecar-architecture-impact-narrowed-followup-20261012T0353Z-v1/RUN-REPORT.md),
and the [run 39 report](../../../experiments/jev-mssr-live/runs/mssr-librarian-sidecar-architecture-impact-atomic-facets-20261012T0400Z-v1/RUN-REPORT.md).

## Run 40: Context Plane receipt facets and containment control (2026-10-12)

Two live Jev facets selected and exact-fetched their labeled ranges (2/2); the cited host composition passed a blind Luna sufficiency review. A separate structural control removed a 548-character contained child. One thematically exposed source cluster only: no owner-gold, clean holdout, semantic-compaction test or calibration; scores remain uncalibrated. See the [run report](../../../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/RUN-REPORT.md) and [validation](../../../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/derived/validation.json).

## Run 61: live Project Context sidecar pilot (2026-10-12)

The Bridge 0.6.175 / MSSR 0.2.127 / Jev 1.13.0 path projected four exact
host-declared sidecar selectors (4/4). Across four exposed MSSR source
clusters, lexical top-8 target recall was 5/8 overall (English 4/4, Spanish
1/4); the exact sidecar filters returned the target in 8/8 bilingual queries.
Jev selected within the expected section 12/12 times it selected; seven unique
handles passed exact fetch/fingerprint and evidence-pack byte equality (7/7).
Blind Luna review judged 12/12 excerpts sufficient and 7/12 calls overbroad
(3/7 unique handles). This was a manual live MCP pilot without raw transport
events/replay IDs, owner-gold, or an independent holdout. It tested this
Project Context sidecar only, not general atom/skill/reference/telemetry
metadata integration, confidence calibration, or production reliability. The
[run report](../../../experiments/jev-mssr-live/runs/mssr-librarian-live-sidecar-bridge-20261012T1810Z-v1/RUN-REPORT.md),
[blind review](../../../experiments/jev-mssr-live/runs/mssr-librarian-live-sidecar-bridge-20261012T1810Z-v1/BLIND-REVIEW.md),
and [ledger entry](../../../experiments/jev-mssr-live/README.md) preserve the
full detail. No runtime or threshold changed.
