# Run51 — Real-document provenance relation

## Outcome

Jev 1.13.0 selected **supports** with raw selected-option confidence **0.96** for the exact ADR 0009 / architecture-module pair. The manually expected label was also `supports`, but it is exploratory and not owner-gold. The portable evaluator kept the judgment at **review** because independent verification is unavailable. The judgment remains unverified and advisory; no canonical write occurred.

Both source handles and fingerprints were revalidated by Bridge before the provider call and again by the relation-review wrapper. Jev cited both atoms (2/2), with complete evidence coverage and no revision or fingerprint mismatch. The expected relation was kept in `inputs/labels.json` and was not included in `inputs/request.json` or the provider request.

## Sources and dependence

The first range is ADR 0009, `block-11`, line 62. It says a `fresh` assertion must match owner/ref/revision and observation time, but this consistency check does not authenticate the host or prove the observation occurred. The second is `.mssr/knowledge/architecture/semantic-evidence-plane.md`, `block-5`, line 15. It says Librarian retains caller-asserted provenance without authenticating it.

The two ranges are compatible and complementary for the stated scope. Their source independence is not established: the architecture module may summarize the ADR. Count this as one dependent diagnostic pair, not two independent claims or an owner-adjudicated sample.

## Metrics

- Provider: `typesafe-jev / jev-1.13.0`; 1 call, 1 batch, 1 question.
- Usage reported by Bridge: 1391 input tokens, 69 output tokens, 754.3473 ms.
- Exact endpoints revalidated: 2/2; citations: 2/2; coverage complete.
- Relation: `supports`; raw confidence: 0.96; calibrated confidence: null.
- Evaluation: `review`; reason: `independent-verification-unavailable`.
- Verified judgments: 0; canonical writes: 0.

## Interpretation and limits

The result is consistent with the expected relation and demonstrates the real-source exact-fetch → atom-bound Jev relation → evaluator-review path. It does **not** validate the 0.96 score: there is one manually labeled pair, likely dependent source text, no independent adjudication, and no holdout. Do not use this score for a confidence gate or production calibration.

Together Runs49–51 now cover linked positive relations, explicit missing-comparability abstention, a separate synthetic contradiction canary, and another real but dependent positive pair. Run50 remains the only contradiction example and is synthetic. No natural current contradiction pair has been found. The next useful evidence is an owner-adjudicated, source-disjoint set with near-negative controls; relation quality should stay separate from Librarian search/selection, evidence-pack composition, and semantic compaction.

## Reproducibility

Frozen inputs and expected label are in `inputs/`; pre-call hashes are in `PRECALL-SHA256SUMS.json`. The structured Bridge response is in `derived/jev-response.json`. This is a direct MCP diagnostic, not a frozen CLI-runner packet; raw provider HTTP bytes were not captured.
