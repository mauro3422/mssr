# Jev and Librarian live experiments

These runs exercise the local Bridge release adapter against exact frozen MSSR
Markdown. They are exploratory diagnostics, not production rollout or
confidence-calibration evidence.

## Evidence handling

- Keep each run directory immutable after provider calls. Preserve `manifest.json`,
  raw `records.jsonl`, `request-events.jsonl`, and `run-completion.json` as the
  original evidence packet. Correct metadata through a separate append-only
  erratum; never rewrite the frozen manifest or provider records.
- Run a live request only through a frozen runner with explicit `--allow-network`
  and recorded user authorization. Labels stay out of provider requests.
- Run `node experiments/jev-mssr-live/summarize-run.mjs <run-directory> --write`
  after execution. This validates manifest/completion/case/record identities
  and derives request counts, unique source-document clusters, exact fetches,
  evidence packs, tokens, and timestamp warnings from the frozen artifacts.
- A runner-produced `summary.json` is convenient output, not an authority for
  cluster counts or semantic answer quality. Copied runners can retain static
  template text. Use `summary-calculated.json` for mechanical counts and keep
  semantic judgments in a separate reviewed file.
- A blind model-assisted review is useful evidence, but it is not owner-gold.
  Keep reviewer identity, input boundaries, and limitations explicit. Do not
  tune confidence thresholds from raw Jev Choice/Noul scores.
- Group queries by source-document cluster. Linked follow-ups, query variants,
  and repeated prompts against the same source are diagnostic repeats, not
  independent benchmark units. Do not pool them as additional holdout samples.
- Record the timestamp at freeze in UTC. Use request-event timestamps as the
  actual execution interval; if a frozen timestamp is wrong, add an erratum and
  preserve the original manifest hash.

## Current linked diagnostic sequence

1. [`mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f`](runs/mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f/) — ten exploratory requests across five source documents; a scorer heading-marker mismatch was corrected only in a derived analysis. Blind review found a Spanish-to-English retrieval miss and an incomplete compound preview query.
2. [`mssr-librarian-linked-diagnostics-20261011T121000Z-7c4e91`](runs/mssr-librarian-linked-diagnostics-20261011T121000Z-7c4e91/) — three linked requests against one source. Explicit English variants restored search from zero to twelve candidates for the Spanish query; Jev selected the exact preview-only rule. The split relation query directly found the allowed relations and fingerprints; the review-only answer remained partial on explicit temporal/scope wording. Its manifest timestamp has a separate erratum.
3. [`mssr-librarian-temporal-scope-facet-20261011T112431Z-91cd52`](runs/mssr-librarian-temporal-scope-facet-20261011T112431Z-91cd52/) — one linked precision request selected the exact source item listing missing temporal/scope data, low confidence, and contradiction as review/abstention triggers.

All semantic reviews are model-assisted and not independently owner-adjudicated.
All linked runs use the same policy document and are one source-document
cluster for evidence accounting. They show a promising retrieval/selection
diagnostic improvement, not general reliability, calibrated probability, or
production confidence.
