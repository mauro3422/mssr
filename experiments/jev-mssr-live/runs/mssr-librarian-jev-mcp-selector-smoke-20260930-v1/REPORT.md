# MSSR Librarian Jev MCP selector smoke (exploratory)

## Run

This is a single-call integration smoke for MSSR 0.2.95, not a benchmark-quality estimate. The compiled MCP registration was connected through the MCP SDK in an in-memory client/server pair, injected with the real MSSR TypeSafe Jev provider, and supplied a frozen corpus of 21 MSSR documents. The runner submitted only the corpus and Spanish query case 01; it did not read expected targets or labels. The existing Windows Credential Manager entry supplied the provider credential ephemerally.

The selector offered 200 exact heading sections plus none (201 total options). Jev selected the expected target section at `Semantic Evidence Plane architecture › Evidence atom and source boundary` in `.mssr/knowledge/architecture/semantic-evidence-plane.md`. A subsequent call to `mssr_librarian_fetch` revalidated the selected handle against the frozen source and returned the identical fingerprint.

## Observed result

- Provider/model: `typesafe-jev` / `jev-1.13.0`.
- Raw provider confidence: 0.79; uncalibrated and descriptive only.
- Usage: 18,192 input / 2,027 output tokens.
- Selection-call latency: 5670.1 ms.
- Exact fetch: passed; revision-bound fingerprint matched.
- Authority: advisory only, unverified, no automatic apply. The selector returned a handle, not section text.
- Persistence: no credential, raw provider response, or source body was persisted.

The expected-target comparison ran after selection. Its label provenance is dual Luna review; not human document-owner adjudication; alternatives were not exhaustively adjudicated. This one match establishes that the compiled MCP path, real provider and exact-fetch handoff worked for this input. It does not measure broad retrieval or decision quality, validate confidence, prove semantic truth, or authorize automatic search reranking.

## Limits

This call covers heading selection and exact fetch only. It does not cover compaction, follow-up grep, paragraph assembly, citation-faithful synthesis, relation/contradiction quality, human-approved gold labels, or Bridge host adoption. Search remains deterministic. The active Bridge package readback remains MSSR 0.2.93 until a separate host adoption is verified.

## Reproduction

From the repository root, run `npm run build`, then `node experiments/jev-mssr-live/runs/mssr-librarian-jev-mcp-selector-smoke-20260930-v1/runner.mjs` on the authorized Windows account. The runner reads the existing Credential Manager entry, sends one real Jev Choice call, performs an exact MCP fetch, and writes only the bounded summary. Run `node experiments/jev-mssr-live/runs/mssr-librarian-jev-mcp-selector-smoke-20260930-v1/score.mjs` separately to compare the result with the frozen expected-target index after the call.
