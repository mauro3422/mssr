# Run48 packet integrity erratum

Date: 2026-10-12

The pre-call checksum inventory in `../PRECALL_SHA256SUMS.txt` records
`manifest.json` as SHA-256
`58fd99cd074a86280743ec414a5c58f9a1e475541f71bf7d8abb08880f68708d`. The
current file hashes to
`d6f6510f94f4a3f9e7582cad23a24ad0ab152810892638eb49d7f340a16d26fb` and contains
post-call fields (`providerCallsCompleted: 4`, the adaptive follow-up, token
totals). The manifest was therefore changed after the pre-call freeze, contrary
to the run-ledger rule that frozen run directories remain immutable after
provider calls. The original manifest bytes are not available from the checksum
alone.

Disposition: preserve the current manifest and all provider receipts; do not
rewrite or attempt to reconstruct the pre-call manifest. Treat the checksum
inventory as the evidence of the pre-call hash and this file as the append-only
disclosure of the mismatch. Seven of its eight listed files still match. The
separate adaptive follow-up inventory matches 2/2. The source revision and all
four exact selection/fetch fingerprints independently verify. This exception
reduces packet reproducibility for pre-call manifest fields; it does not alter
the actual Jev/fetch receipts or the stated quality limitations.

The replay was also assembled directly from live Bridge calls rather than a
copied standard run runner. Provider response JSON, normalized search results,
fetch receipts, the evidence pack, source hash, and derived checks are retained.
Treat it as a traceable development replay, not a runner-validated benchmark
packet.
