# MSSR project state

## Current release
MSSR 0.2.127 (package SHA-256 `70e79ae6e472517501ffdd38c4b0eaad740652c7d570b600bf17f90023703bfc`) is active in Bridge 0.6.173, merged to `origin/main` as `c9ea91b563edbcb24daf5e7509e0cc914626dfad` (PR #2); activation documentation was merged as `87f8f6be2ec3468e3efc3812f24abc8a3c25ddca` (PR #3). Controlled HTTP restart request `820c5b7f-d129-4ea5-bf37-18d6efbd97df`, requested at `2026-10-12T08:07:15.500Z`, was acknowledged at `2026-10-12T08:07:24.0361424Z` by watchdog PID 25000. Live Bridge PID 6884, boot `9b1323c6-9499-4700-81d0-6b14de9d6e41`, reports 189 tools/catalog `c37f43b2b6b63ba4`; local `/status` says ready and `bridge_health` confirmed tunnel `/healthz` and `/readyz` at HTTP 200. The requesting chat received the structured `maintenanceNotice` in the same MCP response with reconnect guidance; delivery is best-effort and Bridge cannot push it to unrelated web chats. Active code is `D:\Dev\bridge-mcp-mssr-0.2.112-query-variants`; the older `D:\Dev\bridge-mcp` checkout remains dirty and preserved as runtime/data owner. The local provider-discovery refresh failure at `2026-10-11T22:43:30.437Z` (`MCP error -32000: Connection closed`) remains a separate degraded registry-discovery path with unresolved duration/cause.

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory and uncalibrated; production is Bridge 0.6.173 / MSSR 0.2.127. Runs 45–47 provide linked multi-project and bilingual search/selection diagnostics; Run48 now exercises the connected Bridge → Jev → exact-fetch → cited pack → host-composition path on the same previously exposed ERS source. In Run48, two primary facets selected their expected sections; the compound Layer 2 selection missed its definition despite Noul 0.88, and one adaptive query/selection recovered it. Exact fetch and text fingerprints passed 4/4; the host-authored answer received one blind “correcta y completa” review. The pack kept four disjoint exact ranges/1,129 characters and performed no semantic compaction. Run48's manifest changed after the pre-call freeze; its append-only erratum records the mismatch. These are diagnostics, not independent samples: labels are not owner-adjudicated, no source-disjoint holdout exists, and raw Choice/Noul scores are not calibrated. No runtime or threshold changed. See the [experiment ledger](../experiments/jev-mssr-live/README.md) and [Run48 report](../experiments/jev-mssr-live/runs/mssr-librarian-ers-layer-facet-composition-20261012T1049Z-v1/derived/RUN-REPORT.md).

Next: freeze source-disjoint owner-adjudicated cases, including multi-facet composition plus positive and near-negative contradiction cases. Keep the KODE top-k miss as its own search arm. Evaluate facet coverage and abstention separately from raw confidence, exact-range match, fetch integrity, cited union and host paragraph quality. Treat adaptive follow-up as a host-side diagnostic pattern, not evidence of automatic query decomposition. Require grouped source-disjoint holdout evidence and owner labels before score calibration or production policy changes; keep raw scores descriptive meanwhile.

**Run 40 (2026-10-12):** A near-disjoint-facet diagnostic on context-plane-history.md used two source-local searches whose 13-handle union exposed each target at rank 3. Live Jev 1.13.0 selected both exact labeled child ranges (2/2); exact fetches and cited evidence-pack checks passed 2/2. The host composed a cited paragraph, and a blind Luna reviewer judged both facets sufficient. A separate structural containment control removed one redundant 548-character child under its parent section. Retrieval reduction (3,576 source characters to 1,165 exact evidence characters) is separate from that containment dedupe. The source had broader thematic exposure, is not sidecar-declared, and the labels/review are not owner-gold; raw scores remain uncalibrated. This does not test Jev prose generation, semantic compaction, production reliability, or an independent holdout. No threshold or runtime changed. See the [run 40 report](../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/RUN-REPORT.md) and [validation](../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/derived/validation.json).

**Experiment-measurement correction (2026-10-12):** Offline regressions now cover the generic and paired Jev run-summary schemas. Run 22's derived metrics are 3/3 normalized heading matches, 3/3 search matches, and three source clusters; its original frozen summary remains unchanged. That packet has no numeric evidence-sufficiency values to recover. The paired cap study now derives 5 cases/10 calls and 9/9 exact fetches without rescoring blind reviews. A separate regression also made run 35's answerability disposition accuracy independent of exact/relevant range quality; its original summary remains unchanged. No threshold or reliability claim follows; see the experiment ledger's summary-correction section.

A follow-up on one already-exposed ADR 0002 cluster used deterministic search handles and five real Jev calls. The composite query selected a precise 284-character transition block but omitted notice authority; two manually split facets selected exact 284- and 100-character blocks. The existing strict provider-off composed-runner replay accepted two real receipts, revalidated exact fetches and built a cited two-paragraph verbatim pack of 384 characters. The replay's 1/1 line-span result per facet is not semantic coverage. Two blind Luna reviewers independently rated the cited union-composed answer Full with low overbreadth. This supports reusing search → exact-handle selection → fetch → evidence-pack → host composition, but does not establish automatic query decomposition, semantic coverage gating, owner-gold, or general reliability. The development harness now blocks synthesis on abstained/missing exact evidence and leaves semantic coverage unknown pending independent review; see changelog 0.2.125. See the [search-derived block report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-blocks-20261011T162000Z-v1/ADJUDICATION-REPORT.md), [receipt replay report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-REPORT.md), its [erratum](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-ERRATUM.md), and [run ledger](../experiments/jev-mssr-live/README.md).

Prior relation, trace-attribution, bilingual retrieval and host-composition diagnostics remain historical evidence, with source-cluster and blind-label limits documented in the [run ledger](../experiments/jev-mssr-live/README.md) and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md). The Bridge Librarian/Jev path is active in 0.6.173/0.2.127; the live search, Jev-select and exact-fetch schemas were verified at boot `9b1323c6-9499-4700-81d0-6b14de9d6e41`. The earlier connected smoke lacks provider request IDs and replay receipts and remains historical integration evidence, not an activation blocker. The remaining gate is benchmark quality, independent labels and reliability evidence. A formal required-tool-unavailable policy remains unsourced.

