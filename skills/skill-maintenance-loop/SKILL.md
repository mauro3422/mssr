---
name: skill-maintenance-loop
description: "Mantiene el loop completo de capacidades de MauroPrime: audita fricción y aprendizajes, identifica la fuente de verdad, corrige o crea skills, routing, fixtures, scripts, tools, guías y documentación, verifica los repositorios y decide cuándo otra aplicación o contexto debe continuar. Úsala al cerrar trabajo especializado y también cuando aparezcan fricción repetida, workaround manual, skill-gap, capability-gap, routing incorrecto, outputs generados stale, lifecycle defectuoso o una regla reutilizable faltante."
---

# Skill Maintenance Loop

Convierte evidencia real en prevención reutilizable sin sobreajustar una skill a un proyecto, una conversación o un artefacto.

## Mapa y recursos

Antes de editar, resuelve sólo el módulo necesario:

- `references/maintenance-*.md`: procedimientos selectivos para auditoría, routing, provider refresh, fixtures, publicación, incidentes y handoff.
- `references/MEMORY_INDEX.md`: índice de memorias internas y sus triggers.
- `references/system-map.md`: fuentes canónicas y ownership entre proyectos, skills, MSSR y Bridge.
- `references/friction-patterns.md`: patrones ya generalizados.
- `references/skill-memory-modules.md`: contrato para memorias internas selectivas.
- `references/capability-evolution-proposals.md`: criterio entre documentación, owner update, módulo, script/tool/guide, nueva skill o cambio de contexto.
- `references/learning-review-promotion.md`: etapa durable `digest -> learning-review -> promotion proposal`, sus gates de evidencia y el límite de promoción humana.
- `references/architecture-documentation-consistency.md`: reconciliación acotada entre arquitectura, ADRs, contexto/estado, changelogs e incidentes antes de persistir una propuesta.

En hosts con ensamblado selectivo, `context-modules.json` carga sólo el núcleo y los módulos cuyo trigger coincide. Los enlaces siguen siendo el fallback para Codex y revisión humana.

Usa también `capability-gap-recovery` cuando falte una herramienta, provider, permiso, skill, producto o vía de verificación. Usa `systematic-debugging` mientras la causa no esté demostrada. Usa `skill-routing-maintainer` sólo cuando cambie activación, fase, dependencia, exclusión o composición.

## Loop adaptativo

1. Congela evidencia observable y clasifica la capa: proyecto, skill, routing, tool, provider, lifecycle, output generado, Git o límite de producto/contexto.
2. Identifica la fuente canónica antes de tocar runtime mounts, caches o artefactos generados.
3. Reproduce el caso mínimo y conserva un caso nominal cercano.
4. Elige la corrección durable más pequeña:
   - documentación local;
   - mejora de la skill propietaria;
   - routing/fixture;
   - script, test, tool o workflow guide;
   - memoria interna selectiva;
   - nueva skill con objetivo independiente;
   - handoff a un contexto con la autoridad necesaria.
5. Verifica por separado fuente, runtime, experiencia real, persistencia y transporte.
6. Regenera outputs afectados y elimina sólo temporales confirmados, nunca evidencia durable útil.
7. Cierra con Git, readback y restart vivo cuando la publicación cambie un runtime o schema.

Cuando el digest tenga `findings=0` o fricción observable, carga `references/learning-review-promotion.md`. Siempre produce una decisión explícita basada en evidencia o en su insuficiencia; no convierte silencio, métricas aisladas ni campos ausentes en una confirmación. La secuencia permanece `observe-only` y con `routingInfluence=false` hasta que el dataset audit, replay/holdout, calibración, shadow y feature flag/rollback tengan evidencia referenciada. Aun con todos los gates, sólo se puede emitir una propuesta candidata a revisión humana: nunca se autoedita una skill, routing o fuente ni se promociona silenciosamente.

No crees una skill nueva cuando basta corregir la propietaria. No fuerces el contexto actual cuando continuar exigiría adivinar estado que vive en otra aplicación.

## Auditoría obligatoria

Al cerrar una iteración guiada por skills identifica:

- qué error debió prevenirse;
- qué verificación nueva apareció;
- qué workaround manual se repitió;
- qué capacidad, evidencia o herramienta faltó;
- qué regla merece convertirse en contrato.

Clasifica cada hallazgo como `Local`, `Mejora de skill`, `Routing/fixture`, `Script/tool/guide`, `Contexto/handoff`, `Nueva skill candidata` o `Evidencia insuficiente`.

Las decisiones opcionales no se presumen. Si el host declara que tiene evidencia para una decisión opcional, exige un `reasonCode` explícito y preserva sus referencias; sin ese código, el resultado queda bloqueado como insuficiente. Si no hay evidencia o no se conoce su disponibilidad, registra exactamente `no disponible` o `desconocida` y no inventa una razón ni un negativo.

