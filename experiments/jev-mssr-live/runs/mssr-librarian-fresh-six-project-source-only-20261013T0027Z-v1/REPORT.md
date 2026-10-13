# Run 65 — fresh six-project Librarian/JeV pilot

**Run:** `mssr-librarian-fresh-six-project-source-only-20261013T0027Z-v1`
**Date:** 2026-10-13
**Purpose:** exploratory check of source-scoped retrieval, Jev range selection/abstention, and exact fetch/evidence packing on six real project documents. Metadata was off; no production threshold or runtime changed.

## Results

- **Retrieval:** a range containing the pre-labeled answer appeared in 5/6 positive cases. The exact frozen target range appeared in 2/6. Whole-document heading containment is counted separately from a narrow target.
- **Positive selection:** Jev selected in all 5 positive cases that had candidates. The selected span covered the full frozen label in 2/5.
- **Negative questions:** Jev abstained in 5/5 cases that reached it. The sixth had no search candidates, so it was not sent to Jev and is not counted as an abstention.
- **Independent blind review:** a Luna reviewer judged 4/5 selected excerpts sufficient for the natural-language query and 1/5 partial. This conflicts with strict full-span coverage in CBAnimal and Workshop Media; those labels require project-owner adjudication.
- **Evidence integrity:** exact fetch fingerprint and evidence-pack validation passed in 5/5 selected primary cases.
- **Provider:** 10 live calls to TypeSafe Jev 1.13.0; 26,034 input / 2,215 output tokens; 8963.7 ms total provider-reported latency. Choice and Noul are descriptive and uncalibrated.

## Readout

This supports using the Bibliotecario as an evidence-retrieval and exact-citation assistant with Jev in the loop. It does **not** justify automatic canonical merging or a confidence threshold: selection coverage remains mixed, the cohort is small and source-only, the documents may have prior informal exposure, and the scores are not calibrated. Exact fetching/packing is currently the strongest verified layer.

The TypeScript Practice source is Spanish while the frozen questions were English. Both primary searches returned zero candidates. A separate post-hoc follow-up with explicit Spanish variants returned 20 candidates for each question; Jev selected the exact positive line and abstained on the negative. This is a language-sensitive retrieval diagnosis, excluded from the primary metrics. It supports testing host-supplied multilingual query variants before changing lexical ranking.

## Execution and integrity notes

The primary calls used MSSR's direct MCP tools with explicit snapshots and live Jev. The frozen plan called this “through Bridge”; `EXECUTION-ERRATUM.json` corrects that description. A Bridge project-root search attempt for TypeScript Practice was rejected because that path has no `.git`, despite a valid and hash-matching `.mssr/project-context.json`; it made no Jev call. The direct MCP path did not exercise Bridge's project authorization boundary.

All six source files and project manifests still match the hashes frozen in `RUN-PLAN.json`. Workshop Media Studio's working tree was dirty and its README was modified before this run; the exact README snapshot stayed unchanged during the pilot. No source, manifest, threshold, or runtime was modified. Raw source bodies were not copied into this run package.

## Artifacts

- [Frozen plan](RUN-PLAN.json)
- [Machine-readable results](RESULTS.json)
- [Blind review](BLIND-REVIEW.md)
- [Language-variant follow-up](FOLLOWUP-QUERY-VARIANTS.json)
- [Execution-path erratum](EXECUTION-ERRATUM.json)
- [Source revision erratum](SOURCE-REVISION-ERRATUM.json)
- [Checksums](SHA256SUMS.json)
