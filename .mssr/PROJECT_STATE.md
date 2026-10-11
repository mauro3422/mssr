# MSSR project state

## Current release
MSSR 0.2.121 passed npm run verify and npm run release:gate on 2026-10-11. Artifact: mauroprime-mssr-0.2.121.tgz, SHA-256 181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971; source commit fcc215fde4f289c193815d66f41517b6f0405861 is pushed on codex/mssr-librarian-query-variants-0.2.112. Bridge 0.6.169 runs that artifact from commit 683303b7b00857b2a788a48b996c81e4042104d4; activation record 2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc; boot adf97c06-a668-4ff9-a187-c12ab058bff2; 188 tools; tunnel live/ready; no restart pending. Same-snapshot parity matched search, Jev selection, exact fetch, and evidence pack once; provider identity and replay receipts remain unverified. See [Bridge smoke and parity report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md).

Jev/Librarian remains exploratory: owner labels are pending and raw Choice/Noul scores are uncalibrated. Latest linked diagnostic: 4/4 search targets, exact selections, fingerprinted fetches, and evidence packs; blind review 3 complete/1 partial (ambiguous ownership omitted), over two source documents only. No reliability or calibration claim, threshold change, or canonical write. See the [run ledger](../experiments/jev-mssr-live/README.md), [benchmark history](knowledge/reference/mssr-jev-confidence-benchmark-history.md), [integration handoff](knowledge/operations/jev-librarian-integration-handoff.md), and [runtime smoke history](knowledge/reference/jev-bridge-active-runtime-smokes-20261010.md). Historical project-state details remain recoverable from Git history and their indexed owner modules.

## Core skill package state
The first-party package has five MSSR operational skill roots. MSSR 0.2.121 added no routed skill; portable semantic-evidence remains core/MCP capability, not a new skill. Canonical ownership and mount policy: [ownership module](knowledge/architecture/canonical-ownership.md).

## Machine-readable current-state claims
<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.121 -->
<!-- mssr-version:bridge.live=0.6.169 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->
