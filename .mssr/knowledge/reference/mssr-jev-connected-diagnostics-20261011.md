## 2026-10-11 connected Jev/Librarian diagnostics

The cross-family diagnostic selected the expected section and passed exact
fetch/evidence-pack checks on 3/3 documents. Blind excerpts were answer-complete
with varying extra context; numeric `evidenceSufficiency` was lost by the first
runner and cannot be reconstructed. Corrected derived counts and limits are in
the [report](../../../experiments/jev-mssr-live/runs/mssr-librarian-cross-family-fresh-smoke-20261011T181217Z-v1/ADJUDICATION-REPORT.md).

### CRLF heading excerpt follow-up

- A short 13-CRLF fixture selected the expected heading under both MSSR 0.2.126
  and 0.2.121, with exact fetch passing for both. It proves the call path, not
  the fix; its freeze-time clean-worktree flag was corrected by an append-only
  [erratum](../../../experiments/jev-mssr-live/runs/mssr-librarian-crlf-candidate-20261011T182512Z-v1/RUN-ERRATUM.md).
- A 101-CRLF document with a parent heading produced an overbroad parent
  selection (5,895 characters) at Choice/Noul 0.85/0.85. Exact fetch passed and
  blind review found the answer present but buried in unrelated staging text.
  This exposes heading precision debt, not a CRLF failure.
- A focused 99-CRLF document without a parent heading selected the exact child
  under 0.2.126 (Choice 1.00, Noul 0.88); exact fetch passed. Blind review found
  full answer coverage but high irrelevant overbreadth. A deterministic,
  provider-off package capture shows the old 0.2.121 option excerpt ended before
  the late answer (`Sign…`), while 0.2.126 included its authority and field list;
  the existing 260-character limit still clips the last suffix.

These are small synthetic diagnostics, not owner-gold, reliability estimates,
or confidence calibration. Scores remain uncalibrated. Production Bridge
0.6.169 still uses MSSR 0.2.121; no restart or adoption occurred. The isolated
Bridge checkout was restored to 0.2.121 and verified clean. The full packets,
linked control, request excerpts, and blind reviews are indexed in the
[experiment ledger](../../../experiments/jev-mssr-live/README.md), entries
23–25. The cross-family report also records the previous 3/3 diagnostic.

A subsequent linked diagnostic used one real Jev 1.13.0 call through isolated Bridge 0.6.169 / MSSR 0.2.126 candidate against the previously exposed `jev-decision-model-use-cases.md`. Heading mode selected category B exactly among 20 headings; exact fetch/fingerprint passed for its 791-character range, containing cases 11–20. Blind Luna exact-text review marked full/low overbreadth. The runner summary's static “synthetic” label is corrected in an append-only erratum; frozen evidence remains intact. This is not independent holdout, owner-gold, reliability or calibration evidence; scores remain uncalibrated. See run ledger entry 26 and the [adjudication report](../../../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).
