# v0.2.0 — 2026-09-23

## Resumen

Segunda versión estable del prototipo. El runtime de agua deja de concentrar intake, control, física, suelo e impactos en `elements/water/water.gd`; se incorporan tunings editables, un pipeline estructurado de impactos, el walk v16 verificado y herramientas/referencias reproducibles para revisión artística.

## Git

Commits funcionales principales:

- `74aac39` — `feat: modularize water runtime and impact pipeline`
- `f2bd01a` — `feat: preserve walk v16 and control continuity`
- `26832bf` — `chore: add motion review references and tooling`
- El commit de release/documentación que contiene este archivo queda incluido por el tag `v0.2.0`.

Ramas de preservación relacionadas, pero **fuera de esta release**:

- `backup/pre-normalization-2026-09-23` / `bf5c117`: snapshot Git del working tree mixto antes de normalizar `main`.
- `wip/astra-run-2026-09-23` / `c4ba1f9`: experimento incompleto de integración de carrera para continuar con Astra.

## Añadido

- `elements/water/water_intake.gd`: preparación, selección de fuente, batches y estado de entrada.
- `elements/water/water_control.gd`: RMB/LMB, release, anticipación, cooldown y emisión de disparo.
- `elements/water/water_physics.gd`: gravedad y colisión ray-swept por segmento.
- `elements/water/ground_water.gd`: ownership de agua depositada y presentación de charcos.
- Tunings editables para intake, control, lanzamiento y física bajo `config/`.
- `elements/water/water_impact_event.gd`, `impact_system.gd`, `impact_receiver.gd` e `impact_splash.gd` como base de impactos reutilizables.
- Smoke aislado de impacto para distinguir maniquí y pared.
- Referencias seleccionadas bajo `reference/motion/` y tooling de captura/auditoría bajo `tools/`.
- Documentación de referencias, pipeline de animación, auditoría de movimiento y handoff de Astra.

## Cambiado

- `elements/water/water.gd` queda como orquestador del loop finito y conserva deliberadamente la curva artística del feeder.
- La órbita/suelo/control/física ya no mantienen estados paralelos dentro del orquestador.
- El maniquí de arena es un receptor reutilizable de impactos y la pared queda etiquetada como superficie de impacto.
- El final corto de `gather` entrega el upper body al loop `control`, evitando congelar la pose mientras todavía entra agua.
- Asset canónico actualizado al walk v16, con revisión de apoyo/despegue documentada.
- `assets/review/` queda explícitamente fuera de Git porque contiene derivados/candidatos descartables.

## Verificación

Estado estable de `main` al preparar la release:

- QA principal: **34/34 PASS** en 900 frames.
- Agua total: **12.0 unidades** conservadas.
- Secuencia: **1 lanzamiento** y **12 impactos de pared**.
- Milestones semánticos preservados: `30 → 41 → 156 → 258 → 289 → 420 → 461 → 611`.
- `--impact-smoke`: **10/10 PASS** para routing maniquí/pared, receiver y splash técnico.
- `--camera-wall-smoke`: **4/4 PASS**.
- Runtime normal: arranque con los ocho clips canónicos (`cast`, `control`, `gather`, `idle`, `release`, `stance`, `turn`, `walk`) y stderr vacío.
- Evidencia gráfica local representativa: `evidence/run_1790211066_329/`.

## Exclusiones deliberadas

El experimento de carrera de Astra **no pertenece a v0.2.0**. En el estado mixto previo, `character.gd` exigía un noveno clip `run` mientras el GLB canónico seguía exponiendo ocho clips; ese checkout fallaba al arrancar con `Missing imported animation`. El experimento quedó preservado en `wip/astra-run-2026-09-23` para continuarlo sin convertirlo en estado estable.

`assets/review/` tampoco forma parte de la release; conserva localmente candidatos de walk/run/retarget para revisión.

## Limitaciones conocidas

- Todavía no existe sistema final de vida/daño/stagger sobre los receivers de impacto.
- El splash es una respuesta técnica provisional, no VFX final.
- Los charcos son funcionales pero visualmente provisionales.
- La carrera de combate y la transición run → plant siguen abiertas para Astra.
- `evidence/` es grande, local e ignorado por Git; se mantiene por decisión del proyecto.