Exige evidencia antes de generalizar: dos apariciones, una corrección repetida o un fallo único de alto impacto con causa clara. Revisa el catálogo completo para encontrar el owner existente. Conserva señales observables como `repeated-friction`, `manual-workaround`, `missing-capability`, `skill-gap`, `provider-refresh-needed` o `reusable-pattern`.

Para una auditoría read-only carga `references/maintenance-audit.md`. Las métricas proponen dónde mirar; nunca autorizan mutaciones o deprecaciones por sí solas.

## Evidencia y ownership

- Tools del Bridge: consulta `bridge_tool_audit`; distingue caller contract, safety guard, falta de evidencia y fallo de implementación.
- Routing: consulta `skill_route_audit`, planes reales y fixtures; un provider degradado no prueba que el routing ajeno esté roto.
- Skills first-party reservadas de MSSR: fuente Git en `D:\Dev\mssr\skills`; skills propias no reservadas: `D:\Dev\mauroprime-skills\skills`. El runtime Codex usa junctions hacia el owner correspondiente, nunca copias editables.
- MSSR: contrato y fixtures en `D:\Dev\mssr`; dashboards son proyecciones generadas.
- Proyecto: decisiones, rutas, assets, blockers y estado actual permanecen en el repositorio del proyecto.

No edites caches de plugins o skills de sistema como personalización durable. Distingue duplicado propio —error—, versiones externas equivalentes —información— y fuentes externas con contratos divergentes —warning—.

## Registro durable de incidentes

Cuando exista un evento no nominal, carga `references/maintenance-incidents.md`. Registra hechos acotados: fecha/estado, capa/owner, síntoma, reproducción o evidencia, causa demostrada o `No resuelta`, corrección, regresión y seguimiento.

Nunca guardes raw prompts, transcripts, secretos, argumentos sensibles o razonamiento privado. Un cierre nominal se reporta como `Sin incidente registrable`.

## Memorias modulares

Cuando un aprendizaje siga perteneciendo al objetivo de una skill pero sólo aplique bajo determinados síntomas, fases, providers o runtimes:

- `SKILL.md` conserva invariantes y workflow;
- `context-modules.json` define selección;
- `references/MEMORY_INDEX.md` documenta `Read when`, tipo, owner, estado y revisión;
- el módulo guarda síntoma, causa, gate, recuperación, regresión y límites;
- el ledger cronológico conserva el incidente real.

Si una capacidad puede activarse, producir y verificarse independientemente, evalúa una skill nueva. Si depende del parent para tener sentido, sigue siendo un módulo interno.

## Actualización y verificación

Antes de editar una skill, léela completa, confirma el owner y evita dos escritores simultáneos. Después:

1. conserva frontmatter válido y descripción de activación precisa;
2. actualiza routing sólo si cambió el contrato de activación/composición;
3. agrega positivos, negativos y continuación cuando corresponda;
4. valida source y junctions;
5. prueba catálogo/bootstrap y una ruta real;
6. ejecuta los gates del repositorio y lee de vuelta los archivos;
7. publica con `git-change-publication` y verifica refs remotos sin force;
8. replanifica MSSR en verify, persist y close;
9. registra un solo outcome con una primary skill; usa dimensiones acotadas cuando subsistemas difieran.

Para cambios transversales ejecuta `scripts/verify-maintenance-loop.ps1`. Usa `-BridgeMode source` antes del restart y `-BridgeMode full` sólo cuando el release nuevo esté activo.
El verificador también ejecuta la regresión determinista de `digest -> learning-review -> promotion proposal`; sus resultados prueban el contrato de la propuesta, no una promoción real.

## Cambio de contexto y handoff

Cuando el entorno actual no pueda acceder, mutar o verificar la autoridad requerida, carga `references/maintenance-handoff.md` y activa `capability-gap-recovery`.

Preserva sólo objetivo/success gate, estado verificado, rutas/commits/hashes/backups/IDs relevantes, limitación exacta, próxima acción, rollback y evidencia que el destino debe devolver. No uses handoff para evitar una investigación posible en el contexto actual.

## Límites

- No conviertas preferencias puntuales en reglas universales.
- No actualices una skill sólo para registrar que una tarea terminó.
- No uses esta skill como changelog general.
- No agregues documentación auxiliar sin trigger ni owner.
- No declares aprendida una mejora sin regresión y readback.
- No borres historia o métricas para mejorar tasas.
- No degrades una tarea completada por una limitación externa que sólo afecta otra dimensión; descríbela explícitamente.

## Salida

Reporta: patrón observado, evidencia, clasificación, owner, cambio aplicado o propuesto, pruebas, persistencia, estado por dimensión y cualquier limitación pendiente. Cuando no exista aprendizaje reutilizable, indica `Sin cambio de skill`.
