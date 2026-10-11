# Paired excerpt-cap diagnostic — adjudication

Run: `mssr-librarian-excerpt-cap-paired-20261011T161000Z-v1`

Provider: Jev `jev-1.13.0`, through isolated Bridge adapter `0.6.169`

MSSR selector: `0.2.124` at commit `e79518ad1fb893847802277bbfc96accbcdd3488`

## Result

The frozen paired run completed all 10/10 requests across five document
clusters; there were no provider errors. The 780-character arm selected an
expected target range in 5/5 cases. The 260-character arm selected the same
expected range in four cases and abstained in one answerable notice-transition
case. Every selected range passed the exact-fetch fingerprint check (9/9).

Two independent Luna reviewers rated the notice case consistently: the
780-character selection answered all requested facets but was highly
overbroad; the 260-character abstention was inappropriate because the source
contains a short, direct answer. The long selection fetched 3,735 code units
from the `Decision` section, including extensive unrelated gate and
implementation details after the concise answer. This is evidence to improve
candidate granularity or penalize overbroad ranges, not a reason to simply
raise the global excerpt cap.

| Case | 260-char arm | 780-char arm | Blind quality finding |
| --- | --- | --- | --- |
| Notice transition | Abstained; Choice 0.83 / Noul 0.14 | Expected `Decision`; 0.96 / 0.71 | Short arm: inappropriate abstention. Long arm: full, high overbreadth (both reviewers). |
| Safe update transaction | Expected heading; 0.68 / 0.37 | Same heading; 0.96 / 0.66 | Full in both reviews; identical target. |
| Optional WAIT reconsideration | Expected heading; 0.40 / 0.64 | Same heading; 0.99 / 0.92 | Full in both reviews; identical target. |
| Superseded worktree evidence | Expected heading; 0.92 / 0.80 | Same heading; 1.00 / 0.90 | Full in both reviews; identical target. |
| Learning metric interpretation (related-topic stratum) | Expected heading; 0.99 / 0.84 | Same heading; 1.00 / 0.91 | Full in both reviews; reviewers disagreed on overbreadth for the long arm. |

The raw Choice and Noul scores increased in all five long-vs-short pairs. That
pattern is descriptive only: these scores are not calibrated probabilities,
there are five clusters, labels are model-assisted rather than owner-gold, and
one case is explicitly a related-topic stratum. Do not infer a calibrated
confidence threshold, general quality improvement, or production policy from
this run. The 780-character arm used 7,477 more reported input tokens across
the five paired requests; total usage was 49,467 input and 3,027 output tokens.

## Integrity and execution boundary

- All 13 files listed in `PRECALL-SHA256SUMS` still match their frozen hashes.
- The blind packet was prepared without cap, score, target label, or rubric
  mapping. Reviewer labels are preserved separately in `adjudication/`.
- The run used the pinned MSSR selector and isolated Bridge adapter named above.
  `run-completion.json` records `productionRuntimeTouched: false`; no production
  Bridge restart or live runtime mutation occurred.
- The repository's generic `summarize-run.mjs` does not accept this custom
  runner's schema: it stopped before writing because this run's completion
  record has no `manifestSha256` field. No frozen input was edited. This
  adjudication therefore records its own schema-specific counts from the
  preserved records and validates the pre-call checksums directly.
- Labels are source-derived and host-authored, not owner-gold. This experiment
  tests exact-range selection under two excerpt caps, not end-to-end synthesis,
  truth, or confidence calibration.

See `adjudication/blind-review.json` for the two reviewers' per-sample labels.
`SHA256SUMS` protects the frozen run payload; `DERIVED-SHA256SUMS` protects the
post-run report and adjudication files.
