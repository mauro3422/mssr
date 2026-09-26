# Deferred technical-debt capture

- **Type:** maintenance recipe
- **Owner:** `skill-maintenance-loop`
- **Read when:** concrete technical debt, a bounded design gap, known performance debt, compatibility debt, or a verified limitation is discovered during active work and intentionally deferred instead of fixed immediately.
- **Status:** active
- **Last reviewed:** 2026-09-23

## Purpose

Do not derail a focused or frozen task merely because adjacent debt becomes visible. Deferring work is acceptable; losing the finding is not. Before the next applicable persistence/maintenance close, make the deferred item durable in the project-owned debt/backlog surface.

Prefer the repository's existing `BACKLOG.md`, `TECH_DEBT.md`, issue tracker, roadmap debt section, or other declared debt owner. If the project has no durable debt surface, use a bounded project-owned MSSR state/knowledge entry and index it normally rather than keeping the only copy in chat or ephemeral trace memory.

## Minimum record

A deferred-debt item should contain enough observable information for a later agent to act without reconstructing the original conversation:

- short stable title or id;
- status: `confirmed-debt` or `review-needed`;
- observable evidence and affected file/component/surface;
- practical impact or risk;
- why it is intentionally deferred now;
- next trigger/gate or suitable future slice;
- closure condition that would prove the debt resolved.

Use links, hashes, test names, benchmark ids, or trace ids when they materially improve reproducibility. Never store raw prompts, transcripts, secrets, or private reasoning.

## Boundaries

- A suspicion is `review-needed`, not a confirmed bug.
- A transient provider/network/tool failure is not technical debt unless evidence shows a project/system defect or repeated friction.
- A current blocker belongs in current project state as well as any debt ledger; do not hide a blocking correctness/safety issue in a future backlog.
- Do not opportunistically fix unrelated debt when doing so widens scope, invalidates a frozen benchmark/holdout, risks concurrent work, or needs a separately reviewed migration/version.
- Update an existing debt item when the same condition reappears; do not create duplicate entries per session.
- When an item is fixed, record the verification/closure evidence and mark/remove/supersede it according to the owning project's normal backlog convention.

## Exit

The current task may continue with debt still open when the item is durably recorded, correctly classified, non-blocking for the current gate, and has a concrete future trigger plus closure condition. Durable capture is the requirement; immediate repair is not.
