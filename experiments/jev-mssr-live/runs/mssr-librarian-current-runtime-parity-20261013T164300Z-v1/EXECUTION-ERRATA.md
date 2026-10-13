# Erratas de ejecución — Run 70

Este archivo preserva desviaciones observables de captura y análisis. No cambia los inputs congelados ni agrega llamadas a la muestra registrada.

1. **Piloto pre-plan (cohort-01–03).** Se hicieron llamadas exploratorias antes de congelar el plan. Están guardadas en `PRE-PLAN-PILOT.json`, fueron excluidas de `records.jsonl` y no cuentan dentro de n=30. El plan registra esta exclusión.
2. **Salida perdida y recuperación (cohort-11).** Una llamada anterior de Jev y su fetch tuvieron salida visible perdida por un error del helper antes de guardar pack/registro. El caso fue repetido y la repetición registrada; la salida perdida no cuenta como una observación adicional.
3. **Llamadas exploratorias de cohort-16.** Hubo una búsqueda exploratoria y luego una llamada Jev cuyo output no se capturó completamente antes de persistir. Ambas quedaron fuera de la muestra; se volvió a ejecutar y guardar cohort-16 en el registro final.
4. **Recuperación de fila (cohort-14).** La primera escritura del JSONL omitió una fila; la fila completa se recuperó del objeto en memoria de la misma ejecución y se anexó. No se volvió a llamar a Jev. El archivo final tiene 30 IDs únicos.
5. **MCP no parseable y retry (cohort-27).** El primer resultado comenzó con `McpServerError` y no pudo parsearse como JSON. El retry quedó seleccionado y persistido; `jevAttempts` conserva ambos estados. `errors.jev` refleja el error del primer intento, aunque el resultado final del caso sea `selected`. La causa del error de servidor/transport no quedó identificada. El uso del primer intento es desconocido.
6. **Corrección del cálculo de rangos.** Una versión intermedia del cálculo comparaba el nombre/ruta del snapshot con la ruta fuente canónica, lo que dio comparaciones falsas en casos de la cohorte 16–19. El cálculo final compara líneas de la selección con rangos aceptables congelados dentro del `sourceRef` explícito del mismo caso. Un recálculo independiente de las 28 selecciones coincide con los tres flags persistidos: `exact`, `within`, `overlap`. Los inputs y snapshots no se modificaron.
7. **Discrepancia aritmética de revisión.** La revisora Luna reportó 8 ajustados, 13 aceptables y 7 amplios en el resumen, pero sus 28 filas individuales suman 9, 13 y 6. Se conservaron las filas y el resumen original; el informe usa el conteo individual y marca el conflicto.

No se agregan a `records.jsonl` intentos sin salida recuperable, llamadas pre-plan ni llamadas de exploración. Los contadores de tokens reflejan solo las respuestas finales guardadas.
