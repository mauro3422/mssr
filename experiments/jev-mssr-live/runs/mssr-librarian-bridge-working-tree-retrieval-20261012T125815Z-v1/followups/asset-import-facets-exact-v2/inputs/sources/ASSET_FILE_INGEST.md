# Bridge — Importación de assets desde ChatGPT

## Objetivo
Convertir archivos generados o adjuntados en ChatGPT en archivos reales del host MauroPrime, sin enviar Base64 por el modelo ni dentro de Blender. La conversión/descarga depende de un **parámetro MCP de archivo autorizado por OpenAI**, no de una ruta de sandbox ni de un file_id desnudo.

## Contrato implementado

`asset_import_files` usa `_meta['openai/fileParams']=['files']` y recibe los archivos como `files` (objeto/s con `download_url`, `file_id`, y opcionalmente MIME y nombre). El host de ChatGPT resuelve la referencia autorizada y aporta una URL HTTPS de vida corta. Bridge transmite esa descarga por streaming al disco y registra SHA-256, longitud, MIME detectado y procedencia.

Cada destino debe declararse en `targets[].outputPath`. No se admiten sobreescrituras ni ubicaciones fuera de `resolveToolPath(access=write)`. Puede incluir `expectedSha256` y `expectedBytes`. `manifestPath` permite guardar JSON con los datos guardados.

Formatos: bytes arbitrarios de imágenes, audio, video, documentos, comprimidos, `.blend` y otros. No convierte, descomprime, ejecuta ni instala contenido. Límites actuales: 512 MiB por archivo, 8 archivos, 1 GiB por lote. Archivos mayores requieren extensión explícita del contrato (no afirmar soporte ilimitado).

## Secuencia correcta para práctica Blender

1. Generar imagen anatómica independiente mediante ImageGen. Inspeccionarla visualmente.
2. En la llamada MCP `asset_import_files`, pasar la imagen como **archivo autorizado** (o elegirla como archivo desde ChatGPT); no pegar Base64 ni una ruta `/mnt/data` como URL de Windows. Destinos, por ejemplo `D:\\Dev\\blender-mcp\\practice\\references\\mano_20261008\\mano_anatomia_fuente.png`.
3. Comparar hash resultante con el manifiesto de origen. Si no coincide, abortar modelado.
4. Ejecutar el gate del repo Blender: `scripts/practice_reference_first_gate.py`. Analizar proporciones. Sólo entonces crear un `.blend` nuevo y empaquetar originales con `bpy.data.images.load(...).pack()`.
5. Validar escena en background, abrir sesión exacta protegida y tomar captura del viewport real. No declarar `accepted` si falta esta fase.

## Por qué antes no funcionaba

`image_asset_import_files` YA existía en el Bridge de imágenes; el conector visible en la conversación exponía `bridge_tool_action` **sin su parámetro superior `files`**, aunque el registro MCP vivo sí lo declaraba. Al pasar sólo un `file_id` suelto no se obtiene una URL, y `/mnt/data` corresponde a ChatGPT, no a Windows.

Con esta versión se incluye una tool dedicada `asset_import_files` para cualquier formato, pero requiere que el catálogo del conector de ChatGPT **se actualice** y que el host le suministre un archivo real. Reiniciar únicamente el proceso de Bridge no garantiza actualizar el catálogo cacheado de la app. No invocar por wrapper con `files` anidados: `_meta openai/fileParams` sólo declara campos **top-level**.

## Seguridad y límites

- Acepta únicamente URLs HTTPS en hosts de descarga autorizados (`files.oaiusercontent.com` por defecto); lista configurable a través de `BRIDGE_ASSET_FILE_HOSTS`. URLs IP/localhost, credenciales en URL, puertos inseguros y redirecciones quedan bloqueadas. Servidor local de prueba sólo en `NODE_ENV=test` con flag explícito.
- Comprueba DNS antes de descargar; permite la lista corta de hosts suministradores confiables. Los enlaces temporales se consumen durante una sola ejecución y no se guardan en el manifiesto.
- Transmite con presupuesto de bytes/tiempo y compara SHA real; prepara en archivo temporal adyacente, hace commit sin reemplazar mediante hardlink y limpia archivos parciales ante error.
- Copiar archivos NO equivale a ejecutar instaladores. La instalación de software debe usar una herramienta diferente, permisos/confirmaciones adecuados, checksum/firma y una ruta de recuperación.
- No enviar secretos ni credenciales dentro de `files` o la telemetría.

## Comprobación

`npm run check && npm run build && node scripts/test-asset-file-import.mjs` verifica contratos de archivo, importación exacta PNG/WAV/MP4, hashes, límites, bloqueo de sobreescritura y URLs inseguras.

Estado de activación: **código y tests locales, NO instalado en el proceso productivo**. El 2026-10-08 el Bridge vivo respondió versión **0.6.161**, mientras que el package/config del árbol de trabajo compartido indica **0.6.144**. El nuevo `asset_import_files` aparece en el build aislado (186 tools), pero no en `bridge_tool_schema` del proceso vivo. **No reiniciar desde este árbol**: podría reemplazar el proceso más reciente por uno más antiguo y arrastrar cambios paralelos. Primero reconciliar fuente/runtime 0.6.161, portar el módulo al árbol correcto, ejecutar tests y despliegue controlado; después actualizar el catálogo del plugin de ChatGPT para exponer `files` a nivel superior. El wrapper visible en esta conversación NO declara top-level `files`, aunque el wrapper vivo sí: pasar `files` al conector antiguo fue rechazado antes de llegar al servidor. No afirmar que la importación de los dos PNG al disco `D:` ocurrió hasta `binary_file_info`+SHA de lectura posterior.
