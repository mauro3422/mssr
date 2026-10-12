# Run 60 — análisis posterior

Fecha: 2026-10-12
Ejecución: `mssr-librarian-run60-fresh-crossproject-bilingual-20261012T1725Z-v1`; build local fijado: Bridge 0.6.175 (`999a8a218405c02a4f4bf9d408ec44074724f694`), MSSR 0.2.127, Jev 1.13.0, Node 24.16.0.

## Qué midió

Run60 aisló el recorrido de texto sin metadatos: búsqueda sobre Markdown de una sola fuente → selección o abstención de Jev → fetch del handle exacto → evidence pack citado. Usó seis archivos de cinco proyectos; por cada una de seis preguntas respondibles y seis controles no respondibles se probaron una consulta sólo en español y una variante español+inglés. Cada par lingüístico es una medida repetida, no dos observaciones independientes. Las etiquetas se prepararon desde las fuentes y recibieron revisión independiente de Luna, pero no adjudicación del dueño del repositorio.

## Resultados

- Las 24 solicitudes de la corrida terminaron; 0 quedaron registradas como fallidas.
- Jev seleccionó 10/12 consultas respondibles: 5/6 en español y 5/6 en español+inglés. Las dos abstenciones falsas fueron una consulta del sistema de entrada de MotorGrafico en español y una consulta de layout en la variante bilingüe.
- Los 12/12 controles cuya respuesta no está en el archivo consultado terminaron en abstención; hubo 0 selecciones falsas. “No está en el archivo” no significa que el dato no exista en otro lugar del proyecto.
- En búsqueda, sólo 4/12 candidatos coincidieron a la vez en fuente, encabezado y límites exactos del rango etiquetado. Un recálculo separado encontró las líneas de respuesta dentro de algún candidato de la misma fuente en 12/12; 11/12 también coincidieron con el encabezado esperado. El único caso sin encabezado alineado fue MotorGrafico Input: la cobertura de líneas provino de un rango de documento completo, no de un apartado enfocado. Por ello 12/12 es una medida inclusiva de presencia de líneas, no una medida suficiente de recuperación útil.
- De las 12 consultas positivas, 3 selecciones coincidieron con un rango aceptable exacto y otras 3 con un rango amplio que se había etiquetado previamente como relevante. Las 4 selecciones restantes quedaron fuera de los rangos preetiquetados; eso no las convierte automáticamente en incorrectas.
- Una revisión ciega de los 10 textos seleccionados los consideró suficientes para responder. Seis eran claramente más amplios de lo necesario; tres eran exactos y uno era más amplio pero enfocado. La mediana de caracteres seleccionados fue 3,59× el rango-oráculo y el total 4,63×. Es una señal de sobreextensión, no una medida de pérdida semántica.
- Las 10 selecciones que llegaron a fetch pasaron fingerprint y evidence-pack; las dos abstenciones falsas no produjeron esos artefactos.
- El proveedor registró 140.293 tokens de entrada y 10.666 de salida. La respuesta no expuso IDs de solicitud ni un conteo verificable de invocaciones en la capa de transporte.

## Scores y su alcance

Los valores de `evidenceSufficiency` quedaron entre 0,70–0,98 en selecciones positivas y el máximo de los controles negativos fue 0,45. En esta muestra pequeña un corte de 0,5 reproduce las decisiones actuales, pero no recupera las dos abstenciones falsas; no es calibración ni justifica adoptar ese corte. `rawChoiceConfidence` también apareció alto en controles negativos, y `noul` llegó como `null` en todos los registros. Mantener los tres campos descriptivos y no intercambiables.

Los seis conceptos positivos y los seis negativos se repitieron en dos brazos de idioma sobre sólo seis archivos. Las etiquetas son source-derived, los revisores ciegos son model-assisted y los resultados se agrupan por documento. No estiman una tasa de fiabilidad general ni una probabilidad utilizable en producción.

## Corrección de evaluación

El campo histórico `searchTargetRecallAt100` del runner llamaba “recall” a una igualdad estricta de encabezado e inicio/fin de líneas. Eso explicaba por qué un candidato que contenía la respuesta completa podía puntuar como fallo. Se dejó la cifra histórica intacta y el runner/resumidor futuros ahora muestran por separado:

- `searchExactLabeledRangeAt100`: coincidencia exacta de fuente, encabezado y límites.
- `searchTargetRangeContainedAt100`: candidato de la misma fuente y encabezado que contiene todas las líneas etiquetadas.
- `searchTargetLinesContainedAt100`: candidato de la misma fuente que contiene esas líneas, aunque su encabezado no esté alineado.

Las métricas de contención indican cobertura de recuperación; no sustituyen la revisión semántica del texto ni la medición de precisión/anchura. `summary-calculated.json` es un derivado recalculado después del run; los artefactos originales del run no se editaron. `DERIVED-SHA256SUMS.txt` verifica ambos derivados.

La regresión `npm run test:jev-run-summarizer` cubre selección exacta, candidato amplio que contiene el rango, solapamiento parcial que no lo contiene y líneas alineadas bajo encabezado no alineado. Pasó con 0 requests de red.

## Qué demuestra y qué no

Run60 respalda que, para estos casos, Jev separó bien responder/abstener y que el fetch citado conserva integridad cuando hay selección. Muestra una selección semánticamente útil con tendencia a pedir más contexto del necesario. La búsqueda encuentra las líneas en este corpus, pero con alineación exacta baja y un caso devuelto sólo como documento completo.

Este run tenía `metadataMode: off`: no midió EvidenceAtoms, referencias o skills, contradicciones, evidencia de varios documentos, unión/facetas, composición de párrafos ni compactación semántica. Tampoco probó una llamada del catálogo MCP activo: el runner usó el build Bridge local identificado arriba. Las corridas anteriores sí tienen pilotos de facetas y composición de párrafos —por ejemplo Run40—, pero son muestras pequeñas asistidas por host, no validación general de ese flujo. No hubo cambio de umbral, runtime ni política de producción.

## Siguiente evaluación

1. Repetir búsqueda con variantes de idioma sobre el mismo pool de candidatos y separar ausencia de candidato, alineación de encabezado, contención de líneas y precisión del span.
2. Preparar fuentes disjuntas con respuestas positivas, negativos difíciles y adjudicación del dueño; comparar variantes por concepto y agrupar resultados por proyecto/documento.
3. Hacer un brazo distinto con metadatos/atoms y luego medir relaciones de contradicción/supersesión, unión de facetas y composición citada como etapas separadas.
4. Registrar anchura/overbreadth y cobertura semántica mediante revisión ciega; evaluar calibración sólo con suficientes unidades independientes y etiquetas adjudicadas.
5. Mantener las salidas Jev como recomendaciones acotadas hasta que los gates de holdout, calibración y verificación independiente estén satisfechos.
