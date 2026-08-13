# Modular skill architecture

Use this module when a skill becomes difficult to load, review, maintain, or apply selectively; when `skill_route_audit` reports excessive length; or when one `SKILL.md` contains large phase-specific protocols, schemas, examples, or scripts.

## Core model

```text
MSSR / catalog
      ↓ indexes and routes
SKILL.md
      ↓ explicitly links by need
references/*.md   scripts/*   templates/*
```

`SKILL.md` is the only routed entry point for that capability. Internal references, scripts, and templates belong to the same skill and do not become independent MSSR nodes merely because they are separate files.

## What remains in SKILL.md

Keep the smallest complete control plane:

- YAML frontmatter and activation boundary;
- purpose and responsibility boundary;
- hard safety/integrity invariants;
- high-level phase workflow;
- direct reference map with one clear “read when” condition per module;
- composition with other skills;
- compact verification and exit criteria.

The entry point must still be usable when no reference is loaded. It should tell the agent what to do next and which module supplies the details.

## What moves to references

Move cohesive, mostly declarative procedures that are only needed in some phases:

- mathematical derivations and camera/geometry contracts;
- failure taxonomies and recovery matrices;
- long evidence schemas and storage layouts;
- platform-specific lifecycle transactions;
- detailed comparison rubrics;
- manifest examples, templates, and extended checklists;
- incident pattern catalogs.

Each reference should own one responsibility and begin with an explicit loading trigger. Prefer descriptive names such as:

```text
references/camera-contract.md
references/recovery-policy.md
references/evidence-schema.md
references/session-lifecycle.md
```

Do not create files named `part-1.md`, `misc.md`, or `extra-notes.md`.

## Indexed memory modules

When references evolve as reusable operational memory—incidents, recovery paths, compatibility notes, recipes or verification discoveries—use the contract in `skill-maintenance-loop/references/skill-memory-modules.md`.

- keep `SKILL.md` as the only routed control plane;
- add `references/MEMORY_INDEX.md` only when more than two optional modules need selective loading;
- give every module a type, owner, `Read when` trigger, status, evidence threshold and review trigger;
- preserve chronology in the owning incident ledger and only the generalized lesson in the module;
- promote universally required rules back into `SKILL.md`;
- do not route references as independent MSSR nodes.

This is a modular documentation pattern, not an implicit vector memory or automatic background learner.

## Linking topology

Prefer a shallow hub-and-spoke topology:

```text
SKILL.md
├── reference A
├── reference B
├── reference C
└── script/template
```

Rules:

1. Link every module directly from `SKILL.md` with a condition such as “Read when diagnosing transport failures.”
2. Do not require recursive discovery to find mandatory procedure.
3. References may link to one another only for an optional detail, never as the sole path to a required invariant.
4. Avoid circular links and chains deeper than one optional hop.
5. Do not duplicate the same rule across modules. Keep one owner and summarize the invariant in `SKILL.md` when it is globally important.
6. Relative links must resolve inside the skill directory and survive the Codex junction.

References are never routed as independent skills. In hosts without selective-context support, the agent loads them because the routed `SKILL.md` says they are needed. In a compatible Bridge bootstrap, `context-modules.json` may deterministically select the exact internal references or `SKILL.md` sections whose stage and intent filters match.

## Selective context manifest

Add `context-modules.json` beside `SKILL.md` only when automatic selective assembly materially reduces context or makes phase-specific references reliable.

```json
{
  "schemaVersion": 1,
  "core": { "sections": ["## Purpose", "## Safety invariants"] },
  "modules": [
    {
      "id": "runtime-recovery",
      "description": "Recovery steps for a degraded provider.",
      "source": { "path": "references/runtime-recovery.md" },
      "stages": ["start", "verify"],
      "signals": ["degraded-capability", "recovery-needed"],
      "priority": 20
    }
  ]
}
```

Contract:

- `core` is always materialized when the parent skill is active; keep it complete enough to govern the skill safely.
- A source uses exactly one of `path` or `sections`.
- `path` stays inside the skill directory; `sections` must name unique exact Markdown headings in `SKILL.md`.
- A non-required module needs at least one selector. Every selector dimension it declares must match the structured intent.
- `required=true` means required inside the already-routed parent skill; it does not independently activate that skill or grant authority, and it cannot be combined with `exclusiveGroup`.
- Use `exclusiveGroup` only for true alternatives. One unique highest score wins; a tie loads none and returns candidates instead of injecting both.
- Modules are indivisible under the budget. Omit and report `budget-exceeded`; never truncate a recovery rule silently. If an optional skill core cannot fit the remaining global budget, omit the whole optional context; only required skill context may overflow with explicit evidence.
- Keep manual `Read when` links in `SKILL.md` or `MEMORY_INDEX.md` for Codex/native hosts and human review.
- Validate manifests through `mauroprime-skills/scripts/validate-context-modules.py` and the MSSR schema/fixtures.


## Scripts and templates

Use `scripts/` when deterministic execution is safer than prose. A script must expose inputs, outputs, side effects, verification, and rollback expectations in `SKILL.md` or its owning reference.

Use `templates/` or a reference code block for reusable data shapes. Do not hide executable behavior inside documentation examples.

## When to create another skill instead

Split into a separate skill only when the extracted capability has an independent reusable objective and at least one of these properties:

- it should activate for tasks where the parent skill must not activate;
- it has a different primary owner or outcome metric;
- it belongs to another workflow phase or domain;
- it composes with several unrelated parent skills;
- it needs its own positive, negative, and continuation routing fixtures;
- it can be applied and verified independently.

Do not create a second skill merely because a document is long. Internal modules reduce context cost without expanding the routing graph.

## Refactor procedure

1. Read the entire current skill and inventory every heading, invariant, failure class, and exit gate.
2. Group content by responsibility and phase, not by equal line counts.
3. Freeze a topic-coverage checklist before moving text.
4. Create references first and preserve all authoritative rules in one owner.
5. Rewrite `SKILL.md` as a compact control plane with direct links and hard invariants.
6. Validate every relative link and compare the topic checklist against the new structure.
7. Measure line/byte reduction, but treat coverage and usability as the success gate.
8. Load the skill through the real runtime junction and verify that the entry point exposes the reference map.
9. Run skill frontmatter/discovery checks and MSSR route audit.
10. Update routing metadata/fixtures only when activation, phase, dependencies, or independent capability boundaries changed.

## Review checklist

```text
SKILL.md remains the only routed entry point:
Activation boundary preserved:
Global invariants visible without references:
Each reference has one responsibility:
Each reference has a “read when” trigger:
All mandatory modules linked directly:
No circular/recursive dependency required:
Relative links resolve through source and runtime junction:
No project-specific facts leaked into global procedure:
No independent capability hidden as a reference:
Routing contract unchanged or deliberately updated:
Frontmatter, discovery, audit and representative route pass:
```
