# MSSR project state

## Current release

MSSR 0.2.121 remains live in Bridge 0.6.170 (PID 25180, boot `d14a6cde-80b1-4c07-a6bd-a2982e28102a`, 189 tools/catalog hash `2c61021b82279630`, tunnel ready, no restart pending). Its package SHA-256 is `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`; the [Bridge smoke report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md) remains historical evidence for the earlier .169 activation. The .170 source release is published on `codex/bridge-restart-maintenance-notice-0.6.170` at `39a94b7c1b5926f5f812f2fee37db0589e53df93`, including core-recovery source commit `e1cf182` and restart-notice release commit `7d69b4e`; its watchdog HTTP restart was acknowledged as `04d1ba6a-da67-4f7c-bc2c-13035ab46a35`, and `verify:all` passed with `failedRequired=0`. The repository has no separate persisted runtime-adoption receipt for MSSR 0.2.121. Source package 0.2.122 passed `npm run verify` and `npm run release:gate` but is not adopted by Bridge. Its tarball is 1,149,810 bytes, SHA-256 `6785a2471492cb967446b70b2f9f5b3df5fa5e9edb9aec384c615b13682b053d`, with receipt at [0.2.122 release receipt](runtime/releases/0.2.122.json). Source package 0.2.123 contains documentation/state reconciliation only, passed `npm run verify` and `npm run release:gate`, and is not adopted by Bridge. Its tarball is 1,150,191 bytes, SHA-256 `50a76c98b4a684fee3ea93a461030c57b4e2ff8e5ec7bcd322e20612e7becbcd`, with receipt at [0.2.123 release receipt](runtime/releases/0.2.123.json). Source package 0.2.124 fixes Unicode-safe excerpt truncation and records an exploratory live Jev pilot; `npm run verify` and `npm run release:gate` pass. Its tarball is 1,151,540 bytes, SHA-256 `c4b9eb8962283431ce5f489aef7a59015598aa23965e914a90f617cc4ade2761`, with receipt at [0.2.124 release receipt](runtime/releases/0.2.124.json); it is not adopted by Bridge. MSSR 0.2.125 adds a development-only composed-replay gate that separates exact evidence completeness from unknown semantic coverage; `npm run verify` and `npm run release:gate` pass. Its tarball is 1,152,782 bytes, SHA-256 `8b23ac75300adaa83bd976e1a91db7c2586031b89ceec388af92ff28721cdfb9`, with receipt at [0.2.125 release receipt](runtime/releases/0.2.125.json). It is not adopted by Bridge; no source release above 0.2.121 is active there. Source package 0.2.126 fixes Jev heading excerpt offsets across newline variants and restores selective loading for current connected diagnostics. It passed npm run verify and npm run release:gate; its 1,154,880-byte tarball has SHA-256 d9b68866b6414d5248bb8c2c7e90cce99c13db21c76f679ddad82dbdf121cf82, with receipt at [0.2.126 release receipt](runtime/releases/0.2.126.json). It is not adopted by Bridge.

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory and is not confidence-calibrated. Production Bridge remains 0.6.169 with packaged MSSR 0.2.121; source MSSR 0.2.126 is not adopted, and these experiments did not restart or mutate the production runtime. The paired cap diagnostic completed 10/10 real Jev calls over five source clusters: exact-fetch fingerprints passed 9/9 selections. A 780-character excerpt recovered one answerable result that 260 abstained on, but selected a 3,735-character overbroad range. Scores rose in all five long-cap pairs, but remain descriptive and do not justify changing defaults or thresholds. See the [paired-cap report](../experiments/jev-mssr-live/runs/mssr-librarian-excerpt-cap-paired-20261011T161000Z-v1/ADJUDICATION-REPORT.md).

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

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.126 -->
<!-- mssr-version:bridge.live=0.6.169 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

**Linked real-document Jev diagnostic (2026-10-11):** One live Jev 1.13.0 call through the isolated Bridge .169 / MSSR .126 candidate selected the exact category B child heading from the previously exposed real MSSR use-cases document; exact fetch/fingerprint passed and contained cases 11–20. A blind Luna exact-text review marked it full with low overbreadth. This remains one linked diagnostic cluster, not holdout, owner-gold, reliability or calibration evidence; raw Choice/Noul values remain uncalibrated. Production stayed on MSSR .121 during this run. The frozen copied summary’s “synthetic” label is corrected only by append-only erratum. Full limits and artifacts: [run ledger entry 26](../experiments/jev-mssr-live/README.md) and [report](../experiments/jev-mssr-live/runs/mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/ADJUDICATION-REPORT.md).
