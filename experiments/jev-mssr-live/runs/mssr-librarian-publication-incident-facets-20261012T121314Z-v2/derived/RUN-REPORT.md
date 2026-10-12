# Corrida exploratoria: publicación e incidentes por facetas

**Run:** `mssr-librarian-publication-incident-facets-20261012T121314Z-v2`
**Proveedor real:** `typesafe-jev` / `jev-1.13.0`, invocado mediante el MCP conectado de MauroPrime Bridge.
**Bridge observado antes de la corrida:** `0.6.173`, boot `9b1323c6-9499-4700-81d0-6b14de9d6e41`.
**Fuentes:** dos documentos Markdown reales de MSSR; los SHA-256 congelados coinciden con las revisiones actuales.

## Diseño y resultados

Se compararon dos preguntas compuestas (una por documento) con seis consultas de faceta: dos de publicación y cuatro de destinos del ledger de incidentes. Las consultas, labels y pools de candidatos quedaron congelados antes de las llamadas; no se enviaron labels a Jev. La búsqueda produjo 41 candidatos en ocho consultas. Las ocho selecciones primarias y sus fetches exactos se conservaron.

- El baseline compuesto cubrió **6/6 spans de faceta**: publicación L9-L10 e incidentes L7-L10.
- El tratamiento por facetas también cubrió **6/6**. No hubo ganancia de cobertura en esta muestra.
- Para lograr ese empate, el tratamiento hizo seis selecciones frente a dos del baseline (**+4 llamadas, +200%**) y devolvió 1.809 unidades UTF-16 de texto frente a 1.148 (**+661, +57,6%**). El conteo conserva rangos anidados/repetidos; no se aplicó deduplicación.
- Todas las ocho respuestas primarias fueron seleccionadas con Jev. Suma de uso reportado: **8.728 tokens de entrada / 786 de salida**, latencia media **296,325 ms**. Los scores de confianza y suficiencia son descriptivos, **no calibrados**.
- Los nueve fetches comprobados —ocho primarios y un diagnóstico separado— coinciden con el slice exacto del snapshot y con el fingerprint del handle. No se observó cambio de revisión de fuente.
- Dos revisores Luna ciegos calificaron completos los dos paquetes. Ambos también señalaron rangos redundantes o más amplios de lo necesario.

## Lectura

En estos dos documentos, la consulta compuesta ya encontró evidencia que cubría todas las facetas. Separar las consultas **no aumentó cobertura** y elevó el volumen recuperado. Sí produjo citas específicas para tres de las cuatro facetas del ledger; la consulta de routing eligió la sección completa L1-L12, que además repetía las citas L8-L10. En publicación, una consulta atómica también devolvió el bloque L5-L12 para los checks, aunque la respuesta podía citar L9-L10 de forma más ajustada.

Después se hizo un único follow-up diagnóstico para routing. Tras la selección demasiado amplia, la consulta más concreta eligió exactamente L7 y el fetch exacto pasó. Es una señal útil para el flujo adaptativo, pero **un solo caso** y queda fuera de las métricas primarias.

**Recomendación de calibración:** conservar la consulta compuesta cuando cubra las facetas con evidencia exacta y suficiente; descomponer o hacer follow-up cuando la cobertura muestre una omisión, ambigüedad o un rango excesivo. Antes de fijar umbrales, hacen falta positivos y negativos con gold revisado por dueños y más clusters independientes. No usar confidence del proveedor como probabilidad calibrada.

## Capacidad medida y límite

Esta corrida mide búsqueda, selección por faceta, fetch exacto, ensamblaje de un paquete de evidencia citado y revisión ciega de cobertura. El ensamblaje de MSSR es **verbatim**: conserva fragmentos de fuente y citas. La composición de un párrafo por el host observada en Run 48 es una capacidad adyacente con evidencia; **la compactación semántica no se midió aquí**.

## Integridad y alcance

La predecesora `...-v1` se invalidó antes del análisis porque un error de conteo de líneas produjo labels desplazados. Las labels nunca se enviaron a Jev. Se conservó el run y se repitió con rangos one-based corregidos en `...-v2`; v1 no contribuye a ninguna métrica.

Los resultados son exploratorios: dos clusters documentales dentro de un proyecto, labels revisados por una analista, consultas positivas solamente, sin negativos, owner-gold, holdout certificado ni adjudicación humana. No se cambiaron umbrales, runtime ni código de producto.

Los archivos `PRECALL-SHA256SUMS.txt` y `FOLLOWUP-PRECALL-SHA256SUMS.txt` conservan los hashes congelados antes de las llamadas. `POSTCALL-SHA256SUMS.txt` cubre el paquete final salvo a sí mismo.
