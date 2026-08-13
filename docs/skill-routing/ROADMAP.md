# Roadmap de MSSR

## Estado actual

- Catálogo vivo de Codex y Roblox.
- Precedencia y deduplicación por fuente.
- Intención estructurada con fallback léxico marcado.
- Contexto breve para continuaciones conversacionales.
- Fases, dependencias, exclusiones y workflows.
- Auditoría de drift y salud de skills.
- Fixtures positivos, negativos y de continuación.
- Configuración y pruebas versionadas en Git.
- Dashboard generado y skill mantenedora.
- Observatory del Bridge con trazas, privacidad, outcome por skill primaria y dashboard local.
- `trace-contract-v1` implementado: continuidad local más lease acotada por proceso para llamadas stateless, selección inequívoca, protección de ambigüedad, propagación por direct tools y dispatch wrappers, regresión MCP multisesión y época activa limpia con historia preservada.
- Contrato portable `recommend -> host decision -> load`: `host-gated` mantiene candidatas opcionales fuera del contexto hasta `accepted`, registra `skipped` por motivo y conserva requeridas como obligaciones.
- Preflight portable de cierre con `closureDue`, gates faltantes y siguiente acción, más working metadata temporal `until-outcome` y purga al cerrar.
- Analizador portable de decisiones por skill y firma semántica canónica de la tarea; todavía no reescribe routing automáticamente.
- Adaptador inicial Photo Rig que registra outcome técnico desde el manifest y permite reemplazarlo con revisión visual final.

## Próximo nivel útil

### 1. Cumplimiento del hook de activación
La continuidad interna de una tarea ya está probada por `trace-contract-v1`. La prioridad restante es medir el denominador que el observatorio todavía no ve: tareas elegibles donde el host pudo omitir completamente MSSR.

- definir qué constituye trabajo especializado sustancial frente a consultas estáticas o no operativas;
- emitir un checkpoint/heartbeat del hook antes de la primera cadena especializada;
- registrar si se cargó contexto durable del proyecto y si se produjo intención estructurada;
- detectar sesiones con tools de código/Roblox/Blender pero sin ruta previa;
- separar activación omitida, fallback deliberado y tareas correctamente excluidas;
- mostrar cobertura del hook por caller y tipo de tarea.

El resultado debe distinguir una ruta continua y correcta de una tarea invisible para el observatorio porque omitió completamente MSSR.

### 2. Autoridad de contexto de proyecto

Añadir un preflight portable que detecte y resuma las fuentes durables disponibles sin copiar todo su contenido:

- `AGENTS.md` o equivalente del host;
- contexto, memoria y estado bajo `.bridge/` cuando existan;
- documentación canónica y estado operativo del proyecto;
- incidentes, checkpoints, commits o snapshots relevantes para la tarea actual.

Debe informar fuentes ausentes, contradictorias o obsoletas. Los hechos locales permanecen en el proyecto; sólo los procedimientos realmente transversales ascienden a skills globales.

### 3. Observabilidad de decisiones

Registrar sin convertir la telemetría durable en un transcript:

- hash de intención, caller, fase y trace;
- firma semántica canónica: `stage + domains + actions + artifacts + needs + signals`;
- fuentes de contexto utilizadas;
- skills recomendadas, diferidas y requeridas;
- para cada candidata opcional: `accepted` o `skipped` y motivo acotado;
- skills realmente cargadas, distinguiendo un skip deliberado de un fallo de carga;
- replans, warnings, salud de providers y fallos de tool/schema;
- duración y resultado de fases;
- verificación, persistencia, correcciones del usuario y señales de fricción.

El analizador portable ya agrega decisiones por skill y por firma semántica. **Un skip no reduce globalmente la utilidad de una skill.** La evidencia debe responder preguntas contextuales: “¿en tareas con esta firma o firmas cercanas esta candidata suele aceptarse, sobrar o correlacionarse con buenos outcomes?”. El ranker futuro debe exigir un mínimo de evidencia, mantener una cuota de exploración para capacidades nuevas y producir primero propuestas revisables.

Una segunda capa vectorial puede ser útil para recuperar firmas históricas semánticamente próximas cuando las etiquetas exactas no alcanzan. Debe complementar, no reemplazar, el vocabulario canónico, los gates deterministas, fixtures positivos/negativos y revisión explícita.

