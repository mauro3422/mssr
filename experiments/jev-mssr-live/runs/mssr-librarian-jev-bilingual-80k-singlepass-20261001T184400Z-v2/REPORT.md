# Live bilingual Jev selection — MSSR 0.2.97, 80k direct run v2

Status: complete exploratory benchmark against the final 0.2.97 build (`mssr-build:sha256:bc288853f02be406`). Provider: TypeSafe Jev 1.13.0. Corpus: 21 real MSSR Markdown documents / 200 headings. Queries: 52 paired English/Spanish. The live runner recorded all calls before it opened gold labels; `score.mjs` requires a complete response file before reading them.

## Outcome

All 52 provider calls succeeded in single-pass mode; 2 queries abstained, 50 selected handles passed exact fetch, and 34/52 strict labelled headings matched (17/26 English, 17/26 Spanish). Usage was 1,465,227 input / 106,438 output tokens; mean observed latency was 646 ms. Raw records and scoring details are stored beside this report.

Compared to the first 80k direct run on identical frozen input bytes, 50/52 queries returned the same status and exact source/range identity. One English selection changed from the target subsection to its parent heading, reducing that run's strict heading score from 35 to 34; one Spanish selection changed but remained a strict miss. The run-to-run difference cautions against treating one 52-case output as a fixed score.

## Live smoke evidence

- Synthetic bilingual hierarchy: 261 headings, two local shards plus final Choice, 3 provider calls/query, top two per shard, exact target and fetch passed in 2/2 queries. Synthetic evidence only.
- Real-corpus probability-map smoke: one Spanish query over 200 headings, single-pass, live Jev response validated and exact fetch passed. Evaluation labels were not read for this smoke.

Scores are not human-adjudicated answer quality. Alternate valid ranges, abstention quality and sufficient-answer judgments are not labelled. Choice and Noul are uncalibrated for MSSR policy; the final Noul sees a different candidate set in hierarchical mode than it does here. Do not infer a confidence threshold. See `../MSSR-LIBRARIAN-JEV-COMPARISON-20261001.md` for the overall decision and next evaluation gate.
