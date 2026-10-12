## Run55 composite answer (Luna writer)

Bridge registra por cada descarga de `asset_import_files` el SHA-256, la longitud, el MIME detectado y la procedencia. [fuente L8](../inputs/sources/ASSET_FILE_INGEST.md#L8)

Cada destino debe declararse en `targets[].outputPath`; no se admiten sobreescrituras ni rutas fuera de `resolveToolPath(access=write)`. Se pueden indicar `expectedSha256` y `expectedBytes`, y `manifestPath` permite guardar un JSON con los datos guardados. [fuente L10](../inputs/sources/ASSET_FILE_INGEST.md#L10)

Los límites actuales son 512 MiB por archivo, 8 archivos y 1 GiB por lote. [fuente L12](../inputs/sources/ASSET_FILE_INGEST.md#L12)

## Situation answer revision (same exact selected evidence)

El watcher reúne observaciones C2e derivadas de recibos activos del Context Plane que todavía apuntan a candidatos canónicos vigentes y afirmaciones explícitas C2e-D independientes de los recibos; ambas alimentan la evaluación portable MSSR C2c/C2d. Guarda snapshots solo de metadatos en `data/project-situation.json` o en la ruta configurada por `BRIDGE_MCP_PROJECT_SITUATION_PATH`. Excluye cuerpos de PROJECT_MEMORY, prompts, transcripciones, razonamiento privado y contenido arbitrario de documentos.

Citations: L28 and L30 in the frozen Situation Model source snapshot. This revision names the exact default snapshot path and its environment override; the previous version is preserved in `../raw/writer-response.json`.
