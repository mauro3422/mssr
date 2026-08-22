# Signals and recovery

Read when observable work is non-nominal, a route/bootstrap/tool call fails, or
a runtime identifier is unavailable.

Use the smallest truthful signal: evidence (`error-observed`,
`warning-observed`, `degraded-capability`, `uncertainty`,
`conflicting-evidence`); recovery/learning (`repeated-friction`,
`manual-workaround`, `missing-capability`, `recovery-needed`, `skill-gap`,
`reusable-pattern`); or capability control (`capability-discovery-needed`,
`additional-capability-needed`, `tool-chain-needed`, `provider-refresh-needed`,
`replan-needed`). Tags can require discovery or verification; they never grant
mutation authority.

Use `skill_route_plan` to inspect a decision and `skill_bootstrap` to apply the
active phase on the same trace. Do not normally load every skill one by one.
Before an identifier-consuming tool, run its declared preflight. Do not invent
session, snapshot, upload, Studio, or provider tool identifiers.

Do not retry an unchanged failure. Classify schema, target, permission/risk,
provider, timeout, safety guard, or implementation; repair the relevant
precondition and re-plan. After adapter restart, lease loss, or ambiguous
continuity, pass the explicit trace id and refresh vocabulary/catalog before
emitting new canonical values.
