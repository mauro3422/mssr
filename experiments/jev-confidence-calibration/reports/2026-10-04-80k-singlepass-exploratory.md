# Jev 80k single-pass confidence diagnostic

Exploratory offline report from frozen historical runs. This is not production calibration.

## Method

The final Choice count was validated as 200 in the manifest and every response record. The evaluator applies the documented TypeSafe normalized Choice confidence inverse (typesafe-choice-normalized-pmax-v1): pmax = 1/n + confidence * (1 - 1/n) ([documentation](https://docs.typesafe.ai/confidence)). It scores the reconstructed top-option mass against the frozen strict heading label as a diagnostic; it does not treat that value as the probability that evidence is correct. Full multiclass scores are unavailable because no complete candidate probability vectors were persisted.

## Results

| Run | Version / build | Dirty source | Selected | Abstained | Strict target matches | Top-label Brier | Top-label log-loss | Distinct source documents |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1 | 0.2.96 / no receipt | true | 50 | 2 | 35/50 | 0.184383 | 0.534465 | 21 |
| ↳ en | same run | — | 25 | 1 | 18/25 | 0.183435 | 0.534856 | — |
| ↳ es | same run | — | 25 | 1 | 17/25 | 0.18533 | 0.534074 | — |
| mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2 | 0.2.97 / mssr-build:sha256:bc288853f02be406 | true | 50 | 2 | 34/50 | 0.178172 | 0.515081 | 21 |
| ↳ en | same run | — | 25 | 1 | 17/25 | 0.169699 | 0.494576 | — |
| ↳ es | same run | — | 25 | 1 | 17/25 | 0.186645 | 0.535587 | — |

### Reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1

| Reconstructed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.3632 | 0.444444 | 4 |
| [0.5, 0.7) | 12 | 0.584588 | 0.583333 | 7 |
| [0.7, 0.85) | 10 | 0.7612 | 0.8 | 8 |
| [0.85, 1] | 19 | 0.935063 | 0.842105 | 16 |

### Exploratory risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1

| Minimum top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 15/50 | 0.3 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 5/29 | 0.172414 |
| 0.85 | 19/52 | 0.365385 | 3/19 | 0.157895 |
| 0.9 | 14/52 | 0.269231 | 0/14 | 0 |

Risk-coverage here is an exploratory curve over the strict labels and selected outputs; it is not a reliable risk guarantee or threshold recommendation.

### Reliability bins — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2

| Reconstructed top-choice mass | Support | Mean mass | Strict exact-target rate | Correct |
|---|---:|---:|---:|---:|
| [0, 0.5) | 9 | 0.369833 | 0.333333 | 3 |
| [0.5, 0.7) | 12 | 0.596196 | 0.666667 | 8 |
| [0.7, 0.85) | 10 | 0.77513 | 0.6 | 6 |
| [0.85, 1] | 19 | 0.935063 | 0.894737 | 17 |

### Exploratory risk-coverage — mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2

| Minimum top-choice mass | Accepted / 52 | Coverage | Errors / accepted | Selective risk |
|---:|---:|---:|---:|---:|
| 0 | 50/52 | 0.961538 | 16/50 | 0.32 |
| 0.5 | 41/52 | 0.788462 | 10/41 | 0.243902 |
| 0.7 | 29/52 | 0.557692 | 6/29 | 0.206897 |
| 0.85 | 19/52 | 0.365385 | 2/19 | 0.105263 |
| 0.9 | 15/52 | 0.288462 | 0/15 | 0 |

Risk-coverage here is an exploratory curve over the strict labels and selected outputs; it is not a reliable risk guarantee or threshold recommendation.

## Limits

- Labels were hidden from inference and reviewed by Luna, but there is no independent document-owner ground truth.
- Each query has one strict target heading. Alternative valid ranges have not been adjudicated.
- The grouped query split reuses all 21 source documents; the two languages and repeated runs are paired, not independent samples.
- Runs came from dirty source trees; v1 has no build receipt and v2 identifies build mssr-build:sha256:bc288853f02be406. Source hashes are preserved in each manifest.
- Abstention correctness is unlabeled. Abstentions are visible and excluded from top-label Brier/log-loss.
- Multiclass Brier/log-loss are unavailable because complete per-option probability vectors are absent.
- No production threshold is recommended. The data are too small and not owner-adjudicated for a production claim.\n