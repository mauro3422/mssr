# Composed Librarian workflow diagnostic

- Status: completed exploratory diagnostic, not benchmark.
- Source: ADR 0007, one previously exposed source-document cluster.
- Live Jev: 9 Choice calls (8 selections, 1 abstention); raw scores remain uncalibrated.
- Final union: six exact cited ranges, fetched and fingerprint-checked.
- Coverage: initial broad pass was incomplete; focused decomposition and union covered four source-derived facets.
- Synthesis: Codex host manually composed the Spanish answer from the exact pack. Jev selected evidence but did not generate prose. MSSR packs verbatim ranges and citations; it does not infer semantic facet coverage or synthesize a paragraph.
- Review: Luna literal-text review found final claims supported and citations aligned; model-assisted, not owner-gold.
- Interpretation: demonstrates a host can chain the existing retrieval, Jev selection, exact fetch, union, and cited synthesis pieces. It does not show generalized answer quality, reliability, calibration, fresh-source transfer, or automatic orchestration.
- Next gate: a small experimental orchestrator should persist facets, candidates, abstentions, fetches, coverage, citations, and host-produced prose separately, then exercise provider-off and nearby-negative cases on exposed development documents. Do not tune from this packet.
