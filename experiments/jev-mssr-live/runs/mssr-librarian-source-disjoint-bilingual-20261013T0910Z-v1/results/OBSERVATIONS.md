# MSSR Librarian + Jev pilot observations

Run: `mssr-librarian-source-disjoint-bilingual-20261013T0910Z-v1`
Date: 2026-10-13
Model: `jev-1.13.0`

## Scope and method

This pilot used 12 source-derived questions across BeeIncremental, Elemental Frontier, and the Bridge candidate repository: six questions with a source-supported answer and six asking about absent, pending, unset, or unauthorized facts. Each question ran in Spanish and English, for 24 search arms. The sources were frozen from clean Git worktrees and copied into this run; the pilot did not write to those source repositories. These project families had appeared in earlier work, so this is a diagnostic cohort, not an independent project-family holdout. Labels were independently reviewed but are not owner-gold.

Search used the live Bridge catalog and exact candidate handles (max 8 results; snippets capped at 160 characters). Jev ran only when the candidate pool was nonempty: 22 calls, 2 deliberate not-runs for empty pools. The saved usage counters sum to 36,370 input + 2,704 output = 39,074 tokens. `SELECTION-SUMMARY.json` now stores this total as a scalar.

## Results

| Measure | Result | What it says |
|---|---:|---|
| Search found the planned target span | 21/24 | Strong overall retrieval on this small cohort, with a language gap. |
| Spanish target-span coverage | 9/12 | Misses: two BeeIncremental arms and the Bridge dashboard-navigation arm. |
| English target-span coverage | 12/12 | All planned spans appeared in the result pools. |
| Jev selected | 12/22 nonempty pools | Nine positive answer arms and three explicit “unset / unauthorized” evidence arms. |
| Jev abstained | 10/22 nonempty pools | Eight appropriate abstentions and two missed abstentions under blind review. |
| Selected evidence sufficient | 12/12 | No unsupported selection observed by the independent reviewer in this cohort. |
| Exact fetch and evidence pack | 12/12 | Every selected handle was revalidated and packed with its cited source text. |
| Selected exact target range | 7/12 | Five selections included extra surrounding text; three were broad and two moderate after resolving Q-10. |

Positive answer behavior needs two separate readings. Of six positive questions (12 language arms), nine arms selected the target. Two failed earlier at search (one empty pool, one candidate pool without the target); Jev then did not invent an answer. One arm had the exact target available but Jev abstained. Thus end-to-end positive target selection was 9/12 arms, while conditional selection among pools with the target actually available was 9/10.

On the 11 nonempty negative pools, Jev abstained in eight. It selected explicit evidence that the requested value was not set or not authorized in three; the blind reviewer judged all three selected passages sufficient. One other negative arm abstained even though the candidate set included direct no-authorization evidence. Treat “source proves absent” separately from “source provides no answer” in future labels and metrics.

The independent reviewer judged all selected passages sufficient, but the 100% observed selected-evidence sufficiency is only 12 cases and is not an estimate of production precision. It also disagreed with one breadth label; the persisted exact handle resolves Q-10 as the entire 39-line matrix, so it is counted broad. See [BLIND-JEV-REVIEW.md](BLIND-JEV-REVIEW.md).

## Quality assessment

The evidence path is promising as an advisory librarian: when Jev selected, the exact revision-bound handle survived fetch and citation packing, and the blind reviewer found support in each selected passage. This is materially better than a fluent answer without provenance.

The system is not yet calibrated as a trust or activation gate. Search recall is weaker for Spanish in this sample; Jev missed two answerable arms (one after an actual retrieval miss, one despite the target being present), and selected ranges are wider than needed in five of twelve results. Provider Choice/Noul values are raw, uncalibrated scores; this cohort does not justify a confidence threshold or automatic application.

