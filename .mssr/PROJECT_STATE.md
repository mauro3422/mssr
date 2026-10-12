# MSSR project state

## Current release
MSSR 0.2.127 (package SHA-256 `70e79ae6e472517501ffdd38c4b0eaad740652c7d570b600bf17f90023703bfc`) was merged to `origin/main` as `c9ea91b563edbcb24daf5e7509e0cc914626dfad` (PR #2); activation documentation was merged as `87f8f6be2ec3468e3efc3812f24abc8a3c25ddca` (PR #3). Latest direct Bridge health readback at `2026-10-12T15:51:47Z` confirms server 0.6.175, boot `165f4d43-61f9-4ba7-89d4-19e0add66d00`, 189 tools/catalog `018b9f91ae7fcff9`, tunnel `/healthz` and `/readyz` at HTTP 200, and no restart pending. No new tunnel 502 or local POST-without-status failures occurred since baseline `2026-10-12T14:11:25.532Z`. The controlled HTTP restart request `820c5b7f-d129-4ea5-bf37-18d6efbd97df`, requested at `2026-10-12T08:07:15.500Z` and acknowledged at `08:07:24.0361424Z`, belongs to the previous boot `9b1323c6-9499-4700-81d0-6b14de9d6e41` and is historical. The requesting chat received the structured `maintenanceNotice` in that MCP response with reconnect guidance; delivery is best-effort and Bridge cannot push it to unrelated web chats. Active code is `D:\Dev\bridge-mcp-mssr-0.2.112-query-variants`; the older `D:\Dev\bridge-mcp` checkout remains dirty and preserved as runtime/data owner. The latest local MSSR provider refresh at `2026-10-12T15:48:39.555Z` still reports `mauroprime-bridge` unavailable with zero cached capabilities and `MCP error -32000: Connection closed`, while direct Bridge health/catalog calls succeed. This is a separate provider-discovery path; its cause remains unresolved.

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory and uncalibrated; the latest fresh evaluation is Run60 on Bridge 0.6.175 / MSSR 0.2.127 / Jev 1.13.0. It tested only raw Markdown search → Jev select/abstain → exact fetch → evidence pack with metadata disabled. All 24 cases completed; Jev selected 10/12 positive variants and abstained on 12/12 file-scoped negatives. Gold lines occurred within same-source search candidates 12/12, but only 11/12 also matched the expected heading, exact-range candidates were 4/12, and one line hit came only from a full-document MotorGrafico result. Final selections matched exact or pre-labeled relevant ranges 3/12 each; blind Luna review found all 10 selections sufficient and six broad. The six source files and paired language arms are not 24 independent cases; labels are source-derived, not owner-gold. Run60's fetch/fingerprint and evidence-pack integrity passed 10/10 selected cases. The metric fix now separates exact range, heading-constrained containment, and source-line containment. It still does not test atoms/metadata, contradictions, multiref union, paragraph composition, semantic compaction, or active MCP catalog activation. Raw scores remain uncalibrated; no threshold or production behavior changed. See the [Run60 analysis](../experiments/jev-mssr-live/runs/mssr-librarian-run60-fresh-crossproject-bilingual-20261012T1725Z-v1/derived/POST-RUN-ANALYSIS.md) and [experiment ledger](../experiments/jev-mssr-live/README.md); prior Run58/59 reports remain linked in the ledger.

Next: freeze owner-adjudicated, source-disjoint positive/negative cases. Compare Spanish and bilingual queries on the same candidate pool, separating candidate absence, heading alignment, full-range containment, and exact match. Continue KODE top-k; add natural contradiction/supersession pairs, metadata-on atom cases, facet union, and cited paragraph composition as separate stages. Measure overbreadth and downstream task outcome. Semantic compaction and general confidence calibration remain unmeasured; keep Jev scores descriptive until grouped owner-gold holdouts justify a reviewed policy.

**Run 40 (2026-10-12):** A near-disjoint-facet diagnostic on context-plane-history.md used two source-local searches whose 13-handle union exposed each target at rank 3. Live Jev 1.13.0 selected both exact labeled child ranges (2/2); exact fetches and cited evidence-pack checks passed 2/2. The host composed a cited paragraph, and a blind Luna reviewer judged both facets sufficient. A separate structural containment control removed one redundant 548-character child under its parent section. Retrieval reduction (3,576 source characters to 1,165 exact evidence characters) is separate from that containment dedupe. The source had broader thematic exposure, is not sidecar-declared, and the labels/review are not owner-gold; raw scores remain uncalibrated. This does not test Jev prose generation, semantic compaction, production reliability, or an independent holdout. No threshold or runtime changed. See the [run 40 report](../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/RUN-REPORT.md) and [validation](../experiments/jev-mssr-live/runs/mssr-librarian-context-plane-receipt-union-20261012T0417Z-v1/derived/validation.json).

**Run 58 (2026-10-12):** Nine live Jev 1.13.0 calls through the local Bridge 0.6.175 / MSSR 0.2.127 adapter completed 9/9 on nine Bridge Markdown documents from one project. Answerability disposition was 9/9 against source-derived labels (8/8 positive selections, 1/1 dated negative abstention); strict search target presence was 3/8, selected labeled ranges 2/8, and exact fetch/fingerprint plus evidence packs passed 8/8. Two blind reviewers disagreed on D and H; conservative semantic coverage is 6/8 sufficient and 2 partial/disputed. Run58 shows reliable exact-evidence transport in this small packet, not reliable retrieval or calibrated confidence. It does not test paragraph composition, semantic compaction, contradiction detection, owner-gold, independent holdout, or production MCP catalog activation. No runtime or threshold changed. See the [Run58 adjudication](../experiments/jev-mssr-live/runs/mssr-librarian-run58-bridge-cross-doc-pilot-20261012T153028Z-v1/derived/ADJUDICATION-REPORT.md) and [experiment ledger](../experiments/jev-mssr-live/README.md).

**Experiment-measurement correction (2026-10-12):** Offline regressions now cover the generic and paired Jev run-summary schemas. Run 22's derived metrics are 3/3 normalized heading matches, 3/3 search matches, and three source clusters; its original frozen summary remains unchanged. That packet has no numeric evidence-sufficiency values to recover. The paired cap study now derives 5 cases/10 calls and 9/9 exact fetches without rescoring blind reviews. A separate regression also made run 35's answerability disposition accuracy independent of exact/relevant range quality; its original summary remains unchanged. No threshold or reliability claim follows; see the experiment ledger's summary-correction section.

A follow-up on one already-exposed ADR 0002 cluster used deterministic search handles and five real Jev calls. The composite query selected a precise 284-character transition block but omitted notice authority; two manually split facets selected exact 284- and 100-character blocks. The existing strict provider-off composed-runner replay accepted two real receipts, revalidated exact fetches and built a cited two-paragraph verbatim pack of 384 characters. The replay's 1/1 line-span result per facet is not semantic coverage. Two blind Luna reviewers independently rated the cited union-composed answer Full with low overbreadth. This supports reusing search → exact-handle selection → fetch → evidence-pack → host composition, but does not establish automatic query decomposition, semantic coverage gating, owner-gold, or general reliability. The development harness now blocks synthesis on abstained/missing exact evidence and leaves semantic coverage unknown pending independent review; see changelog 0.2.125. See the [search-derived block report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-blocks-20261011T162000Z-v1/ADJUDICATION-REPORT.md), [receipt replay report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-REPORT.md), its [erratum](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-ERRATUM.md), and [run ledger](../experiments/jev-mssr-live/README.md).

Prior relation, trace-attribution, bilingual retrieval and host-composition diagnostics remain historical evidence, with source-cluster and blind-label limits documented in the [run ledger](../experiments/jev-mssr-live/README.md) and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md). The live Bridge Librarian/Jev path exposes search, Jev-select and exact-fetch tools in Bridge 0.6.175 at boot `165f4d43-61f9-4ba7-89d4-19e0add66d00`; Run58 records MSSR adapter 0.2.127. The earlier connected smoke lacks provider request IDs and replay receipts and remains historical integration evidence, not an activation blocker. The remaining gate is benchmark quality, independent labels and reliability evidence. A formal required-tool-unavailable policy remains unsourced.

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
<!-- mssr-version:bridge.live=0.6.175 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