A separate post-hoc Bridge 0.6.169 / MSSR 0.2.121 diagnostic then exercised
the real Bridge search → Jev → exact-fetch wrappers on one cutover document.
All 5 exact fetches matched their selected fingerprints. With the same 3
handles offered to each query, split authority and inbox facets selected the
expected blocks (2/2); a compound query selected only the inbox block and
omitted the explicit `.bridge/` fallback rule, despite Noul 0.83. Bridge
metrics persisted the calls under the live boot ID, and one blind Luna reviewer
also marked the compound result partial. This supplies a bounded
connected-path receipt with Jev provider/model identity, not a calibration
sample or a general quality claim. See the [diagnostic report](../experiments/jev-mssr-live/runs/mssr-bridge-cutover-compound-diagnostic-20261011T1704Z-v1/RUN-REPORT.md).

The next connected diagnostic tested three fresh changelog source clusters.
Jev selected and exact-fetched two primary cases; on the third it abstained
from an answerable compound question. Four linked, manually split facets on
that same source then selected exact ranges, and two blind Luna reviewers
judged their union complete for the frozen question. This supports a manual
host-side decomposition/evidence-union pattern for one case; it does not prove
automatic facet planning, semantic-coverage gating, owner-gold, or calibration.
All six selected exact fetches matched fingerprints. Scores remain
uncalibrated, and production Bridge/runtime behavior did not change. The
follow-up plan timestamps were declared incorrectly; the append-only erratum
records Bridge write-before-call event ordering. See the [run report](../experiments/jev-mssr-live/runs/mssr-librarian-fresh-changelog-clusters-20261011T1717Z-v1/RUN-REPORT.md)
and [run ledger](../experiments/jev-mssr-live/README.md).

The latest cross-family diagnostic selected the expected section and passed
exact fetch/evidence-pack verification on 3/3 documents. Blind review found
answer-complete excerpts with extra context; this is a small source-derived
diagnostic, not calibration. Its frozen runner also dropped numeric Noul
because of a field-name mismatch; the missing values cannot be recovered. The
derived summary now reports normalized heading matches and exposes missing
evidence-sufficiency capture. See the [report](../experiments/jev-mssr-live/runs/mssr-librarian-cross-family-fresh-smoke-20261011T181217Z-v1/ADJUDICATION-REPORT.md)
and [run ledger](../experiments/jev-mssr-live/README.md).

