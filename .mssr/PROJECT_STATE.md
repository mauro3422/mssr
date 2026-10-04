# MSSR project state

## Current release

MSSR 0.2.103 is a local candidate on codex/jev-citation-evidence-pack-clean. `npm run verify` and `npm run release:gate` pass; the local 1,102,613-byte package SHA-256 is 8191881b18a0e4a84b87b59750e6587d60be77e94893b55a52c740fb9e7c0fd5. The verified 0.2.102 baseline is 4abac0c6806e778a4bf3d886b5989c6c3b38b3cf (artifact SHA-256 a26e74b7dd8605a19062277615885bb63ba0d8e48cfb63c7d5f2640b1a24617b); 0.2.103 remains unpublished.

Bridge 0.6.153/MSSR 0.2.101 had 11 event-loop stalls (max 20,935 ms) and 19 HTTP client errors; cause is unknown. At 06:11:51 UTC transport was live/ready, queue empty, with zero tunnel 502 or localPostNoStatus events since 00:20 UTC. Recovery is observed; the old errors remain unexplained. Candidate .148/.102 is at 44ba5f27ece09ead2fc3d5eb74a97325257e7895; active Codex does not expose `mssr_librarian_evidence_pack`.

The Librarian composes bounded retrieval over host-supplied documents/atoms, Jev selection and relation review, exact-source fetch, and citation-preserving evidence packs. Hosts can chain these for contradiction review, compaction and cited drafting; tools do not crawl autonomously or write sources. The 0.2.103 map selects deep sections by intent and indexes root `ROADMAP.md`. Benchmark runs remain separate: archive commit 0d976e9 preserves 206 files (53,079,986 bytes); source branch cbc4f35 and the previous full state remain intact.

## Machine-readable current-state claims
<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.103 -->
<!-- mssr-version:bridge.live=0.6.153 -->
<!-- mssr-version:bridge.mssr=0.2.101 -->
<!-- mssr-version:bridge.candidate=0.6.148 -->
<!-- mssr-version:bridge.candidate.mssr=0.2.102 -->
<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

On 2026-10-04, the active local semantic-curation learning-status tool reported 0 observations/rules and updatedAt=1970-01-01. This host-local store is not reconciled with the separate Semantic Experience shadows described in older state/history; do not infer that those records were deleted or that this store contains them. The learning plane remains observe-only: raw Jev is not training truth; routing influence and canonical rewrites remain disabled. Current eligibility still requires at least 8 observations across 2 distinct projects, a 95% lower bound of 0.65 and dominance of 0.8, with contradictions sent to review.

## Core skill package state

The first-party MSSR package remains five operational skill roots. MSSR 0.2.103 changes only project context/state organization and verification fixtures; it adds no routed skill or runtime authority. Librarian capabilities remain in the existing MCP/tool contract.
