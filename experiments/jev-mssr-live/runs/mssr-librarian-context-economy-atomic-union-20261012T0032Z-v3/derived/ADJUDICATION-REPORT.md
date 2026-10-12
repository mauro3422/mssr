# Atomic-facet union diagnostic — 2026-10-12

## Scope

This is an informed iteration on one previously exposed source-document cluster. It evaluates whether manually separating a compound context-economy question into three bounded facets improves Jev selection and whether exact fetched ranges can support a host-composed answer. It is exploratory evidence, not a holdout, owner-gold set, confidence calibration, or production adoption test.

The source was `docs/skill-routing/HANDOFF_CONTEXT_ECONOMY_PRIORITY.md`, frozen at SHA-256 `7b85a968ca5b35197baf91dde99c175ca38c24eab07bc6b6fb1bb74bd874d83a`. The source was audited against 48 previous runs without finding a recorded reference or full matching copy; an unrecorded excerpt/paraphrase cannot be ruled out. More directly, v3 follows v2 on the same source, so these three calls are linked repeats within one cluster.

The calls used Jev 1.13.0 via the isolated Bridge 0.6.172 / MSSR 0.2.127 release adapter (`bridgeCommit` `8c181ef33919038f400f623bd9a42ca1fd6b17a6`). The runner cannot observe provider transport calls beneath the Bridge adapter; `providerTransportInvocationsObserved` remains `null`.

## Iteration history

- **v1** failed frozen-input validation before provider setup. It made no provider calls and remains preserved.
- **v2** made three live calls. One narrow lifecycle facet selected and fetched its target; a broad compound query and a multi-part budget/alias/caveat query abstained. This motivated a third iteration with three manually atomic questions.
- **v3** completed 3/3 Jev calls. The expected target was present in search 3/3, Jev selected 3/3, exact fetch/fingerprint validation passed 3/3, and all three individual evidence packs validated.

## v3 selection and union

| Facet | Jev selection | Expected line | Exact accepted range | Exact fetch/pack |
|---|---|---:|---|---|
| Required roots | `block-12`, L39, 304 chars | L39 | Match | Pass |
| Context budgets | `block-17`, L51, 202 chars | L51 | Match | Pass |
| Owner aliases and causal caveat | `heading-7`, L45–L54, 688 chars | L53 | Broader section | Pass |

Normalized heading equality was 3/3, but selected exact accepted-range matches were 2/3. The search results contained the exact accepted target range 3/3. This distinction matters: the third fetch was byte-exact for the selected heading range and useful to answer the question, yet it included the surrounding heading section rather than selecting only L53.

The host built one provider-off union pack from those three selected/fetched handles. It contains three verbatim cited paragraphs totaling 1,194 characters; union validation passed and required zero further Jev/provider calls. Exact source text, source revision, citations, and output fingerprints are recorded in `UNION-EVIDENCE-PACK.json`, `UNION-VERIFICATION.json`, and `POST-RUN-REVALIDATION.json`.

## Answer quality

One blind Luna review found 2 direct answers and 1 partial answer, with low overbreadth for all three. The partial item concerns which roots were selected: the source confirms four required roots but names only `git-change-publication` and `skill-maintenance-loop`; the composed paragraph states this limitation instead of inventing the other two. The full literal text and review are in `HOST-COMPOSED-PARAGRAPH.md` and `BLIND-REVIEW.md`.

Jev selected evidence; the host assembled the cited paragraph. This run does not demonstrate autonomous semantic coverage planning or Jev prose generation.

## Scores, effort, and measurement correction

Raw Choice confidence values were `0.47`, `0.97`, and `0.89`; explicit evidence-sufficiency values were `0.67`, `0.93`, and `0.95`. These scores are descriptive and uncalibrated. The three calls consumed 29,651 input tokens and 2,441 output tokens.

The run summarizer initially treated evidence packs with `status: validated` as unbuilt because it required `status: complete`, even though the runner records `passed: true`. It now counts validated/complete packs only when the positive pass flag or supported legacy status is present, and separately reports normalized heading matches, selected exact accepted-range matches, and exact-range presence in search. The recalculated run summary reports 3/3 packs, 3/3 heading matches, 2/3 selected exact ranges, and 3/3 exact search targets. Regression coverage and the corrected derived output are preserved; the original `summary.json`, provider records, manifest, and frozen hashes were not rewritten.

Post-run verification confirmed the current source bytes and frozen snapshot match; all three selections/fetches matched their exact normalized source slices and fingerprints; all three individual packs and the union pack validated; all 20 pre-run files verified; and no runner lock remained.

## Limits and next experiment

This is one source cluster, three linked manual facets, and one model-assisted reviewer. The targets are source-derived; they are not owner-gold. Do not pool these calls as three independent benchmark cases, tune a confidence threshold from them, or infer general retrieval/selection reliability.

The next useful step is a new, independently audited source cluster whose text explicitly enumerates the expected items. Freeze accepted ranges and blind labels before live calls, test one compound query against manually split facets, and evaluate search recall, exact selected-range precision, fetch/fingerprint integrity, complete cited coverage, and overbreadth separately. Keep the current source out of that independent cohort.
