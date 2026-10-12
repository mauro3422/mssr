# MSSR Librarian synthetic contract diagnostic — 2026-10-12

**Run:** `mssr-librarian-synthetic-contract-20261012T0451Z-v1` — **Status:** completed synthetic diagnostic; not owner-gold, not a production benchmark, and not confidence calibration.

## Frozen design and execution

The source is an invented 1,236-byte fixture at `sources/fixture.md`, SHA-256 `cee9d777dcb690ca05ffdb4f0c24249eb78ff54678c3e2aeca7741258d39c6d7`. The pre-call `manifest.json` and synthetic `labels/frozen-labels.json` are preserved as frozen inputs. The labels were not included in Jev requests. The actual provider-call counts and post-call artifact hashes are in `run-receipt.json`; the pre-call manifest was not rewritten after execution.

The live path was MauroPrime Bridge HTTP `0.6.172`, embedded MSSR `0.2.127`, TypeSafe provider `typesafe-jev`, model `jev-1.13.0`. Three valid deterministic searches surfaced each relevant facet within the returned candidates. Three independent Jev Choice calls were made, one per case. Two selected ranges were exact-fetched and packed; the host assembled the cited paragraph in `report/host-composition.md`. Jev did not generate prose or authorize a write.

Three earlier search attempts used `maxSnippetChars=500`, above the live schema maximum of 240. Bridge rejected them before provider work. The runtime schema was inspected and the three searches were retried with a valid value. Those rejected attempts are recorded as schema friction, not benchmark cases or Jev calls.

## Results

| Case | Search evidence | Jev result | Choice confidence | Top option probability | Synthetic expected result |
| --- | --- | --- | ---: | ---: | --- |
| S01 (Spanish) | Expected exact block was rank 3; the whole-document parent and section also ranked above it. | Selected `block-2`, “Authority and contradiction handling”; exact fetch and pack passed. | 0.52 | 0.64 | Correct target selection |
| S02 (English) | Expected exact block was rank 3; the whole-document parent and section also ranked above it. | Selected `block-3`, “Exact citation retrieval”; exact fetch and pack passed. | 0.44 | 0.53 | Correct target selection |
| S03 (Spanish negative) | The relevant “Confidence and sample-size limits” section ranked 3rd and its exact block ranked 4th. | Abstained (`none`); no exact owner-gold sample size was invented. | 0.82 | 0.86 | Correct abstention |

Against these **three synthetic labels**, disposition and target results were 3/3: two expected exact-range selections and one expected abstention. This is a fixture-level check only. The deterministic lexical scores are candidate-ranking signals, not confidence estimates. Parent ranges often outranked the exact blocks, so this tiny run does not establish retrieval quality beyond the observed candidates.

### Choice confidence interpretation

`providerConfidence` and the winning option's probability are different TypeSafe Choice fields. TypeSafe derives Choice confidence from the concentration of the *whole* probability distribution. For `n` options and maximum probability `p`, the documented formula is `(n × p − 1) / (n − 1)`. The offered option count includes the explicit `none` choice:

- S01: `(4 × 0.64 − 1) / 3 = 0.52`.
- S02: `(6 × 0.53 − 1) / 5 = 0.436`, reported as `0.44`.
- S03: `(5 × 0.86 − 1) / 4 = 0.825` from the displayed probabilities; the provider reported `0.82`. This is a two-decimal rounding boundary, and the captured result does not expose more precise probabilities or a rounding rule. Treat it as consistent with display precision, not as a demonstrated mismatch or a verified exact match.

The official documentation explains that Choice confidence summarizes distribution shape and gives top probability as a separate possible statistic: [TypeSafe Confidence](https://docs.typesafe.ai/confidence), [TypeSafe Choice](https://docs.typesafe.ai/primitives/choice). MSSR correctly preserves both fields. This resolves the apparent S01/S02 discrepancy; no code or threshold change is indicated. Both Choice confidence and Noul `evidenceSufficiency` remain uncalibrated for MSSR's target tasks.

## Evidence integrity and host output

- Both selections were exact-fetched against the frozen source revision and range fingerprints.
- The evidence pack contains two verbatim ranges totaling 610 characters. It reports `advisoryOnly: true`, `truthAuthority: false`, and `canonicalRewriteAllowed: false`.
- The host-composed Spanish paragraph cites those exact lines. A blind Luna review judged both selected passages appropriately scoped and the S03 abstention appropriate. A second blind review checked only the confidence arithmetic; it confirmed S01/S02 and identified the S03 rounding boundary. These are model reviews, not human owner-gold.
- The blind reviewer input and review are stored separately from frozen labels. The independent review could not validate revision binding from its compact input alone; the raw tool results and evidence pack do show matching revision and fingerprint values.

## Limits and next gate

This run does **not** test the real MSSR corpus, EvidenceAtom metadata, contradiction graph, cross-source union planning, semantic compaction, threshold selection, or production reliability. The fixture explicitly names the desired behavior, so 3/3 is not a generalization estimate. The next meaningful calibration gate remains owner-adjudicated labels on source-bound real cases with preserved exposure history. Keep the current owner-gold holdout isolated until its human labels and exposure declaration are complete. Use a separate development cohort for threshold or prompt iteration.

No MSSR runtime, route, threshold, or canonical project knowledge changed in this run.
