# Arquitectura

## Principios

1. El dibujo local nunca espera a la red.
2. Toda operación sincronizable tiene un ID estable y solo sale de la cola después de una confirmación de persistencia.
3. Los archivos binarios no se guardan dentro del JSON del tablero.
4. La tinta y las imágenes usan capas separadas para que el borrador no modifique referencias.
5. Las pruebas usan servidores y carpetas temporales; nunca operan sobre la pizarra real.
6. SQLite es la fuente canónica; los JSON se conservan como migración y backups legibles.
7. Cada operación conserva su `boardId`, incluso si queda offline y otra pizarra pasa a estar activa.
8. Una restauración valida primero el snapshot y crea una copia del estado actual antes de reemplazarlo.
9. La cámara es una preferencia local por navegador, dispositivo y pizarra; no forma parte del contenido canónico compartido.

## Flujo de una operación

```text
Gesto local
  → estado optimista visible
  → IndexedDB (operación pendiente)
  → WebSocket
  → validación y persistencia en servidor
  → operation:ack
  → eliminación de IndexedDB
```

Después de una reconexión, el cliente espera el snapshot canónico de la pizarra activa, superpone únicamente las operaciones pendientes cuyo `boardId` coincide y luego reenvía toda la cola. Los IDs de trazo y objeto hacen que una repetición sea idempotente. Si una operación pertenece a una pizarra que ya no está activa, el servidor la persiste allí sin mezclarla visualmente con la pizarra abierta.

`clear`, `undo`, `redo` y la administración de pizarras siguen siendo autoritativos del servidor y se deshabilitan mientras haya operaciones pendientes para evitar que dos historiales diverjan.

## Cliente web

### `App.tsx`

Coordina herramientas, preferencias, estado de conexión, importación/exportación y controles de objetos. No contiene la implementación de almacenamiento ni de renderizado.

### `WhiteboardCanvas.tsx`

Mantiene cámara, gestos, entrada táctil, selección y composición visual. El escenario está dividido en:

```text
cuadrícula infinita
canvas de imágenes
canvas de tinta y selección
preview GPU durante pan/pinch
HUD y cursor
```

El canvas de tinta conserva el render inmediato; el preview GPU compone imágenes y tinta durante la navegación para seguir los dedos sin redibujar el tablero.

La barra superior expone lápiz, borrador, undo, redo y una papelera SVG que se reemplaza inline por cancelar/confirmar. `WorkspaceMenu.tsx` monta dentro del marco del lienzo un rail flotante opaco de nueve iconos, incluido el disparador de captura; los controles que requieren opciones abren popovers pequeños hacia el interior, sin cubrir toda la pizarra.

La cámara se guarda con demora breve en `localStorage`, usando `deviceId + boardId`. Al cambiar de pizarra se persiste la cámara anterior y se restaura la correspondiente. Si una PC no tiene una cámara guardada todavía, puede usar la vista reciente de la tablet de la misma pizarra como referencia inicial. Cada mensaje de presencia incluye `boardId`, por lo que una vista de otra pizarra nunca centra ni dibuja marcas en el tablero actual.

### Módulos extraídos

- `lib/offlineQueue.ts`: IndexedDB y operaciones pendientes.
- `lib/imageUpload.ts`: validación, upload y geometría inicial.
- `lib/boardImages.ts`: carga, caché, render e hit testing de imágenes.
- `lib/canvasRenderer.ts`: primitivas de tinta y colores por tema.
- `lib/boardExport.ts`: límites, composición y exportación PNG/PDF.
- `lib/drawingAssist.ts`: estabilización, continuación y caligrafía.
- `lib/palmRejection.ts`: clasificación heurística de contactos.
- `lib/backupApi.ts`: acceso tipado a las copias de la pizarra indicada.
- `lib/boardApi.ts`: administración HTTP tipada de pizarras.
- `lib/cameraStorage.ts`: validación y persistencia local de cámara por dispositivo y pizarra.
- `lib/captureApi.ts`: listado, subida PNG y eliminación tipada de capturas.
- `components/CaptureAlbum.tsx`: álbum horizontal, apertura de miniaturas y eliminación SVG con overlay rojo.
- `components/WorkspaceMenu.tsx`: rail flotante vertical y sus popovers compactos, separado de `App.tsx`.
- `components/BackupPanel.tsx`: interfaz táctil y confirmación de restauración, separada de `App.tsx`.
- `components/BoardPanel.tsx`: creación, apertura, renombrado, duplicación y eliminación con confirmación inline.

## Servidor

### HTTP

