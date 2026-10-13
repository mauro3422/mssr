# Run 70: paridad del runtime actual Bibliotecario → Jev

- **Estado:** completado con erratas y límites documentados.
- **Momento:** iniciado 2026-10-13T16:43:00Z; cierre 2026-10-13T17:07:27+00:00.
- **Runtime observado:** Bridge 0.6.179, MSSR 0.2.132, Jev 1.13.0, boot `72bd1014-9946-4245-821d-8be20272c823`.
- **Unidad:** 30 consultas sobre 30 documentos de un único grupo de proyecto MSSR, ya expuestos en corridas previas. Etiquetas derivadas de fuentes, no adjudicadas por el dueño. **No es holdout ni benchmark confirmatorio.**

## Resultado medido

| Medida | Resultado |
|---|---:|
| Búsqueda encontró el rango esperado | 30/30; cero pools truncados; tamaño de candidatos min/mediana/máx. 2/11/99 (media 21.27) |
| Jev seleccionó / se abstuvo | 28 / 2 |
| Selección exactamente igual al rango anotado | 8/28 (28.6%) |
| Selección completamente dentro de un rango aceptable | 24/28 (85.7%) |
| Selección con algún solapamiento | 26/28 (92.9%) |
| Fetch exacto, revisión/fingerprint verificados | 28/28 selecciones |
| Evidence pack verbatim válido | 28/28 selecciones |

Cuatro selecciones no quedaron completamente dentro de los rangos source-derived: cohort-04 (Choice 0.54 / sufficiency 0.40, sin solapamiento), cohort-14 (0.39 / 0.94, con solapamiento), cohort-20 (0.39 / 0.61, sin solapamiento) y cohort-29 (0.71 / 0.94, con solapamiento). Las puntuaciones son descriptivas. En particular, la suficiencia alta no garantiza el rango mínimo anotado.

## Revisión ciega de texto

Una Luna recibió 28 pares anonimizados de pregunta y extracto elegido, sin scores ni etiquetas esperadas. Clasificó el soporte como 25 directos, 2 parciales y 1 no soportado. Desde las clasificaciones individuales, el alcance fue 9 ajustados, 13 aceptables y 6 amplios. **El resumen agregado que devolvió la revisora dice 8/13/7**, así que hay una discrepancia de una unidad entre “ajustado” y “amplio”; se conservaron ambas versiones y no se resolvió a mano. El no soportado corresponde a cohort-20; los parciales a cohort-04 y cohort-21. Es revisión exploratoria asistida por modelo, no ground truth.

## Repetibilidad sobre los mismos casos

Comparado con los 30 resultados registrados el 11 de octubre (Bridge 0.6.172 / MSSR 0.2.127), coinciden las decisiones de selección/abstención en 30/30 y coinciden `rangeId` y líneas de las 28/28 selecciones. La diferencia absoluta media entre los scores de Choice guardados es 0.0411; el máximo es 0.17. Es repetibilidad en las mismas fuentes y preguntas expuestas, no generalización entre proyectos.

## Coste y latencia observados

Las 28 respuestas seleccionadas persistidas suman 123,372 tokens de entrada y 7,586 de salida. La primera respuesta MCP falló al parsearse en cohort-27 y el uso de ese intento no se conoce; por ello estos totales son el uso guardado de las respuestas finales, no el total facturable. Latencia informada por Jev: mediana 846.0 ms, media 910.0 ms, máximo 1335.7 ms en 28 respuestas seleccionadas; no es latencia end-to-end.

## Scores de Choice por banda (solo descriptivo)

- <0.50: 2/4 dentro del rango aceptable.
- 0.50–0.69: 5/6 dentro del rango aceptable.
- 0.70–0.89: 8/9 dentro del rango aceptable.
- ≥0.90: 9/9 dentro del rango aceptable.

Muestra pequeña, expuesta y de un solo clúster: **no calibra Choice/Noul y no permite fijar umbrales.** No hubo escritura canónica, síntesis/compacción de párrafos, adjudicación de contradicciones, unión de claims ni merge automático en esta corrida.

## Integridad y erratas

- Se verificó que las 30 filas sean únicas, que los tres indicadores de rango de cada selección coincidan con los spans congelados y que inputs, fetches y packs sean consistentes.
- El plan pre-run separa un piloto previo de los casos 01–03; sus llamadas no forman parte de las 30 filas.
- El historial de pérdida de salida, recuperación de la fila cohort-14 y el primer fallo/reintento de cohort-27 está en [EXECUTION-ERRATA.md](EXECUTION-ERRATA.md).
- La revisión ciega y la clave de anonimización están separadas en `blind-review-results.json` y `blind-review-key.json`; la clave se guardó después de cerrar la revisión.

## Evaluación y siguiente gate

El pipeline actual demuestra búsqueda revisionada, decisión acotada, abstención, fetch exacto y empaquetado verbatim con alta repetibilidad en casos conocidos. Los cuatro recortes fuera del rango anotado y las abstenciones siguen siendo materiales; las etiquetas todavía no están adjudicadas y el revisor ciego encontró un extracto no soportado. **No lo considero listo para merges canónicos autónomos ni para afirmar confiabilidad general.**

Siguiente evaluación útil: congelar preguntas, rangos mínimos semánticos, positivos, negativos, contradicciones y criterios de rechazo de una familia realmente no expuesta; pedir adjudicación del dueño antes de llamar a Jev; y puntuar retrieval, selección, suficiencia, sobreextensión, abstención y exactitud de evidencia por separado. Mantener la síntesis/compacción y las decisiones de unión/merge como carriles separados, con revisión humana.
