# Skill memory modules

Read this module when a reusable skill accumulates related incidents, recovery notes, edge cases, compatibility facts, prompt recipes, verification discoveries, or alternative procedures that are useful only under certain conditions.

The goal is **selective durable memory**, not a diary and not a second routing system.

## Architecture

```text
MSSR routes one capability
        ↓
SKILL.md remains the control plane
        ↓ direct “read when” links
references/MEMORY_INDEX.md
        ↓ selects only relevant modules
references/<named-module>.md
scripts/* or templates/* when deterministic support is needed
```

MSSR indexes and routes only `SKILL.md`. Memory modules do not become independent skills and never grant permissions. A host with selective-context support may assemble modules declared in `context-modules.json` when their stage and structured-intent selectors match; Codex native/manual workflows still follow the owning `SKILL.md` and `MEMORY_INDEX.md` links explicitly. The manifest is a loading contract inside the parent skill, not a second routing graph.

## When a memory module is justified

Create or update a module when at least one condition holds:

- the same failure or workaround occurred twice;
- one high-impact failure has a demonstrated cause and reusable prevention;
- a phase-specific procedure is too detailed for the main skill but remains within its objective;
- a compatibility or lifecycle fact changes how the skill must operate in a bounded situation;
- an incident produced a new verification gate, recovery sequence, prompt contract or evidence schema;
- multiple related notes need one searchable owner and expiration/review policy.

Do not create a module merely because a task completed, a thought might be useful someday, or a project-specific path exists.

## Memory types

Use one primary type per module:

- `invariant`: a rule that must always hold when its trigger applies;
- `incident-pattern`: symptom → cause → correction → regression;
- `recovery`: bounded steps for restoring a failed workflow;
- `compatibility`: provider, runtime, version or platform-specific behavior;
- `decision-record`: chosen trade-off and rejected alternatives;
- `recipe`: reusable prompt, geometry, data or implementation contract;
- `verification`: test matrix, readback gate or evidence rubric;
- `deprecation`: obsolete path, replacement and removal conditions.

Incident ledgers preserve chronology. Memory modules preserve the generalized reusable lesson. Link them; do not copy full incident histories into the skill.

## Index contract

When a skill owns more than two optional memory modules, create `references/MEMORY_INDEX.md`. Each row must be actionable:

```markdown
# Memory index

| Module | Type | Read when | Signals / evidence | Status | Owner | Last reviewed |
|---|---|---|---|---|---|---|
| [runtime-discovery.md](runtime-discovery.md) | incident-pattern | a new or renamed skill exists in source but cannot be loaded | `skill_load: not found`, missing junction | active | skill-maintenance-loop | 2026-07-27 |
```

The index is a navigation surface, not a summary dump. Keep the `Read when` condition specific enough that an agent can decide not to load the module.

## Module header contract

Begin every memory module with a compact metadata block:

```markdown
# Runtime discovery after skill creation

- **Type:** incident-pattern
- **Owner:** skill-maintenance-loop
- **Status:** active
- **Read when:** a skill was created, renamed or moved, or source exists while runtime discovery fails.
- **Signals:** `tool-call-failed`, `missing-capability`, `skill-gap`
- **Evidence threshold:** one demonstrated high-impact lifecycle failure or two repeated misses.
- **Source incidents:** `mauroprime-skills/docs/INCIDENTS.md#...`
- **Last reviewed:** 2026-07-27
- **Review trigger:** junction installer, runtime discovery path or skill repository layout changes.
```

Then record only:

1. observable symptom;
2. cause or `No resuelta`;
3. decision/gate;
4. recovery steps;
5. regression or readback;
6. limits and supersession conditions.

Never store hidden reasoning, full transcripts, secrets, raw user data, temporary IDs without durable value, or claims unsupported by evidence.

## Source precedence and conflict handling

Use this precedence:

1. current system/safety and user request;
2. current project authorities and live evidence;
3. owning `SKILL.md` invariants;
4. active memory module whose trigger matches;
5. historical incident or deprecated module.

A memory module cannot silently override `SKILL.md`. When a module reveals a universally required invariant, summarize that invariant in `SKILL.md` and keep the detailed evidence/recovery in the module.

If two modules conflict:

- prefer the one with the matching environment and newer verified evidence;
- mark the older module `superseded` rather than deleting useful history immediately;
- update the index with the replacement;
- add a regression proving the selected rule.

## Lifecycle

Each module has one status:

- `active`: current and verified;
- `provisional`: cause or generality is not fully established;
- `superseded`: preserved for history but replaced;
- `deprecated`: no longer valid; removal conditions documented;
- `archived`: project/history value only, not loaded during normal work.

Review a module when its provider, tool schema, runtime layout, version boundary, owning skill objective or linked regression changes. Remove or archive modules that no longer influence behavior.

## Creation procedure

1. Freeze the observable incident or repeated friction.
2. Identify the canonical skill owner.
3. Decide whether the lesson belongs in the main skill, a memory module, a script/tool, project docs, MSSR routing or a separate skill.
4. Add or update the chronological incident ledger.
5. Create the smallest named module and index entry.
6. Add a direct `SKILL.md` loading trigger.
7. Add deterministic support when prose cannot enforce the gate.
8. Verify source path, runtime junction, links, discovery and representative behavior.
9. Update changelog and routing only if activation/composition changed.

## Decision boundary: module or new skill

Keep it as a memory module when it cannot produce a useful outcome without the parent skill and should never activate independently.

Create another skill only when the extracted objective:

- has its own activation boundary and success metric;
- applies when the parent skill should not activate;
- composes with several unrelated skills;
- needs independent routing fixtures; and
- can be tested and used on its own.

## Anti-patterns

Do not create:

- `notes.md`, `misc.md`, `ideas.md`, `part-2.md` or date-only filenames;
- an unindexed pile of incident fragments;
- one file per minor tool error;
- references that recursively require several other references to discover a mandatory rule;
- a memory database that bypasses Git review, project context or MSSR;
- auto-written procedural rules from telemetry without a visible task, evidence and verification.
