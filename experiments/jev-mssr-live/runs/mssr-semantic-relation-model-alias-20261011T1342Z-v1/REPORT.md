# Connected Jev semantic relation and preview — model alias diagnostic

Status: complete, exploratory. Captured 2026-10-11 UTC on Bridge 0.6.169.

## Case

The case compares two exact current project passages about capability chaining:

- `docs/AGENT_PROTOCOL.md`, `block-46`, lines 206–209, revision
  `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`,
  fingerprint `b8350c4ca229df4d68ff878fdba2cd7cd27a2457a471835fbfcf3b584adf2d65`.
- `AGENTS.md`, `block-2/item-10`, lines 47–48, revision
  `cb2d567bf085e68ed2e97ec5650de5a152d2a41f4293fe124917ebd3a3f346d2`,
  fingerprint `b617663fd4a06f28a0b20562fd2bd439fcf28b26a085777860dee4c325d4c7e5`.

Both exact ranges were fetched through the connected Librarian before the
relation call; Bridge's relation-review tool re-read the source ranges.
Scope, current-validity assertions, and temporal comparability were left
unknown in the input.

## Jev and independent review

The first live request supplied `gpt-6-luna` as the Jev model and failed with
HTTP 400; Bridge suppressed the provider body and no provider request ID was
returned. The same atoms, exact source evidence, pair, and question then
succeeded when only the model field changed to the TypeSafe Jev model ID
`jev-1.13.0`. Jev chose `supports` with raw confidence 0.77 (1,098 input / 69
output tokens; 969.8 ms). This strongly implicates passing the host model alias
to the provider, but the suppressed error prevents direct confirmation.

A Luna subagent, blind to Jev's result and given only the two exact excerpts,
also labeled the relation `supports` with low uncertainty. The excerpts alone
do not establish scope/time comparability, and the label is not project-owner
gold.

## Synthesis preview

The immutable preview returned `review`. It retained both exact snapshots and
reported `applyAllowed=false`, `canonicalRewriteAllowed=false`, and
`reversible=true`. Its reasons were absent independent verification, missing
claim scope/validity, unknown relation scope and temporal comparability, and
unconfirmed source freshness. No source was edited, merged, or rewritten.

The preview endpoint is registered read-only and must be called through
`bridge_tool_query`; an initial `bridge_tool_action` wrapper attempt was rejected
before target invocation. The corrected read-only query completed successfully.

## Interpretation

This is one linked relation case across two project documents, not a holdout or
a reliability estimate. The provider score is uncalibrated; the blind Luna
annotation is useful independent review but is not owner adjudication. The
run confirms the connected relation path can return a typed, source-bound
judgment and that preview correctly remains review-only when comparability and
verification are absent. It does not validate a merge, produce synthesized
paragraphs, or justify a threshold change.

The next evaluation should use separately frozen source-document clusters,
blind annotations made before Jev calls, and a mix of supports, duplicate,
unrelated, contradiction, supersession, and unresolved cases. Keep raw provider
scores descriptive and preserve exact source identity and preview blockers.
