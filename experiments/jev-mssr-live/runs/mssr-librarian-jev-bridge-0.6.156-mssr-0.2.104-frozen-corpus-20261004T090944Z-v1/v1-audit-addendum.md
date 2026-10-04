# v1 preservation audit addendum

Audit date: 2026-10-04. Scope: this run directory, excluding every `.git` path. Existing run artifacts were treated as read-only. No provider or Bridge call was made during this audit. Target labels and scores were not read; `summary.json` was not inspected.

## Terminal status

The manifest records `status: partial-exploratory` and `evaluationClass: exploratory-build-regression-paired-comparison`. The three preserved preflights (`preflight-setup.json`, `preflight-before-live-gate-fix.json`, and `preflight.json`) each record `preflight-passed-provider-gate-closed`, `providerCallsMade: false`, `labelsRead: false`, and `scoringPerformed: false`.

`records.jsonl` contains 52 valid JSON lines. All 52 have `status: failed`, `failureClass: provider-or-tool-error`, `errorName: Error`, a nonempty request start time, and `rawErrorPersisted: false`. The records therefore establish 52 started request records, but do not establish how many requests reached the provider. This conflicts with the preflight `providerCallsMade: false` declarations. The actual provider-call count is unknown. Do not interpret the preflight field as proof of zero calls.

The raw MCP/provider error is absent. The exact root cause is unknown. The run is preserved as a failed, partial exploratory attempt, not a scored benchmark result. No outcome score or target label was examined in this audit.

## Integrity verification

- All 21 source documents listed in `inputs/source-inventory.json` exist in `project/`; byte counts and SHA-256 values match the inventory, the recorded Git blob hashes, and each inventory `matchesGitCommit` assertion.
- `inputs/cases.json` and `inputs/corpus.json` SHA-256 values match `preflight.json`'s `inputHashes`.
- `runner.mjs` SHA-256 matches `preflight.json`'s `runnerSha256`.
- `project/.mssr/project-context.json` SHA-256 and byte count match the staged-project identity recorded in the preflight.
- The source commit is `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`; the staged snapshot commit recorded by the identity/preflight metadata is `c7a449928d0d62a9793082f84175523dc1f65066`.

## Preserved run-specific evidence

This v1 run includes three distinct preflight snapshots documenting setup, the pre-live-gate-fix state, and final preflight; a staged project identity; and 52 failed request records. The staged `project/` contains its own embedded `.git`, which was left untouched and excluded from this audit's artifact inventory and final checksums. No Git submodule was created, and nothing was staged or committed.

`SHA256SUMS` records hashes for every final non-`.git` file in this run directory other than itself, including this addendum and `run-completion.json`.
