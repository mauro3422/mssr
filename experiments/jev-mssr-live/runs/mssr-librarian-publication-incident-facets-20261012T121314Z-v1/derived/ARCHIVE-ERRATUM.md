# Errata de archivo post-call (2026-10-12)

Esta nota es append-only y corrige afirmaciones de retención; no cambia las entradas congeladas ni aporta métricas.

La inspección del directorio v1 encontró los snapshots, casos, labels, pools de candidatos, resultados crudos de búsqueda y esta auditoría. **No encontró respuestas crudas de selección de Jev.** Por eso, las frases de `run-status.json` e `INVALIDATION.md` que dicen que las respuestas Jev están preservadas son incorrectas. Las llamadas ocurrieron, pero sus salidas no quedaron archivadas de forma recuperable en este directorio. La causa exacta de la omisión no quedó registrada.

La corrida sigue invalidada y excluida por labels con coordenadas desplazadas; no se reconstruyen selecciones desde memoria ni se derivan resultados. La v2 corregida contiene las ocho selecciones y fetches primarios, los dos packs y sus hashes verificados. Para el archivo futuro, no declarar un output como preservado sin leer de vuelta el archivo correspondiente.
