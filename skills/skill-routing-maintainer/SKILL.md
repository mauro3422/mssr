---
name: skill-routing-maintainer
description: Mantiene el sistema MauroPrime Structured Skill Router cuando se crea, renombra, elimina, divide, amplía o corrige una skill, cambia una tool relevante o una activación produce resultados inesperados. Actualiza el contrato versionado, agrega casos positivos y negativos, audita dependencias y ejecuta las verificaciones obligatorias sin autoeditar silenciosamente en segundo plano.
---

# Skill Routing Maintainer

Synchronize catalog, routing, fixtures, documentation, and tests when a skill's
activation or modular structure changes.

## Core protocol

Use this skill for creation, rename/move/removal, material objective/trigger/
phase/dependency changes, structural-health debt, relevant tool changes, or
routing drift. `SKILL.md` remains the only routed entry point; its references,
scripts, and templates are internal modules, not independent capabilities.

The canonical first-party source is `D:\Dev\mssr\skills`; other own skills use
`D:\Dev\mauroprime-skills\skills`; runtime mounts are junctions. Routing
metadata, schema, fixtures, and docs live in the Git-tracked MSSR contract.
Dashboards are generated output. Query the routing vocabulary before writing any
structured intent, contract value, or fixture.

Keep the control plane shallow: activation boundary, purpose, hard invariants,
phase workflow, direct `Read when` map, composition, and verification remain in
the root. Move situational procedures to references with selectors. Do not split
solely by length or alter activation semantics for an organizational refactor.

## Reference map

- Read [modular skill architecture](references/modular-skill-architecture.md)
  for structural-health pressure, extraction, and manifest design.
- Read [routing contract maintenance](references/routing-contract-maintenance.md)
  for metadata, fixture, catalog, audit, discovery, and verification procedure.

## Exit

Read back every modified file. Require clean audit, explicit owned metadata,
positive/negative/continuation coverage where applicable, no cycles or broken
references, correct junction visibility, and the relevant routing/package tests.
Automation may detect and test; it must not silently rewrite skills or routing.
