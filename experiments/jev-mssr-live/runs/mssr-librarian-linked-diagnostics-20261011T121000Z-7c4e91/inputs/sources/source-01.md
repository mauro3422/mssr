## Confidence and merge policy

Treat confidence as a decision-family-specific routing signal, not a universal
quality percentage. Choose thresholds against the cost of a false action and
report risk-versus-coverage at several cutoffs. Until the score is calibrated
on independently reviewed, project-grouped holdout cases, label it
uncalibrated; do not call a raw threshold “90% trusted.” Evaluate calibration
with reliability bins and Brier/log loss or ECE alongside accuracy, precision,
recall, abstention and high-confidence errors.

Proposed stages:

1. Deterministic identity, owner, revision, privacy and exact-evidence guards.
2. Librarian returns bounded evidence handles; Jev proposes typed judgments
   over those explicit candidates.
3. Missing temporal/scope data, low confidence, or a contradiction sends the
   proposal to review/abstain.
4. A raw confidence threshold may admit a derived synthesis preview, never a
   destructive source merge or canonical write.
5. Independent verification and normal owner approval remain required before
   any persisted project change.

A merge/synthesis proposal should retain input atom IDs, refs, revisions and
fingerprints; candidate relations and conflicts; decision alternatives and a
short evidence-cited reason for each inclusion, omission or separation; the
output hash; confidence/calibration version; and reviewer/verification state.
Keep original atoms and source bytes intact. A contradiction blocks automatic
consolidation; represent supersession as a temporal relation rather than
silently overwriting older evidence. The current preview builder accepts only
exact fingerprint-bound source snapshots and comparable `supports` or
`duplicate` relations. It retains exact source snapshots and output hashes;
contradiction, unresolved, low-confidence, non-comparable or unverified cases
remain separate/review-only. The default 0.75 raw relation threshold is an
exploratory gate, not a calibrated probability or production confidence
guarantee. Unknown/non-fresh source status blocks candidate status. Freshness
and verifier records are caller assertions, not authenticated receipts; the
host must re-read and compare current source revisions before consuming a
candidate. `applyAllowed` and canonical rewrite remain false.

### Current exploratory live MSSR smoke — 2026-09-30

The live run at
`experiments/jev-mssr-live/runs/mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1/`
used four current MSSR documents, four retrieval queries, eight exact fetched
blocks and four Jev relation requests. Librarian recall@5 was 4/4 but top-1
was 0/4 (expected ranks 3, 2, 5 and 2). Jev matched 3/4 author-created
relation labels. For the case with unknown scope/time, Jev chose
`supports` at 0.45 confidence; deterministic evaluation and synthesis preview
kept both atoms in review because scope and temporal comparability were
unknown. Both previews had `applyAllowed=false`. The run has no independently
adjudicated labels or true contradiction positives, so it does not establish
general accuracy, contradiction recall or confidence calibration. It confirms
the explicit MSSR MCP path can call live Jev over exact current source blocks;
it does not make Jev an automatic Librarian reranker or authorize writes.
