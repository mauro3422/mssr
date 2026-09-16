# Auditoría de utilidad y economía de contexto — 2026-09-05

## Dictamen

MSSR tiene valor como memoria operativa y selección de procedimientos locales: autoridad de archivos, límites de herramientas, recuperación, pruebas y distinción entre fuente y runtime. Es información que la capacidad general del modelo no reemplaza. Su rentabilidad neta y una ventaja relativa para Sol, Astra o modelos menores todavía no están demostradas: falta una comparación controlada con iguales tareas, herramientas y criterios de aceptación.

La intervención realizada reduce una carga innecesaria demostrable sin cambiar pesos, aprendizaje, permisos ni el motor de routing. Las raíces principales ya eran compactas; el problema observado estaba también en las referencias ensambladas y en procedimientos condicionales presentados como trabajo obligatorio.

## Fuentes y alcance

- Autoridades `.mssr/`, protocolo, código y skills first-party del repositorio; snapshot previo de cambios locales para conservar trabajo ajeno.
- Dashboard real `http://127.0.0.1:3001/dashboard#mssr`, abierto e inspeccionado visualmente, Bridge 0.6.117.
- Snapshot del observatorio a las 2026-09-05T01:12:42Z; ventana de 30 días desde 2026-08-06. Es una población diagnóstica mixta, no un conjunto experimental limpio.
- Tareas accesibles: **Auditoría del último fix**, **Publicar y limpiar MSSR**, **Observatorio diario de proyectos**, **Dar acceso a skills** y **Resumen diario personal**. Lectura selectiva; esta última tenía contenido anterior no leído. Los resultados narrados por otros agentes no equivalen a reejecutar sus pruebas. No se exportaron transcripciones.
- Incidente Web documentado en `HANDOFF_CONTEXT_ECONOMY_PRIORITY.md` y contrastado con la traza `mssr-20260828010415-22f85d29-02f`: bootstrap sin contexto entregado y bloqueo de presupuesto durante un cierre de revisión. Sigue pendiente resolver el costo del envelope y la selección amplia de obligaciones en ese escenario.
- Traza de esta auditoría: `mssr-20260905011118-c923eaa9-d2d`. Evidencia local ignorada por Git en `.mssr/runtime/audit-20260905/`: snapshot de skills, diff previo, agregados acotados y mediciones antes/después. No contiene transcripciones de chats.

## Qué permiten afirmar los números

La ventana contiene 16.898 eventos y 1.296 trazas. Hay 4.008 eventos de ruta, de los cuales 3.981 son estructurados (99,33%). La correlación ruta/carga indicada es 64,32%; el cumplimiento de cargas requeridas, 1.610/1.665 (96,7%). Estos indicadores describen el protocolo, no la calidad del producto.

Sobre 1.281 trazas con ruta, 545 tienen verificación (42,54%) y 607 tienen outcome (47,38%). El 80,11% de éxito corresponde a 451 de 563 outcomes atribuidos, no al total de tareas. La ausencia de un evento es falta de evidencia; no demuestra que el trabajo esté abierto o haya fallado. **Publicar y limpiar MSSR** muestra además que un límite de uso puede interrumpir una tarea.

El agregado incluye 163 trazas Web con `fixture-model`, sin outcomes. No debe usarse como cohorte de producción sin filtrar. Las filas Web Sol incluyen 401 trazas con esfuerzo high y 390 con esfuerzo desconocido; las filas Codex Astra observadas tienen solo 3 con low y 1 con high. Hay diferencias de host, tarea, versión y cobertura: no permiten comparar modelos. La herramienta de historial no identifica por sí sola el modelo de cada chat.

El dashboard informa un ahorro de contexto de 57,03% respecto de las cargas completas que contabiliza. Eso no equivale a ahorro frente a trabajar sin MSSR, ni mide la calidad obtenida. El agregado de bootstrap registra 10.533.592 caracteres de respuesta frente a 2.200.476 de contexto entregado, mezclando revisiones: conviene medir el envelope completo por cohorte y tarea.

## Hallazgos y correcciones

1. **Revisión proporcional.** La guía de mantenimiento ahora distingue `no-learning-change`, `insufficient-evidence` y `proposal-ready`. Una revisión ordinaria puede terminar con una decisión acotada y su checkpoint; no exige fabricar una propuesta, publicar o reiniciar. Se conservan dataset audit, replay/holdout, calibración, shadow y feature flag/rollback antes de promover aprendizaje.
2. **Recuperación con evidencia específica.** La referencia stateless requiere acciones recover/debug y señales recovery-needed/conflicting-evidence. Una auditoría con fricción genérica ya no recibe instrucciones para provocar pérdida de coordinador. Las reproducciones deliberadas se limitan a un coordinador de prueba aislado.
3. **Cierre explícito.** La guía explica que completar mantenimiento requiere `phase_completed` antes de `outcome`. Se comprobó en la primera parte de esta conversación que el checkpoint faltante resolvía el rechazo; eso no prueba un defecto del runtime. Se elimina ambigüedad procedural.
4. **Mantenimiento que propaga el criterio.** La skill que mantiene routing ahora exige medir el paquete ensamblado y probar casos positivos, negativos cercanos y continuidad. Medir solo el tamaño de `SKILL.md` oculta referencias costosas.
5. **Interpretación del observatorio.** La guía exige denominadores, cohortes, tratamiento de fixtures y estados desconocidos. El dashboard ya diferencia varios indicadores de proceso y calidad; quedan frases que equiparan outcome ausente con tarea abierta. La tabla “Contexto por traza” también merece aclarar último bloque versus costo acumulado: la traza observada mostraba 3.828/7.000, no el total de la cadena.

