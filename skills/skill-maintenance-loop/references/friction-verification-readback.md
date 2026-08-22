# Verification and readback friction

Read when a reported success, passing test or incident signal must be separated from verified target state and from authority to mutate instructions.

## Readback and live-effect gates

### Exit code or mutation report overclaimed

`code=0`, `changed=true`, `HTTP 200`, `saved`, or `committed` proves only that one operation reported success. Read back the exact target, verify hashes/counts/state and test the user-facing path.

### Tests pass but the live target metric does not move

A candidate algorithm may pass synthetic regressions yet leave the real layout, performance metric or visible defect unchanged. Before publishing, declare the intended live delta, recapture the same state and classify the hypothesis as `accepted`, `rejected` or `inconclusive`. A zero-delta or perceptually worse candidate is rejected and reverted; useful tests or instrumentation may be preserved separately. Never describe a green unit suite as proof that the user-facing hypothesis worked.

### Integrity incident repeats but skills must not self-edit

Repeated errors justify maintenance, not unsupervised instruction mutation. Metrics and incident records can produce a bounded proposal, but source changes require a visible task with owner review, snapshot, diff, regression tests, routing verification and Git publication.

Use `skill-maintenance-loop/scripts/build_change_proposal.py` to choose the smallest candidate change. The report must state `automaticMutationPerformed=false`.
