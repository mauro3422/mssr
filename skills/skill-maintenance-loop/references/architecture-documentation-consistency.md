# Architecture and documentation consistency

- **Type:** invariant
- **Owner:** skill-maintenance-loop
- **Read when:** repository architecture, ADR, project context/state, changelog,
  or incident evidence conflicts, is stale, or is proposed for persistence.
- **Status:** active
- **Last reviewed:** 2026-08-13

## Ownership boundary

The repository owns its facts. Architecture documents explain the current
system, ADRs preserve durable decisions and consequences, project context/state
records the bounded current truth, changelogs describe released deltas, and
incident ledgers preserve non-nominal chronology. MSSR Context Messages may
transport references to those sources, but they do not become a second source of
truth. Host or adapter inboxes own delivery only.

## Consistency gate

Before accepting a persistence proposal:

1. Resolve the canonical owner and read the referenced source rather than
   trusting only a message summary.
2. Check provenance, revision/timestamp, and freshness. Treat stale, unknown,
   conflicting, or unavailable evidence as a context request, verification, or
   re-plan signal—not as permission to pick the convenient version.
3. Classify the change by authority: current architecture, durable decision,
   current project state, released delta, or incident chronology. Update only
   the owner needed for the accepted fact.
4. Add reciprocal references only where they prevent ambiguity; do not duplicate
   full facts across every document.
5. Verify links, declared context/state impact, tests or runtime evidence, and
   read back the final owner before reporting persistence complete.

If the contradiction is unresolved, preserve both bounded evidence references
and record the next verification gate. Do not silently rewrite project knowledge
from telemetry, a raw prompt, transcript, heuristic, or learning digest.

## Context Message behavior

A `persistence-proposal` is a review candidate. It must name bounded evidence and
remain advisory until a caller with normal write authority accepts it. Related
incident, ADR, changelog, and continuation messages can guide `load-context`,
`inspect-reference`, `verify-runtime`, or `replan`; none authorizes mutation or
proves freshness by itself.