Se corrigieron además descripciones obsoletas de la relación MSSR/Bridge y de la versión en README. No se alteró el dashboard ni el runtime Bridge.

## Regresión de contexto

Mediciones con el mismo planificador y las mismas fixtures, cambiando únicamente la fuente de skills entre el snapshot previo y la fuente editada. Son caracteres de contexto procedural seleccionado, no tokens facturados ni respuestas de un modelo.

| Caso | Antes | Después | Interpretación |
| --- | ---: | ---: | --- |
| Cierre de revisión nominal | 12.688 | 6.935 | −45,34%; cabe completo en página procedural de 7.000 |
| Revisión con warning | 4.831 | 5.144 | Aumenta por la regla explícita de proporcionalidad |
| Auditoría de observabilidad sin recuperación | 2.882 | 3.126 | Excluye recuperación; añade límites de interpretación |
| Debug con fricción, sin reinicio | 1.906 | 1.289 | No activa experimento stateless |
| Recuperación tras pérdida de coordinador | 2.882 | 4.088 | Conserva recuperación y añade aislamiento/interpretación |
| Debug de identidad de traza conflictiva | 1.906 | 2.251 | Conserva recuperación específica |
| Revisión de candidato de aprendizaje | 31.785 | 26.333 | Disminuye, pero sigue siendo un paquete grande |

No todos los casos se achican y no se pretende que lo hagan. El objetivo es cargar el procedimiento aplicable. Estas pruebas parten de padres seleccionados: no demuestran que el router siempre elija los padres correctos ni solucionan el bloqueo del envelope Web completo.

## Verificación y adopción

La prueba del límite falló con la fuente anterior y las siete fixtures pasan con la nueva. Los ocho self-tests del generador de propuestas pasan, conservando las barreras de promoción. `npm run test:skill-routing` pasó 231 fixtures. El log de `npm run verify` llegó al último paso con conformance cross-host PASS y `audit:check` ok, sin problemas ni violaciones de schema; la sesión de proceso ya no estaba disponible después de la interrupción por límite de uso. `git diff --check` no encontró errores de whitespace. Logs en `.mssr/runtime/audit-20260905/`.

La auditoría viva de Bridge no informa errores ni warnings, pero conserva deuda de su contrato instalado: falta metadata/fixtures para `workshop-media-editing`, siete WATCH estructurales y un REVIEW. No se presenta ese runtime como actualizado por la verificación de fuente.

Durante esta auditoría se imprimieron diagnósticos excesivos, incluido un benchmark serializado de aproximadamente 6,5 millones de caracteres antes de truncamiento. No se conoce cuánto llegó al modelo ni su costo facturado. Es fricción propia de esta ejecución, no evidencia de que cada tarea MSSR tenga ese costo. Los diagnósticos deben proyectarse antes de entrar al contexto del agente.

Cambios locales en fuente, documentados como borrador 0.2.59; el paquete permanece en 0.2.57 y el trabajo preexistente 0.2.58 se conserva. Las junctions locales apuntan a `D:/Dev/mssr/skills`. Bridge sigue cargando su paquete instalado: no se publicó ni se reinició, por lo que no se afirma que ChatGPT Web haya adoptado estos cambios.

## Prioridades siguientes

1. Reproducir y reducir el envelope de bootstrap y las obligaciones ajenas a la tarea usando el incidente Web existente. No añadir otro modelo para resolver ese problema antes de medir el selector actual.
2. Separar explícitamente fixtures y producción, y mostrar “sin evidencia” cuando falta resultado. Medir costo acumulado por tarea y revisión del sistema.
3. Hacer una comparación pequeña y emparejada: instrucciones básicas, contexto local seleccionado y MSSR completo; mismas tareas, host, modelo, herramientas y presupuesto. Evaluar aceptación del resultado con criterios independientes, correcciones del usuario, llamadas, caracteres/tokens y tiempo. Los historiales orientan qué tareas elegir; no reemplazan este experimento.
4. Revisar en su propietario externo `conversation-history-review`, que aún menciona `.bridge/PROJECT_CONTEXT.md`. Su fuente es otro repositorio y no se modificó en este lote. Evitar convertir instrucciones históricas de observadores en autoridad actual.

No hacen falta más chats al azar para sostener estos hallazgos. Para demostrar rentabilidad causal sí harán falta tareas comparables y resultados evaluables, especialmente de Web, donde está la mayor parte del uso.
