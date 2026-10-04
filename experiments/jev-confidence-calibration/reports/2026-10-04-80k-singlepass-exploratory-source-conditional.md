# Jev 80k single-pass confidence diagnostic

Conditional exploratory offline report from frozen historical runs. It supersedes the earlier n=200 report and the n=201 source-verified report: both runs were captured from dirty trees, and neither has a preserved selector source file matched to the run-time fingerprint. No actual final Choice option count is verified. This is not production calibration.

## Method

Both frozen manifests record 200 heading candidates and dirty run source. The v2 manifest captures a selector-source hash, but the matching source file is not preserved in the archive; v1 captured no selector-source hash. The recorded Git run HEAD is not proof of the code in those dirty working trees. Accordingly, this report shows conditional sensitivity scenarios: n=200 if the final Choice consisted only of headings, and n=201 if it added exactly one `none` option. These scenarios are not exhaustive if the dirty source added a different number of options. The runner copied `finalistCount` from `candidateCount` when absent, so neither field independently establishes final Choice cardinality. For each assumed n, the evaluator applies the documented TypeSafe normalized Choice confidence inverse (typesafe-choice-normalized-pmax-v1): pmax = 1/n + confidence * (1 - 1/n) ([documentation](https://docs.typesafe.ai/confidence)). Resulting pmax is the conditional mass assigned to the chosen option. Binary top-label scores compare that mass with strict heading match among selected answers; they do not establish independent calibration or evidence sufficiency. Full multiclass scores are unavailable because no complete candidate probability vectors were persisted.

## Results

Every Brier/log-loss value and every probability-derived curve below is conditional on the column's assumed option count; none is based on a verified final Choice count.

| Run | Version / build | Dirty source | Selected | Abstained | Strict target matches | Brier n=200 | Brier n=201 | Log-loss n=200 | Log-loss n=201 | Distinct source documents |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1 | 0.2.96 / no receipt | true | 50 | 2 | 35/50 | 0.184383 | 0.184383 | 0.534465 | 0.534465 | 21 |
| ↳ en | same run | — | 25 | 1 | 18/25 | 0.183435 | 0.183436 | 0.534856 | 0.534857 | — |
| ↳ es | same run | — | 25 | 1 | 17/25 | 0.18533 | 0.18533 | 0.534074 | 0.534074 | — |
| mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2 | 0.2.97 / mssr-build:sha256:bc288853f02be406 | true | 50 | 2 | 34/50 | 0.178172 | 0.178172 | 0.515081 | 0.51508 | 21 |
| ↳ en | same run | — | 25 | 1 | 17/25 | 0.169699 | 0.169699 | 0.494576 | 0.494574 | — |
| ↳ es | same run | — | 25 | 1 | 17/25 | 0.186645 | 0.186645 | 0.535587 | 0.535585 | — |

### Conditional reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1, n=200 assumed

Assumption: The final Choice contains only the frozen heading candidates and no extra option.

| Assumed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.3632 | 0.444444 | 4 |
| [0.5, 0.7) | 12 | 0.584588 | 0.583333 | 7 |
| [0.7, 0.85) | 10 | 0.7612 | 0.8 | 8 |
| [0.85, 1] | 19 | 0.935063 | 0.842105 | 16 |

### Exploratory conditional risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1, n=200 assumed

| Minimum assumed top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 15/50 | 0.3 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 5/29 | 0.172414 |
| 0.85 | 19/52 | 0.365385 | 3/19 | 0.157895 |
| 0.9 | 14/52 | 0.269231 | 0/14 | 0 |

Risk-coverage is an exploratory sweep over strict labels and selected outputs under this assumed n; it is not a reliable risk guarantee or threshold recommendation.

### Conditional reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1, n=201 assumed

Assumption: The final Choice contains the frozen heading candidates plus exactly one explicit none option.

| Assumed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.363184 | 0.444444 | 4 |
| [0.5, 0.7) | 12 | 0.584577 | 0.583333 | 7 |
| [0.7, 0.85) | 10 | 0.761194 | 0.8 | 8 |
| [0.85, 1] | 19 | 0.935062 | 0.842105 | 16 |

### Exploratory conditional risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1, n=201 assumed

| Minimum assumed top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 15/50 | 0.3 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 5/29 | 0.172414 |
| 0.85 | 19/52 | 0.365385 | 3/19 | 0.157895 |
| 0.9 | 14/52 | 0.269231 | 0/14 | 0 |

Risk-coverage is an exploratory sweep over strict labels and selected outputs under this assumed n; it is not a reliable risk guarantee or threshold recommendation.

### Conditional reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2, n=200 assumed

Assumption: The final Choice contains only the frozen heading candidates and no extra option.

| Assumed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.369833 | 0.333333 | 3 |
| [0.5, 0.7) | 12 | 0.596196 | 0.666667 | 8 |
| [0.7, 0.85) | 10 | 0.77513 | 0.6 | 6 |
| [0.85, 1] | 19 | 0.935063 | 0.894737 | 17 |

### Exploratory conditional risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2, n=200 assumed

| Minimum assumed top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 16/50 | 0.32 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 6/29 | 0.206897 |
| 0.85 | 19/52 | 0.365385 | 2/19 | 0.105263 |
| 0.9 | 15/52 | 0.288462 | 0/15 | 0 |

Risk-coverage is an exploratory sweep over strict labels and selected outputs under this assumed n; it is not a reliable risk guarantee or threshold recommendation.

### Conditional reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2, n=201 assumed

Assumption: The final Choice contains the frozen heading candidates plus exactly one explicit none option.

| Assumed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.369818 | 0.333333 | 3 |
| [0.5, 0.7) | 12 | 0.596186 | 0.666667 | 8 |
| [0.7, 0.85) | 10 | 0.775124 | 0.6 | 6 |
| [0.85, 1] | 19 | 0.935062 | 0.894737 | 17 |

### Exploratory conditional risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2, n=201 assumed

| Minimum assumed top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 16/50 | 0.32 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 6/29 | 0.206897 |
| 0.85 | 19/52 | 0.365385 | 2/19 | 0.105263 |
| 0.9 | 15/52 | 0.288462 | 0/15 | 0 |

Risk-coverage is an exploratory sweep over strict labels and selected outputs under this assumed n; it is not a reliable risk guarantee or threshold recommendation.

## Limits

- Labels were hidden from inference and reviewed by Luna, but there is no independent document-owner ground truth.
- Each query has one strict target heading. Alternative valid ranges have not been adjudicated.
- The grouped query split reuses all 21 source documents; the two languages and repeated runs are paired, not independent samples.
- Both runs came from dirty source trees. v1 has no selector source hash; v2 has a selector source fingerprint but not the exact matching source file. The recorded Git run HEAD does not establish dirty run-time contents.
- n=200 and n=201 are sensitivity assumptions, not verified final Choice cardinalities. Other option counts are possible if the unpreserved selector source added a different number of options.
- Abstention correctness is unlabeled. Abstentions are visible and excluded from top-label Brier/log-loss.
- Multiclass Brier/log-loss are unavailable because complete per-option probability vectors are absent.
- No production threshold is recommended. The data are too small and not owner-adjudicated for a production claim.
