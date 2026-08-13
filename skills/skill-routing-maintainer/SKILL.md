---
name: skill-routing-maintainer
description: Mantiene el sistema MauroPrime Structured Skill Router cuando se crea, renombra, elimina, divide, amplía o corrige una skill, cambia una tool relevante o una activación produce resultados inesperados. Actualiza el contrato versionado, agrega casos positivos y negativos, audita dependencias y ejecuta las verificaciones obligatorias sin autoeditar silenciosamente en segundo plano.
---

# Skill Routing Maintainer

Mantén sincronizados catálogo, routing, fixtures, documentación y pruebas.

## Activación obligatoria

Usa esta skill cuando ocurra cualquiera de estos casos:

- se crea, instala, renombra, mueve o elimina una skill;
- cambia de forma material el objetivo, los disparadores, la fase o las dependencias de una skill;
- una skill empieza a mezclar más de un objetivo independiente o supera aproximadamente 500 líneas;
- aparece una tool nueva que modifica qué skill debe activarse;
- `skill_route_plan` selecciona demasiado, demasiado poco o en una fase incorrecta;
- `skill_route_audit` informa drift, referencias faltantes, ciclos o metadata inferida para una skill propia.

## Fuentes canónicas

- Fuente Git de las skills first-party reservadas de MSSR: `D:\Dev\mssr\skills\<name>\SKILL.md`.
- Fuente Git de las demás skills propias: `D:\Dev\mauroprime-skills\skills\<name>\SKILL.md`; no puede declarar un nombre reservado por el manifest first-party.
- Montaje de runtime para Codex: `C:\Users\mauro\.codex\skills\<name>` como junction hacia la fuente Git.
- Código del router y autoregistry: `D:\Dev\mssr\src\`.
- MCP opcional de MSSR: `D:\Dev\mssr\src\mcp-server.ts`.
- Adaptador ChatGPT/Roblox del Bridge: `D:\Dev\bridge-mcp\src\tools\skill-catalog-tools.ts`.
- Contrato versionado: `D:\Dev\mssr\config\skill-routing\skill-routing-overrides.json`.
- Schema: `D:\Dev\mssr\config\skill-routing\skill-routing.schema.json`.
- Fixtures: `D:\Dev\mssr\config\skill-routing\skill-routing-fixtures.json`.
- Documentación: `D:\Dev\mssr\docs\skill-routing\`.
- `SKILL.md` continúa siendo la fuente procedural y único punto de entrada ruteado de cada skill; el JSON sólo define activación y composición.
- `references/`, `scripts/` y `templates/` son módulos internos de esa misma skill. MSSR no los indexa como capacidades independientes.

## Arquitectura modular

Cuando una skill supere aproximadamente 500 líneas, mezcle protocolos largos o cargue detalles que sólo aplican a algunas fases, lee [modular-skill-architecture.md](references/modular-skill-architecture.md).

Mantén un diseño superficial: `SKILL.md` enlaza directamente cada módulo con una condición explícita de carga. No construyas una red recursiva de referencias. Crea otra skill sólo cuando el contenido extraído tenga objetivo, activación, owner y verificación independientes.

## Loop de mantenimiento

1. Ejecuta `skill_route_audit` sobre las fuentes relevantes.
2. Consulta `skill_route_vocabulary` antes de escribir structured intents, metadata o fixtures. Reutiliza exactamente sus `domains`, `actions`, `artifacts`, `needs`, `signals`, `risks`, `stages`, `phases` y `callers`; no inventes etiquetas con nombres de comandos.
3. Clasifica el cambio: metadata, dependencia, workflow, fixture, split de skill, vocabulario o cambio del router.
4. Actualiza el contrato Git-tracked. No mantengas una segunda copia editable en `_dashboard`. Usa `phase` como fase principal y `coversPhases` sólo cuando un procedimiento coherente deba permanecer válido en fases adicionales; no lo uses para mezclar responsabilidades independientes.
5. Trata toda skill propia nueva o renombrada como `routing-unstable` hasta demostrar simultáneamente:
   - metadata MSSR explícita en el contrato versionado;
   - al menos un fixture positivo donde la skill quede activa o diferida en la fase correcta;
   - al menos un fixture negativo cercano donde no quede activa ni diferida sin utilidad; las skills `activation=always` quedan exentas sólo del negativo;
   - una variante de continuación con `context` cuando el trabajo pueda retomarse con respuestas breves como “dale”, “sí”, “mandale”, “seguí”, “de una” o “hacé eso”;
   - un `skill_route_plan` real que reproduzca los resultados esperados.
   `skill_route_audit` debe reportar automáticamente skills propias sin metadata o sin cobertura positiva/negativa; no aceptes como estable una skill que sólo exista en disco.
6. Cuando el cambio parte de un falso positivo, falso negativo o fallo del contrato, registra el incidente en `D:\Dev\mssr\docs\skill-routing\INCIDENTS.md` con síntoma, entrada mínima reproducible, causa, corrección y fixture que evita la regresión. Conserva sólo información observable, no cadena de pensamiento.
7. Cuando cambie la clasificación, mantén sincronizado el vocabulario entre TypeScript, schema MCP, contrato JSON, documentación, bootstrap, `skill_route_vocabulary` y fixtures. Incluye señales de discovery adicional, tool-chain, refresh y replan cuando correspondan. Exige `nominal` para casos limpios y señales no nominales para errores, degradación, incertidumbre, fricción, recuperación o gaps.
8. Ejecuta primero el caso que fallaba y demuestra que realmente falla antes del ajuste cuando sea reproducible; después exige que pase junto con toda la suite.
9. Si cambió una dependencia, verifica que no haya ciclos ni referencias inexistentes.
10. Si una skill coincide por necesidad u operación pero el artefacto real no pertenece a su alcance, usa `requireArtifactMatch` y un negativo cercano. Si coincide por artefacto pero no por la operación solicitada, usa `requireActionMatch`. Usa `requireNeedMatch` para capacidades que sólo son válidas cuando existe una necesidad explícita. Usa `requireSignalMatch` cuando una skill transversal de depuración, recuperación o mantenimiento sólo deba abrirse ante evidencia no nominal; acompaña cada gate con al menos un positivo y un negativo que fallen antes del ajuste.
11. Inspecciona el plan completo de casos cercanos, incluyendo `activeSkills` y `deferredSkills`. Una ruta que no se activa pero contamina tareas ajenas como deferred sigue siendo un falso positivo de composición; estrecha dominios, artifacts, needs o workflow match y agrega `deferredExcludes` cuando corresponda.
12. Si cambia el descubrimiento, prueba por separado `~/.codex/skills`, junctions permitidos y `~/.codex/plugins/cache`. El caché de plugins sólo debe recorrerse dentro de su raíz resuelta y en modo lectura; una raíz completa rechazada debe producir un warning observable.
13. Si la skill creció demasiado, aplica `references/modular-skill-architecture.md`: conserva `SKILL.md` como control plane, extrae módulos cohesivos con triggers de carga y crea otra skill sólo para un objetivo reusable independiente. No dividas por longitud ni cambies routing cuando sólo cambió la organización interna.
14. Si se creó, renombró o movió una skill, ejecuta en `D:\Dev\mauroprime-skills`:

```powershell
.\scripts\install-junctions.ps1
.\scripts\verify-skills.ps1
.\scripts\test-codex-discovery.ps1
```

15. Ejecuta en `D:\Dev\mssr`:

```powershell
npm run verify
```

Usa checks focales antes del gate completo, pero evita repetir build y suite integral varias veces sin un cambio material.

16. Si cambió la integración del Bridge, ejecuta en `D:\Dev\bridge-mcp`:

```powershell
npm run check
npm run build
npm run test:regressions
npm run test:skill-routing
npm run docs:tools:check
```

El `verify:all` vivo pertenece al gate posterior a publicación/restart cuando cambien versión o catálogo.

17. Regenera `TOOLS.md` cuando cambie una tool o su schema.
18. Lee de vuelta los archivos modificados y reporta pruebas, warnings, active/deferred inesperados y rutas.

## Automatización segura

La detección y las pruebas pueden ser automáticas. Las modificaciones del contrato o de una skill deben ocurrir dentro de una tarea visible, con diff, snapshot y verificación. No ejecutes un daemon que reescriba instrucciones basándose sólo en métricas o una coincidencia aislada.

## Criterios de salida

- `skill_route_audit.ok = true`;
- no quedan skills propias activas con metadata inferida sin revisar;
- los fixtures positivos, negativos y de continuidad pasan;
- no existen ciclos ni referencias rotas;
- todas las skills propias tienen junction correcto y son visibles en el prompt de Codex;
- la documentación y el contrato apuntan a rutas Git-tracked;
- el Bridge compila y la suite integral pasa.
