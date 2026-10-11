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

## 2026-10-11 linked exact-range coverage diagnostics

The independent-source smoke (3 linked calls across 3 source documents) and
two subsequent query-split packets (6 then 4 calls over the same 2 documents)
are preserved in the [live experiment ledger](../../../experiments/jev-mssr-live/README.md).
In the latest four-call packet, search target, exact heading, fingerprinted
fetch, and evidence-pack construction each passed 4/4. Blind review of literal
fetched text found 3 complete answers and one partial answer: the trace/route
query selected the right lifecycle rule but did not include the separate
ambiguous-ownership rule. Thus heading selection/tool integrity are not
semantic completeness. These are linked, source-derived diagnostics, not
independent samples, owner-gold, a quality estimate, or confidence calibration.
Raw Choice values varied from 0.42 to 0.92 across only four linked cases and
remain descriptive. The follow-up manifest's inherited `createdAt` is corrected
by a separate erratum; the frozen manifest is unchanged.
