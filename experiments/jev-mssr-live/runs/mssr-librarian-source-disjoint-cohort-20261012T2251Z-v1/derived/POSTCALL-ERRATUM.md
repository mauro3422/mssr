# Post-call erratum — frozen manifest status

The manifest was frozen after source-only labels and before Jev calls. Its `status: labels-frozen-awaiting-provider` and `providerCalls: 0` describe that pre-call checkpoint, not the completed run. The frozen manifest was not rewritten after provider execution. Actual calls and outputs are recorded in `raw/jev-*.json`; this erratum and `RUN-REPORT.md` are the append-only post-call record. Five calls completed; A1 had zero search candidates and correctly did not call Jev.

The preparation-time `RUN-PLAN.md` likewise describes the planned pre-call phase. Do not use its future-tense wording or the manifest's pre-call status as evidence that the provider was never called.

The frozen reviewer file `raw/blind-label-luna-b.json` is Markdown-wrapped JSON (a Markdown heading, prose, then a JSON array), so the whole file does not parse as JSON despite its extension. Its recorded manifest hash matches the original bytes; those bytes were preserved rather than rewriting a frozen pre-call label. Treat its content as Markdown containing a JSON array, not as a standalone JSON document.

`raw/evidence-pack-C1-stale-attempt.json` reports that the caller-provided source revision was stale. The adjacent shell-returned text and successful retry using Bridge-read UTF-8 bytes are observed, but the failure receipt does not prove the exact cause. The report therefore records the retry and leaves the cause unresolved.
