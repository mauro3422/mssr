# Referencias reales y tamaño de catálogo

Estado: **completed**. 144 llamadas enviadas en esta corrida.
Snapshot: file:///D:/Dev/mssr/experiments/typesafe-jev-lab/results-references/2026-09-19T22-47-42-725Z/
Fingerprint: 0961cbc1496d296c81ab5385e0a93c4fd90aca11fed14275fc9dee061e665387

## Qué se compara

35 referencias reales de cinco skills first-party MSSR, 78811 caracteres de referencias y 7049 de núcleos comunes. Seis tareas sintéticas en español, catálogos anidados de 8/20/35 referencias, dos repeticiones. Cada subconjunto incluye deliberadamente una referencia principal esperada. Las distracciones se ordenan por hash reproducible. No es una prueba de recuperación cuando la fuente falta ni de consultas sin ninguna referencia útil.

Cinco skills padre se consideran ya aceptadas; no se mide selección de skills ni autorización del host. Los núcleos permanecen en TODOS los lectores. Solo se varían referencias opcionales. No se recorta texto dentro de una referencia.

1. Full entrega núcleos + todas las referencias del subconjunto.
2. Jev lee task/fase + ids/propietario/descripción/fases de las referencias; un Noul independiente por candidato en una request. Umbral 0,5 predefinido, fase y required preservados por código. Otra llamada recibe núcleos y referencias seleccionadas.
3. MSSR usa la función real selectSkillContextModules de dist, con intención estructurada preparada por Codex y presupuesto no limitante; otra llamada recibe núcleos y referencias seleccionadas. No es el bootstrap completo ni el presupuesto global normal.

La intención estructurada y tarea natural son interfaces distintas: no atribuir toda diferencia al modelo. Las etiquetas identifican una referencia primaria y una respuesta esperada, no TODAS las referencias válidas. Retener la primaria es cobertura, no precisión; otras referencias/core pueden contener información redundante que permita acertar. Selector y lector son Jev; no es un agente completando trabajo.

## Comprobación local sin API

| Catálogo | MSSR retiene primaria | Referencias seleccionadas, media | Caracteres seleccionados, media sin core |
|---|---:|---:|---:|
| 8 | 6/6 | 1.8 | 3604 |
| 20 | 6/6 | 3.8 | 7533 |
| 35 | 6/6 | 6.3 | 13345 |

## Resultados API

144 llamadas; 0 errores. Entrada 840729, salida 18456; estimación US$0.035311 a US$0,042/M entrada, sin factura.

| Catálogo | Política | Respuestas esperadas | Primaria retenida | Refs media | Entrada total media | p50 / p95 ms camino |
|---|---|---:|---:|---:|---:|---:|
| 8 | full | 12/12 | 12/12 | 8.0 | 5850 | 314 / 450 |
| 8 | jev | 12/12 | 12/12 | 1.8 | 4265 | 625 / 1205 |
| 8 | mssr | 12/12 | 12/12 | 1.8 | 2930 | 309 / 351 |
| 20 | full | 12/12 | 12/12 | 20.0 | 11682 | 355 / 400 |
| 20 | jev | 12/12 | 12/12 | 4.7 | 7131 | 648 / 770 |
| 20 | mssr | 12/12 | 12/12 | 3.8 | 3857 | 307 / 352 |
| 35 | full | 12/12 | 12/12 | 35.0 | 19702 | 426 / 909 |
| 35 | jev | 12/12 | 12/12 | 6.4 | 9471 | 635 / 743 |
| 35 | mssr | 12/12 | 12/12 | 6.3 | 5173 | 324 / 714 |

La latencia de Jev incluye selector + lector; la entrada también cuenta ambas llamadas. MSSR incluye el tiempo del selector local. Son sumas de duraciones por camino, no wall time de agente; no se mide caché ni costos de otro lector. Seis escenarios repetidos no son doce independientes. Sin adjudicación humana, sin thresholds optimizados y sin incorporación a routing.

## Payload revisable

El archivo results-references/prepared.json contiene núcleos, referencias completas, metadata, escenarios, preguntas y decisiones MSSR. A TypeSafe se enviarían: selector = task/fase/catálogo breve; lector = task/pregunta/núcleos/referencias elegidas. No se envían etiquetas, conversación real, credenciales, archivos productivos ni PROJECT_*. El SDK usa la credencial solo para autenticar.

## Reproducir

node experiments/typesafe-jev-lab/reference-benchmark.mjs --prepare

Tras autorización del payload: ./experiments/typesafe-jev-lab/reference-benchmark.ps1

node experiments/typesafe-jev-lab/reference-report.mjs

## Arquitectura actual y posible uso

MSSR ya selecciona por intención estructurada, fase, señales y presupuesto; el host conserva propiedad de lectura, ejecución y contexto de conversación. Jev no puede leer un chat por sí mismo: el host debe construir un resumen observable de intención/correcciones/fase y enviarlo. Una ampliación futura podría recomendar referencias opcionales desde metadata y comprobar después el contenido. Reglas requeridas, núcleos, provenance y carga efectiva seguirían bajo contratos deterministas/host. No hay integración ni abstracción nueva en este experimento.

Fuente: https://docs.typesafe.ai/cookbooks/skill_suggestion (patrón oficial; sus resultados no se reprodujeron). Código local: src/skill-context.ts y src/context-selection.ts; snapshots del dist realmente importado en carpeta de corrida.

## Economía observada, incluido selector

| Referencias | Ahorro entrada Jev vs todo | Ahorro MSSR vs todo | Entrada extra Jev respecto a MSSR |
|---|---:|---:|---:|
| 8 | 27.1% | 49.9% | 45.6% |
| 20 | 39.0% | 67.0% | 84.9% |
| 35 | 51.9% | 73.7% | 83.1% |

El menor tamaño probado con menor entrada Jev que full es 8. No es un umbral universal: tamaño de texto, número de preguntas, descripción, core y caché cambian el cruce. Comparar contra MSSR es más relevante que comparar solo contra cargar todo.

Incidente de autorización: el primer lanzamiento fue rechazado antes de ejecutar por envío de referencias internas. El usuario autorizó expresamente las cinco skills y las 35 referencias a TypeSafe; luego se ejecutó esta corrida. No hubo ruta alternativa ni envío previo. La credencial permanece en Credential Manager.

Solo experiments/typesafe-jev-lab modificado por esta tarea; sin commit/push. PROJECT_CONTEXT/MEMORY/STATE y skills: reviewed-none. Datos de benchmarks no autorizan promoción de routing.
