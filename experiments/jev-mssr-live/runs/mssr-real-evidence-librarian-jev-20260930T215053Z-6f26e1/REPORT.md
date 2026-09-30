# Corrida exploratoria live de Librarian + Jev en MSSR

**Run:** `mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1`
**Commit/build:** `7fd0f7414e636d17cfac385cbffea9b55f83e78c` / `mssr-build:sha256:cfaaa9b0f9ad1977`
**Proveedor/modelo:** TypeSafe Jev `jev-1.13.0`; 4 requests exitosos.

## Datos y protocolo

Se congelaron cuatro documentos Markdown reales del checkout MSSR, cuatro consultas de recuperación y ocho bloques exactos para formar cuatro pares de evidencia. Las etiquetas quedaron en `inputs/labels.json`, fuera del request a Jev. Son etiquetas del autor sin adjudicación independiente. El corte es exploratorio (4 consultas y 4 pares); no se abrió un holdout y no mide calibración.

## Resultados

- **Bibliotecario:** el bloque esperado apareció en el top 5 en **4/4** consultas, pero quedó primero en **0/4**. Rangos esperados: **3, 2, 5 y 2**; MRR **0,383**. Los encabezados padre suelen adelantarse a la sección precisa.
- **Fetch exacto:** **8/8** bloques pasaron la comprobación del handle/fingerprint.
- **Jev relaciones:** coincidió con **3/4** etiquetas exploratorias. Predijo `supports` para dos pares complementarios y `unrelated` para el par sin vínculo. En el cuarto, predijo `supports` con confianza **0,45**, aunque la etiqueta era `unresolved` por alcance/tiempo ausentes.
- **Protección downstream:** el evaluator y los dos previews dejaron todo en `review`; **0** propuestas permiten aplicar o reescribir. Para el caso sin alcance/tiempo se registraron `missing-claim-scope`, `missing-claim-validity` y comparabilidad desconocida.
- **Uso Jev:** **6.906 tokens de entrada**, **278 de salida**, latencia media de transporte **337 ms**.
- **Contradicciones:** no se incluyó ningún positivo adjudicado de contradicción. Jev no propuso una, pero este corte **no mide** precisión ni recall de esa clase.

## Qué significa y qué sigue

La integración recorre búsqueda → fetch exacto → EvidenceAtoms → Jev → preview reversible usando contenido MSSR real. El Bibliotecario encuentra los pasajes en top 5, pero el ranking top 1 necesita mejora. Jev propone relaciones útiles, aunque un caso sin metadatos suficientes recibió `supports`; las guardas MSSR evitaron consolidarlo.

Para afirmar calidad general falta un corpus mayor con al menos 30 unidades independientes por conjunto reclamado, etiquetas congeladas y revisión independiente, agrupación por documento/módulo y ejemplos verdaderos de contradicción, supersesión, duplicado, apoyo, no relación y abstención. Luego conviene comparar retrieval lexical contra selección/reranking Jev y medir retención de citas/contradicciones al sintetizar. Hasta entonces Jev permanece advisory; el benchmark no activa escrituras.

La corrida histórica de 153 requests permanece intacta y separada: `D:\Dev\mssr-snapshots\benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17`.

El MCP no expuso request IDs, hora inicial individual ni el body HTTP crudo del proveedor; el artefacto conserva los inputs exactos, la respuesta normalizada, tokens y latencia por batch.
