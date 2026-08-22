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