Recommendation: keep the librarian advisory with exact-handle fetch and independent verification. Before using its score as confidence, build an owner-gold, project-family holdout with balanced positive, true no-answer, documented-absence, and unauthorized cases. Tune Spanish query expansion and range narrowing on development cases only, then evaluate once on the frozen holdout. Report retrieval recall, selected-evidence sufficiency, abstention quality, exact-range rate, and a calibrated reliability curve separately.

## Run-integrity and harness notes

- The preregistered EF version-matrix hash had a transcription error. Hash verification found it before any Jev call; `RUN-PLAN-ERRATA.md` records the correction and the corrected hash is in `PRECALL-SHA256SUMS.txt`.
- The JavaScript execution host lacked `TextEncoder` during one Bee search serialization attempt. That arm was repeated with the supported serializer; only the successful saved response was scored, and Jev was not called during the failed attempt.
- One initial host-gated bootstrap incorrectly supplied a decision for required root `mssr-agent-routing`. The route rejected it before provider execution; a corrected bootstrap succeeded. This repeats known caller-side host-gating friction and is recorded in the MSSR routing incident log; no routing or product change is indicated.
- The raw full provider object for BEE-01 Spanish was unavailable in the persisted folder; a compact result transcription and exact fetch/pack remain. This is a reproducibility limitation for that one call, not a result that can be reconstructed by re-calling Jev without changing the run.
- The source hash correction, tool-host serializer failure, and total-token serialization defect are recorded here so they do not get mistaken for Jev behavior.

## Roll-up of the preceding three days

The experiment directory contains 81 dated run folders from 2026-10-11 through 2026-10-13. They include iterative variants, replays, smoke checks, and post-hoc packages; they are not 81 independent cohorts and their counts must not be summed.

| Cohort | Measured result | Caveat |
|---|---|---|
| Run45, cross-project development | 8/10 positive selections with candidates; 4/4 negative abstentions; exact fetch/fingerprint/pack 8/8. | Only 5/8 selected ranges covered the complete labeled support span; blind composition review found 3 complete and 1 partial. Negative Choice scores were 0.82–0.99, showing raw score is not confidence. |
| Run58, Bridge cross-document | 8/8 positive selections; 1/1 negative abstention; fetch/pack 8/8. | Search target coverage 3/8 and final selection in the gold range 2/8. Two positive sufficiency reviews were disputed and treated as partial. |
| Run59, Spanish source pilot | Answered 5/6; selected 2/3 positive cases and abstained 3/3 negatives; positive search coverage 2/3; exact range 1/3; fetch/pack 2/2. | Two supposedly empty pools omitted `candidateHandles`, so Jev saw implicit headings; those are not valid empty-pool abstention evidence. The run was already called, so its “holdout” name does not mean protected holdout. |
| Run60, fresh cross-project bilingual | 10/12 positive arms selected; 12/12 negative arms abstained; selected evidence blind-rated sufficient 10/10; fetch/pack 10/10. | Six of ten ranges were broad; only 3/12 were exact. An old metric called strict exact-range equality “recall”; use the corrected post-run analysis. Two positive arms were false abstentions. |
| Run61, live sidecar | Selector filtering 4/4; target retrieval 8/8 versus lexical 5/8; 12/12 selections landed inside expected sections; exact fetch/fingerprint/bytes 7/7; blind sufficiency 12/12. | Seven of twelve selections were too broad. The cohort used exposed sources and does not isolate a causal improvement from atoms, skills, or refs. |
| Run63, source/path-disjoint cohort | Target appeared in 2/3 positive pools; Jev selected 1/2 where target was offered; abstained on 3/3 negatives; fetch/pack 1/1. | Only source/path-disjoint inside exposed project families, not project-family holdout; one false abstention occurred despite an exact NeoPSE table. |
| Run64, query-variant replay | An English variant recovered a target that the prior query missed; on the same source handle, Jev abstained on the compound Spanish query and selected on translated/faceted queries. Blind review judged 5/5 sufficient. | Reuses Run63 cases; useful for diagnosis, not an independent language-effect estimate. Selected ranges included extra columns. |
| Run65, six-project source-only cohort | Top-level `RESULTS.json` claims fetch/pack 5/5; per-case receipts and `INTEGRITY-ERRATUM.json` support only 2/5 case-verifiable selections. Blind review found 4/5 sufficient and 1 partial. | The other three are unsupported aggregate claims, not proven failures. Search covered a containing range in 5/6 positives but exact ranges in 2/6; no raw provider bodies or owner-gold labels. |
| Run66, integration smoke | Bridge search → exact Jev block → fetch → pack passed end-to-end for one case; writes/apply disabled. | Confirms wiring and byte identity, not quality at population scale. |
| Run67, compound/facet diagnostic | Compound query: Choice 0.97, sufficiency 0.53, blind result partial. Facet follow-up retrieved the complementary paragraph with Choice 0.39. Fetch/pack 2/2. | Direct counterexample to treating Choice as a confidence percentage. The second query was post-hoc and the cluster was known. |
| Run55 and related facet/union examples | Manual split, exact evidence union, and paragraph assembly improved several reviewed examples; Run55 initial composition had 3 complete/1 partial, then three same-snapshot facet follow-ups were judged complete. | These examples show the librarian can support useful synthesis; automatic facet coverage and generalization remain unvalidated. |

