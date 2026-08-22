---
name: mssr-observability-maintenance
description: Audit and maintain MauroPrime Bridge and MSSR observability when callers, models, effort, sessions, projects, routed skills, required loads, verification, persistence, outcomes, active epochs, or dashboard labels are missing, misleading, duplicated, or inconsistent. Use for silent or looping ChatGPT Web tool runs, orphan or ambiguous traces, premature or duplicate outcomes, unknown attribution, route-to-load gaps, privacy-safe telemetry changes, and MSSR dashboard regressions.
---

# MSSR Observability Maintenance

Diagnose only what the host can observe, repair the smallest owner, and leave a
reproducible privacy-safe trace contract.

## Core protocol

Bridge observes calls that traverse Bridge plus explicit MSSR checkpoints.
Native tools, final UI rendering, private reasoning, and unexposed metadata are
outside the boundary and remain `unknown`/`not exposed`. Keep caller, session,
workflow, task, trace, project, runtime boot, and active epoch distinct.

Classify the defect before changing anything: host metadata -> adapter; catalog
or discovery detour -> catalog/context next action; route/load/close state ->
trace coordinator or MSSR core; activation -> routing metadata/fixtures;
projection wording -> dashboard; reusable procedure -> owning skill. Do not
patch labels to hide lifecycle defects.

Success requires one compatible trace, required loads, applicable verify and
persist checkpoints, one final outcome after phase gates, and explicit resume or
re-plan before later work. An idle timer or missing final message proves neither
success nor acceptance.

## Reference map

- Read [trace identity and reproduction](references/trace-identity-and-reproduction.md)
  for session/trace reconstruction or a controlled reproduction.
- Read [delegated attribution](references/delegated-attribution.md) for wrappers,
  delegated targets, metrics cardinality, or dashboard attribution.
- Read [stateless recovery](references/stateless-recovery.md) after restart,
  coordinator loss, or trace ambiguity.
- Read [telemetry safety](references/telemetry-safety.md) when changing metrics,
  privacy handling, retention, or active epochs.

## Exit

Add the regression that reproduces the observed sequence and recovery. Verify
source, adapter/runtime, dashboard projection, and restart behavior in
proportion to the change. Record an incident through `skill-maintenance-loop`
when non-nominal evidence or repeated friction warrants it.
