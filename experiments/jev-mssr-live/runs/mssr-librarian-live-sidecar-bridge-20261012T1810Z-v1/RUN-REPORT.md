# Run 61 — piloto live del sidecar de Project Context

**Estado:** diagnóstico exploratorio terminado; no es evaluación de fiabilidad ni calibración.

## Diseño y ruta

Se probaron cuatro fuentes MSSR con revisiones SHA-256 congeladas en `RUN-PLAN.md`. Para cada una se formularon preguntas en inglés y español, con su variante bilingüe explícita, y se compararon dos brazos: búsqueda léxica con metadata apagada y búsqueda con el filtro exacto del sidecar de Project Context. Se ejecutó la ruta live Bridge 0.6.175 / MSSR 0.2.127 / Jev 1.13.0: búsqueda → selección Jev → fetch exacto → evidence pack.

El plan se fijó antes de las llamadas puntuadas. Un smoke inicial y un intento de búsqueda rechazado antes de leer fuentes por `maxSnippetChars=260` están excluidos. El esquema live confirmó `queryVariants` y el límite máximo de 240; la corrida puntuable usó 160. Esos errores previos no llegaron a Jev.

## Resultados

| Medición | Léxico, metadata off | Sidecar exacto |
|---|---:|---:|
| Consultas de búsqueda | 8 | 8 |
| Objetivo exacto presente en top 8 | 5/8 | 8/8 |
| Selecciones Jev | 5/8 | 7/8 |
| Abstenciones Jev | 3/8 | 1/8 |

El control recuperó los cuatro objetivos con pregunta primaria en inglés (4/4), pero sólo uno con español primario (1/4). El sidecar proyectó los cuatro selectores declarados (4/4, cero omitidos) y recuperó el objetivo en ambos idiomas para las cuatro fuentes (8/8). Cada filtro del tratamiento devolvió un candidato del objetivo esperado. Esto mide la proyección y consulta de esos cuatro selectores exactos; el host aportó los filtros, así que no demuestra que Jev descubra etiquetas ni que todos los átomos o productores de metadata estén conectados.

Jev seleccionó rangos contenidos en el encabezado esperado en 12/12 decisiones seleccionadas: 5/8 en el control y 7/8 con sidecar. Las tres abstenciones del control fueron preguntas en español cuyos objetivos no aparecieron en el top 8. La abstención restante fue A4 en inglés con sidecar: el único candidato era una sección de 7.728 caracteres. En el control inglés Jev sí eligió el bloque concreto A4 de 356 caracteres; probar ese bloque contra la sección larga queda como follow-up exploratorio, fuera de esta corrida.

Los siete handles distintos seleccionados pasaron fetch y fingerprint (7/7). El evidence pack conservó siete rangos y 13.534 caracteres; su texto fue idéntico al de fetch en 7/7. Esto verifica identidad y transporte de bytes, no suficiencia semántica ni que un pack responda por completo.

Una revisión ciega de Luna examinó sólo las 12 preguntas/extractos de `BLIND-REVIEW-INPUT.md`: suficiencia 12/12; alcance, 5 focados y 7 excesivos a nivel de llamada. Al agrupar handles repetidos, 4/7 fueron focados y 3/7 excesivos. Es una revisión model-assisted, no owner-gold ni adjudicación humana independiente. Señala que el sidecar devuelve rangos correctos, pero puede devolver secciones demasiado grandes.

Las 16 llamadas registraron `typesafe-jev` / `jev-1.13.0`, 19.550 tokens de entrada, 1.460 de salida y mediana de latencia Bridge de 711,7 ms. `providerConfidence` y `evidenceSufficiency` se conservaron como scores descriptivos, sin calibrar; no se ajustó ningún umbral.

## Límites y lectura

- Sólo cuatro fuentes MSSR ya expuestas y cuatro filtros preparados por el host; los pares de idiomas y los dos brazos por fuente no son casos independientes.
- Las etiquetas se derivaron de los encabezados/objetivos congelados, sin gold adjudicado por el dueño ni holdout limpio.
- La revisión ciega fue de Luna; no valida verdad ni integridad semántica.
- Este paquete es una captura manual de llamadas MCP; no contiene un manifest de runner congelado, eventos crudos del transporte ni IDs remotos que permitan replay independiente. `records.json` conserva las respuestas normalizadas y métricas observadas, no los bytes originales del transporte.
- Sólo se ensayó el sidecar Project Context. No se probó ingreso live de metadata genérica de EvidenceAtom, skills, refs o telemetría; tampoco descubrimiento de contradicciones, merge, composición de párrafos ni compactación.
- El source `PROJECT_STATE.md` se congeló antes de añadir este informe a su estado actual. No se cambió código, catálogo, umbral ni comportamiento productivo.

**Conclusión:** en este pequeño piloto, el filtro sidecar compensó tres omisiones de búsqueda en español y las selecciones que llegaron a fetch mantuvieron rangos exactos. El siguiente trabajo es recortar rangos amplios y construir una cohorte source-disjoint con labels revisados por Mauro antes de sostener una afirmación de calidad general.
