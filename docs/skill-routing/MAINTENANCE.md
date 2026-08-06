# Mantenimiento de MSSR

## Salud de fuentes externas

Trata la integridad del contrato y la disponibilidad de fuentes como verificaciones distintas. Un contrato limpio no vuelve sana una fuente MCP solicitada. Si Roblox Studio MCP devuelve cero tools, conserva el routing local/plugin, informa la fuente Roblox como degradada o no disponible y exige mantenimiento en la auditoría viva. Nunca conviertas un catálogo dinámico vacío en un resultado silenciosamente sano.

## Al crear una skill

1. Crear su `SKILL.md` con `name` y una descripción que explique claramente cuándo usarla.
2. Ejecutar `skill_route_audit`.
3. Revisar la metadata inferida sugerida.
4. Añadir una entrada explícita a `config/skill-routing/skill-routing-overrides.json` para skills propias.
5. Definir fase principal, `coversPhases` cuando el mismo procedimiento cubra fases adicionales, dominios, acciones, artefactos, necesidades, dependencias y activación. No uses `coversPhases` para ocultar varias responsabilidades independientes dentro de una sola skill.
6. Añadir un fixture positivo, uno negativo cercano y variantes de continuación cuando el flujo pueda retomarse con respuestas breves como “dale”, “sí”, “mandale”, “seguí”, “de una” o “hacé eso”.
7. Ejecutar `npm run test:skill-routing` y `npm run verify`.

La skill ya es visible antes del paso 4 porque el catálogo se reescanea, pero permanece en estado inferido y no se considera estable.
`skill_route_audit` mantiene ese gate de forma determinista: reporta skills propias sin metadata explícita, sin fixture positivo o sin negativo cercano. Las skills `activation=always` quedan exentas únicamente del negativo. La continuación sigue siendo obligatoria por contrato cuando el flujo sea resumible, aunque no se infiere automáticamente para todos los procedimientos.

## Al modificar una skill

Actualizar routing y fixtures cuando cambie alguno de estos aspectos:

- propósito o disparadores;
- fase del workflow;
- dependencias o skills complementarias;
- artefactos cubiertos;
- tipo de prueba o persistencia requerida;
- alcance suficientemente grande como para justificar una segunda skill.

Una corrección de redacción que no cambia el comportamiento no requiere modificar el contrato.

## Renombrar o eliminar

- Cambiar todas las referencias en `requires`, `complements`, `excludes` y workflows.
- Migrar o eliminar la entrada anterior.
- Actualizar fixtures y documentación.
- Ejecutar la auditoría; una entrada vieja aparece como `staleConfigEntries` y una referencia rota como error.

## Skills grandes

La auditoría marca skills mayores de 500 líneas o 120.000 caracteres para revisión. Eso no obliga a dividirlas automáticamente.

Separar cuando exista:

- otro objetivo reusable;
- una referencia extensa que puede cargarse sólo cuando haga falta;
- scripts o plantillas que no deberían ocupar contexto;
- fases claramente independientes.

No separar sólo para cumplir una cifra si el procedimiento sigue siendo una unidad coherente.

## Tools nuevas o modificadas

Cuando una tool cambia qué workflows son posibles:

1. revisar descripciones y schemas MCP;
2. revisar qué skill debe enseñarla o exigirla;
3. actualizar routing y fixtures;
4. actualizar clasificación de riesgo en `src/tool-registry.ts`;
5. regenerar `TOOLS.md`;
6. ejecutar handshake y suite integral cuando corresponda.

## Patrones de ejecución que disparan mantenimiento de skills

Un fallo de proyecto también puede revelar una skill incompleta aunque el routing haya sido correcto. Al cerrar una tarea, captura mensaje exacto, stack, modo y propiedades antes de decidir qué skill actualizar.

