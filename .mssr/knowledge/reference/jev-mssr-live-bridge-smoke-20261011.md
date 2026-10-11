# MSSR live Bridge/Jev smoke — 2026-10-11

## Scope and method

One read-only live smoke used Bridge 0.6.167 / MSSR 0.2.115 against `docs/decisions/0009-semantic-evidence-plane.md` (source revision `63bac32774a54bdb8e7a5dd6021fa3f0351e491c6475cbb6745ce4c1e05ed2ad`). Search was lexical-only (`metadataMode=off`) for the question: “What does EvidenceAtom v2 require for freshnessEvidence to be structurally consistent, and what does that not prove?” Search returned eight exact-fetchable candidates.

The live Jev provider (`typesafe-jev`, model `jev-1.13.0`) made one call and selected `heading-4` (“1. Common evidence atom”) from eight candidates. Provider confidence was `0.79`; evidence sufficiency was `0.44`. Both are explicitly uncalibrated provider scores. The call used 1,806 input and 127 output tokens and took about 1.03 seconds.

## Exact-fetch review

Bridge fetched the selected range at lines 28–63, offsets 2,082–4,048, source revision above, fingerprint `3011bc7f729130c60359bb6167921b35642ee5e4a26a67296596927609269c94`. The returned section states that a `fresh` label requires a caller-supplied assertion matching canonical owner, normalized ref, and revision, with an observation timestamp. It says validation checks consistency only; it does not authenticate the host or independently prove that the observation occurred.

The fetched text directly supports both parts of this query. This is a source-derived manual review of one case, not owner-gold, blind adjudication, holdout, or a calibration point. It does not estimate retrieval accuracy or justify a score threshold.

## Reproducibility

The full receipt, including the exact fetched text and candidate summary, is stored outside the repository at `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-mssr-live-bridge-smoke-20261011-v1\receipt.json` (SHA-256 `97b121fe9e68bea28569bdc983cdeec627265791938ba2a6065e75cfcead82fe`). This live Bridge smoke is separate from the offline baseline/candidate diagnostic.
