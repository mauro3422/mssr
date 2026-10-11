# MSSR project state

## Current release
MSSR 0.2.121 passed npm run verify and npm run release:gate on 2026-10-11. Artifact: mauroprime-mssr-0.2.121.tgz, SHA-256 181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971; source commit fcc215fde4f289c193815d66f41517b6f0405861 is pushed on codex/mssr-librarian-query-variants-0.2.112. Bridge 0.6.169 runs that artifact from commit 683303b7b00857b2a788a48b996c81e4042104d4; activation record 2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc; boot adf97c06-a668-4ff9-a187-c12ab058bff2; 188 tools; tunnel live/ready; no restart pending. Same-snapshot parity matched search, Jev selection, exact fetch, and evidence pack once; provider identity and replay receipts remain unverified. See [Bridge smoke and parity report](knowledge/reference/jev-mssr-live-bridge-smoke-20261011-bridge-06169.md).

Jev/Librarian remains exploratory: no owner-gold; Choice/Noul uncalibrated. ADR 0007: the composed run made 9 Choices (8/1), and a later linked connected-Bridge smoke made 2 more; neither is an independent sample or calibration. Six composed-run handles were revalidated after incomplete intermediate receipts (see erratum). A dry-run/provider-off composition harness validates selection receipts, exact fetches, path containment, abstentions and a hashed replay packet; its live mode still blocks because it cannot verify connected Bridge identity. Separately, connected search → Jev Choice → exact fetch → evidence pack succeeded through Bridge wrappers on boot `adf97c06-a668-4ff9-a187-c12ab058bff2`: a compound query selected a broad rule (0.47 confidence/0.26 Noul), while a linked narrow ownership facet selected the exact list item (0.99/0.90). Scores remain uncalibrated; no reliability claim or threshold change. Direct dedicated connector calls lost trace attribution; explicit wrappers worked. See the [run ledger](../experiments/jev-mssr-live/README.md), [composed report](../experiments/jev-mssr-live/runs/mssr-librarian-composed-adr007-20261011T124146Z-v1/REPORT.md), [connected smoke](../experiments/jev-mssr-live/runs/mssr-librarian-connected-smoke-adr007-20261011T1317Z/CONNECTED-SMOKE.md), [benchmark history](knowledge/reference/mssr-jev-confidence-benchmark-history.md), and [integration handoff](knowledge/operations/jev-librarian-integration-handoff.md).

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
