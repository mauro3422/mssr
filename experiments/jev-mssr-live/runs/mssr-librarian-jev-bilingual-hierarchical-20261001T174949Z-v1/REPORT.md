# Live bilingual Jev selection — 96k run folder

Status: complete exploratory benchmark. Provider: TypeSafe Jev 1.13.0. Corpus: 21 MSSR Markdown documents / 200 headings. Queries: 52 paired English/Spanish.

## Actual outcome

This folder name says `hierarchical`, but all 52 response records show `selectionMode: single-pass`: each query offered all 200 candidates in one Choice. Results: 52/52 provider calls succeeded, 2 abstentions, 50/50 selected handles passed exact fetch, 35/52 strict labelled headings matched (18/26 English, 17/26 Spanish), 1,465,227 input and 106,438 output tokens, 652 ms mean observed latency. Read `summary.json`, `responses.json`, and `score-summary.json` for the detailed records.

The live runner did not read `labels.json` or `target-index.json`; the scorer read them only after the response file was complete. Labels are Luna-reviewed, not human-owner-adjudicated. Exact-heading misses and confidence values are exploratory evidence, not answer-quality ground truth or a threshold.

## Preserved threshold-smoke lineage

This folder contains evidence from several later diagnostic steps; the files remain in place and are classified here rather than silently moved:

- `hierarchical-live-smoke-result.json` is the failed synthetic 96k hierarchy smoke. TypeSafe rejected its request with `max_tokens_exceeded`; it made no accepted result and is evidence for the request-size cap.
- `hierarchical-live-smoke-result-64k.json` and `preflight-64k/` belong to the later 64k synthetic/preflight diagnostic, not this 96k full-catalog run. The successful 64k hierarchy benchmark itself is in the sibling `mssr-librarian-jev-bilingual-hierarchical-64k-20261001T181350Z-v1/` directory.
- `smoke.mjs` / `smoke-result.json` are an earlier isolated wiring smoke and do not contribute to the 52-query score.

Retain all inputs, scripts, outputs and these failed diagnostics. The run's legacy folder name and mixed smoke lineage are captured in `manifest.json` and the comparison index at `../MSSR-LIBRARIAN-JEV-COMPARISON-20261001.md`.