A focused CRLF follow-up exercised source MSSR 0.2.126 through an isolated
Bridge 0.6.169 adapter. A 99-CRLF heading-mode query selected the exact child
section (Choice 1.00, Noul 0.88), and exact-fetch fingerprint validation passed;
blind review found full answer coverage but high irrelevant overbreadth. A
provider-off package capture on the same frozen source shows .121's excerpt
ended before the late rule, while .126 included its authority and field list
within the 260-character cap. A short 13-CRLF control did not distinguish the
versions. A separate 101-CRLF run selected an overbroad parent heading, so
nested-heading precision remains open. All source swaps were confined to the
isolated checkout, restored to packaged .121 and verified clean. Production
Bridge remains on .121 without restart; these synthetic cases are not
owner-gold, reliability evidence, or calibration. See the [run ledger](../experiments/jev-mssr-live/README.md),
entries 23–25.

Project Context modularization review split the confidence-run history by
evaluation era: the pre-2026-10-11 measured history remains in its existing
module, while three connected 2026-10-11 diagnostics are separately indexed.
This brings the measured history below its 7,000-character load budget and
keeps recent connected-path evidence selectable without loading all earlier
runs. A prior situation-review warning's detailed payload was not retained,
so its historical-claim/receipt/state mismatch codes cannot be mapped
conclusively to a canonical edit yet. The current version and release receipt
evidence are internally consistent; do not rewrite those claims from an
unrecoverable notice alone.


**Linked Jev runtime parity diagnostic:** active Bridge 0.6.170 / MSSR 0.2.121 selected the exact same category B heading and identical fetched bytes as the previous isolated .126 candidate on one previously exposed real source. Choice was 1.00 in both; evidence sufficiency .91 vs .92. One linked case only, no calibration/reliability or version-effect claim. See [run ledger entry 27](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-linked-runtime-parity-20261011T191747Z-v1/REPORT.md).

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.127 -->
<!-- mssr-version:bridge.live=0.6.173 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

**Linked real-document Jev diagnostic (2026-10-11):** One live Jev 1.13.0 call through the isolated Bridge .169 / MSSR .126 candidate selected the exact category B child heading from the previously exposed real MSSR use-cases document; exact fetch/fingerprint passed and contained cases 11–20. A blind Luna exact-text review marked it full with low overbreadth. This remains one linked diagnostic cluster, not holdout, owner-gold, reliability or calibration evidence; raw Choice/Noul values remain uncalibrated. Production stayed on MSSR .121 during this run. The frozen copied summary’s “synthetic” label is corrected only by append-only erratum. Full limits and artifacts: [run ledger entry 26](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).

**Prior source-new Jev diagnostic (2026-10-11, run 28):** Active Bridge .170 / MSSR .121 selected and exact-fetched the frozen Acceptance matrix heading from a source absent in recent ledger entries 23–27. Choice .63 and evidence sufficiency .43 remain uncalibrated. Blind review marked Partial despite all nine checklist facets being present, because the matrix does not explain each check; preserve answer-depth ambiguity. One exploratory source cluster only, no holdout/owner-gold/reliability claim and no adoption decision. See [run ledger entry 28](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-event-trigger-acceptance-live-20261011T192430Z-v1/REPORT.md).

**Learning digest overflow correction (2026-10-11):** MSSR 0.2.127 raises the strict context-selection bound from 96 to 128 after a closed real Jev trace accumulated 102 unique skill/project selections and its digest failed validation. The source regression preserves all 102 and rejects 129; there is no truncation. This package is now adopted by Bridge 0.6.171; the post-restart live catalog and health checks passed. The earlier failed trace outcome was recovered from retained events without duplicating its unique selections.

## Project knowledge review

Current Project Context Health is advisory `watch`: manifest valid, 48 indexed modules, and `PROJECT_MEMORY.md` is 30,224 bytes and approaching monolithic context; several Jev history modules remain near their per-entry budgets. The paired 2026-10-11 diagnostic remains byte-preserved under its existing parent module with a narrow selector. Review of the PROJECT_MEMORY Jev/Librarian sections found that the composed grep/selection/assembly workflow and uncalibrated-confidence rule are already recorded; Run 45's measurements belong in its report and experiment ledger, so no memory append is needed. The next maintenance gate is a semantic module-grouping/split review; no automatic move or rewrite was applied.
