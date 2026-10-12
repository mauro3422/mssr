# Seguimiento por facetas — snapshot exacto

## Pregunta y método

Se dividió la consulta compuesta de importación en metadatos por descarga, reglas del destino y límites de archivo/lote. El run es una repetición vinculada a una sola fuente, no tres unidades independientes ni un holdout. Las consultas, objetivos provisionales y top-20 de búsqueda se congelaron antes de Jev; las etiquetas no se enviaron. Para el pool de Jev se conservaron todos los handles `block` del top 20 y se excluyeron las secciones por una condición fija de granularidad, sin filtrado por líneas esperadas.

La fuente congelada se leyó mediante Bridge `read_text_file`; Bridge informó 5.221 bytes y su escritura de verificación confirmó SHA-256 `8e2478f18ce30c41a8d2352189079053676253f48da7446e79e8e1430e42ad48`, 40 líneas. Los tres rangos seleccionados reportan esa misma revisión.

## Resultado

| Faceta | Bloques en pool | Rango objetivo en búsqueda | Jev seleccionó | Fetch exacto |
|---|---:|---:|---|---:|
| Metadatos de descarga | 13 | 3 | L8, block-2 | 375 caracteres |
| Reglas del destino | 14 | 3 | L10, block-3 | 253 caracteres |
| Límites | 13 | 3 | L12, block-4 | 313 caracteres |

Tres llamadas Jev 1.13.0 seleccionaron los tres bloques correctos. Los fetches coincidieron con el slice exacto congelado, el fingerprint y la revisión en 3/3. El evidence pack retuvo tres citas literales y 941 caracteres, sin dedupe ni reescritura. Una respuesta host-side contestó las tres partes y dos revisores Luna con evidencia literal la calificaron completa, sin errores ni omisiones.

Uso observado: 10.398 tokens de entrada, 541 de salida; latencia reportada media 323,6 ms. Choice fue 1,00/0,67/1,00 y Noul 0,82/0,74/0,96. Son números descriptivos de estas tres llamadas; no son probabilidades calibradas ni una base para umbrales.

## Interpretación y límites

La descomposición y el pool de bloques resolvieron la consulta compuesta en esta fuente. La búsqueda recuperó cada bloque objetivo en el puesto 3 del top 20. Esto sugiere que el host debería comprobar cobertura de facetas y unir rangos exactos cuando una selección singular deja preguntas sin responder.

Es un solo cluster ya relacionado con Run55, con positivos source-derived, sin owner-gold ni control negativo. La evidencia-pack es copia literal, no compactación semántica. El texto final lo redactó un agente Luna; Jev eligió los rangos, no generó el párrafo. No se modificaron runtime ni política. La primera respuesta de Situation Model de Run55 se afinó por separado para nombrar el destino exacto, sin cambiar la selección o el score.

## Evidencia primaria

Los requests y hashes previos a Jev están en `inputs/` y `PRE-JEV-SHA256SUMS.txt`. Respuestas crudas en `raw/search-*.json`, `raw/jev-block-only-*.json`, `raw/fetch-*.json`, y `raw/evidence-pack-union.json`. Las revisiones ciegas están en `derived/composition-review-*.json`.
