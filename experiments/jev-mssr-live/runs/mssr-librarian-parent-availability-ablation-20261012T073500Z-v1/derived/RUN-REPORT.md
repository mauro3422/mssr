# Run 44 — parent-availability ablation

Fecha: 2026-10-12. Corrida exploratoria con cuatro decisiones Jev en dos pares. La ejecución utilizó el módulo release local de Bridge 0.6.173 / MSSR 0.2.127 y devolvió `typesafe-jev` / `jev-1.13.0` en los cuatro registros.

## Diseño

Se congelaron y reutilizaron los pools de candidatos de Run 43: ocho candidatos por pregunta y siete tras retirar únicamente el parent que contenía el rango objetivo. Se mantuvo el orden de los candidatos restantes. No se volvió a ejecutar la búsqueda del Bibliotecario; Run 44 mide la selección de Jev condicionada a esos handles. Las fuentes ya estaban expuestas en Run 43, por lo que esto no es un holdout ni una muestra independiente.

Q01 preguntó qué significa el umbral de relación raw predeterminado de 0.75. Q02 preguntó qué debe volver a leer y comparar el host antes de consumir una synthesis preview. La ablación también retiró contexto adicional junto con cada parent, así que el contraste no identifica por sí solo un efecto causal general del tamaño o presencia de parents.

## Resultados

| Par | Selección con pool completo → parent retirado | Match exacto | Cobertura ciega | Sobreextensión | Choice raw |
|---|---|---:|---|---|---:|
| Q01 | `heading-1` de 3.276 caracteres → `block-4` exacto de 1.197 | 0 → 1 | completa en ambos | alta → baja | 0,74 → 1,00 (+0,26) |
| Q02 | mismo `heading-1` competidor de 3.276 caracteres en ambos; objetivo: 2.149 | 0 → 0 | completa en ambos | alta en ambos | 0,68 → 0,91 (+0,23) |

Un revisor Luna independiente evaluó a ciegas los cuatro extractos con IDs opacos: cobertura semántica completa en 4/4, sobreextensión alta en 3/4 y baja en 1/4. La adjudicación posterior y el mapeo de IDs se guardan por separado en `review/blind-review-response.json` y `derived/unblinded-adjudication.json`. La revisión no es owner-gold ni calibración.

El resumen mecánico marca 4/4 decisiones de answerability correctas porque todos los casos eran respondibles y Jev seleccionó en todos. Esa métrica sólo mide seleccionar frente a abstenerse. En calidad de rango, Jev seleccionó el rango aceptado exacto en 1/4; no hubo coincidencias con rangos adicionales explícitamente marcados como relevantes; tres selecciones quedaron fuera de los rangos aceptados y son **no evaluadas** por la etiqueta, no automáticamente incorrectas o irrelevantes. La revisión ciega sugiere que las tres aun así cubrían la pregunta, aunque con exceso de contexto.

Los cuatro fetches pasaron fingerprint y revisión de bytes; los cuatro evidence packs quedaron validados. Uso total: 6.496 tokens de entrada y 488 de salida. La búsqueda no se midió. Tampoco se midieron composición de párrafos por el host, compactación semántica, calidad de síntesis o uso en producción.

## Lectura

Retirar el parent del objetivo ayudó a Q01: Jev pasó del parent amplio al bloque exacto, que además era suficiente con baja sobreextensión. En Q02 la misma ablación no resolvió la ambigüedad entre documentos: Jev mantuvo el rango de política competidor, que el revisor juzgó suficiente pero demasiado amplio. La Choice raw subió 0,23 sin cambiar la selección exacta. Esto refuerza que el score no se debe tratar como porcentaje de confianza calibrado ni usar esta corrida para mover un umbral.

Los cuatro registros devolvieron modelo y proveedor, timestamps, huellas de petición, uso de tokens y salidas completas, pero `providerRequestId` es `null` en las cuatro respuestas; `run-completion.json` cuenta cero IDs y deja `providerTransportInvocationsObserved` como `null`. La evidencia respalda cuatro respuestas registradas del adaptador con identidad `typesafe-jev` / `jev-1.13.0`, pero no tenemos IDs remotos por llamada ni una medición independiente del transporte.

## Integridad y límites

Los artefactos congelados originales no se modificaron. Los 15 hashes que ya estaban listados coincidieron y el SHA-256 de `manifest.json` coincidió con `run-completion.json`. El índice original había omitido `review/blind-review-input.json`; el `SHA256SUMS` final se regeneró para cubrir todos los archivos del paquete, excepto el propio índice. El escaneo de patrones comunes de credenciales no encontró coincidencias.

Son dos pares vinculados sobre dos pools previamente expuestos. Los IDs de opción se pueden renumerar al retirar candidatos y el parent retirado también aporta contexto. Los scores raw Choice/Noul no están calibrados. No cambia umbrales, sidecar, comportamiento de producción ni runtime.

## Próximo gate

Preparar un conjunto prospectivo con fuentes separadas de los runs anteriores, etiquetas de dueño congeladas antes de llamar a Jev y adjudicación independiente por faceta. Medir búsqueda, selección de rango, cobertura semántica, fetch/integridad y composición del host por separado; incluir negativos y contradicciones reales. Mantener los scores como descriptivos hasta contar con suficientes grupos independientes para evaluar riesgo/coverage y calibración.
