# MauroPrime capability-system map

Use this map before deciding where a maintenance change belongs.

## Sources of truth

| Layer | Canonical location | Owns | Never treat as canonical |
|---|---|---|---|
| MSSR first-party procedures | `D:\Dev\mssr\skills\<name>\SKILL.md` | Reserved MSSR skill instructions, references, scripts, agent metadata | External editable shadow, runtime copy, plugin cache |
| Custom reusable procedures | `D:\Dev\mauroprime-skills\skills\<name>\SKILL.md` | Non-reserved skill instructions, references, scripts, agent metadata | Copied prompt text, reserved MSSR name, generated dashboard |
| Skill lifecycle incidents | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | Chronology of source/install/discovery/procedure failures | Generalized procedure duplicated from skill modules |
| Runtime skill mounts | `C:\Users\mauro\.codex\skills\<name>` junctions | Discovery path only | Independent copied directories |
| Routing contract | `D:\Dev\mssr\config\skill-routing\` | Domains, actions, artifacts, needs, signals, phases, dependencies, workflows, fixtures | `_dashboard` output |
| Routing implementation | `D:\Dev\mssr\src\` | Deterministic planning, provider registry, audit, schemas | Bridge-specific shortcuts |
| Bridge adapter and tools | `D:\Dev\bridge-mcp\src\`, `scripts\`, `TOOLS.md` | Local access, tool schemas, risk classification, provider adapters, restart lifecycle | Stale live process or generated docs alone |
| Project-local state | Project `AGENTS.md`, `.bridge`, docs, tests, evidence | Exact paths, architecture, current decisions, accepted artifacts | Global skill prose |
| Live application state | Connected MCP/runtime | Open scene, active session, in-memory state, current tool catalog | Source files or cached catalog alone |
| Product context | ChatGPT, Codex, Roblox Studio, Blender, browser, connectors | Available authority, UI and direct state | Assumed access based on another product |

## Ownership decision

1. Exact fact about one repository or artifact → project documentation.
2. Reusable procedure within an existing objective → update the owning skill.
3. Incorrect selection, phase or composition → MSSR metadata and fixtures.
4. Missing execution primitive → script, adapter or tool with tests and risk classification.
5. Repeated multi-step orchestration → workflow guide.
6. Independent reusable objective → new skill.
7. State or authority only available elsewhere → context handoff through `capability-gap-recovery`.

## Required maintenance order

```text
Observe friction
→ freeze evidence
→ identify owner
→ reproduce the failure or bad route
→ apply smallest durable change
→ verify source/runtime/user-facing/persistence layers
→ update routing and fixtures when semantics changed
→ regenerate generated outputs
→ run cross-repository checks
→ commit and push each canonical repository
→ restart live services only after source verification
→ verify the live version/catalog
```

## Context choices

- **Codex:** direct local repository, terminal, build, refactor and test work.
- **ChatGPT + MauroPrime Bridge:** shared routing, cross-client coordination, connected apps, verified local operations and resumable handoff.
- **Roblox Studio MCP:** live DataModel, Edit/Server/Client state, Play tests and exact place persistence.
- **Blender bridge:** live scene, object state, viewport captures and batch scripts.
- **Browser/web:** current external documentation, releases, services and public sources.
- **Connected app:** private account data only when the relevant connector is installed and authorized.

A context switch is a technical decision, not a failure. Name the missing authority and preserve a bounded handoff packet.
