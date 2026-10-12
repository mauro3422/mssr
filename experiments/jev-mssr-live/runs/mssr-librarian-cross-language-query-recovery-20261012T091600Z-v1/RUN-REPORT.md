# Run46 — Cross-language Librarian query recovery

## Scope

This is a small development diagnostic of explicit bilingual query variants and Jev candidate selection on three real project-document families. Metadata and atom/contradiction projections were off. The translator saw only the query text. Labels stayed in the local evaluator and were not sent to search or Jev. The labels are analyst-derived, not source-owner adjudicated; this is not a holdout or calibration cohort.

The Run45 EF negative receipt carried revision `a51fe735f7a0e85a0bece3ae36bcda5fd01825f8c4ab32c4d7dd356c642c5c7d`, which differs from the declared and SHA-verified EF snapshot `07d5ea38cf9af29c10d3c838a8a9428b478f9eecb6a8d6a812b1dfb8cc3c49fe`. The Run45 EF positive receipt had 0 candidates and no handle revision. Both historical EF receipts are excluded from same-source pairing. Run45's ERS positive receipt also returned no handles, so it could not attest its search revision. Amendments add two EF controls and one live Bridge ERS primary-only control. ERS source hash before and after its call remained `4a5556680a4f395bdbc4e6b578d9fbc368c15483fdad6b6f57aeef3e84a5cd77`; Run45 artifacts remain unchanged.

## Results

| Case | Search arm | Primary candidates | Variant/current candidates | Candidate delta | Target rank in variant/current pool | Jev |
|---|---|---:|---:|---:|---:|---|
| KODE-01-ES | primary + translation | 10 | 10 | +0 / −0 | — | not called |
| EF-01-EN | primary + translation | 0 | 5 | +5 / −0 | 2 | abstained |
| ERS-01-ES | primary + translation | 0 | 10 | +10 / −0 | 2 | abstained |
| EF-NEG-01 | primary + translation | 8 | 10 | +2 / −0 | — | abstained |
| KODE-NEG-01 | primary only | 10 | 10 | +0 / −0 | — | not called |
| ERS-NEG-01 | primary only | 10 | 10 | +0 / −0 | — | not called |

Across the three positive query-variant cases, the accepted target appeared in **2/3** variant pools, at rank **2** for EF and ERS; KODE remained absent from the top 10 and the returned handle pool did not change. EF's negative control grew from 8 to 10 handles (**+2**), showing bounded variant-driven noise in this one negative.

Jev was called on two positive pools (EF and ERS) and the changed EF negative pool. It **abstained 3/3**: positive selections **0/2**, negative abstentions **1/1**. Its three requests offered the exact ordered search pools. Raw confidence/evidence-sufficiency scores and token/latency counts are preserved in `derived/aggregate.json`; scores are explicitly uncalibrated. No case selected a candidate, so this run has **zero exact fetches and zero evidence packs**. It did not test compaction, union, paragraph assembly, or the composed Librarian workflow.

## Interpretation and next diagnostic

Explicit translations recovered two targets in the search pool, but Jev abstained on both; this is retrieval recovery, not successful end-to-end answer production. KODE suggests a top-10 candidate-cap question, but a larger-k or separate-variant arm is required before attributing that miss to top-k starvation. Do not tune a confidence threshold from these three calls.

The next run should separate three questions: (1) whether Jev selects differently when only query language changes while the candidate pool/order stays identical; (2) whether compound questions split into manually frozen facets, followed by exact fetch, evidence union and host paragraph assembly with blind review; and (3) whether KODE's target appears in an isolated translation search or a larger top-k pool. Preserve exact source revisions and keep labels hidden from the agent. The second arm is the one that evaluates the complete intelligent Librarian flow—retrieval, selection, union, exact evidence, compaction, and cited paragraph assembly—rather than treating it as plain grep.

## Reproduction and integrity

Run `node scripts/aggregate-run.mjs` from this run directory. The script checks case/source binding, frozen source hashes, primary query text, exact Jev candidate-pool identity, labels isolation assertions, EF's mismatch/empty baseline, and ERS's empty baseline limitation. `derived/frozen-evidence-sha256.json` locks the plan, manifest, inputs, raw receipts, aggregation script, baseline labels, source snapshots, and baseline search receipts after provider calls; it is a post-call integrity checkpoint, not proof of pre-call provider isolation.