- Sirve la aplicación compilada.
- `GET /api/board`: snapshot de la pizarra activa.
- `GET /api/boards`: catálogo y pizarra activa.
- `POST /api/boards`: crear y abrir una pizarra.
- `POST /api/boards/:id/activate`: cambiar la pizarra activa compartida.
- `PATCH /api/boards/:id`: renombrar.
- `POST /api/boards/:id/duplicate`: duplicar contenido con IDs nuevos.
- `DELETE /api/boards/:id`: guardar una copia y eliminar, sin permitir borrar la última.
- `POST /api/assets`: carga binaria validada, máximo 12 MB.
- `GET /api/backups?boardId=...`: copias de una pizarra con fecha, tamaño, validez y cantidades.
- `POST /api/backups?boardId=...`: creación manual de una copia.
- `POST /api/backups/:name/restore?boardId=...`: restauración validada con copia previa.
- `POST /api/captures`: recibe un PNG compuesto por el navegador y guarda metadatos de cámara en SQLite.
- `GET /api/captures`, `GET /api/captures/latest` y `DELETE /api/captures/:id`: álbum y eliminación.
- `POST /api/captures/request`: solicita por WebSocket una captura fresca a la PC conectada y espera su PNG con timeout.
- `/board-assets/*`: archivos persistidos.
- `/health`: almacenamiento, pizarras, clientes, vistas, backups, capturas y assets.

### WebSocket

El servidor valida contratos compartidos, mantiene una pizarra activa global y confirma las operaciones solamente después de guardarlas. `boards:snapshot` sincroniza el catálogo y el ID activo; al abrir otra pizarra se difunden su snapshot, historial y catálogo, y se reinician las vistas remotas. Las operaciones de tinta u objetos solo se difunden sobre el lienzo cuando pertenecen a la pizarra activa.

### Persistencia

```text
apps/server/data/
├── whiteboard.sqlite                     fuente canónica
├── whiteboard.sqlite-wal / -shm          archivos de trabajo de SQLite
├── default-board.json                    legado conservado sin cambios
├── migrations/
│   └── default-board-before-sqlite.json  copia de la importación inicial
├── assets/                               PNG, JPG, WebP y GIF
├── captures/                             vistas PNG guardadas por el álbum o Bridge MCP
└── backups/                              snapshots JSON rotativos por pizarra
```

`board-repository.ts` encapsula SQLite y usa las tablas `boards`, `strokes`, `images` y `app_state`. Las altas normales son incrementales: agregar un trazo o modificar una imagen toca solamente sus filas y la fecha del tablero. Las operaciones de reemplazo completo se reservan para restore y undo/redo. WAL permite lecturas concurrentes mientras se escribe y las claves foráneas eliminan automáticamente los elementos de una pizarra borrada.

Cuando la base todavía está vacía, `default-board.json` se valida e importa una sola vez. El archivo original queda intacto y se crea una copia adicional en `migrations`. `board-state.ts` concentra validación y normalización; `board-store.ts` coordina el tablero activo, historiales y backups; `board-routes.ts` y `backup-routes.ts` separan la API HTTP del WebSocket.

Los backups siguen siendo JSON portables y su retención se aplica por pizarra. Una restauración válida reemplaza únicamente la pizarra indicada. Si está activa, se difunde a todos los clientes y se registra como una acción de historial: undo recupera el estado previo y redo vuelve a aplicar la copia elegida.

## Contratos compartidos

`packages/shared` define:

- `Stroke` y `Point`;
- `BoardImage`;
- `BoardState` y `BoardSummary`;
- catálogo de pizarras y respuestas de administración;
- operaciones sincronizables con `operationId` y `boardId` estable;
- snapshots, ACK, historial, catálogo y presencia de cámara;
- solicitudes y metadatos tipados de capturas visibles;
- metadatos tipados de backups y respuesta de restauración segura.

## Límites actuales

- El upload inicial de una imagen requiere conexión con la PC; sus cambios posteriores pueden quedar offline.
- GIF se guarda y renderiza como imagen del navegador, pero la exportación captura el frame disponible al momento de exportar.
- Con 5.000 trazos densos, el rasterizado es rápido; el mayor costo observado sigue estando en cargar y materializar el snapshot completo. Para decenas de miles de elementos podrán hacer falta snapshots incrementales e indexación espacial, aunque la escritura canónica ya es incremental en SQLite.
- El historial profundo vive en memoria por sesión; al reiniciar el servidor se reconstruyen como acciones los trazos e imágenes existentes, pero no se conserva una cronología completa de restauraciones o transformaciones antiguas.
- La pizarra activa es global para simplificar la colaboración PC/tablet; todavía no existen sesiones independientes que abran pizarras diferentes al mismo tiempo.
- La cámara recordada vive en el almacenamiento local de cada navegador; no se transfiere automáticamente a otro navegador o dispositivo.
- `WhiteboardCanvas.tsx` sigue concentrando el núcleo sensible de cámara y gestos; las funciones nuevas se extraen a módulos para evitar una reescritura riesgosa del input táctil estable.
