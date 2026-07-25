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
- Adaptador inicial Photo Rig que registra outcome técnico desde el manifest y permite reemplazarlo con revisión visual final.

## Próximo nivel útil

### 1. Cumplimiento del hook de activación

La prioridad principal es poder demostrar que cada host ejecutó el protocolo, no sólo que MSSR estaba disponible:

- cargar contexto durable del proyecto antes de trabajo especializado sustancial;
- producir intención estructurada con `signals` explícitas;
- llamar `skill_route_plan` o `skill_bootstrap`;
- cargar las skills requeridas de la fase activa;
- conservar el mismo trace en loads, replans y checkpoints;
- replanificar al cambiar de fase o aparecer evidencia/capacidades nuevas.

El resultado debe distinguir una ruta correcta de una tarea que omitió completamente MSSR.

### 2. Autoridad de contexto de proyecto

Añadir un preflight portable que detecte y resuma las fuentes durables disponibles sin copiar todo su contenido:

- `AGENTS.md` o equivalente del host;
- contexto, memoria y estado bajo `.bridge/` cuando existan;
- documentación canónica y estado operativo del proyecto;
- incidentes, checkpoints, commits o snapshots relevantes para la tarea actual.

Debe informar fuentes ausentes, contradictorias o obsoletas. Los hechos locales permanecen en el proyecto; sólo los procedimientos realmente transversales ascienden a skills globales.

### 3. Observabilidad de decisiones

Registrar sin prompts ni transcripciones completas:

- hash de intención, caller, fase y trace;
- fuentes de contexto utilizadas;
- skills activas, diferidas, requeridas y realmente cargadas;
- replans, warnings, salud de providers y fallos de tool/schema;
- duración y resultado de fases;
- verificación, persistencia, correcciones del usuario y señales de fricción.

Esto permitirá medir activación omitida, sobre-activación, required-load compliance y continuidad entre fases sin saturar contexto ni guardar razonamiento privado.

Implementado en el adaptador Bridge: trazas correlacionadas, structured-vs-lexical rate, required-load compliance, cobertura de verify/persist/outcome, una única skill primaria por outcome, colaboradores, aceptación, score y tabla por skill. El siguiente paso es medir cobertura del hook contra un universo explícito de tareas elegibles y no sólo contra traces que ya llegaron al observatorio.

### 3.1 Bandeja de notices y contexto dinámico

Extender el canal existente de notices para producir evidencia accionable sobre agentes concurrentes, rutas con ownership, capturas/revisiones pendientes, contexto de proyecto obsoleto, fallos de activación, required skills omitidas y métricas anómalas. El host debe drenar o adjuntar notices en puntos seguros, resumirlos dentro de presupuesto y replanificar sólo cuando cambien materialmente la tarea.

La entrega preferida es piggyback/pull en el siguiente tool result; las notificaciones push MCP pueden complementar, pero no se asume que todos los hosts despierten una nueva inferencia al recibirlas.

### 4. Evaluación histórica y promoción de aprendizaje

Convertir evidencia confirmada mediante una escalera explícita:

```text
evento aislado
  -> telemetría o documentación local
fallo reproducible del proyecto
  -> fix + regresión local
patrón procedural entre proyectos
  -> actualización de la skill propietaria
fallo de activación/fase/dependencia
  -> metadata MSSR + fixtures
objetivo reusable independiente
  -> skill nueva
```

No aprender automáticamente de una única ejecución ni reescribir el contrato por frecuencia. Crear un benchmark de replay con incidentes reales confirmados y casos nominales cercanos.

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
