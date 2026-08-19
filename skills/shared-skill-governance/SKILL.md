---
name: shared-skill-governance
description: Govern the shared skill system used by Codex, MauroPrime Bridge, ChatGPT, and connected MCPs. Use when creating, updating, generalizing, reviewing, discovering, or coordinating reusable skills and when deciding whether knowledge belongs in a global skill or project documentation.
---

# Shared Skill Governance

## Canonical repositories

- `D:\Dev\mssr\skills` is the Git source of truth for the reserved first-party MSSR skills shipped by `@mauroprime/mssr`.
- `D:\Dev\mauroprime-skills\skills` remains the Git source of truth for Mauro's non-reserved custom reusable skills. A custom skill must never reuse a name reserved by the MSSR first-party manifest.
- `C:\Users\mauro\.codex\skills\<name>` is the runtime mount expected by Codex and must be a directory junction to the matching Git source. Install reserved MSSR skills with the MSSR first-party installer; install non-reserved custom skills with `D:\Dev\mauroprime-skills\scripts\install-junctions.ps1`. Edits through either junction affect the single owning source.
- A compatibility alias such as `C:\Dev\mauroprime-skills` may itself be a junction to the real Git root. Before mutating through Bridge, resolve the runtime junction and `git rev-parse --show-toplevel`; if an alias is outside allowed roots, use the resolved Git root or the verified runtime junction. Never create a copied mirror just to bypass a root policy.
- MauroPrime Bridge discovers the runtime tree live on each catalog, recommendation, route, bootstrap, or load request and follows allowed junctions. Never maintain copied mirrors.
- Project-specific facts, architecture and current state belong in the project repository (`AGENTS.md`, canonical `.mssr/` project authorities/knowledge modules, docs, tests), not in a global skill. Managed MSSR project knowledge is canonical-only under `.mssr/`; active MSSR artifacts under `.bridge/` are initialization/cleanup debt, never fallback authority.
- A workflow that applies across projects should be generalized and stored as a global skill.
- Roblox-authored `rbx-*` skills remain inside the live `Roblox_Studio` MCP and must not be copied locally.

## Activation model

### Semantic classification stage

The agent that receives the user message produces the compact intent object during its normal turn. MSSR does not call a hidden classifier model: after the intent exists, independent MSSR applies deterministic TypeScript routing. Bridge may expose it as an adapter. If the caller omits intent, MSSR uses a marked lexical/regex fallback.

Always include `signals` alongside domains, actions, artifacts, needs, risk, and ambiguity. Emit `nominal` only when no anomaly exists. Otherwise omit `nominal` and declare observable incident, friction, recovery, capability discovery, additional capability, tool-chain, provider-refresh or replan state. These signals may route discovery, recovery, verification, maintenance, or skill creation, but never grant mutation authority.

Use `mssr-agent-routing` as the transversal protocol. The initial route is advisory rather than an allowlist: when runtime evidence requires another capability, search or refresh providers, inspect the candidate, re-plan and continue through normally authorized tools. Use `systematic-debugging` for any non-nominal anomaly that requires causal investigation, regardless of domain. Use `capability-gap-recovery` when the missing piece is a skill, tool, provider, permission, verification path or product context.

`AGENTS.md`, this skill, and the MCP tool descriptions make the classification step mandatory before substantial specialized work; the intent is not pre-injected into the original user message. Treat the classification as reusable control metadata: it may select skills, tools, phases, tests, approvals, or safe triggers. Never let a semantic tag alone execute destructive or external side effects; those still require the normal authorization and tool safety boundary.

### Codex

Codex has native skill discovery. Global `AGENTS.md` rules require it to inspect relevant local skills and the live Roblox MCP skill catalog before substantial specialized work.

### ChatGPT through MauroPrime Bridge

ChatGPT does not natively watch the local skill directory. Before substantial specialized work, it must:

1. Infer a compact semantic result from the request: domains, actions, artifacts, needs, risk and ambiguity. This object is an outcome classification, not private chain-of-thought.
2. Call `skill_route_plan` or `skill_bootstrap` with that structured intent and at least one semantic signal.
3. Load only the skills assigned to the current phase.
4. Re-plan with `stage=verify`, `stage=persist`, or `stage=close` and the completed phase list as work progresses.

The router rescans the Codex runtime tree, resolves junctions back to the Git source, deduplicates managed plugin copies by precedence, applies the live routing schema, resolves dependencies/exclusions and checks workflow coverage. Lexical matching is only a marked fallback when structured intent is unavailable.

This is an explicit bootstrap hook, not a background filesystem watcher. New or edited skills and routing metadata become visible on the next route/catalog/bootstrap call without restarting the Bridge.

### Caller profile

Pass `caller=codex-local` or `caller=chatgpt-web` when known. Codex local should prefer its direct filesystem and terminal for ordinary local work, while ChatGPT web normally reaches MauroPrime through the Bridge. In either client, use the Bridge when it adds shared routing, snapshots, recovery, persistent terminals, verified Roblox place saves, or cross-client coordination.

Use `skill_route_plan` when only a compact decision is needed. Use `skill_bootstrap` only when the current phase actually needs full skill contents; loaded `SKILL.md` text is a larger context cost than the intent classification itself.

## Routing contract

The durable machine-readable contract is versioned with independent MSSR, while the dashboard remains generated output:

- `D:\Dev\mssr\config\skill-routing\skill-routing.schema.json` defines valid metadata and workflow phases.
- `D:\Dev\mssr\config\skill-routing\skill-routing-overrides.json` assigns phases, intents, signals, dependencies, exclusions and composed workflows and is versioned with Git.
- `_dashboard/skills-registry.json` is generated for audit/dashboard use and must not become a second editable source of truth.

Keep detailed procedures inside each `SKILL.md`; keep only routing metadata in the routing contract.

## Updating skills

Codex and ChatGPT may both improve shared skills when repeated project evidence reveals a reusable improvement.

Before editing:

1. Read the current skill completely.
2. Check whether an existing skill already covers the behavior.
3. Separate reusable procedure from project-specific details.
4. Avoid concurrent edits by two agents to the same skill.

After editing:

1. Preserve valid YAML frontmatter and a clear activation description.
2. Keep instructions tool-agnostic where possible; name tools only where capability or safety requires it.
3. Keep a new or renamed owned skill in `routing-unstable` state until `skill_route_audit` confirms explicit metadata plus positive and nearby negative fixture coverage; add a context continuation fixture when the workflow is resumable.
4. Run a live skill catalog/bootstrap query to confirm discovery and a real route plan to confirm activation.
5. Test the skill on a representative task and a nearby task where it must not activate.
6. Record durable project-specific consequences in the affected project documentation.

## Generalization rule

Prefer generic capabilities such as `roblox-connection-network-authoring` over project names such as `mycelium-connection-authoring`. The project may reference the generic skill and document its own domain vocabulary, constraints and implementation paths.

## Conflict handling

Priority is:

1. system and safety instructions;
2. current user request;
3. project `AGENTS.md` and durable project documentation;
4. loaded skills;
5. general defaults.

When two skills overlap, load the narrower domain skill plus the general safety/testing skill, and state which one governs each part of the work.
