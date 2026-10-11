---
name: skill-maintenance-loop
description: "Mantiene el loop completo de capacidades de MauroPrime: audita fricción y aprendizajes, identifica la fuente de verdad, corrige o crea skills, routing, fixtures, scripts, tools, guías y documentación, verifica los repositorios y decide cuándo otra aplicación o contexto debe continuar. Úsala al cerrar trabajo especializado y también cuando aparezcan fricción repetida, workaround manual, skill-gap, capability-gap, routing incorrecto, outputs generados stale, lifecycle defectuoso o una regla reutilizable faltante."
---

# Skill Maintenance Loop

Turn observable evidence into the smallest reusable prevention without fitting a
skill to one project, conversation, or artifact.

## Core loop

Freeze evidence; identify the canonical owner; reproduce the smallest case and
a nearby nominal; choose the smallest durable correction; verify source,
runtime, experience, persistence, and transport separately, then read back.
Classify as project-local, skill, routing/fixture, script/tool/guide,
context/handoff, new-skill candidate, or insufficient evidence.

Metrics/telemetry are evidence, never mutation authority; retain no raw prompts,
transcripts, secrets, or private reasoning. Learning stays `observe-only` with
`routingInfluence=false` until dataset, replay/holdout, calibration, shadow,
feature-flag, and rollback gates are independently evidenced for human review.

Scale review to the finding. With no reusable change, record `reviewed-none`
and complete maintenance. Deferred concrete debt goes in the project debt/backlog
with evidence, impact, reason, next gate, and closure condition; suspicion stays
`review-needed`. Do not derail the task. Audits need no proposal, publication,
restart, or new skill; load and verify only the candidate owner's procedure.

## Reference map

Start with [learning review](references/learning-review-promotion.md) to decide
whether any proposal is warranted, or [ownership](references/system-map.md)
when the owner is unresolved. Then load only the indexed owner reference: audit,
routing, provider, fixtures, publication, incidents/handoff, friction, memory,
evolution, learning, architecture, deferred debt, automation, or context
modularization. `context-modules.json` owns every direct path.

## Boundaries and exit

Do not create a skill when its owner only needs a local document, module, test,
script, or correction. Do not promote from frequency alone or make hidden
background changes. Report pattern, evidence, classification, owner, change or
proposal, verification, persistence, dimensions, and remaining limitation. If
none is reusable, report `Sin cambio de skill`.
