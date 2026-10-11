# MSSR project state

## Current release

MSSR 0.2.121 remains live in Bridge 0.6.169 (boot `adf97c06-a668-4ff9-a187-c12ab058bff2`, 188 tools, tunnel ready, no restart pending). Its package SHA-256 is `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`; runtime adoption record: `2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc`. Source package 0.2.122 passed `npm run verify` and `npm run release:gate` but is not adopted by Bridge. Its tarball is 1,149,810 bytes, SHA-256 `6785a2471492cb967446b70b2f9f5b3df5fa5e9edb9aec384c615b13682b053d`, with receipt at [0.2.122 release receipt](runtime/releases/0.2.122.json). Search/selection/fetch/evidence-pack parity matched once; provider identity and replay receipts remain unverified. See the [Bridge smoke report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md).

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory: no owner-gold, uncalibrated scores, and no threshold changes. Four new blind-labeled pairs across three docs produced two Jev `supports` (0.71/0.59) and two `unresolved` (0.54/0.66); two previews stayed abstain/review with no apply permission. Cases are correlated; blind Luna labels are not gold. A host model alias caused HTTP 400; provider ID `jev-1.13.0` succeeded. A formal required-tool-unavailable policy remains unsourced. See the [run ledger](../experiments/jev-mssr-live/README.md), [current integration handoff](knowledge/operations/jev-librarian-integration-handoff.md), [latest relation batch](../experiments/jev-mssr-live/runs/mssr-librarian-jev-relation-blind-batch-20261011T1351Z-v1/REPORT.md), and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md).

A post-hoc connected Bridge 0.6.169 diagnostic on ADR 0008 confirms explicit trace attribution across Librarian search, Jev selection, exact fetch, and evidence packing. A narrow two-facet query fetched a complete exact range after a linked broad query returned a partial range, despite the broad query's higher raw score. This is one source cluster, not a benchmark or calibration sample; see the [trace diagnostic](../experiments/jev-mssr-live/diagnostics/adr0008-trace-attribution-posthoc-20261011.md). The integration handoff now keeps current gates separate from historical branch/evaluation notes; source evidence remains in place, with the older next-gates snapshot relabeled and excluded from current context.

A second post-hoc connected diagnostic exercised four linked Jev queries over the same `docs/AGENT_PROTOCOL.md` section. Exact fetch and evidence packing passed for the section and a focused prose block. Raw Choice/Noul varied with wording; blind review of the compound query missed an ambiguity between ephemeral trace memory and the durable learning digest. Code inspection shows selection uses a query-centered excerpt capped at 260 characters before the subsequent full-range fetch. This is a hypothesis for a controlled excerpt-size comparison, not causal evidence or calibration; no threshold or runtime behavior changed. See the [working-memory diagnostic](../experiments/jev-mssr-live/diagnostics/agent-protocol-working-memory-jev-posthoc-20261011.md).

Its linked addendum adds a fifth Jev request, exact fetch/pack for the retention-and-digest paragraph, and a host-composed Spanish answer cited to two exact blocks. A blind Luna review marked the composed answer Full with the ephemeral-versus-durable distinction intact. This validates one complete connected workflow on the same single document cluster, not independent quality or calibration. A no-trace direct connector call was rejected before Jev; an explicit-trace wrapper retry succeeded. See the [composition addendum](../experiments/jev-mssr-live/diagnostics/agent-protocol-working-memory-composition-addendum-20261011.md).

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.122 -->
<!-- mssr-version:bridge.live=0.6.169 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->
