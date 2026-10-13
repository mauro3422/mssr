# Run plan integrity errata

Before any benchmark search or live Jev request, source verification found that the frozen plan copied the Elemental Frontier VERSION_MATRIX.md SHA-256 incorrectly. The on-disk document at the preregistered clean HEAD f5a0dc9895c7b7b7c755c3a1e7bb65795c58f346 hashes to fa29514bd0fe4504a1b9a8a7712fff981bf1b660e7c486a72706388588f555fd.

The source reference, question, expected answer, target line, queries, and protocol did not change. Only the source-integrity value for EF-01 and EF-03 was corrected to the observed source hash. No Jev request occurred before or during this correction. The corrected plan and all inputs are included in PRECALL-SHA256SUMS.txt before the first measured call.
