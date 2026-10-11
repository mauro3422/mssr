# Real facet receipts replayed through the composed Librarian harness

Run: `mssr-librarian-notice-union-replay-20261011T162500Z-v1`

The two manually authored notice facets ran through deterministic MSSR search,
the Jev `1.13.0` selector via isolated Bridge `0.6.169`, exact fetch, and the
existing `run-composed-librarian-experiment.mjs` provider-off receipt replay.
Both Jev requests selected the expected block (ADR 0002 lines 22 and 24), and
the exact fetch fingerprints passed. Total Jev usage was 3,770 input and 294
output tokens. The strict replay accepted both receipts, performed zero provider
or network calls, built a two-paragraph verbatim evidence pack of 384 total
characters, and reported 1/1 line-span coverage for each declared facet.

The replay explicitly reports `semanticCoverage: false` and `ownerGold: false`.
Its line-span metric proves only that the selected source ranges overlap the
host-declared line spans; it does not prove that those ranges semantically
support a claim. The exact text was independently judged Full in the preceding
blind review of the two literal ranges and the cited union-composed answer, but
that review remains model-assisted, source-derived, and part of this same
already-exposed ADR cluster.

This validates that the existing components can be composed without a new
retrieval subsystem: Jev selection receipts are revision-bound, exact fetches
are replay-checked, and the evidence pack preserves the two source passages
verbatim. It does not show that the product automatically plans facets,
semantically checks union coverage, or gates synthesis. The replay output is
[`mssr-librarian-notice-union-replay-20261011T162500Z-v1-replay`](../mssr-librarian-notice-union-replay-20261011T162500Z-v1-replay/)
with its own checksums.

The production Bridge was not contacted or restarted. Jev ran only through the
isolated local adapter, and replay was provider-off. Scores remain uncalibrated;
this is diagnostic evidence, not independent benchmark quality or a production
activation gate.
