# MSSR project state

## Current release

MSSR 0.2.121 is live in Bridge 0.6.169 (boot `adf97c06-a668-4ff9-a187-c12ab058bff2`, 188 tools, tunnel ready, no restart pending). The release package SHA-256 is `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`; runtime adoption record: `2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc`. Search/selection/fetch/evidence-pack parity matched once; provider identity and replay receipts remain unverified. See the [Bridge smoke report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md).

## Current Jev/Librarian evaluation

Jev/Librarian remains exploratory: no owner-gold, uncalibrated scores, and no threshold changes. Four new blind-labeled pairs across three docs produced two Jev `supports` (0.71/0.59) and two `unresolved` (0.54/0.66); two previews stayed abstain/review with no apply permission. Cases are correlated; blind Luna labels are not gold. A host model alias caused HTTP 400; provider ID `jev-1.13.0` succeeded. A formal required-tool-unavailable policy remains unsourced. See the [run ledger](../experiments/jev-mssr-live/README.md), [current integration handoff](knowledge/operations/jev-librarian-integration-handoff.md), [latest relation batch](../experiments/jev-mssr-live/runs/mssr-librarian-jev-relation-blind-batch-20261011T1351Z-v1/REPORT.md), and [confidence history](knowledge/reference/mssr-jev-confidence-benchmark-history.md).

## Core skill package state

Core package state: five first-party MSSR operational skill roots. Semantic evidence remains a core/MCP capability, not a new skill. Ownership policy: [canonical ownership](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.121 -->
<!-- mssr-version:bridge.live=0.6.169 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->
