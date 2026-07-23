# MSSR repository instructions

This repository owns the portable MSSR routing contract. Keep it independent of
MauroPrime Bridge and any one host agent.

- MSSR is advisory. Never turn route output into an implicit permission system,
  tool proxy, or allowlist.
- Keep the public contract small: intent, bounded context, phase, completed
  phases, signals, and optional capability needs.
- Tool names and schemas are runtime registry data. Do not hard-code an entire
  tool catalog into agent instructions.
- A provider refresh may update a snapshot automatically; changing durable
  routing semantics, schemas, fixtures, or bootstrap behavior requires tests,
  changelog, and documentation updates.
- Preserve provenance, health, timestamps, and degradation state. An empty or
  stale provider catalog is evidence, not proof that no capability exists.
- Plans must permit re-plan and capability chaining. An agent may discover,
  inspect, and use another authorized tool when work reveals it is needed.
- Do not capture hidden chain-of-thought. Intent and context must be concise,
  user-relevant, and observable.

See `docs/AGENT_PROTOCOL.md` before modifying tags, routing semantics, registry
behavior, or the managed bootstrap template.

