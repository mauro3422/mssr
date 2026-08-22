---
name: shared-skill-governance
description: Govern the shared skill system used by Codex, MauroPrime Bridge, ChatGPT, and connected MCPs. Use when creating, updating, generalizing, reviewing, discovering, or coordinating reusable skills and when deciding whether knowledge belongs in a global skill or project documentation.
---

# Shared Skill Governance

Keep reusable procedure, project knowledge, runtime mounts, and routing metadata
owned by their canonical source.

## Core rules

First-party MSSR skills live in `D:\Dev\mssr\skills`; other Mauro skills live
in `D:\Dev\mauroprime-skills\skills`; runtime mounts under
`C:\Users\mauro\.codex\skills` are junctions, never editable copies. Resolve
an alias before mutation. Do not copy system/plugin-cache or live `rbx-*` skills.

Project-specific facts, architecture, and state stay in that project's
`AGENTS.md`, `.mssr/` authorities, docs, and tests. Create or generalize a
global skill only for an independent cross-project procedure. A routed
`SKILL.md` remains the single entry point; references and scripts remain its
internal modules.

MSSR is deterministic after the caller provides compact intent. The route is
advisory and does not grant permissions. Keep durable activation metadata only
in the versioned routing contract; generated dashboards are not a second source
of truth.

## Reference map

- Read [activation across hosts](references/activation-across-hosts.md) when
  integrating Codex, ChatGPT Web, Bridge, or caller profiles.
- Read [safe skill updates](references/safe-skill-updates.md) before creating,
  moving, generalizing, or materially changing a shared skill.

## Exit

Preserve frontmatter and explicit ownership. Validate source, junction/discovery,
representative positive and nearby negative routing, and any affected repository
contract. Reconcile conflicts in priority order: safety/user instruction,
project authority, loaded skill, defaults.
