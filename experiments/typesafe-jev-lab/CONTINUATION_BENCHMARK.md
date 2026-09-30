# Jev: responder después de seleccionar contexto

Corrida: D:\Dev\mssr\experiments\typesafe-jev-lab\results-continuation\2026-09-19T22-27-50-372Z\
Fingerprint: b35c92c14c8cd8be0963554695a62d2dc6e69db8fd2086d72d58a93ddb949118

## Diseño previo a inferencia

12 escenarios nuevos en español, seis fragmentos cada uno, dos repeticiones. Casos y preguntas congelados y copiados a la carpeta de corrida antes de consultar. Las etiquetas y listas de evidencia esperada nunca se envían. Los nuevos casos están inspirados en problemas previos: NO son un holdout independiente ni tienen adjudicación humana. El selector y el lector son Jev jev-1.13.0; esto evalúa preguntas acotadas, NO ejecución de tareas por un agente ni razonamiento independiente.

Selector: seis Noul independientes agrupados, con umbral 0,5 previamente fijado. Lector: una Choice yes/no/unknown sobre el contexto que efectivamente recibe, sin acceso a originales omitidos. Se rota la posición de los fragmentos entre casos, pero se mantiene por repetición. Orden de brazos rotado para reducir sesgo temporal.

Baselines sencillos: todo, últimos dos y dos por coincidencia de palabras de al menos cuatro caracteres (sin stemming, empate por orden). Son referencias del lab; NO equivalen al recuperador TF-IDF actual de MSSR. Jev puede conservar más de dos fragmentos: comparar también tamaño, no solo aciertos. Protected se define en fixtures como metadata explícita; no se detecta automáticamente ni se usa una respuesta modelo como permiso.

Recuperación: si el lector protegido devuelve unknown, error o confidence menor a 0,65, otra request entrega todos los originales. Umbral piloto, no calibrado. Se recupera también en conflictos genuinos, donde más de la misma evidencia puede no ayudar. Ningún original se modifica.

## Resultado

151 llamadas, 0 errores. 101219 tokens de entrada y 7370 de salida. Costo estimado US$0.004251, usando US$0,042/M entrada y salida gratuita; no factura.

| Contexto | Coincide con etiqueta | Ahorro caracteres | p50 / p95 ms del camino | Entrada media del camino |
|---|---:|---:|---:|---:|
| Todo | 22/24 | 0.0% | 308 / 367 | 663 |
| Jev sin protección | 23/24 | 45.3% | 603 / 775 | 1724 |
| Jev + protegidos | 24/24 | 45.3% | 598 / 706 | 1724 |
| Últimos dos | 14/24 | 69.2% | 283 / 365 | 532 |
| Dos por palabras | 14/24 | 63.3% | 297 / 397 | 540 |
| Jev + protegidos + recuperación | 22/24 | 33.4% | 628 / 949 | 1916 |

Cada 24 observaciones representa solo doce casos repetidos. Ahorro = media por caso de texto de fragmentos; no ahorro de factura. Latencia del camino = suma de duraciones medidas de selector y lector (y segundo lector cuando corresponde), excluye esperas de otros brazos y trabajo de archivos; no se presenta como wall time de un agente. Tokens de selector incluidos en caminos que lo usan. El selector se ejecuta una vez y se comparte en este experimento, pero se imputa a cada política al compararlas; la factura total cuenta cada request real una vez.

Selector p50 287 ms / p95 405 ms. Recuperaciones: 7/24. Punto de equilibrio teórico de entrada para reutilizar la selección protegida: 13 lectores sobre EL MISMO conjunto seleccionado, sin caché ni recuperación. No extrapolar a otras preguntas ni comparar con costos de otro modelo.

## Primera repetición, visible caso por caso

