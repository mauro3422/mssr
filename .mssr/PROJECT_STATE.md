# MSSR project state

## Current release

MSSR 0.2.121 remains live in Bridge 0.6.169 (boot `adf97c06-a668-4ff9-a187-c12ab058bff2`, 188 tools, tunnel ready, no restart pending). Its package SHA-256 is `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`; the [Bridge smoke report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md) records watchdog acknowledgement `18b4db27-1fc8-47c5-b670-dafc194ab57f` and activation-documentation follow-up commit `2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc`. The repository has no separate persisted runtime-adoption receipt for 0.2.121. Source package 0.2.122 passed `npm run verify` and `npm run release:gate` but is not adopted by Bridge. Its tarball is 1,149,810 bytes, SHA-256 `6785a2471492cb967446b70b2f9f5b3df5fa5e9edb9aec384c615b13682b053d`, with receipt at [0.2.122 release receipt](runtime/releases/0.2.122.json). Source package 0.2.123 contains documentation/state reconciliation only, passed `npm run verify` and `npm run release:gate`, and is not adopted by Bridge. Its tarball is 1,150,191 bytes, SHA-256 `50a76c98b4a684fee3ea93a461030c57b4e2ff8e5ec7bcd322e20612e7becbcd`, with receipt at [0.2.123 release receipt](runtime/releases/0.2.123.json). Source package 0.2.124 fixes Unicode-safe excerpt truncation and records an exploratory live Jev pilot; `npm run verify` and `npm run release:gate` pass. Its tarball is 1,151,540 bytes, SHA-256 `c4b9eb8962283431ce5f489aef7a59015598aa23965e914a90f617cc4ade2761`, with receipt at [0.2.124 release receipt](runtime/releases/0.2.124.json); it is not adopted by Bridge. Search/selection/fetch/evidence-pack parity matched once; provider identity and replay receipts remain unverified. See the [Bridge smoke report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md).

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory and is not confidence-calibrated. Production Bridge remains 0.6.169 with packaged MSSR 0.2.121; source MSSR 0.2.124 is not adopted, and these experiments did not restart or mutate the production runtime. The paired cap diagnostic completed 10/10 real Jev calls over five source clusters: exact-fetch fingerprints passed 9/9 selections. A 780-character excerpt recovered one answerable result that 260 abstained on, but selected a 3,735-character overbroad range. Scores rose in all five long-cap pairs, but remain descriptive and do not justify changing defaults or thresholds. See the [paired-cap report](../experiments/jev-mssr-live/runs/mssr-librarian-excerpt-cap-paired-20261011T161000Z-v1/ADJUDICATION-REPORT.md).

A follow-up on one already-exposed ADR 0002 cluster used deterministic search handles and five real Jev calls. The composite query selected a precise 284-character transition block but omitted notice authority; two manually split facets selected exact 284- and 100-character blocks. The existing strict provider-off composed-runner replay accepted two real receipts, revalidated exact fetches and built a cited two-paragraph verbatim pack of 384 characters. The replay's 1/1 line-span result per facet is not semantic coverage. Two blind Luna reviewers independently rated the cited union-composed answer Full with low overbreadth. This supports reusing search → exact-handle selection → fetch → evidence-pack → host composition, but does not establish automatic query decomposition, semantic coverage gating, owner-gold, or general reliability. The next gate is to define and fixture-test semantic facet coverage and synthesis readiness while reusing the existing contracts. See the [search-derived block report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-blocks-20261011T162000Z-v1/ADJUDICATION-REPORT.md), [receipt replay report](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-REPORT.md), its [erratum](../experiments/jev-mssr-live/runs/mssr-librarian-notice-union-replay-20261011T162500Z-v1/RUN-ERRATUM.md), and [run ledger](../experiments/jev-mssr-live/README.md).

Prior relation, trace-attribution, bilingual retrieval and host-composition diagnostics remain historical evidence, with source-cluster and blind-label limits documented in the [run ledger](../experiments/jev-mssr-live/README.md) and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md). The [integration handoff](knowledge/operations/jev-librarian-integration-handoff.md) remains the activation gate; the earlier connected smoke still lacks verified provider identity and replay receipts. A formal required-tool-unavailable policy remains unsourced.

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.124 -->
<!-- mssr-version:bridge.live=0.6.169 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->
