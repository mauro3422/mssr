---
name: mssr-agent-routing
description: Apply the transversal MSSR protocol to classify observable intent, route skills by phase, discover or chain additional tools, react to provider degradation, and re-plan without treating the first route as an allowlist. Use before substantial specialized work, when another skill or tool is created or changes, when a tool/schema/provider fails or disappears, when the task advances to verification/persistence/close, or when an agent needs capabilities not present in its initial plan.
---

# MSSR Agent Routing

Apply the same advisory routing loop across domains, skills, MCPs and hosts.

## Core protocol

Before substantial specialized work, emit compact observable intent: `domains`,
`actions`, `artifacts`, `needs`, `signals`, `risk`, and `ambiguity`. This is
control metadata, never hidden reasoning, a raw prompt, or a transcript. Use a
bounded resolved summary only when continuing multi-turn work.

Use `nominal` only for clean work. Otherwise select the smallest truthful
signal set. Non-nominal debugging/review evidence composes
`systematic-debugging`; capability, provider, routing, skill, or context gaps
compose `capability-gap-recovery`. Neither selection grants permissions.

Plan the current phase, load only its eligible skills, use the authoritative
execution host, and re-plan at `verify`, `persist`, `close`, `resume`, a
material failure, provider/schema change, new capability, or repeated friction.
The initial route is advisory, not an allowlist. Do not route mechanically
between adjacent successful calls.

Selected context is bounded advisory evidence: verify canonical owner,
provenance, and freshness before relying on it. Stale, unknown, conflicting, or
unavailable evidence requires the smallest source load, verification, context
request, or re-plan. A persistence proposal never authorizes its own write.

## Reference map

- Read [signals and recovery](references/signals-and-recovery.md) when a task
  is non-nominal, a route/bootstrap/tool call fails, or a runtime identifier is
  missing.
- Read [context and lifecycle](references/context-and-lifecycle.md) when
  consuming context messages, carrying a trace, checkpointing or closing an
  outcome.
- Read [capability chaining](references/capability-chaining.md) when discovery,
  provider refresh, autoregistry, or routing maintenance is needed.

## Invariants and exit

MSSR ranks and composes capabilities; it never grants, removes, proxies, or
substitutes normal tool authorization. Keep long work visibly alive with
bounded user-visible checkpoints that report completed facts, active phase, and
next gate—never private reasoning. Finish a substantial trace with one
evidence-backed final outcome after its required lifecycle gates.
