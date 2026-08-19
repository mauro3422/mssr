# Architecture and documentation consistency

- **Type:** invariant
- **Owner:** skill-maintenance-loop
- **Read when:** repository architecture, ADR, project context/state, changelog,
  or incident evidence conflicts, is stale, or is proposed for persistence.
- **Status:** active
- **Last reviewed:** 2026-08-13

## Ownership boundary

The repository owns its facts. `AGENTS.md` owns broad repository instructions;
`.mssr/PROJECT_CONTEXT.md` owns stable architecture/facts/ownership/invariants;
`.mssr/PROJECT_MEMORY.md` owns durable decisions/lessons/rationale; and
`.mssr/PROJECT_STATE.md` owns mutable current versions, blockers and handoff
state. Architecture docs and ADRs may specialize those authorities, changelogs
describe released deltas, and incident ledgers preserve non-nominal chronology.
Active MSSR project knowledge is canonical-only under `.mssr/`; `.bridge/` is not
read as project authority. Historical artifacts there are cleanup evidence handled
by explicit initialization/migration tooling, never retrieval fallback. MSSR Context
Messages may transport references to canonical sources, but they do not become a
second source of truth. Host or adapter inboxes own delivery only.

## Smart maintenance advisory

`evaluateMssrProjectKnowledgeMaintenance` may combine bounded host-observable
metadata — trace stage, changed paths/tool categories, package/runtime adoption,
routing or skill-structure changes, Context Plane freshness conflicts and user
corrections — into owner-specific levels:

- `none`: no project-knowledge action;
- `watch`: keep as low-noise evidence; do not load extra documentation or force a write;
- `review`: load only the named authority/module plus this maintenance recipe and decide `updated` vs `reviewed-none`;
- `required`: unresolved freshness/consistency evidence must be reviewed before a successful persistence/close claim.

The advisory is not a writer and its score is not project truth. Use it to decide
**where to inspect**, then verify against the canonical source/diff. If the target
is a skill/reference, involve `skill-routing-maintainer` only when activation,
composition, routing, or structural module semantics actually changed.

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
