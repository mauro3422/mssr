# Contexto, memoria y compactación con Jev — 2026-09-19

## Pregunta investigada

¿Sirve Jev para seleccionar información y detectar posibles discrepancias antes
de una revisión más costosa? ¿Puede reducir contexto conservando información útil?
Todo es experimental/observe-only; no se compactó esta conversación, no se borraron
memorias reales, no se modificó MSSR productivo ni se instalaron plugins externos.

## Investigación pública

- [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) implementa
  selección de llamadas/resultados para Claude Code. Jev puntúa; código elimina o
  recorta candidatos y copia literalmente lo conservado. No es generación de un
  resumen ni compresión reversible de toda la información.
- [pi-jev-compaction](https://github.com/vava-nessa/pi-jev-compaction) adapta esa
  idea a Pi. Distingue necesidad de conservar llamada versus salida completa.
  Su ejemplo de reducción del 97% procede de una sesión de validación pequeña,
  no prueba general. Reconoce que una probabilidad no demuestra que sea seguro
  descartar y que reconstruir prefijos afecta caché. Reejecutar herramientas no
  siempre recupera la evidencia original, de ahí nuestro caso irrepetible.
- [pi-fast-jev-compaction](https://github.com/QuentinDanblon/pi-fast-jev-compaction)
  incorpora persistencia de decisiones y simulaciones del costo de reconstruir
  caché frente a ahorro posterior. No evaluamos ni instalamos su implementación.
- [invalidate](https://github.com/chopratejas/invalidate) compara memorias con
  eventos nuevos, preserva el texto original, marca reemplazos y contempla revisión
  humana. Planes o preguntas no se tratan como hechos consumados. Lo relevante
  para MSSR es proponer una revisión, no delegarle la vigencia canónica al modelo.
- [jev-rerank-bench](https://github.com/anessbelbati/jev-rerank-bench) publica
  respuestas y métricas de reranking con candidatos comunes. Es evidencia externa
  del autor, no una reproducción nuestra ni garantía sobre memorias de MSSR.

Se buscó también en Reddit, pero las implementaciones enlazadas por sus autores
en GitHub proporcionaron evidencia más concreta para estas preguntas.

La [lista oficial de límites](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
advierte sobre contexto irrelevante, lectura literal, indirection, números e
instrucciones adversarias. El límite de ventana no equivale a rendimiento constante
al llenarla. Reglas exactas, comparaciones temporales y autoridad quedan en código.

## Diseño congelado y datos

`context-cases.mjs`: 24 casos españoles sintéticos, cuatro por familia: contexto,
memoria, skills, documentación, arquitectura y compactación. Casos positivos,
negativos cercanos, versiones distintas, fuentes en conflicto, instrucciones
incrustadas, descripción ausente y evidencia irrepetible.

Cada caso se evalúa dos veces en dos variantes: corto, y el mismo estado con
27.071 caracteres de archivo distractor sintético (90 entradas). Total: 96 requests.
Las variantes se alternan e invierten entre repeticiones. Ruido en campo separado
`unrelatedArchive`: es una prueba relativamente fácil, no un repositorio real con
evidencia mezclada, ni stress cerca de la ventana máxima.

Modelo fijado a `jev-1.13.0`; SDK 0.6.0; timeout 30s, sin reintentos automáticos.
Una request agrupa preguntas independientes: Noul por candidato y Choice de
suficiencia; revisiones usan Choice yes/no/unknown más relevancia e impacto Score.
Score/relevancia de revisiones son exploratorios, no tienen ground truth puntuado.

Etiquetas y 12 probes textuales se escribieron antes de consultar. Son propuestas
de Codex, no juicio humano independiente. expected/rationale/probes no se envían.
Umbral de selección 0,5 fijado antes de medir y sin optimización posterior.

Corrida inicial: `results-context/2026-09-19T21-33-46-075Z/`.
Fingerprint: `7c5072dd03b680cfd63b68e1f8a61394ce90356319da09aceb97f53603987f7d`.

## Resultados de la corrida inicial

96/96 respuestas válidas, cero errores de API. 541.696 tokens de entrada y 8.896
de salida. Estimación US$0,022751; no se consultó facturación.

| Variante | p50 | p95 | Máximo | Tokens de entrada |
|---|---:|---:|---:|---:|
| Corta (48 llamadas) | 311 ms | 388 ms | 868 ms | 44.288 |
| Con distractores (48 llamadas) | 341 ms | 441 ms | 1.471 ms | 497.408 |

| Familia | Resultado de selección/revisión |
|---|---|
| Contexto | Precisión 100%, recall 71,4% en ambas variantes |
| Memorias | Precisión y recall 100% en ambas variantes |
| Skills | Precisión 100%, recall 66,7% en ambas variantes |
| Documentación | 4/4 casos coinciden en ambas variantes y repeticiones |
| Arquitectura | 4/4 casos coinciden en ambas variantes y repeticiones |
| Compactación sin guardas | Recall de fragmentos 75% corto / 83,3% con distractores |

Los dos casos de revisión con evidencia ausente respondieron unknown siempre.
La mejoría aparente con ruido en compactación no justifica agregar ruido; puede ser
variabilidad con un conjunto diminuto. En la mayoría de casos no cambió la selección.
La variante larga consumió 11,2 veces más entrada sin mejora general demostrada.

## Hallazgo: selección útil no equivale a descarte seguro

En compactar-restriccion el selector asignó 0,22 a «Usuario: no hacer commit ni
push» y lo omitió con umbral 0,5. Las cuatro observaciones de ese caso inicial
omitieron la restricción. La copia protegida la conserva por regla determinista.
También se omitió el registro de cobro duplicado en compactar-excepcion, aunque
conservó la excepción de no repetir POST sin idempotency-key.

Los originales nunca se mutan. `raw` es una simulación de descarte; `guarded`
conserva items protected y conserva todo ante error/formato inválido o suficiencia
negativa. El informe verifica reconstrucción literal y retención protegida.

## Hallazgo del instrumento y diagnóstico separado

La pregunta inicial dice «evidencia suficiente para cumplir el objetivo». En skills
y compactación el objetivo describe ejecutar una tarea, pero nuestra etiqueta
provisional esperaba suficiencia para seleccionar contexto. Jev pide código o
evidencia para ejecutar: el indicador no mide de forma limpia lo que pretendíamos.
Esto es defecto/ambigüedad de pregunta y etiqueta, no fallo de capacidad demostrado.

Se congeló una reformulación exclusivamente de esa pregunta, aclarando «seleccionar
fragmentos, no ejecutar ni terminar la tarea». Mismos ocho casos de skills y
compactación, dos variantes, dos repeticiones: 32 llamadas. Preguntas keep_* y
umbral permanecen iguales. Es diagnóstico post hoc, NO holdout ni nueva validación.

Corrida: `results-context/2026-09-19T21-35-36-560Z/` (scope-diagnostic.json).
32/32 válidas; 190.428/3.296 tokens entrada/salida; costo estimado US$0,007998.
Suficiencia coincidió 100% con las etiquetas de selección; la selección de skills
siguió omitiendo el candidato TypeSafe en el caso de fallo SDK. No se retocó su etiqueta.

| Composición en cuatro casos de compactación | Ahorro medio de caracteres | Probes conservados |
|---|---:|---:|
| Inicial, selector sin guardas | 76,8% | 87,5% |
| Inicial, conserva todo al faltar evidencia + protected | 5,1% | 100% |
| Pregunta acotada, selector sin guardas | 77,2% | 83,3% |
| Pregunta acotada, protección explícita | 76,8% | 91,7% |
| Baseline conservar todos | 0% | 100% |
| Baseline últimos dos fragmentos | 16,3% | 50% |

Los probes son doce cadenas concretas entre cuatro casos, repetidos; solo prueban
que esa información sigue textualmente presente. NO prueban que otro agente pueda
terminar la tarea. Algunos elementos etiquetados pueden ser redundantes: descartar
el aviso de que el proceso nuevo no reproduce el viejo reduce recall sin perder
los probes de ese caso. Requiere adjudicación humana, no contar todo como model error.

El ahorro es la media por caso de caracteres del texto de items; excluye metadata,
preguntas y unrelatedArchive. No es ahorro de tokens ni de factura downstream.
Los logs repetitivos facilitan la reducción: no extrapolar 77% a conversaciones.
La falta de evidencia recuperada es más importante que el porcentaje de reducción.

## Reproducir y verificar

```powershell
node experiments/typesafe-jev-lab/context-benchmark.mjs --dry-run
./experiments/typesafe-jev-lab/context-benchmark.ps1
./experiments/typesafe-jev-lab/context-benchmark.ps1 -ScopeCheck
node experiments/typesafe-jev-lab/context-report.mjs
```

El wrapper usa la credencial Windows existente y restaura el entorno; no expone
la clave. Cada corrida nueva preserva manifest/records/summary en su carpeta.
El informe verifica hashes del manifiesto y de cada request reconstruida, unicidad
de repeticiones, cantidad esperada, copia literal, reglas protected/fallback y
probes. El runner valida la forma/distribuciones de cada respuesta antes de usarla.
Errores de servicio, timeout, formato y discrepancias de juicio quedan separados.

`context-report.mjs` genera audit.json y agrega una sección al laboratorio existente
sin eliminar la primera batería. Si se regenera la UI antigua con report.mjs,
volver a ejecutar context-report.mjs. El diagnóstico es opcional y queda identificado
por su propio id; no mezclar sus resultados con una corrida inicial futura.

## Decisión y próximo gate

Prometedor: recuperar memorias específicas, elegir fragmentos y señalar diferencias
acotadas con scope/validity explícitos. No validado: comprender arquitecturas enteras,
invalidar memorias reales, compactación destructiva, ruido adversario denso ni éxito
downstream. Un clasificador de relevancia no debe poder borrar restricciones.

Siguiente experimento: casos reales saneados revisados por humano, corpus retenido
como holdout, y comparar el resultado final de un agente con contexto completo versus
seleccionado. Medir costo total con caché. Mantener pin de restricciones/objetivo,
provenance y rehidratación de evidencia. Sin integrar SemanticJudgmentProvider aún.

Mantenimiento: reviewed-none en skills/core; hallazgos de preguntas se conservan
localmente como evidencia. PROJECT_CONTEXT/MEMORY/STATE: reviewed-none. Sin commit,
push, release ni cambios a R4. Las fuentes públicas fueron leídas, no ejecutadas.
