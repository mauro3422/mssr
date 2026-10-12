# MSSR Librarian + Jev — cross-project development cohort

Run: mssr-librarian-cross-project-development-cohort-20261012T083000Z-v1

## Alcance y límites

Corrida diagnóstica de desarrollo sobre 12 facetas semánticas en 4 familias de documentos: 12 consultas positivas, 4 negativos cercanos y 4 pares bilingües. Los pares inglés/español cuentan como condiciones emparejadas, no como observaciones independientes. Las etiquetas estuvieron ocultas al proveedor según el protocolo del paquete, fueron derivadas de los snapshots y revisadas por un analista independiente; no hay adjudicación de los dueños. La exposición externa de estas fuentes no puede descartarse.

Esto no es un holdout certificado ni una medición de confiabilidad de producción. Las Choice/Noul y providerConfidence son salidas descriptivas sin calibración. No se estiman Brier, ECE ni un umbral de confianza.

La búsqueda usó metadata off y ninguna variante de consulta. Elemental Frontier pasó por MSSR portable porque el núcleo de identidad de proyecto del adaptador Bridge estaba en estado review por superar presupuesto; sus resultados sí ejercitaron búsqueda, Jev, fetch y pack, pero no el adaptador de fuente Bridge para ese repo.

## Resultados por etapa

| Etapa | Resultado |
|---|---:|
| Búsqueda: target aceptable en el pool | 9/12 (75%) positivas |
| Búsqueda: target en top 1 | 0/12 (0%) positivas |
| Búsqueda: target en top 5 | 9/12 (75%) positivas |
| Búsqueda: target en top 10 | 9/12 (75%) positivas |
| Jev: llamadas con el pool idéntico a la búsqueda congelada | 14/14 (100%) llamadas |
| Jev: positivo seleccionado | 8/12 (66.7%) casos positivos |
| Jev: positivo seleccionado entre llamadas | 8/10 (80%) positivos llamados |
| Jev: positivo abstuvo | 2/10 (20%) positivos llamados |
| Positivo: sin candidatos, Jev no llamado | 2/12 (16.7%) casos positivos |
| Negativo: Jev abstuvo | 4/4 (100%) negativos enviados a Jev |
| Selección dentro de sección esperada | 8/8 (100%) selecciones |
| Selección cubre todas las líneas etiquetadas como soporte | 5/8 (62.5%) selecciones |
| Fetch exacto y fingerprint | 8/8 (100%) seleccionados |
| Evidence pack conserva texto/cita exactos | 8/8 (100%) seleccionados |

La búsqueda recuperó el rango aceptable en 9/12 consultas positivas. Las tres omisiones fueron KODE-01-ES, EF-01-EN, ERS-01-ES. Una omisión (KODE-01-ES) sí tenía candidatos, pero no el rango objetivo; EF-01-EN y ERS-01-ES no devolvieron candidatos. Las consultas negativas sí recibieron pools de búsqueda; la abstención ocurrió en Jev, no en la recuperación.

Jev seleccionó 8 rangos; 3 cubrieron el rango aceptable completo y 8 quedaron dentro de su sección esperada. La cobertura línea por línea del soporte etiquetado fue completa en 5/8 selecciones. Ese solapamiento es una señal diagnóstica, no una medida completa de suficiencia semántica: el alcance de algunas etiquetas es más amplio que el texto mínimo que permite contestar.

Todas las selecciones que se enviaron a adquisición pasaron fetch exacto y evidence pack (8/8 cada uno). Esto demuestra integridad/procedencia del material seleccionado, no que todas las respuestas sean completas.

## Casos

