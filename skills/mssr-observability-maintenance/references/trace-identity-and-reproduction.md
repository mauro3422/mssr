# Trace identity and reproduction

Read when reconstructing one execution or comparing telemetry with a dashboard.

`sessionKey` correlates an exposed host scope, not necessarily a visible chat.
`workflowKey` groups a recurring family; `taskKey` groups bounded task text;
`traceId` identifies one routed execution; `runtimeBootId` distinguishes process
generations; commits, snapshots, and hashes are persistence evidence. Never
merge traces by recency alone. Use explicit `traceId` when candidates are
ambiguous.

Reproduce one caller, task, primary project, and epoch. Record route, required
loads, verify/persist/outcome checkpoints, timestamps, and externally observable
completion. Compare trace evidence and recent metrics to the dashboard. For
ChatGPT Web also measure first routed action, discovery detours, tool span, idle
gap, required-load corrections, premature outcomes, and observable stops/retries.

## Reading aggregates

Declare the actual time window and denominator for each metric. Separate
synthetic/fixture traces, host/model/effort, runtime and skill revisions before
comparing outcomes. Unknown identity stays unknown. Missing verification or
outcome is missing evidence, not proof that a user task is still running or
failed. Compare observable completion with available chat history when needed.

Start with status and bounded summaries; project large responses to needed
fields before displaying them. Inspect a few exact traces to test a hypothesis.
Do not put entire aggregate event/signature arrays into the model context.
Context savings relative to full guidance do not establish savings against no
router. Accepted/loaded/self-scored success is not causal usefulness; report
missing outcomes and selection bias before any productivity claim.

## Bounded model trials

Before delegation, fix one representative asset, visible acceptance criteria,
one repair allowance and a user-agreed spend/time bound. Prefer an existing
accepted asset as the quality target. A primitive box cannot establish organic
modeling ability. Inspect pixels and functional details; dimensions alone do
not prove quality. If no relevant skill context was loaded, do not label the
run evidence of skill effectiveness.

Keep the supervisor out of the execution loop until a result or blocker arrives.
Do not add history research to a cost trial. Separate supervisor and worker work;
account-wide quota deltas with concurrent activity are not worker costs. Use
observed start/end timestamps, not an agent's guessed duration. Near quota
exhaustion, persist a short handoff and stop optional experiments or retries.
