# Evaluación bilingüe del Bibliotecario MSSR

**Run:** `mssr-librarian-bilingual-retrieval-20260930-v1`
**Código evaluado:** `@mauroprime/mssr` 0.2.94, `searchMssrLibrarianEvidence` desde `dist/librarian-retrieval.js`
**Corpus:** 21 documentos Markdown actuales del repositorio MSSR, congelados desde `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`
**Consultas:** 26 necesidades de información en inglés y sus 26 paráfrasis en español
**Jev:** 0 llamadas; esta corrida mide el baseline léxico del Bibliotecario, sin reranking semántico.

## Resultado

| Idioma | Recall sección @1 | Recall sección @5 | MRR @100 | Destino ausente del top 100 |
|---|---:|---:|---:|---:|
| Inglés | 0/26 (0%) | 1/26 (3,85%) | 0,0326 | 8/26 (30,77%) |
| Español | 0/26 (0%) | 2/26 (7,69%) | 0,0257 | 22/26 (84,62%) |

En el conjunto agrupado de holdout (5 documentos fuente, 6 consultas por idioma), ninguno de los dos idiomas recuperó el destino en top 1 o top 5. El MRR @100 fue 0,0177 en inglés y 0 en español. No se ajustó el sistema con ese holdout.

Las 52 listas de resultados llegaron truncadas por el tope de 100 candidatos. Por eso el MRR reportado es MRR @100: los destinos fuera de esos 100 se cuentan como cero y no se conoce su posición completa. En este corte, el destino apareció dentro del top 100 en 18/26 consultas inglesas y 4/26 españolas.

Se verificaron 260 intentos de fetch exacto para los candidatos top 5: 193 pasaron la comprobación de rango y fingerprint; 67 se rechazaron porque la sección superaba el límite de fetch de 20.000 caracteres; no hubo fallos de integridad de handles. Los rechazos por tamaño son una limitación observable del flujo de fetch para esas secciones, no evidencia de handles corruptos.

## Lectura

El ranking léxico actual tiene rendimiento bajo para encontrar primero la sección esperada en este conjunto; en ningún caso quedó primera. La diferencia entre idiomas es visible principalmente en la cobertura del top 100: el objetivo faltó en 8 consultas inglesas y 22 españolas. Dado que `searchMssrLibrarianEvidence` compara tokens normalizados contra el encabezado, el texto y metadatos suministrados, una explicación probable es el desajuste entre el idioma de algunas consultas y el idioma del documento. Este resultado por sí solo no demuestra la causa ni generaliza a otros repositorios.

Hay un límite importante para la intervención de Jev: si el Bibliotecario no trae el destino entre sus candidatos, un reranker no puede recuperarlo. Esta corrida no evalúa un reranker con Jev; MSSR hoy expone revisión de relaciones con Jev, pero el contrato de búsqueda aquí medido es determinista y no lo invoca. El siguiente experimento debería mantener separadas generación de candidatos y selección semántica, primero con recall@100 suficiente y luego con un selector Jev explícito comparado contra el baseline.

## Etiquetas y alcance

Los destinos esperados se congelaron antes de puntuar. Una Luna diseñó las consultas; otra adjudicó a ciegas los destinos ingleses, excluyendo los IDs 05, 07, 11 y 14 por ambigüedad; una segunda pasada creó las consultas españolas, que recibió revisión independiente contra los mismos destinos. Se recuperó además el ID 13 omitido en el primer inventario y se revisó su traducción. **Son etiquetas revisadas por agentes, no por el responsable humano de la documentación**, por lo que el resultado es un benchmark exploratorio y no una verdad oro institucional.

El holdout agrupa por `sourceRef`: se seleccionaron 5 de las 21 fuentes ordenándolas por SHA-256 antes de ejecutar. Los 52 resultados brutos incluyen ranking, score, identificadores de handles y estado del fetch; el corpus, las etiquetas, el índice de destinos, el runner y los resultados están protegidos por SHA-256 en `SHA256SUMS`.

Esta evaluación cubre recuperación léxica, ranking de secciones y verificabilidad del fetch exacto. No mide calidad de respuesta redactada, reranking o búsqueda semántica con Jev, relaciones/contradicciones, síntesis/compactación, fidelidad de citas, calibración de confianza ni decisiones de escritura. La corrida live anterior de cuatro consultas y cuatro pares de relaciones se conserva intacta en [mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1](../mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1/REPORT.md).
