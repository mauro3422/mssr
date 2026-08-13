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
  routing semantics, schemas, fixtures, bootstrap behavior, or project-knowledge
  contracts requires tests, documentation, and a versioned `changelogs/X.Y.Z.md`
  entry referenced from `changelogs/INDEX.md`.
- Every versioned changelog must declare `PROJECT_CONTEXT`, `PROJECT_MEMORY`, and
  `PROJECT_STATE` impact as `updated`, `reviewed-none`, or `pending`. `pending`
  blocks persistence. Hosts may audit this contract but must not auto-write
  project knowledge from telemetry or heuristics.
- Repositories that deliberately use `.bridge/PROJECT_*` authorities should also
  maintain `.bridge/project-context.json` so project context remains selectively
  loadable instead of staying in legacy full-document fallback indefinitely.
- Preserve provenance, health, timestamps, and degradation state. An empty or
  stale provider catalog is evidence, not proof that no capability exists.
- Plans must permit re-plan and capability chaining. An agent may discover,
  inspect, and use another authorized tool when work reveals it is needed.
- Do not capture hidden chain-of-thought. Intent and context must be concise,
  user-relevant, and observable. A host may keep bounded ephemeral per-trace
  working metadata (summary, hypotheses, decisions, evidence, next gate) when it
  helps continuation; it must not contain raw prompts, transcripts, secrets, or
  private chain-of-thought and should be purged or compacted when the outcome closes.
- Keep recommendation, host selection, and procedural context loading observable
  as separate steps. Required skills remain workflow obligations; optional
  candidates should not be materialized in host-gated mode until accepted.

See `docs/AGENT_PROTOCOL.md` before modifying tags, routing semantics, registry
behavior, or the managed bootstrap template.

