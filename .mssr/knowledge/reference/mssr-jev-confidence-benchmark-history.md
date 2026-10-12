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