- **Contenido object-backed desaparece entre Edit y Play:** si `EditableMesh`, `EditableImage` u otro contenido aparece en Edit pero llega como `None`, placeholder o caja de bounds al Server/Client, emite `reusable-pattern` y `skill-gap`. Actualiza la skill propietaria de authoring/persistencia visual, la QA/captura y la guía del proyecto.
- **El mismo carrier dinámico se reconstruye o clona para varias variantes:** si una segunda generación idéntica se bloquea, agota presupuesto o un `Clone()` object-backed no completa, emite `repeated-friction` y `reusable-pattern`. La corrección general es hidratar una fuente una sola vez, ordenar dependencias explícitamente, derivar representaciones adicionales desde el `MeshContent` runtime validado y conservar capas dependientes en coordenadas locales. Exige evidencia Server/Client y cardinalidad de las capas preservadas.
- **`lacking capability <X>` en un callback:** emite `missing-capability`. La línea del evento es el síntoma; inspecciona el `LuaSourceContainer` definidor, `Sandboxed` y `Capabilities` antes de atribuirlo a una tabla o conexión.
- **La herramienta no puede ampliar capabilities:** emite `capability-gap` o la señal equivalente vigente y `manual-workaround`. No repitas la mutación; exige fuente autorizada o cambio arquitectónico y registra la limitación en la skill de edición segura.
- **Pivot correcto, bounds incorrectos:** emite `reusable-pattern`; actualiza placement/QA para validar bottom y containment desde el bounding box final después de rotación.
- **Placeholder confundido con defecto artístico o de cámara:** emite `skill-gap`; la skill de captura debe bloquear antes del camera-fit y la de referencia debe insertar un gate de representación runtime.
- **Línea de `table.insert(... CharacterAdded:Connect(...))`:** separa dos hipótesis y pruébalas en orden: capability del evento y lifecycle de la colección. Sólo actualiza la regla de conexiones si la tabla realmente no fue inicializada, se nombró de forma inconsistente o no se limpia.

Mapa mínimo de ownership:

- runtime visual/persistencia → `roblox-visual-asset-forge`, `roblox-photo-rig-capture`, `visual-reference-replication`;
- consola/capabilities/Client-Server → `roblox-studio-qa`, `roblox-safe-editing`;
- soporte/footprint/creación autoritativa → `roblox-placement-system-authoring`;
- detección y propagación del aprendizaje → `skill-maintenance-loop`;
- hechos y rutas concretas → guía y docs del proyecto.

Estos cambios no requieren tocar routing si no cambian propósito, fase, dependencias o activación. Si se agregan nuevos disparadores o signals, añade fixtures positivo, negativo y de continuación y registra el incidente reproducible.


## Errores de activación

- **Se activa de más por una necesidad genérica aunque el artefacto no coincide:** añadir un artefacto específico, `requireArtifactMatch` y un caso negativo cercano.
- **Coincide por artefacto pero no por operación:** añadir `requireActionMatch` y un caso negativo cercano.
- **Coincide por operación/artefacto pero no existe la necesidad especializada:** añadir `requireNeedMatch` y un caso negativo cercano.
- **Skill transversal de anomalías se abre en trabajo nominal:** añadir `requireSignalMatch`, declarar sólo señales no nominales y exigir un fixture anómalo positivo más un nominal negativo.
- **Existe la capacidad pero no en el contexto actual:** activar `capability-gap-recovery`, probar el límite de autoridad/estado y producir un handoff acotado al producto o provider que pueda ejecutar y verificar la operación.
- **No se activa:** mejorar descripción, metadata, dependencia o fixture positivo.
- **Fase incorrecta:** corregir `phase`, workflow y `completedPhases` del caso.
- **Una continuación breve pierde el plan:** el caller debe enviar siempre un `context` resuelto y acotado para trabajos multi-turno, no depender de detectar una frase literal.
- **Codex local y ChatGPT web eligen rutas distintas:** enviar `caller` y seguir `executionGuidance`; no duplicar filesystem/terminal mediante Bridge cuando Codex ya posee una ruta directa suficiente.
- **Falta una fuente completa del catálogo:** exigir un warning de raíz y probar `skills`, junctions y `plugins/cache` por separado. No ampliar permisos generales para resolver un problema de descubrimiento interno.
- **Dos skills compiten:** establecer roles complementarios, dependencia o exclusión; evitar duplicar procedimientos.

