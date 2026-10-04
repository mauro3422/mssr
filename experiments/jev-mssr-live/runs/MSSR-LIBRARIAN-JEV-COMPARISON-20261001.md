# MSSR Librarian / Jev comparison — 2026-10-01

## What was compared

The frozen benchmark contains 21 real MSSR documents, 200 headings, and 26 English/Spanish query pairs (52 requests). The candidate heading labels and target index are byte-identical across all four runs below. They were reviewed by Luna agents, not independently adjudicated by the human document owner. A strict exact-heading match is therefore a narrow proxy: another nearby range may still contain useful evidence.

| Run | Actual path | Exact labelled heading | Selected / abstained | Jev calls | Exact fetches | Mean latency |
|---|---|---:|---:|---:|---:|---:|
| [`96k folder`](mssr-librarian-jev-bilingual-hierarchical-20261001T174949Z-v1/REPORT.md) | Single-pass over 200 candidates; the folder name is stale | 35/52 (EN 18, ES 17) | 50 / 2 | 52 | 50/50 | 652 ms |
| [`64k`](mssr-librarian-jev-bilingual-hierarchical-64k-20261001T181350Z-v1/REPORT.md) | Hierarchical, two local shards plus one global Choice | 31/52 (EN 14, ES 17) | 49 / 3 | 156 | 49/49 | 1,197 ms |
| [`80k v1`](mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1/REPORT.md) | Single-pass over 200 candidates | 35/52 (EN 18, ES 17) | 50 / 2 | 52 | 50/50 | 674 ms |
| [`80k v2`](mssr-librarian-jev-bilingual-80k-singlepass-20261001T184400Z-v2/REPORT.md) | Single-pass over 200 candidates on MSSR 0.2.97 | 34/52 (EN 17, ES 17) | 50 / 2 | 52 | 50/50 | 646 ms |

All provider calls completed without an error. The live runners did not read evaluation labels; scorers opened them only after each response file was complete. The 80k rerun chose the identical exact source/range in 50/52 queries relative to 80k v1. One changed query moved from the exact labelled English subsection to its parent heading; the other changed query remained an exact-label miss. This is enough to show small run-to-run variation, not enough to estimate a stable quality interval.

The earlier 0.2.96 full-heading baseline scored 34/52 under the same narrow labels. The two 80k runs scored 35/52 and 34/52, so they do not establish a repeatable quality lift over that baseline. The 64k hierarchical run scored 31/52 on this one evaluation, with more calls and higher latency. Keep the 80k direct Choice as the tested default for this 200-heading case; retain hierarchy only as a bounded fallback for catalogs that do not fit one call, and do not interpret this one ablation as a universal architecture result.

## What the run supports

- A single Jev Choice over the full 200-heading catalog can select a useful revision-bound range in English and Spanish, then the caller can verify it with exact fetch. Both 80k runs passed 50/50 fetch checks.
- The 0.2.97 Jev adapter preserves and validates the Choice probability map. In hierarchy, valid maps keep the top two candidates per shard; a provider without a map keeps the selected local winner. A live 261-heading bilingual synthetic smoke passed 2/2 exact fetches with three calls per query. This validates the fallback path shape, not its quality on a large real MSSR corpus.
- Unicode retrieval and excerpt centering now normalize composed/decomposed accents consistently while preserving `ñ` as distinct from `n`; deterministic search still does not translate or stem.
- The exact-handle flow remains explicit: host search supplies candidates, Jev selects, and the host exact-fetches the returned source range. It does not write project documents or establish truth.

## What the run does not support

- The exact-heading labels are not human-owner adjudications and do not enumerate all acceptable ranges. Do not call these numbers general retrieval accuracy or answer quality.
- There are no independent gold labels for abstention quality, evidence sufficiency, contradiction truth, paragraph synthesis or citation faithfulness.
- These queries are grouped, but they all use the same 21 source documents; this does not establish generalization to unseen documents or larger production catalogs.
- Choice confidence bands and Noul sufficiency remain uncalibrated for MSSR. In single-pass mode Noul sees the full offered set; in hierarchical mode the final Noul sees only retained finalists. Their values are not comparable across those modes. Neither score is a pass threshold or permission to act.
- A prior synthetic 96k hierarchy smoke exceeded TypeSafe's request output limit (`max_tokens_exceeded`). That failed artifact is retained and recorded in the 96k folder report; it is not counted as a successful full-catalog benchmark.

## Recommended next evaluation

Before using any confidence cutoff, have the document owner annotate a representative bilingual set with multiple acceptable ranges, direct answerability, compound-query completeness, and whether abstention is preferable. Keep a document-grouped holdout. Measure deterministic retrieval recall, exact-fetch integrity, range relevance, false selection/abstention, Choice calibration and Noul sufficiency calibration separately. Then compare a direct Choice with hierarchical shortlist on larger real catalogs, repeating each query enough times to quantify Jev's run-to-run variation.

The broader architecture remains coherent when its boundaries stay explicit: deterministic grep/search retrieves candidates; Jev makes a typed selection or relation judgment over bounded evidence; the host may request more evidence, use a separate generator for compaction/paragraph assembly, check contradictions and revisions, and present a reversible preview; a trusted host/verifier owns approval and writes. The current MSSR slice implements the selector and some relation/preview contracts, not the autonomous retrieval/generation loop or host adoption.

## Frozen input hashes

Full SHA-256 hashes for `cases.json`, `corpus.json`, `labels.json`, and `target-index.json` are recorded in each run's `manifest.json`. The scorer asserts the four inputs are byte-identical between the compared runs. Do not change those frozen files in place; create a new benchmark version for changed corpus or labels.
