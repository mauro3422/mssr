# Bridge Librarian Jev on real MSSR documents

## Result

The frozen three-query Jev handler smoke completed successfully: **3/3 exact author-labeled heading matches**, **2/2 selected-handle exact fetches**, and **1/1 correct abstention**. Total for those scored exploratory calls: 6,863 input tokens, 588 output tokens. The small author-labeled sample has no independent adjudication and is not representative or sufficient for calibration.

After the controlled Bridge restart, one repeated case exercised the actual Bridge MCP action/query path end to end. Jev selected **“Document Surface and Librarian contract”** from the frozen MSSR corpus. The exact fetch accepted the revision-bound handle and returned text whose fingerprint matched the selected handle. This repeated query is recorded separately and was excluded from the scored denominator.

## Live runtime evidence

- Bridge 0.6.143, MSSR 0.2.95, boot `fef12ad4-e879-4c78-bfb2-54b3d4cdfcba`, 185 runtime tools.
- The selector is present in the live catalog. HTTP `/status` reports ready and `http://127.0.0.1:8081/readyz` returns `ready`.
- Watchdog restart request `97ca3592-d184-43e8-9f40-bbbd74b697e0` was acknowledged at `2026-10-01T02:18:53Z`.
- The MCP Jev request returned model `jev-1.13.0`, provider score 0.87 (explicitly **uncalibrated**), 2,292 input / 197 output tokens, and 1,017.2 ms provider latency.
- The fetched source was `.mssr/knowledge/architecture/semantic-evidence-plane.md`, revision `8195560b6c5c1d57f2a9710124c216cdf4a2d83cc7f9a65d51e7e5d64d3ea6bc`; the selected handle fingerprint and exact-fetch fingerprint both equal `c86abc84908588ad357888685a555aaa93bf025f39da3eafc58602fdba18c416`.

## Limits and next evidence gate

This establishes integration and revision-safe fetching. It does not establish calibrated confidence or broad document quality. Keep deterministic search and Jev selection distinct, require exact fetch before consuming selected text, and gather a larger frozen/adjudicated set before evaluating quality thresholds or confidence. The first wrapper attempt used a trace owned by another project and was rejected before Jev invocation; a project-specific trace retry passed. No source document was modified.

Machine-readable verification details are in `mcp-e2e.json`; frozen inputs and scored smoke outputs remain unchanged.
