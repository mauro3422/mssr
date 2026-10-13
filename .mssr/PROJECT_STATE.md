# MSSR project state

## Current release
MSSR 0.2.130 (package SHA-256 `35d3fe6d2e385efcb9e7bf2ae51490406088c5bbb32a8d2e9e4abc0e1a1a37e6`) is published on branch `codex/mssr-librarian-query-variants-0.2.112`; Bridge 0.6.176 now adopts the exact artifact. The MSSR branch is pushed but not yet merged to `origin/main`. Active Bridge code is `D:\Dev\bridge-mcp-mssr-0.2.112-query-variants`; runtime/data remain at `D:\Dev\bridge-mcp`.

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory. Choice/Noul scores are uncalibrated; no confidence threshold or autonomous canonical merge is justified.

**Evidence inventory update (2026-10-13):** An audit of 95 run directories found zero owner-adjudicated gold units and no unexposed, ready-to-use holdout. Run59 was already called despite `holdoutOpenedAt: null`; treat it as exposed development evidence. Run58–65 contain useful retrieval/selection diagnostics, but repeated language arms and queries on the same source/project do not increase the independent sample size. Do not promote their provider scores as calibrated confidence. A new confirmatory set requires owner-adjudicated, frozen source/query/facet labels from project families not used in prior runs; adjudicate before any Jev call.

**MSSR 0.2.129 prior candidate (2026-10-13):** Superseded for the active Bridge adoption by 0.2.130. Its selector/retrieval fixes and bounded run-history layout remain part of the development record; no separate 0.2.129 runtime is active.

**MSSR 0.2.130 published candidate and Bridge adoption (2026-10-13):** Registers the already-versioned `git-worktree-reconciliation` skill with positive, continuation, and nearby single-branch-publication negative fixtures. All 277 routing fixtures, full `npm run verify`, and `npm run release:gate` pass. Canonical package `mauroprime-mssr-0.2.130.tgz` is 1,178,226 bytes with SHA-256 `35d3fe6d2e385efcb9e7bf2ae51490406088c5bbb32a8d2e9e4abc0e1a1a37e6`; source and Bridge-vendored artifact hashes match. The branch is pushed at commit `1e6068632689b1f5024fb2a3bcd926c78b6ac6f5` but is not yet merged to `origin/main`. Bridge 0.6.176 has adopted the exact package; its live 277-case routing audit reports 58/58 owned skills with positive and negative fixtures and no maintenance requirement. Package adoption made no live Jev calls.

**Bridge provider observation (2026-10-13 01:56 UTC):** Direct Bridge HTTP remains healthy from the prior readback, while MSSR registry refresh reports the stdio provider closed with zero discovered tools. Two live Node stdio Bridge processes are descendants of separate Codex/MSSR launcher processes; this confirms multiple host sessions but does not identify why the registry connection closes. No process was started, stopped or restarted. Keep root cause unassigned pending provider/host-side diagnostics.

**Latest live cohort — Run65 (2026-10-13 UTC):** 12 source-only questions across six project families, metadata off. Search returned a containing range in 5/6 positives and the exact frozen target in 2/6. Jev selected evidence in all 5 positives with a non-empty pool and covered the full frozen span in 2/5; it abstained in 5/5 negatives that reached Jev, while one empty-pool negative was not called. Exact fetch, fingerprint, and evidence-pack checks passed 5/5. Blind review judged 4/5 selections sufficient and 1/5 partial; disagreements for CBAnimal and Workshop Media need project-owner adjudication. Ten live Jev 1.13.0 calls used 26,034 input and 2,215 output tokens with 8,963.7 ms aggregate provider-reported latency.

A separate post-hoc Spanish-variant check recovered the TypeScript Practice positive and abstained on its negative after the frozen English searches returned no candidates; it is excluded from primary metrics. Run65 used direct MSSR MCP with explicit snapshots, not Bridge project authorization. Bridge rejected the TypeScript Practice root because it has no `.git`; no Jev call or source mutation followed. Runtime, thresholds, sources, and manifests were unchanged.

**Bridge integration smoke (2026-10-13):** A frozen one-query, source-derived (not owner-gold) smoke through Bridge 0.6.175 / MSSR 0.2.127 used `.mssr/PROJECT_STATE.md` and selected the exact `block-2` at line 8 from five lexical candidates. Jev 1.13.0 reported Choice 0.95, selected-option probability 0.96 and Noul 0.94; all remain uncalibrated. Exact fetch fingerprint and verbatim evidence-pack citation passed. Automatic application remained disabled. This verifies one known-family integration path only, not retrieval reliability or calibration. See the [smoke run](../experiments/jev-mssr-live/runs/mssr-bridge-integration-smoke-state-20261013T0137Z-v1/RUN-PLAN.json).

**Next gate:** adjudicate the disputed Run65 spans and build a frozen project-grouped cohort with at least 30 independent labeled units; investigate the separate MSSR registry failure. Report retrieval, selection, sufficiency, overbreadth, abstention, and exact evidence integrity separately, and preserve human review before canonical writes. Detailed history remains in the [experiment ledger](../experiments/jev-mssr-live/README.md) and [benchmark history](knowledge/reference/mssr-jev-confidence-run-history.md).

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.130 -->
<!-- mssr-version:bridge.live=0.6.176 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

**Linked real-document Jev diagnostic (2026-10-11):** One live Jev 1.13.0 call through the isolated Bridge .169 / MSSR .126 candidate selected the exact category B child heading from the previously exposed real MSSR use-cases document; exact fetch/fingerprint passed and contained cases 11–20. A blind Luna exact-text review marked it full with low overbreadth. This remains one linked diagnostic cluster, not holdout, owner-gold, reliability or calibration evidence; raw Choice/Noul values remain uncalibrated. Production stayed on MSSR .121 during this run. The frozen copied summary’s “synthetic” label is corrected only by append-only erratum. Full limits and artifacts: [run ledger entry 26](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).

**Prior source-new Jev diagnostic (2026-10-11, run 28):** Active Bridge .170 / MSSR .121 selected and exact-fetched the frozen Acceptance matrix heading from a source absent in recent ledger entries 23–27. Choice .63 and evidence sufficiency .43 remain uncalibrated. Blind review marked Partial despite all nine checklist facets being present, because the matrix does not explain each check; preserve answer-depth ambiguity. One exploratory source cluster only, no holdout/owner-gold/reliability claim and no adoption decision. See [run ledger entry 28](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-event-trigger-acceptance-live-20261011T192430Z-v1/REPORT.md).

**Learning digest overflow correction (2026-10-11):** MSSR 0.2.127 raises the strict context-selection bound from 96 to 128 after a closed real Jev trace accumulated 102 unique skill/project selections and its digest failed validation. The source regression preserves all 102 and rejects 129; there is no truncation. This package is now adopted by Bridge 0.6.171; the post-restart live catalog and health checks passed. The earlier failed trace outcome was recovered from retained events without duplicating its unique selections.

## Project knowledge review

Project Context Health now reports 48 indexed modules at advisory `watch` rather than the prior 49-module `review`; the redundant standalone history file is removed. The measured run-history and Runs 62–63 follow-up share one backing source with internal segments: benchmark verification loads only the bounded run-history baseline, while matching `resume` work also loads the historical detail. The Runs 62–63 section hash remains `0fc901ba86f368043703f2f601072f2d6866ac563821ccdaa4f3bea408e7e05e`. Current Run65 and Bridge smoke findings are consolidated above; full artifacts remain in the [experiment ledger](../experiments/jev-mssr-live/README.md).
