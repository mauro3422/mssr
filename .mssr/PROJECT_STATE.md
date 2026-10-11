# MSSR project state

## Current release

MSSR 0.2.127 (package SHA-256 `70e79ae6e472517501ffdd38c4b0eaad740652c7d570b600bf17f90023703bfc`) is active in Bridge 0.6.172. Direct runtime readback reports boot `c7d652a8-88c7-42b2-87e0-76bde8b33dcf`, 189 tools/catalog `fe34a30b4af0975a`, tunnel health/readiness 200, and no restart pending. Bridge restart-maintenance release 0.6.172 was published on `codex/bridge-restart-maintenance-notice-0.6.170`; its release and documentation commits are `391a1bb1bce092a3bdeb879b5b9e5a9ad3e78745` and `3de489cf040f5e581b2b328521f4cbd44f2b81a9`. The restart notice warns connected MCP callers about transport interruption and retry timing; delivery is not guaranteed after the transport closes.

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory and is not confidence-calibrated. Active production is Bridge 0.6.172 with packaged MSSR 0.2.127. The latest diagnostic (run 29) is one live Jev 1.13.0 call on a fresh Bridge changelog source through Bridge 0.6.171: expected range, exact fetch/fingerprint, evidence pack, and blind review all passed (3/3 queried facts). It is cross-repository, one source cluster, used connected MCP rather than the frozen CLI runner, and has no owner-gold or statistical holdout status; raw Choice/Noul remain uncalibrated and support no reliability claim. No threshold or runtime policy changed. See [run ledger entry 29](../experiments/jev-mssr-live/README.md) and the external artifact packet at `D:/MSSR-benchmark-artifacts/jev-bridge-release-bounds-fresh-source-20261011T203537Z-v1/`.

**Experiment-measurement correction (2026-10-11):** Offline regressions now cover the generic and paired Jev run-summary schemas. Run 22's derived metrics are 3/3 normalized heading matches, 3/3 search matches, and three source clusters; its original frozen summary remains unchanged. That packet has no numeric evidence-sufficiency values to recover. The paired cap study now derives 5 cases/10 calls and 9/9 exact fetches without rescoring blind reviews. No new provider calls, threshold changes, or reliability claims came from this harness repair; see the experiment ledger's summary-correction section.

A follow-up on one already-exposed ADR 0002 cluster used deterministic search handles and five real Jev calls. The composite query selected a precise 284-character transition block but omitted notice authority; two manually split facets selected exact 284- and 100-character blocks. The existing strict provider-off composed-runner replay accepted two real receipts, revalidated exact fetches and built a cited two-paragraph verbatim pack of 384 characters. The replay's 1/1 line-span result per facet is not semantic coverage. Two blind Luna reviewers independently rated the cited union-composed answer Full with low overbreadth. This supports reusing search → exact-handle selection → fetch → evidence-pack → host composition, but does not establish automatic query decomposition, semantic coverage gating, owner-gold, or general reliability. The development harness now blocks synthesis on abstained/missing exact evidence and leaves semantic coverage unknown pending independent review; see changelog 0.2.125. See the [search-derived block report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-blocks-20261011T162000Z-v1/ADJUDICATION-REPORT.md), [receipt replay report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-REPORT.md), its [erratum](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-ERRATUM.md), and [run ledger](../experiments/jev-mssr-live/README.md).

Prior relation, trace-attribution, bilingual retrieval and host-composition diagnostics remain historical evidence, with source-cluster and blind-label limits documented in the [run ledger](../experiments/jev-mssr-live/README.md) and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md). The [integration handoff](knowledge/operations/jev-librarian-integration-handoff.md) remains the activation gate; the earlier connected smoke still lacks verified provider identity and replay receipts. A formal required-tool-unavailable policy remains unsourced.

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
<!-- mssr-version:bridge.live=0.6.172 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

**Linked real-document Jev diagnostic (2026-10-11):** One live Jev 1.13.0 call through the isolated Bridge .169 / MSSR .126 candidate selected the exact category B child heading from the previously exposed real MSSR use-cases document; exact fetch/fingerprint passed and contained cases 11–20. A blind Luna exact-text review marked it full with low overbreadth. This remains one linked diagnostic cluster, not holdout, owner-gold, reliability or calibration evidence; raw Choice/Noul values remain uncalibrated. Production stayed on MSSR .121 during this run. The frozen copied summary’s “synthetic” label is corrected only by append-only erratum. Full limits and artifacts: [run ledger entry 26](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).

**Prior source-new Jev diagnostic (2026-10-11, run 28):** Active Bridge .170 / MSSR .121 selected and exact-fetched the frozen Acceptance matrix heading from a source absent in recent ledger entries 23–27. Choice .63 and evidence sufficiency .43 remain uncalibrated. Blind review marked Partial despite all nine checklist facets being present, because the matrix does not explain each check; preserve answer-depth ambiguity. One exploratory source cluster only, no holdout/owner-gold/reliability claim and no adoption decision. See [run ledger entry 28](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-event-trigger-acceptance-live-20261011T192430Z-v1/REPORT.md).

**Learning digest overflow correction (2026-10-11):** MSSR 0.2.127 raises the strict context-selection bound from 96 to 128 after a closed real Jev trace accumulated 102 unique skill/project selections and its digest failed validation. The source regression preserves all 102 and rejects 129; there is no truncation. This package is now adopted by Bridge 0.6.171; the post-restart live catalog and health checks passed. The earlier failed trace outcome was recovered from retained events without duplicating its unique selections.

## Project knowledge review

Current Project Context Health is advisory `review`: 49 indexed modules, `PROJECT_MEMORY.md` is 30,224 bytes and approaching monolithic context, and several Jev history modules are near their per-entry budgets. Run 29 was added only to the experiment ledger and this mutable state; no architecture or memory decision changed. The next maintenance gate is a semantic module-grouping/split review; no automatic move or rewrite was applied.
