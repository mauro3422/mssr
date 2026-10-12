# Run49 — relaciones Jev con documentos reales MSSR

## Alcance

Tres llamadas reales a Jev 1.13.0 mediante el wrapper Bridge de revisión de relaciones. Se usó una sola pareja de afirmaciones canónicas actuales y no sensibles: AGENTS.md, líneas 6–7, y .mssr/PROJECT_CONTEXT.md, línea 5. Ambas afirman que las rutas y juicios de MSSR son advisory y no conceden permisos ni autorizan escrituras. Cada llamada volvió a leer los rangos exactos y ligó la respuesta a los atoms, revisiones y fingerprints correspondientes.

No se encontró una pareja natural de contradicción en las autoridades y documentos actuales examinados. Los antecedentes del benchmark también registran cero casos positivos de contradicción. Por eso este run real evalúa apoyo y abstención; el canary contradictorio se conserva aparte en Run50 y es sintético.

## Resultados

| Control | Datos cambiados | Jev | Confianza cruda | Evaluación portable |
|---|---|---:|---:|---|
| Control positivo, frescura desconocida | freshness unknown; scope/periodo declarados | supports | 0,93 | review: falta verificación independiente y frescura confirmada |
| Ablación de frescura exacta | mismos textos; observación exacta fresh | supports | 0,60 | review: falta verificación independiente |
| Abstención por comparabilidad | atoms fresh; scope y temporalidad omitidos del par | unresolved | 0,54 | abstain: faltan scope/validez y comparabilidad temporal; sin verificación independiente |

Los tres resultados citaron los dos atoms y cubrieron 2/2 endpoints. Ninguno quedó verificado. Los dos primeros son repeticiones del mismo par, no dos ejemplos independientes. La diferencia de 0,33 en Choice entre esas llamadas muestra por qué la confianza cruda no es una probabilidad calibrada. La ablación sí mostró que evidencia exacta de frescura elimina el motivo source-freshness-not-confirmed, pero la ausencia de verificación independiente mantiene el juicio en review.

## Contabilidad y límites

- 3 llamadas / 3 batches informados; 3.545 tokens de entrada y 210 de salida; suma de latencias reportadas por Jev: 2.354,78 ms.
- 1 cluster de fuente, 2 documentos, 6 lecturas de endpoint exactas, 6 citas; cero discrepancias de revisión/fingerprint.
- No se observaron bytes de transporte del proveedor. Se conserva el resultado estructurado devuelto por el wrapper, no una captura cruda de HTTP.
- Las etiquetas supports y unresolved son diagnósticas, no owner-gold. No calculamos accuracy ni calibración a partir de tres preguntas vinculadas.
- No hubo escrituras canónicas, cambios de umbral ni cambios de runtime.

## Lectura

El camino EvidenceAtom → relectura exacta → Jev → juicio tipado → evaluación portable funciona en estos controles. La capa también se abstuvo cuando se retiró scope/tiempo. No hay evidencia todavía para afirmar sensibilidad real a contradicciones: falta un set de pares positivos y near-negative con labels adjudicadas por el dueño, comparabilidad explícita y fuentes independientes. Run50 prueba solo la ruta técnica con un fixture sintético.

## Siguiente paso

Construir un pequeño conjunto owner-gold de contradicciones y controles cercanos en documentos o casos deliberadamente preparados, declarar scope y validez antes de llamar al modelo, y separar los resultados sintéticos de los reales. Mantener Jev en modo advisory y sin threshold hasta contar con suficientes clusters independientes y una verificación externa.

## Revisión de mantenimiento

Decisión de aprendizaje: insufficient-evidence para calibración o influencia de scores; faltan etiquetas owner-gold, clusters independientes y un verificador externo. Decisión de routing/skill: sin cambio reusable. La primera búsqueda excedió el máximo de snippet del conector (240 caracteres); se corrigió el parámetro y no se envió contenido externo en la llamada rechazada. El catálogo de descubrimiento de Bridge sigue marcado stale en el estado vigente, pero el wrapper Jev directo funcionó. Los candidatos opcionales irrelevantes del router no se cargaron ni influyeron en la ejecución. No hay evidencia para abrir una incidencia nueva: el límite usado fue un error de parámetro del caller y la degradación del catálogo ya tiene dueño/seguimiento documentado.
