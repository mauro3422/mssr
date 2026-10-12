# Run 64 post-call record

`manifest.json` is intentionally the frozen **pre-call** checkpoint: it records `status: awaiting-provider` and `providerCalls: 0`. It is not a post-run status file and was not rewritten after the calls. Five live Jev disposition receipts, four search receipts, exact fetches, and evidence packs are preserved in `raw/`; the completed results and counts are in `RUN-REPORT.md` and `metrics.json`.

The additional B1 language/facet probes were specified in `POSTCALL-FOLLOWUP-PLAN.md` before those three calls. They reuse the same exact B1 target and do not increase the independent case count. The run remains an exposed-case diagnostic with source-only labels; no thresholds, runtime, metadata mode, or source documents were changed.

The two input source files are frozen snapshots in the referenced Run 63 package. Their exact paths and SHA-256 values are recorded in `manifest.json`, `RUN-PLAN.md`, and `metrics.json`. This package does not claim that those files were re-read from their upstream project roots during Run 64.