| Caso | Pool | Rango aceptable: posición | Jev | Rango seleccionado | Solapamiento con soporte | Fetch | Pack |
|---|---:|---:|---|---|---:|---|---|
| GDA-01-EN | 10 | 2 | seleccionó / raw 0.54 | heading-6 L62-87 | 6/6 (100%) | pass | pass |
| GDA-01-ES | 4 | 2 | seleccionó / raw 0.94 | heading-6 L62-87 | 6/6 (100%) | pass | pass |
| GDA-02-EN | 10 | 3 | seleccionó / raw 0.74 | block-9 L90-97 | 4/4 (100%) | pass | pass |
| GDA-NEG-01 | 10 | ausente | se abstuvo / raw 0.82 | — | — | — | — |
| KODE-01-EN | 10 | 3 | seleccionó / raw 0.6 | block-47 L175-175 | 1/3 (33.3%) | pass | pass |
| KODE-01-ES | 10 | ausente | se abstuvo / raw 0.59 | — | — | — | — |
| KODE-02-EN | 10 | 5 | seleccionó / raw 0.92 | block-50 L183-187 | 5/5 (100%) | pass | pass |
| KODE-NEG-01 | 10 | ausente | se abstuvo / raw 0.99 | — | — | — | — |
| EF-01-EN | 0 | ausente | sin candidatos | — | — | — | — |
| EF-01-ES | 10 | 2 | seleccionó / raw 0.88 | block-5 L19-27 | 9/11 (81.8%) | pass | pass |
| EF-02-EN | 10 | 3 | seleccionó / raw 1 | heading-5 L33-48 | 13/13 (100%) | pass | pass |
| EF-NEG-01 | 8 | ausente | se abstuvo / raw 0.97 | — | — | — | — |
| ERS-01-EN | 10 | 2 | seleccionó / raw 0.45 | heading-5 L43-56 | 14/44 (31.8%) | pass | pass |
| ERS-01-ES | 0 | ausente | sin candidatos | — | — | — | — |
| ERS-02-EN | 10 | 2 | se abstuvo / raw 0.69 | — | — | — | — |
| ERS-NEG-01 | 10 | ausente | se abstuvo / raw 0.99 | — | — | — | — |

El rango aceptable del buscador exige la ruta de encabezado esperada y cobertura de todo el intervalo congelado. La cobertura de soporte es intersección de líneas inclusiva; no la interpretes como juicio semántico independiente.

## Resultados por fuente

| Fuente | Recall de target | Top 5 | Positivos seleccionados | Negativos abstienen |
|---|---:|---:|---:|---:|
| godot-atlas | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 1/1 (100%) |
| kode | 2/3 (66.7%) | 2/3 (66.7%) | 2/3 (66.7%) | 1/1 (100%) |
| elemental-frontier | 2/3 (66.7%) | 2/3 (66.7%) | 2/3 (66.7%) | 1/1 (100%) |
| electronics-repair-simulator | 2/3 (66.7%) | 2/3 (66.7%) | 1/3 (33.3%) | 1/1 (100%) |

## Pares bilingües

| Familia / faceta | Inglés | Español | Misma disposición |
|---|---|---|---|
| godot-atlas / interaction-transition | en: seleccionó (target en pool) | es: seleccionó (target en pool) | sí |
| kode / model-package-precedence | en: seleccionó (target en pool) | es: se abstuvo (target ausente) | no |
| elemental-frontier / comparison-controls | en: sin candidatos (target ausente) | es: seleccionó (target en pool) | no |
| electronics-repair-simulator / layer-model | en: seleccionó (target en pool) | es: sin candidatos (target ausente) | no |

Coincidieron en disposición 1/4 (25%) pares. Este patrón identifica un área de recuperación multilingüe que conviene medir con una variante de consulta/metadata pre-registrada, pero cuatro pares no justifican una tasa general.

## Negativos, tokens y confianza

Los 4 negativos se abstuvieron (4/4 (100%)); no hubo selección de un negativo en esta cohorte. Los 14 recibos Jev suman 24078 tokens de entrada y 1960 de salida. El proveedor/modelo reportado fue typesafe-jev/jev-1.13.0.