El Bridge ya aporta trazas correlacionadas, structured-vs-lexical rate, required-load compliance, cobertura de verify/persist/outcome, una skill primaria por outcome, colaboradores, aceptación y score. Falta conectar allí el nuevo evento de decisión, host-gated bootstrap y visualizaciones por firma semántica, además de medir el hook contra un universo explícito de tareas elegibles.

### 3.1 Bandeja de notices y contexto dinámico

Extender el canal existente de notices para producir evidencia accionable sobre agentes concurrentes, rutas con ownership, capturas/revisiones pendientes, contexto de proyecto obsoleto, fallos de activación, required skills omitidas y métricas anómalas. Añadir especialmente notices derivados del preflight de cierre: `closureDue`, gates faltantes, `nextRequiredAction` y trazas abiertas/obsoletas que ya no deberían competir con la recuperación automática. El host debe drenar o adjuntar notices en puntos seguros, resumirlos dentro de presupuesto y replanificar sólo cuando cambien materialmente la tarea.

La entrega preferida es piggyback/pull en el siguiente tool result; las notificaciones push MCP pueden complementar, pero no se asume que todos los hosts despierten una nueva inferencia al recibirlas. El idle timeout puede marcar `stale-open` o candidato a cierre; nunca debe inferir `success`.

### 4. Evaluación histórica y promoción de aprendizaje

El aprendizaje post-iteración empieza cuando existe un cierre observable, no cuando el usuario recuerda decir “terminamos”. El host detecta que entra en `stage=close`, consulta los gates, completa verificación/persistencia/maintenance cuando corresponda y recién entonces produce outcome. Antes del outcome puede usar working metadata temporal de la traza para conservar hipótesis, decisiones, evidencia y próximo gate; esa memoria efímera se purga al cerrar.

Convertir evidencia confirmada según ownership, no suponiendo que todo termina en una skill:

```text
evento aislado
  -> telemetría / no promoción
hecho o decisión local del proyecto
  -> context / memory / state / documentación del proyecto
fallo reproducible del proyecto
  -> fix + regresión local
regla o decisión arquitectónica durable
  -> ADR / arquitectura / diseño del proyecto
patrón procedural entre proyectos
  -> actualización de la skill propietaria
soporte de ejecución reusable
  -> tool / script / guide / test del owner correcto
fallo de activación/fase/dependencia
  -> metadata MSSR + fixtures
objetivo reusable independiente
  -> skill nueva
```

No aprender automáticamente de una única ejecución ni reescribir el contrato por frecuencia. El sistema puede proponer una promoción al cierre o comparar múltiples trazas, pero una mutación durable exige owner claro, evidencia, diff y regresión/revisión. Crear un benchmark de replay con incidentes reales confirmados y casos nominales cercanos.

### 5. Checkpoints y edición asistida

Añadir estado durable para workflows que sobrevivan reinicios, pausas o varios días:

- intención resuelta y fase actual;
- fases completadas y skills cargadas;
- artefactos producidos;
- verificaciones pendientes;
- señales/fricciones observadas;
- referencias a commits o snapshots.

Una herramienta futura podrá proponer patches de metadata o fixtures desde auditoría e historial, pero deberá exigir confirmación, snapshot, diff y pruebas antes de escribir.

## LangGraph

No se añade como dependencia en esta etapa. MSSR hoy resuelve routing, no ejecuta un grafo autónomo de larga duración. El Bridge ya dispone de snapshots, sesiones de terminal, métricas y replanificación por fases.

Reevaluar LangGraph cuando aparezcan simultáneamente varios de estos requisitos:

- reanudación automática tras caída;
- human-in-the-loop entre nodos;
- ramas y reintentos complejos;
- subagentes con memoria por hilo;
- time travel o replay de estados;
- muchas ejecuciones concurrentes que necesiten un store compartido.

En ese momento MSSR puede convertirse en el nodo de routing inicial de un grafo, sin reemplazar el contrato ni los fixtures actuales.

## No objetivos

- No autoeditar skills silenciosamente en background.
- No guardar cadena de pensamiento.
- No cargar todas las skills en cada turno.
- No transformar métricas de frecuencia en reglas sin casos reproducibles.
- No hacer que el Bridge adivine una conversación que el caller no le envió.