**Linked real-document Jev diagnostic (2026-10-11):** One live Jev 1.13.0 call through the isolated Bridge .169 / MSSR .126 candidate selected the exact category B child heading from the previously exposed real MSSR use-cases document; exact fetch/fingerprint passed and contained cases 11–20. A blind Luna exact-text review marked it full with low overbreadth. This remains one linked diagnostic cluster, not holdout, owner-gold, reliability or calibration evidence; raw Choice/Noul values remain uncalibrated. Production stayed on MSSR .121 during this run. The frozen copied summary’s “synthetic” label is corrected only by append-only erratum. Full limits and artifacts: [run ledger entry 26](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).

**Prior source-new Jev diagnostic (2026-10-11, run 28):** Active Bridge .170 / MSSR .121 selected and exact-fetched the frozen Acceptance matrix heading from a source absent in recent ledger entries 23–27. Choice .63 and evidence sufficiency .43 remain uncalibrated. Blind review marked Partial despite all nine checklist facets being present, because the matrix does not explain each check; preserve answer-depth ambiguity. One exploratory source cluster only, no holdout/owner-gold/reliability claim and no adoption decision. See [run ledger entry 28](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-event-trigger-acceptance-live-20261011T192430Z-v1/REPORT.md).

**Learning digest overflow correction (2026-10-11):** MSSR 0.2.127 raises the strict context-selection bound from 96 to 128 after a closed real Jev trace accumulated 102 unique skill/project selections and its digest failed validation. The source regression preserves all 102 and rejects 129; there is no truncation. This package is now adopted by Bridge 0.6.171; the post-restart live catalog and health checks passed. The earlier failed trace outcome was recovered from retained events without duplicating its unique selections.

## Project knowledge review

Project Context Health remains advisory `watch`: the manifest is valid with 48 indexed modules, while memory and several reference modules approach their context/load budgets. For Run60 close review, `.mssr/PROJECT_CONTEXT.md` and `.mssr/PROJECT_MEMORY.md` were read: both already capture the composed Jev workflow and the rule that provider scores stay uncalibrated. Their stable architecture/decision content needs no change (`reviewed-none`); run-specific evidence belongs in the experiment report/ledger and this current-state section. The Run59 Spanish retrieval miss and Run60's same-pool metric correction are recorded in the ledger. The next maintenance gate remains semantic module-grouping/split review; no automatic move or rewrite was applied.
