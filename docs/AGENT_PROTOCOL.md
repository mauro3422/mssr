# Agent protocol

The MSSR protocol is a compact, observable classification—not hidden reasoning.
It makes routing reusable across skills and tools without forcing every request
through a proxy.

## Intent envelope

Before substantial specialized work, the host must form a compact intent using
the canonical vocabulary, for example:

```json
{
  "domains": ["roblox", "skill-system"],
  "actions": ["analyze", "edit", "verify"],
  "artifacts": ["mcp", "document"],
  "needs": ["integrity-verification", "cross-agent"],
  "signals": ["degraded-capability", "replan-needed"],
  "risk": "write",
  "ambiguity": "low",
  "capabilityNeeds": ["inspect the live provider catalog"]
}
```

Use a bounded resolved context (normally 500–2000 characters) only for a
continuation or multi-turn plan. It contains the accepted goal, constraints,
current phase, completed work, and unresolved references—not the transcript or
chain-of-thought.

## Project context and context budget

MSSR keeps procedural guidance and project state in separate layers:

- reusable cross-project procedure belongs in a skill;
- project-specific architecture, vocabulary, paths, decisions, current state,
  and open blockers belong in the repository's durable context and docs;
- the host loads only the project material needed to resolve the current intent,
  then asks MSSR for the smallest phase-scoped skill set.

A new project does not require a new skill by default. Create or generalize a
skill only when the lesson has an independent reusable objective across projects.
This separation is the main context-pressure control: durable project facts stay
available without placing every skill or historical transcript in the prompt.

The host is responsible for the activation hook. Before substantial specialized
work it must load the relevant project context, produce the compact intent, and
call `skill_route_plan` or `skill_bootstrap`. A `trace-contract-v1` adapter then
keeps one active trace per MCP session and propagates it through direct and
delegated skill loads, compatible domain tools, replans, verification,
persistence, and outcome; explicit IDs are reserved for cross-session resume.
MSSR cannot activate itself in a host that never calls it.

## Routing evidence checkpoint and notices

The host's first observable action after deliberating about substantial specialized work is a compact Routing Evidence Checkpoint. It contains operational conclusions suitable for MSSR—not private reasoning. This boundary is sometimes described as the second tick: the model interprets the request, emits structured routing metadata, receives the route, and then reasons again with the selected capabilities.

Runtime or project evidence may arrive later through bounded notices attached to tool results or a drainable inbox. Errors, active agents, owned files, pending captures/reviews, stale project context, missing routing, required skills not loaded, and unusual metrics can trigger a context request or replan. Notices never authorize mutations.

See `ROUTING_EVIDENCE_OBSERVATORY.md` for the full contract.

## Stages and phases

The host passes one execution `stage`: `start`, `implement`, `verify`, `persist`,
`close`, or `resume`. MSSR maps it into workflow phases such as `discovery`,
`safety`, `implementation`, `verification`, `persistence`, and `maintenance`.
Load only the active returned phase. Re-plan when the stage advances, after a
material result or failure, or when a new capability becomes necessary. A prior
plan never locks the agent out of another authorized tool.

## Signals and capability chaining

Signals are observable process state. Common values are:

- `error-observed`, `warning-observed`, `uncertainty`, `conflicting-evidence`
- `degraded-capability`, `missing-capability`, `recovery-needed`
- `repeated-friction`, `manual-workaround`, `skill-gap`, `reusable-pattern`
- `capability-discovery-needed`, `additional-capability-needed`
- `tool-chain-needed`, `provider-refresh-needed`, `replan-needed`

When a selected skill/tool reveals another need, record the signal and a short
`capabilityNeeds` description, refresh or inspect the registry if necessary,
then re-plan. The host retains normal authority to use any available authorized
tool; MSSR is not an allowlist.

Non-nominal evidence signals combined with `debug`, `analyze`, `review`, `test`,
`verify`, or `recover` should compose `systematic-debugging` with the narrowest
relevant domain skill. Capability, provider, skill, routing, permission,
verification, or context gaps should additionally compose
`capability-gap-recovery`. Both routes are gated by matching signals so ordinary
nominal implementation and review remain outside the debugging/recovery branch.

## Friction and learning loop

Friction is observable control metadata, not permission to rewrite the system.
A host should checkpoint bounded facts when a tool fails, a workaround repeats,
a required skill was not loaded, a route changes materially, or verification and
persistence disagree. The checkpoint should identify the route/phase, signals,
selected and loaded skills, result, and a short redacted summary—never the raw
prompt or transcript.

Promotion follows an evidence ladder:

1. one isolated event remains telemetry or project-local documentation;
2. a reproduced project defect becomes a focused regression and project fix;
3. a repeated cross-project procedural gap updates the owning skill;
4. an activation, dependency, phase, or signal defect updates MSSR metadata and
   positive, negative, and continuation fixtures;
5. only an independently reusable objective justifies a new skill.

Frequency alone must not change routing. Historical evidence proposes maintenance;
a visible task with snapshot, diff, tests, and review applies the change.

## Outcome attribution

Close each substantial routed trace with one latest effective outcome. Exactly one `primarySkill` owns the result; `supportingSkills` record collaboration without duplicating success. Prefer manifests, tests, runtime readback, or explicit review over self-scoring. Reuse the trace for retries and final review so the latest outcome replaces preliminary evidence in metrics.

Track activation, required-load compliance, verification, persistence, outcome success, and artifact acceptance separately. No single percentage represents all of MSSR quality.

## When skills change

Creating or materially changing a skill should trigger a routing audit:

1. Declare its domains, actions, artifacts, needs, and phase role.
2. Add durable routing metadata/fixtures when its activation semantics are new.
3. Update registry-visible metadata if its name, source, or availability changes.
4. Run the router tests and document user-visible contract changes.

Do not edit this protocol merely because a new tool appears. Auto-registry
discovers volatile capability names and schemas. Update this document only when
the routing contract itself changes.
