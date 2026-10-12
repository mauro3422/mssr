# Run 59 — piloto holdout de consultas en español sobre documentación inglesa

Fecha de ejecución: 2026-10-12. Run: mssr-librarian-spanish-source-holdout-pilot-20261012T161950Z-v1.

## Alcance y procedencia

Se congelaron seis preguntas en español sobre tres documentos Markdown en inglés/español, de DuckSugar, Incremental Farm y Zomboid Smartwatch Network. El inventario previo encontró 85 documentos elegibles en esos repositorios sin coincidencia exacta de hash o ruta relativa con 160 snapshots de 83 corridas anteriores. El contenido es holdout dentro de esas fuentes; Zomboid no es project-name-blind porque el nombre del proyecto apareció en handoffs previos.

Las tres etiquetas positivas y tres negativas son source-derived, revisadas antes de las llamadas, y no son owner-gold. Las negativas significan que la respuesta no está declarada en ese archivo, no que falte en todo el proyecto. Metadata y query variants estaban apagados. La corrida queda congelada; este informe es derivado y no cambia el manifiesto, solicitudes, respuestas ni checksums del paquete.

Bridge 0.6.175 / MSSR 0.2.127 / Jev 1.13.0. Las seis solicitudes terminaron. El adaptador no devolvió IDs de Jev y no observa las llamadas de transporte bajo Bridge; el flag --allow-network documenta autorización, no prueba por sí solo la ruta de red. Uso: 10.848 tokens de entrada y 840 de salida.

## Resultados mecánicos

| Medida | Resultado | Lectura |
|---|---:|---|
| Solicitudes completadas | 6/6 | Sin fallas registradas |
| Answerability frente a etiquetas source-derived | 5/6 (83,3%) | Métrica descriptiva sobre seis casos |
| Positivas seleccionadas | 2/3 | La positiva Zomboid quedó sin respuesta; search devolvió cero, pero Jev recibió 9 encabezados por el modo implícito del runner |
| Negativas con abstención | 3/3 | Controles source-scoped; dos se ejecutaron en modo implícito de encabezados tras una búsqueda vacía |
| Target positivo presente en búsqueda | 2/3 | El documento Zomboid no produjo candidatos para la consulta española |
| Selección de rango exacto | 1/3 positivas | DuckSugar exacto; Farm eligió sección más amplia |
| Fetch/fingerprint/evidence pack | 2/2 selecciones | Integridad del texto, no calidad semántica general |
| Scores de evidencia capturados | 6/6 | Descriptivos, no calibrados; Noul separado estuvo ausente 6/6 |

Un revisor Luna nuevo, sin el historial de diseño de etiquetas ni resultados, evaluó los dos textos positivos seleccionados y encontró ambos suficientes para responder. El fragmento DuckSugar cubre exactamente la línea 29. Para Farm, Jev eligió la sección completa L16–L29: contiene la respuesta L18–L24, pero devuelve 14 líneas cuando bastaban 7. El scorer estricto no lo cuenta como selección exacta; la revisión semántica sí confirma que el texto responde. Esto señala una oportunidad de precisión/segmentación, no una respuesta incorrecta.

## Falla observada

La pregunta positiva de Zomboid preguntaba en español por el resultado de la aceptación al perder el reloj. La búsqueda devolvió cero resultados. Sin embargo, el runner omitió `candidateHandles` cuando la lista quedó vacía; `mssr_librarian_jev_select` interpretó esa omisión como modo implícito y ofreció a Jev los nueve encabezados del documento. Jev se abstuvo y no hubo fetch. Por tanto, el resultado confirma una omisión de recuperación, pero no mide la respuesta del selector ante un pool vacío ni una abstención sin candidatos. El control negativo Farm tuvo la misma bifurcación: búsqueda cero, siete encabezados implícitos y abstención. Los otros negativos recibieron 13 y 20 resultados. Las abstenciones observadas siguen siendo válidas para esos documentos, pero la corrida mezcla selección condicionada por búsqueda con selección implícita de todo el documento.

## Qué aporta y qué no

- Aporta evidencia fresca, de tres repositorios, de que la integridad de fetch y pack se mantiene y de que el selector puede responder preguntas breves con evidencia exacta o suficiente.
- No aporta una prueba de Jev con pool vacío: en los dos casos con búsqueda vacía el selector recibió todos los encabezados implícitos (7 y 9). El runner compartido ahora corta ese camino para futuras corridas y registra `not-run/no-search-candidates`; las solicitudes y respuestas originales quedan intactas.
- Reproduce el límite de consultas multilingües visto en diagnósticos previos: la expansión lingüística puede ayudar, pero este paquete no probó variantes y no debe reutilizarse para ajustar parámetros.
- La elección de una sección de 14 líneas frente a la tabla necesaria de 7 refuerza que conviene medir precisión/overbreadth además de exactitud literal.
- No establece fiabilidad de producción, tasa general de alucinación, umbral de confianza, calibración, síntesis/compactación, contradicciones ni activación del catálogo MCP productivo. Hay solo tres grupos de fuente, las etiquetas no son owner-gold y los negativos son escasos.

## Siguiente experimento recomendado

Congelar un paquete nuevo de fuentes y etiquetas adjudicadas por dueños: comparar búsqueda literal con variantes bilingües manteniendo idéntico el pool para separar recuperación de selección; incluir documentos con tablas/secciones para medir cobertura y exceso de líneas; y agregar pares de evidencia contradictoria reales con resolución exigida. Mantener metadata y umbrales sin cambios hasta medir esa comparación. No reutilizar estos tres documentos para ajustar y volver a puntuar el holdout.

## Archivos

- summary-calculated.json: resumen mecánico reproducible del paquete.
- derived/ADJUDICATION-REPORT.md: este análisis y revisión semántica.
- DERIVED-SHA256SUMS.txt: hashes de los dos archivos derivados.
- SHA256SUMS: checksums originales generados por el runner; no se reescribieron.
