# Direct MCP smoke erratum — 2026-10-11

The manifest remains unchanged. It was frozen with status `frozen-before-provider-call`, but the Jev selection and exact-fetch calls were subsequently made directly through the connected Bridge MCP tool rather than through this experiment's frozen runner. This violates the run procedure in `experiments/jev-mssr-live/README.md`; therefore this directory is not a completed frozen-run packet and its observations must not be counted as benchmark or calibration evidence.

## Observed call

- Query: “What exact sequence should be followed after a missing tool or skill is identified before using that capability?”
- Three frozen Markdown snapshots from two skill families were offered; the selector exposed eight heading candidates, including nested headings from the third source.
- Jev `jev-1.13.0` made one Choice call and selected the expected `Capability chaining and maintenance` heading from `skills/mssr-agent-routing/references/capability-chaining.md`.
- Raw Choice confidence was 0.97; Noul/evidence sufficiency was 0.59; usage was 1,609 input and 127 output tokens; latency was 739.5 ms.
- Exact fetch passed with fingerprint `548192ea60705b208c123323938dc7f120a30b8c745948e0473fde3deb0de609`.
- Range-overlap diagnostics reported 15 same-revision pairs and five nested overlaps, all caused by a broad parent heading in `project-context-modularization.md` containing its child headings. This is candidate-set structure evidence, not five independent examples.

The raw MCP result was not saved as a byte-for-byte record, so these fields are a contemporaneous diagnostic note, not a substitute for `records.jsonl`, `request-events.jsonl`, or `run-completion.json`. The sources were also exposed in this direct call and must be excluded from future “unseen” claims. One query over two source families, author-derived target and no independent adjudication cannot estimate reliability or calibrate scores. No production behavior changed.
