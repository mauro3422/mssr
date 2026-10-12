# Run 43 — unindexed policy-source sidecar control

## Result

This is a source-derived exploratory retrieval/selection study, not an independent holdout, owner-gold set, production validation, or confidence calibration. It uses two current MSSR policy documents that are not declared in the four-entry project-context Librarian sidecar. Run 42 remains the latest sidecar-positive development smoke; Run 43 is a negative control for undeclared sources.

The sidecar behaved as specified: it projected zero declarations for these source refs and retained lexical fallback. For each of C01 and C02, baseline and sidecar returned the same eight revision-bound candidate handles in the same order. The expected answer range was available in each pool, but Jev’s exact-range hit rate on the four adaptive follow-ups was 1/4. This is selection/range evidence only; the four questions reuse two source pools and are not independent samples.

## Protocol and corrections

The two policy sources were selected explicitly; there was no crawl. Initial baseline/sidecar searches returned no candidates because the caller supplied `query.metadata.domain=coding` to both arms. The tool applies typed metadata filters even when `metadataMode=off`, and neither source carries that tag. No Jev request was made for those no-hit searches. CORR-01 preserves the failed request and records the caller-side correction. Corrected searches removed only that unintended filter and returned the same 8 candidates in baseline and sidecar.

Two primary Jev calls used compound queries over identical pools. C01 selected a relevant, incomplete 532-character block at raw confidence 0.84. C02 selected the entire 9,431-character Semantic Evidence Plane section at raw confidence 0.35. Both exact fetches succeeded. CORR-02 then froze four adaptive query variants, source-derived labels, and the exact unchanged candidate pools before four additional Jev calls. The correction is transparently post-outcome: the adaptive set is not preregistered primary evidence. Its queries were intended to be faceted but still include related multiple requirements in C01a/C01b/C02b; the next round should atomize those requirements more carefully.

## Adaptive live Jev selections

| Case | Selected exact range | Chars | Raw confidence / sufficiency | Strict answer coverage | Range precision |
|---|---|---:|---:|---|---|
| C01a: conflict/non-comparability and originals | `mssr-jev-confidence-merge-policy.md` `block-3/item-4`, L18–19 | 124 | 0.51 / 0.74 | Partial: says preview is allowed, canonical write is not; omits conflict handling and original-atom preservation | Tight but insufficient |
| C01b: default 0.75 threshold | same policy `block-3`, L13–21 | 532 | 0.49 / 0.93 | Partial: says preview may be allowed and canonical write is not; omits 0.75 and its exploratory/uncalibrated status | Acceptable |
| C02a: Jev authority boundary | `semantic-evidence-plane.md` `heading-5`, L24–31 | 2,149 | 1.00 / 0.96 | Complete: Jev may label explicit candidates but establishes no authority, truth, permission, verification, or canonical write rights | Acceptable; exact target heading |
| C02b: checks before consuming preview | `semantic-evidence-plane.md` `heading-1`, L1–65 | 9,431 | 0.55 / 0.94 | Complete in content: host reread/revision comparison and caller-asserted, unauthenticated freshness/verifier metadata | Overbroad; 4.39× the targeted 2,149-character heading |

Provider and model for all six Run43 Jev calls: `typesafe-jev` / `jev-1.13.0`. Adaptive calls used 6,750 input and 508 output tokens (four isolated calls). Raw confidence and evidence-sufficiency scores are provider output and remain **uncalibrated**; no threshold was changed. A confidence of 1.0 on C02a is one observed judgment, not a reliability estimate.

## Blind review and exact-evidence validation

A fresh Luna subagent reviewed only `results/blind-review-followup-input.json`; it did not see labels, manifests, or reports and made no Jev calls. It agreed C01a was partial and C02b was content-complete but overbroad. It called C01b complete, but its rationale did not establish either requested 0.75/calibration facet. The report therefore preserves the disagreement and uses the stricter facet-by-facet classification rather than converting the reviewer label into gold. It marked C02a complete with acceptable range precision.

All four selected handles were re-fetched against current source bytes. Their revision and fingerprint validation passed. The evidence pack contains exact verbatim source ranges totaling 12,236 characters and reports `advisoryOnly=true`, `truthAuthority=false`, and `canonicalRewriteAllowed=false`.

## Interpretation

The negative control shows no metadata-sidecar lift on sources with no declared selectors; this is expected fallback behavior, not evidence that the sidecar is defective. Candidate availability was not the problem: target ranges were present, but Jev often preferred a parent/overlapping range or a nearby policy block. Parent and child ranges co-occurred in both eight-handle pools, so range-overlap competition is a plausible factor that a distinct future arm could test. Do not conflate candidate recall, selected-range precision, answer completeness, overbreadth, provider confidence, and sidecar projection.

The query filter failure was caller-side construction, not a retrieval regression. No production code, selector declaration, policy, threshold, or Bridge runtime changed. The canonical PROJECT_MEMORY review was recorded as reviewed-none because its existing rules cover the reusable principles; PROJECT_STATE was refreshed with the Run42–43 evaluation summary. Production status remains unchanged. Existing `npm run test:project-context-librarian` passed before this continuation; no source code changed during the adaptive study.

## Next experiment

Use a separately versioned intervention to split C01a into conflict/non-comparability and supersession questions, split C01b into exploratory-threshold semantics and permitted action, and split C02b into the exact host revision check and the authentication status of verifier/freshness metadata. Preserve the current pools first, then optionally compare a separately labeled overlap-reduced candidate arm. Keep these results as exploratory until independent owner labels and source-disjoint cases exist.
