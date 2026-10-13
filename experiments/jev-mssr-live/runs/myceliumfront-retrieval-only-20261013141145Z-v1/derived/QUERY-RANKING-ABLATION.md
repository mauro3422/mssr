# Ablación offline del ranking de query variants

Fecha: 2026-10-13. Run base: `myceliumfront-retrieval-only-20261013141145Z-v1`.

## Diseño

Reproduje con `src/librarian-retrieval.ts` las nueve consultas en inglés que no encontraron un ancla provisional en el top 8. Verifiqué los SHA-256 de las cuatro fuentes congeladas y de `QUERIES.json`; las etiquetas siguen pendientes de revisión del dueño. No hubo llamadas a Jev, red, cambios de fuentes ni cambios de runtime.

Comparé la política vigente —búsqueda combinada que coloca primero los resultados de la consulta primaria— con una hipótesis offline: búsqueda por separado en inglés y español, alternancia de un candidato de cada lista empezando por inglés y deduplicación por handle exacto. Cada lista llegó hasta 100 resultados. Usé todas las anclas declaradas por caso y medí por separado solapamiento, contención completa y rango exacto.

## Resultado

| Política | Ancla solapada / contenida en top 8 | Rango exacto en top 8 | Ancla solapada / contenida en top 16 | Rango exacto en top 16 |
| --- | ---: | ---: | ---: | ---: |
| Primaria primero (actual) | 8/9 | 2/9 | 9/9 | 5/9 |
| Alternancia primaria/variante (hipótesis) | 9/9 | 2/9 | 9/9 | 5/9 |

La alternancia recuperó D10: su primera ancla pasó del rango 10 al 4. No perdió un ancla del top 8 en estos nueve casos. El número de rangos exactos no cambió: esta prueba mejora cobertura de candidatos dentro del top 8, pero no demuestra que Jev elija mejor ni que produzca respuestas mejores.

Los pools de top 100 seguían truncados en P05, D10 y U03; D10 tenía ambas listas truncadas. Por eso la comparación sólo reordena candidatos devueltos y no recupera los que quedaron fuera de esos pools.

## Decisión

No cambié el comportamiento de producción. La regla primaria-primero forma parte del contrato versionado en `changelogs/0.2.112.md`; intercalar resultados cambiaría esa semántica y puede cambiar la selección posterior de Jev. Este resultado justifica una evaluación controlada adicional en familias independientes, con etiquetas adjudicadas y medición Jev end-to-end, antes de considerar una nueva opción explícita de ranking.

Es un análisis de nueve casos enlazados de un solo proyecto, sobre anclas provisionales. No es gold, holdout, evidencia de confianza calibrada ni benchmark general.

## Reproducibilidad

Ejecutar desde la raíz MSSR:

```powershell
node --import tsx experiments/jev-mssr-live/runs/myceliumfront-retrieval-only-20261013141145Z-v1/derived/recompute-query-ranking-ablation.mjs
```

El script vuelve a verificar snapshots y resultados base, recalcula las métricas y actualiza `QUERY-RANKING-ABLATION.json`. `SHA256SUMS.txt` contiene las huellas de los tres artefactos derivados.