The historical atom ablation reported 48/51 vs 45/51 vs 34/51 for atom, parent, and text-only conditions. It was an exposed/tuned sample, not an independent holdout. The Run67 inventory counted 95 runs but found zero owner-adjudicated units and no ready, unexposed holdout. Consequently none of these scores can calibrate a production confidence threshold.

## Current connection state observed during this report

At `2026-10-13T09:34:56Z`, refreshing the Codex-local MSSR capability registry returned `mauroprime-bridge: unavailable`, zero discovered capabilities, and `MCP error -32000: Connection closed`; its last successful registry observation was 2026-10-11. The same local route reported a stale loaded MSSR build (`c0b0df2f3eeccf0f`) against available build (`ea26a64e6c4feedd`). Direct Bridge calls then succeeded: `skill_load` at 09:42:02Z, followed by `bridge_health(all)` at 09:42:47Z reporting Bridge 0.6.177, tunnel `200/live`, readiness `200/ready`, 189 tools, zero recent transport failures, and no restart pending. Therefore the earlier failure is a stale/inconsistent Codex-local provider-health snapshot, not evidence that the Bridge runtime is down. The Bridge metric `processStartTimeSeconds` still points to 2026-10-11 05:08:33Z while OS process 4256 started 2026-10-13 04:54:39Z; that metric's source remains unresolved. No restart was performed. These current connection observations do not invalidate the already saved Jev run.

Across runs, exact revision-bound fetch/fingerprint/pack is strongest when each case has its own persisted handle and receipt. It proves provenance and byte identity, not sufficiency, completeness, or narrowness. The recurring quality risks are search misses (especially language variants), false abstentions with available evidence, wide or partial ranges, incomplete facet coverage, and reports whose aggregates lack case-level receipts. Split-and-union synthesis has useful reviewed examples, but automatic facet completion is not validated. Keep all confidence-like decisions advisory until owner-gold labels, an actually unexposed project-family holdout, per-case receipt integrity, and calibration gates exist.

## Files

- `RUN-PLAN.json` — frozen cohort, queries, labels, budgets, and protocol.
- `RUN-PLAN-ERRATA.md` — hash correction before provider calls.
- `inputs/BLIND-SOURCE-REVIEW.md` — source-derived label review.
- `results/SEARCH-SUMMARY.json` — retrieval metrics.
- `results/SELECTION-SUMMARY.json` — selection, abstention, token, fetch, and range metrics.
- `results/BLIND-JEV-REVIEW.md` — blind quality review and resolved discrepancy.
- `results/search/`, `results/selection/`, `results/fetch/`, `results/packs/` — per-arm evidence artifacts.
