# Context and lifecycle

Read when consuming selected context messages, carrying a trace, checkpointing,
or recording an outcome.

Treat selected messages as advisory evidence. Check canonical owner,
provenance, and freshness; stale, unknown, conflicting, or unavailable evidence
requires a minimal load, verification, context request, or re-plan. Deduplicate
piggyback and inbox deliveries by portable identity. Continuation receipts only
resume compatible state and do not prove project facts are current.

Carry a trace through meaningful replans. Use explicit `traceId` after restart,
across processes, for ambiguity, or deliberate historical selection. Project
ownership is part of trace identity; crossing repositories needs a new owner
trace with bounded handoff evidence.

For a substantial task, record exactly one final outcome: one `primarySkill`,
supporting skills, truthful status, and bounded objective evidence. Reuse the
trace for retries and final review so the latest outcome replaces preliminary
evidence. Keep summaries and evidence references within schema limits. A trace
or heartbeat proves backend activity only, not user-visible completion.

Report visible checkpoints at scope resolution, before opaque work, material
results, handoffs, failure/replan, before persistence, and closure. Report
completed facts, active phase, and next gate only.
