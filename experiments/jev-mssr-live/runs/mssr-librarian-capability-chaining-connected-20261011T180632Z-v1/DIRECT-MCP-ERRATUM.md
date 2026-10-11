# Direct MCP smoke erratum — 2026-10-11

The manifest remains unchanged. It was frozen with status `frozen-before-provider-call`, but the Jev selection and exact-fetch calls were subsequently made directly through the connected Bridge MCP tool rather than through this experiment's frozen runner. This violates the run procedure in `experiments/jev-mssr-live/README.md`; therefore this directory is not a completed frozen-run packet and its observations must not be counted as benchmark or calibration evidence.

## Observed call

- Source: `skills/mssr-agent-routing/references/capability-chaining.md`
- Frozen SHA-256: `3300d407c82a44a62535fb68622403012afbbb88ab488adaa6e2a46f11b8e080`
- Query: “What sequence does the project prescribe after a missing tool or skill is discovered?”
- Bridge selection result: selected; Jev `jev-1.13.0`; one Choice call; candidate count 1; raw Choice confidence 0.98; Noul/evidence sufficiency 0.73; 659 input and 57 output tokens; 887.4 ms.
- Selected handle fingerprint: `548192ea60705b208c123323938dc7f120a30b8c745948e0473fde3deb0de609`; exact Bridge fetch returned the same fingerprint and the expected source range.
- A first exact-fetch attempt used the local adapter's argument shape and was rejected by Bridge schema validation before reading a source or calling a provider. Retrying with the runtime Bridge schema `{projectRoot, handle}` succeeded. This is caller-schema friction, not a Jev failure.

The raw MCP result was not saved as a byte-for-byte record, so these fields are a contemporaneous diagnostic note, not a substitute for `records.jsonl`, `request-events.jsonl`, or `run-completion.json`. This one source, one query, author-derived target and direct call cannot estimate reliability or calibrate scores. No production behavior changed.