| Caso | Esperada | Todo | Jev | Protegido | Últimos dos | Palabras | Recuperación |
|---|---|---|---|---|---|---|---|
| adopcion-separada | no | no | no | no | unknown | no | no |
| contrato-excepcion | no | no | no | no | no | unknown | no |
| restriccion-aplicable | no | no | no | no | unknown | no | no |
| dependencia-indirecta | yes | yes | yes | yes | unknown | yes | yes |
| nombre-enganoso | no | no | no | no | no | no | no |
| evidencia-ausente | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| memoria-propuesta | no | no | no | no | unknown | no | no |
| conflicto-sin-dueno | unknown | unknown | unknown | unknown | unknown | yes | unknown |
| ambitos-distintos | no | no | no | no | unknown | unknown | no |
| prueba-no-observacion | unknown | no | unknown | unknown | unknown | unknown | no |
| contenido-incrustado | yes | yes | yes | yes | yes | unknown | yes |
| solicitud-fuera-catalogo | no | no | no | no | no | unknown | no |

## Límites e interpretación

Las discrepancias se guardan en summary.json, separando regresión respecto a contexto completo, error de API/formato y respuesta incorrecta sin señal de recuperación. Una respuesta acertada con evidencia esperada ausente puede ser inferencia o acierto por azar; no demuestra retención. Una etiqueta discutible debe adjudicarse antes de llamarla error de modelo. No se ajustaron etiquetas o thresholds mirando esta corrida.

El siguiente gate para afirmar utilidad real es adjudicación humana, evaluación con lector independiente y tareas con resultado ejecutable. No hay integración en producción, cambios a R4 ni commit/push. Cambios concurrentes del core se dejaron intactos. PROJECT_CONTEXT/MEMORY/STATE y skills: reviewed-none.

## Reproducción

```powershell
node experiments/typesafe-jev-lab/continuation-benchmark.mjs --dry-run
./experiments/typesafe-jev-lab/continuation-benchmark.ps1
node experiments/typesafe-jev-lab/continuation-report.mjs
```

Auditoría offline: snapshots del instrumento, hashes de manifiesto y requests, igualdad con JSONL, cuenta/unicidad, preguntas y state reconstruidos, textos literales, protección y activación exacta de recuperación.

## Revisión del instrumento después de la corrida

El caso prueba-no-observacion tiene una ambigüedad entre «no está demostrado» y «no sabemos si ocurrió». El lector completo devuelve no y la etiqueta esperaba unknown. Es una discrepancia de instrumento pendiente de adjudicación, no una prueba de error del modelo. Se conservan todos los datos y la tabla original; no se cambió el caso ni se repitió para mejorar el resultado.

Como análisis de sensibilidad POST HOC, excluyendo ese único caso: contexto completo, Jev sin protección, Jev protegido y recuperación coinciden 22/22, 22/22, 22/22 y 22/22 respectivamente. Últimos dos y palabras: 12/22 y 12/22. Esto no reemplaza el resultado original ni establece superioridad estadística.

Raw y guarded recibieron exactamente los mismos fragmentos en 24/24 observaciones: aquí el selector ya retuvo lo protegido. Sus diferencias de respuesta son variación entre llamadas, NO una mejoría atribuible a las guardas. La eficacia preventiva de las guardas se comprueba determinísticamente con entradas que las omiten y en el experimento anterior.

Con lexical2, conflicto-sin-dueno respondió yes con confidence 0,92/0,90, pese al conflicto en los originales. El lector recibió solamente una parte de la evidencia, por lo que no podía descubrir por sí mismo la fuente omitida. La regla hipotética de recuperar solo ante unknown/confidence<0,65 no se activaría. Esa recuperación se ejecutó realmente solo para guarded, no para lexical2. No inferir ausencia de pérdidas solo porque el lector responde con seguridad.

Conclusión local: en estos textos breves el selector añade tiempo y entrada (unos 1724 tokens por camino frente a 663 leyendo todo). El ~45% de reducción de caracteres no compensó el costo de selección para una única pregunta. La reducción conserva las respuestas en los once casos no ambiguos; falta demostrar beneficio en corpus mayores y tareas independientes.

Incidentes de implementación: el entrypoint inicial no reconocía la junction C:/Dev→D:/Dev y no ejecutaba el dry-run; se corrigió resolviendo realpath antes de inferencia. La auditoría comparaba una propiedad SDK undefined con JSON que la omite; se normalizó la comparación a representación JSON. Los registros de API no cambiaron y la auditoría pasó.
