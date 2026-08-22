# Skill runtime and routing friction

Read when a skill is created or edited but runtime discovery, junction installation or structured composition fails.

## Routing and skills

### Source skill exists but runtime junction was not installed

Creating a skill in its Git source does not by itself make it discoverable by Codex. Reserved MSSR names live under `D:\Dev\mssr\skills`; non-reserved custom names live under `D:\Dev\mauroprime-skills\skills`. The runtime catalog reads `C:\Users\mauro\.codex\skills\<name>`, which must be a junction to the one owning Git source.

Observable pattern:

```text
source SKILL.md exists
skill_load -> "Codex skill not found"
install-junctions.ps1 creates the missing junction
skill_load succeeds without changing SKILL.md
```

Gate:

1. after creating, renaming or moving a skill, run `scripts\install-junctions.ps1` before the first runtime load;
2. verify the runtime path resolves to the exact Git source rather than an independent copy;
3. run `verify-skills.ps1` and the real Codex discovery test;
4. only then diagnose routing, cache or frontmatter when the skill remains missing;
5. record source creation, runtime installation and MSSR stabilization as separate lifecycle states.

File existence is source evidence, not runtime discovery evidence.

### Skill exists but does not compose in a domain

A transversal skill can contain correct prose yet fail routing because domains, artifacts, needs or gates exclude the real intent. Always test `skill_route_plan` with a structured real-world case, not only catalog discovery.

### Positive route without a nearby nominal negative

Broad domain lists can fix a false negative and create silent overactivation. Require an anomaly signal/action gate and a nominal negative fixture before calling the route stable.

### Capability exists but current product cannot use it

Distinguish installation from context availability. A plugin may be installed for Codex but not loaded in ChatGPT; a local file may exist but not be connected; a live application may be reachable only through its MCP. Use `capability-gap-recovery` and produce a context handoff instead of pretending access.