Los valores raw de confidence se conservan caso por caso en aggregate.json, pero no son probabilidades calibradas. El promedio descriptivo fue 0.759 en selecciones positivas, 0.64 en abstenciones positivas y 0.943 en negativos abstinentes. Los negativos abstuvieron aun con providerConfidence entre 0.82 y 0.99; este campo no es una probabilidad calibrada de respuesta correcta. La muestra y las etiquetas de analista no permiten elegir un score de paso. La política futura debería exigir evidencia recuperada, cobertura suficiente de cada faceta de la consulta y revisión de contradicciones; agregar evidencia no debe elevar confianza por sí solo.

## Compacción y composición

En el control determinista de contención, el pack pasó de 1800 a 1401 caracteres: se quitaron 399 (22.2%) y las citas pasaron de 2 a 1. Solo se quitó el hijo estrictamente contenido por el padre. Es ahorro de texto sin pérdida de bytes cubiertos, no resumen semántico ni síntesis de varios hechos.

Una revisión ciega independiente de los cuatro párrafos host-compuestos evaluó: Tres párrafos tuvieron cobertura alta, buen soporte y poca sobreextensión. El párrafo de Electronics Repair Simulator tuvo cobertura baja pero delimitada honestamente porque el extracto seleccionado solo contenía la Capa 2; los cuatro estaban respaldados literalmente y no incluían afirmaciones sin soporte.

| Familia | Cobertura | Soporte literal | Sobreextensión | Afirmaciones no sustentadas |
|---|---|---|---|---|
| GodotAtlas | alta | alto | baja | ninguna |
| Kode | alta | alto | baja | ninguna |
| Elemental Frontier | alta | alto | baja | ninguna |
| Electronics Repair Simulator | baja pero delimitada | alto | baja | ninguna |

El texto exacto de esos borradores no estaba persistido en los recibos al cerrar la revisión; se conserva el veredicto, no un replay textual auditable.

## Hallazgos y siguiente experimento

1. Atacar primero la recuperación entre idiomas: tres consultas positivas perdieron el rango esperado y dos ni siquiera produjeron candidatos. Comparar una expansión/traducción explícita con el baseline, conservando pools y negativos, sin mandar etiquetas a Jev.
2. Medir suficiencia de evidencia por faceta. ERS-01 seleccionó solo la Capa 2 dentro de una pregunta sobre el modelo de tres capas; ERS-02 abstuvo aunque el rango esperado estaba en el pool. Probar descomposición en facetas, unión de rangos exactos y un verificador que marque cobertura faltante antes de redactar.
3. Agregar evidencia atom/metadata y contradicciones como un brazo separado. Esta cohorte usó metadata off y no ejercitó el grafo de contradicciones; no puede validar esas capas.
4. Guardar el texto final compuesto, la cobertura por faceta, las citas y la revisión ciega como artefactos derivados antes de cualquier llamada de adjudicación. Esta corrida conserva el veredicto del revisor, pero no el cuerpo exacto de los cuatro borradores.

El resultado apoya un sistema compuesto de búsqueda, elección, fetch verificado, empaquetado y ensamblado host-side. No demuestra que Jev por sí mismo haga grep, compresión semántica ni prosa abierta: esas capacidades dependen de la orquestación y del componente que las ejecuta.

## Reproducibilidad

Ejecutar desde la raíz del repo: node experiments/jev-mssr-live/runs/mssr-librarian-cross-project-development-cohort-20261012T083000Z-v1/scripts/aggregate-run.mjs

El script verifica hashes/tamaños de los cuatro snapshots, la huella de cada input y recibo crudo contra derived/frozen-evidence-sha256.json, los pools Jev exactos y las referencias de fetch/pack antes de producir el agregado y el informe. Ese índice se creó después de las llamadas: fija los bytes para reruns futuros, pero no es una atestación pre-call ni demuestra por sí solo que el proveedor no vio etiquetas.
