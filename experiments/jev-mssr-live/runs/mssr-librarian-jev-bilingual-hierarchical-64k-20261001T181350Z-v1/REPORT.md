# Live bilingual Jev selection — 64k hierarchical ablation

Status: complete exploratory benchmark. Provider: TypeSafe Jev 1.13.0. Corpus: 21 MSSR Markdown documents / 200 headings. Queries: 52 paired English/Spanish.

## Actual outcome

Each query used two bounded local Choice shards and a global Choice (156 total calls); the final global request retained up to two local candidates per shard via the Choice probability map. Results: 52/52 calls succeeded, 3 abstentions, 49/49 selected handles passed exact fetch, and 31/52 strict labelled headings matched (14/26 English, 17/26 Spanish). Usage: 1,546,635 input / 112,675 output tokens and 1,197 ms mean observed latency. Full scoring is in `score-summary.json` and `scored-records.json`.

This is a paired ablation over the same frozen inputs as the two 80k direct runs. It scored lower here and used three times as many provider calls; the result is not evidence that hierarchy will underperform on every catalog. No confidence cutoff or automatic production action is justified by this run.

## Script correction and limits

The original runner's hardcoded `runId` pointed to the preceding 96k folder even though its persisted summary and response files correctly named this 64k run. The archived runner constant is corrected so future reruns identify themselves accurately. Existing live response records are preserved. Score output regeneration refuses to overwrite existing artifacts unless `--overwrite` is passed intentionally.

The labels are Luna-reviewed rather than adjudicated by the document owner. Noul in this hierarchical run is asked over retained finalists; its value must not be compared to single-pass Noul over the whole catalog. The adjacent synthetic smoke in the preceding 96k folder is separately classified in that folder's report.
