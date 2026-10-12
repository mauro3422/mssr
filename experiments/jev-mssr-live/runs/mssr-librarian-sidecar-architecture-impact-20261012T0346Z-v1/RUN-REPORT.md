# Run report — broad architecture-impact query

Run: `mssr-librarian-sidecar-architecture-impact-20261012T0346Z-v1`
Parent: none; diagnostic precursor to the narrowed and atomic follow-ups.
Provider: live Jev 1.13.0 through MauroPrime Bridge 0.6.172 / MSSR 0.2.127.

## Question and evidence

The compound query asked what keeps architecture impact at `WATCH` versus
raising it to `REVIEW`, and whether structurally inferred dependency edges can
raise canonical attention. Lexical search offered 48 ranges across four
explicit MSSR sources. The expected target range was present in search.

Jev selected `block-2` from
`.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md`, not the
architecture-impact decision document. The exact fetch and evidence-pack
integrity checks passed for that selected range (717 characters), but the
selection was outside the pre-labeled relevant range and did not answer the
question. Jev reported Choice 0.31 and evidence sufficiency 0.37; both are
uncalibrated provider scores. The call used 7,125 input and 527 output tokens.

## Interpretation and limits

This is a one-source-cluster diagnostic despite search spanning four documents.
It shows that target presence in search and a valid exact fetch do not guarantee
the right selection. No blind semantic review, owner adjudication, holdout, or
calibration was performed. Treat answerability disposition (selected) and
relevant-range quality (miss) as separate outcomes. No threshold or production
behavior changed.

Frozen inputs and provider outputs are protected by `SHA256SUMS`; the derived
summary is `summary-calculated.json`.
