# Agent protocol

The MSSR protocol is a compact, observable classification—not hidden reasoning.
It makes routing reusable across skills and tools without forcing every request
through a proxy.

## Intent envelope

Before substantial specialized work, an agent may form:

```json
{
  "domains": ["roblox", "skills"],
  "actions": ["diagnose", "change"],
  "artifacts": ["MCP catalog", "AGENTS.md"],
  "needs": ["routing", "verification"],
  "risk": "medium",
  "ambiguity": "low",
  "signals": ["degraded-capability"],
  "capabilityNeeds": ["catalog-discovery"]
}
```

Use a bounded resolved context (normally 500–2000 characters) only for a
continuation or multi-turn plan. It contains the accepted goal, constraints,
current phase, completed work, and unresolved references—not the transcript or
chain-of-thought.

## Phases

Plan one phase at a time: `discover`, `analyze`, `implement`, `verify`,
`persist`, and `close`. Re-plan after a material result, a failure, or a new
capability requirement. A prior plan never locks the agent out of another tool.

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

## When skills change

Creating or materially changing a skill should trigger a routing audit:

1. Declare its domains, actions, artifacts, needs, and phase role.
2. Add durable routing metadata/fixtures when its activation semantics are new.
3. Update registry-visible metadata if its name, source, or availability changes.
4. Run the router tests and document user-visible contract changes.

Do not edit this protocol merely because a new tool appears. Auto-registry
discovers volatile capability names and schemas. Update this document only when
the routing contract itself changes.

