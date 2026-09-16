# Context and lifecycle

Read when consuming selected context messages, carrying a trace, checkpointing,
or recording an outcome.

Apply the core's provenance check once per evidence revision. Deduplicate
piggyback and inbox deliveries by portable identity. A delivery receipt proves
delivery, not current project truth or retention after host compaction.

Carry a trace through meaningful replans. Use explicit `traceId` after restart,
across processes, for ambiguity, or deliberate historical selection. Project
ownership is part of trace identity; crossing repositories needs a new owner
trace with bounded handoff evidence.

## Finish the current trace

1. Record verification and persistence only when applicable and evidenced.
2. Re-plan the same trace at `stage=close` after the last material work.
3. Finish required close guidance. Record `eventType=phase_completed` with
   `completedPhases` containing the phases actually completed, including
   `maintenance` when required. Listing phases on an outcome is not a substitute
   for this checkpoint. Loading a skill alone does not complete its phase.
4. Inspect the host's closure state/next action. Once applicable gates are
   complete, record `eventType=outcome` with one `primarySkill`, supporting skills,
   truthful status and bounded evidence. Use current schema limits.

If rejected, follow the reported missing gate on this trace; do not loop over
identical close plans or invent persistence for a read-only task. Keep a real
unresolved blocker explicit. Retries replace the effective outcome rather than
creating another task. A trace heartbeat proves activity, not user-visible
completion.

Reuse guidance still present in the same uncompacted phase. Reload only changed
or missing units after compaction, restart or handoff. Report visible progress
at meaningful boundaries as required by the host; no duplicate progress ritual
is needed for a telemetry checkpoint.
