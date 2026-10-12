# Fresh source-disjoint Jev cohort

Run ID: `mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1`

This cohort covers six Spanish/English answerability and retrieval questions across three exact Markdown sources from three project roots. The source paths were searched in the local Jev experiment ledger before inclusion; no exact-path match was found. The project families themselves have prior exposure in other runs, so this is not a project-disjoint or globally unseen holdout.

Labels are being collected from two Luna reviewers using source text only, before any Jev call. Their labels are analyst judgments, not owner gold. Calls will use live TypeSafe Jev through the connected MauroPrime Bridge MCP. Search metadata and query variants are off. Jev receives only exact handles returned for the same query. A zero-handle search is recorded as not-run; it will not trigger an implicit whole-document selector.

For each case, record search target position/absence, selected handle and raw score distribution, exact fetch revision/fingerprint, and evidence-pack byte/citation identity. Inspect candidate text before sending it to Jev to exclude unnecessary machine-local paths. Scores remain uncalibrated; no thresholds, canonical sources, or production behavior change.

The frozen questions and source snapshots are under `inputs/`. The current `manifest.json` records the source hashes and remains prepared until blind labels are received.
## Blind-label freeze

Two independent Luna reviewers completed source-only labels before provider calls. They agreed on answerability for 6/6 cases and answer content for all 3 answerable cases. Exact-line references were reconciled against frozen snapshots; inaccurate references were preserved in the raw review files and identified in derived/pre-provider-label-agreement.md. Labels are reviewer judgments, not owner gold. Jev receives no labels or expected answers.