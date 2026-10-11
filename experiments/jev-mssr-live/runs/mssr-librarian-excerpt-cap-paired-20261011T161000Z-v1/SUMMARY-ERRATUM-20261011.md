# Summarizer compatibility erratum — 2026-10-11

This is an offline derived-artifact addition. No Jev/provider call was made and no frozen study input, manifest, request, record, label, or adjudication was changed.

The generic summarizer previously rejected this run because the paired-study schema uses `expectedPairs`/`completedPairs`/`providerCalls` and a `study` discriminator rather than the generic runner's `manifestSha256` completion contract. The summarizer now has an explicit `paired-excerpt-cap-v1` adapter, requires `SHA256SUMS` coverage for the frozen manifest, completion, cases, and records, validates every indexed file, and writes only `summary-calculated.json`.

The derived summary confirms five paired cases, ten provider request records, nine selected ranges, nine fingerprint-matched exact fetches, and five distinct source-document clusters. It preserves the manifest's `ownerGold: false`, keeps the existing separate reviewer adjudication untouched, and reports no semantic score or calibration claim. A source-document cluster count is descriptive grouping only, not proof of independent sampling.
