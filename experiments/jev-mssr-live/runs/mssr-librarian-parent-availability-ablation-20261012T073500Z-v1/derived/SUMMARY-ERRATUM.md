# Run 44 — errata de nombre de métrica

Fecha: 2026-10-12.

El campo congelado `summary.json:exactHeadingMatches` y su origen `records[].exactHeadingMatch` están mal nombrados. En `runner.mjs`, `exactHeadingMatch` es un alias de `exactAcceptedRangeMatch`: la comparación requiere fuente, heading y líneas exactas del rango aceptado. No mide solamente si el texto del título coincide.

Por tanto, el valor congelado 1/4 sí es el conteo de selecciones del rango aceptado exacto reportado como `rangeSelectionMetrics.exactMatches`. En Q01-full, `observedHeading` y el heading esperado tienen el mismo título, pero Jev seleccionó el parent completo de 54 líneas y no el bloque etiquetado de 16 líneas; ese caso correctamente no cuenta como match de rango.

No se cambian `summary.json`, los registros ni los valores. Este documento aclara la interpretación; una futura revisión del runner debería renombrar estos campos a `exactAcceptedRangeMatch(es)` para evitar confundir exactitud de rango con coincidencia del título.
