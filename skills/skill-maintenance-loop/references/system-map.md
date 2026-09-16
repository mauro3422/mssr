# Maintenance ownership

Read when a finding's owner is unresolved. Choose one canonical source:

| Finding | Owner |
|---|---|
| Project facts, decisions, state | Project `AGENTS.md`, `.mssr/`, docs/tests |
| MSSR first-party procedure | `D:\Dev\mssr\skills` |
| Other custom procedure | `D:\Dev\mauroprime-skills\skills` |
| Activation/phase/module selection | MSSR `config/skill-routing`, owning manifest, fixtures |
| Portable selector/schema/lifecycle | `D:\Dev\mssr\src` |
| Bridge execution/transport/adapter | `D:\Dev\bridge-mcp\src`, `scripts`, `TOOLS.md` |
| Skill install/discovery incident | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` |
| Live scene/session state | Connected MCP/runtime; verify disk separately |

Runtime junctions under `C:\Users\mauro\.codex\skills`, caches, dashboards and
legacy `.bridge/` project control are not editable authorities. Access in another
product does not prove access here.

Keep facts project-local. Extend an existing skill for reusable procedure, use
scripts/tools for deterministic mechanics and guides for orchestration. Create a
skill only for an independent objective. For state owned elsewhere, use
`capability-gap-recovery` and a bounded handoff.

Freeze evidence, reproduce, change the owner, then test the failure and a nearby
valid case. Update routing/fixtures only when semantics change; regenerate and
verify affected source/runtime/persistence layers. Publish or restart only in
scope, then read back the exact revision. A review may end `reviewed-none`;
this map does not imply a publication chain.