- **Aparecen varios `StudioMCP.exe`:** no limpiar por nombre. Comparar PPID y `roblox_mcp_status.ownership.childPid`; cada cliente puede tener un hijo legítimo.
- **Hay varias ventanas Studio:** obtener ids vivos y exigir `studioId` para toda mutación proxied.
- **Sólo existe catálogo Roblox cacheado:** permitir descubrimiento degradado, pero bloquear queries, acciones y carga de skills vivas.

## Incidentes confirmados

Cuando una activación incorrecta sea reproducible, no la corrijas sólo con una condición ad hoc. Registra el caso en `docs/skill-routing/INCIDENTS.md` con:

- tarea y contexto mínimos;
- selección incorrecta observable;
- causa ubicada en vocabulario, fallback, metadata, workflow, scoring, dependencias o fases;
- corrección general aplicada;
- fixture positivo y negativo que bloquea la regresión;
- resultado de la suite completa.

Un exit code exitoso de un script de mantenimiento no prueba que el contrato cambió: lee de vuelta el archivo y ejecuta el fixture que debía fallar antes de continuar.

## Loop recomendado

```powershell
npm run check
npm run build
npm run test:skill-routing
python scripts\audit-skills.py
npm run verify
```

La detección se puede ejecutar automáticamente en CI o al cerrar una tarea. La reparación debe conservar revisión humana/agente, diff y rollback.



## Workflows transversales y presupuesto

Una skill crítica que debe cumplirse como garantía de proceso no debe competir indefinidamente como optional. Cuando el comportamiento forme un lifecycle reusable —por ejemplo `visual-evidence-audit → visual-evidence-pruning`— decláralo como workflow requerido con condiciones semánticas estrechas y fixtures de presupuesto concurrido. Usa la señal semántica que distingue la garantía real (`human-approval` para decidir qué evidencia conservar), no una capacidad genérica como `visual-qa` que también aparece en descripción de una imagen o captura Photo Rig. No aumentes `maxSkills` globalmente para ocultar una relación contractual faltante.

## Lifecycle visual: identidad, duplicados y continuidad de fase

Para colecciones visuales versionadas:

- no uses cantidad de archivos como cantidad de vistas; declara `physicalImageCount`, `logicalCaptureCount` y `logicalCaptureKey`;
- separa derivados raw/review/thumb de colisiones donde cámaras o estados distintos repiten el mismo frame;
- no dejes que `preferred` o el número de versión resuelvan un conflicto con la fuente vigente;
- protege referencias conceptuales por path y hash aunque estén dentro de un run candidato;
- un track sin píxeles debe seguir visible como pending con `cover=null`;
- una skill que muta y posee postcondiciones debe continuar requerida en `stage=verify` y `stage=persist`; condiciona esas reglas por stage y necesidades de integridad/versionado, no por el riesgo destructivo propio de implementation;
- la activación destructiva directa debe exigir `human-approval`; backup, integrity y version-control son gates técnicos, no autorización.

Mantén positivos de audit/pruning, continuidad verify/persist y un negativo cercano de hash-only sin aprobación.

## Duplicate provenance and context-budget interpretation

`skill_route_audit` classifies duplicate names instead of treating every cached copy as the same defect:

- `owned-error`: more than one `codex-local` source owns the same canonical name; this is an audit error.
- `external-version-info`: plugin-cache versions have the same normalized semantic description; deterministic precedence selects one and the duplicate is informational.
- `conflicting-source-warning`: external/system sources expose different contracts; preserve provenance and review before changing routing.

Never edit plugin caches to silence duplicate counts.

Selective context exposes two separate facts:

- `requiredBudgetExceeded=true` means required core or required module context could not fit normally and the host had to overflow or omit required material.
- `optionalContextOmitted=true` means optional skill/module context was skipped under the hard budget. This remains observable but does not imply bootstrap failure; `budgetExceeded` follows the required-overflow meaning for compatibility with operational health checks.
