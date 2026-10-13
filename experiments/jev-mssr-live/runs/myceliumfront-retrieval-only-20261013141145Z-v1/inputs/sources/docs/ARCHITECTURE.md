# MyceliumFront — Arquitectura técnica

## Propósito

Esta arquitectura intenta sostener una colonia grande y persistente sin acoplar UI, modelos visuales, autoridad de servidor y simulación económica. La regla central es que cada sistema tenga una única responsabilidad y una única fuente canónica.

## Capas principales

### 1. Definiciones compartidas

Contienen datos estáticos de plantas, construcción y red:

- identificador y nombre visible;
- categoría;
- huella y altura;
- coste futuro;
- puertos y compatibilidad;
- tiempos de sedimentación;
- revisión visual;
- parámetros de componentes.

La UI, el preview y el servidor leen esas definiciones. Ninguno debe mantener una copia divergente.

### 2. Contratos de runtime

`BuildEntity` define el mínimo común para una entidad construida o intervenible:

```text
EntityId
EntityType
DefinitionId
OwnerUserId
State
VisualRevision
```

Las conexiones agregan:

```text
SourceEntityId
TargetEntityId
SourcePort
TargetPort
Broken
VisualState
Maturity
GrowthProgress
GrowthStartedAt / GrowthEndsAt
RegenerationProgress
RegenerationStartedAt / RegenerationEndsAt
Flow
```

Las referencias persistentes o entre sistemas utilizan IDs, nunca nombres de modelos ni partes visuales.

### 3. Presentación

La presentación se deriva del estado lógico:

- `PlantFactory` construye las representaciones de plantas;
- `PlantViewport` genera copias simplificadas para UI;
- el fantasma de colocación representa una solicitud local todavía no autorizada;
- `MyceliumLinkVisual` representa previews y conexiones reales bajo revisión `7`; las conexiones construidas incluyen un hitbox invisible con `CanQuery = true`, mientras previews y partes visuales siguen fuera del raycast;
- `BuildPresentationController` interpola sedimentación, crecimiento, estados y pulsos en Client;
- `AssetReviewStation` construye celdas de revisión regenerables para fuentes visuales registradas, sin convertirlas en gameplay;
- `VisualRevision` y `SourceSha256` permiten detectar copias o módulos antiguos.

Los modelos de galería, previews y estaciones de review son regenerables. No son la fuente de verdad.

### 4. Visual Asset Forge

El loop visual transversal mantiene separados cinco artefactos:

```text
fuente canónica en Studio
→ registro versionado en disco
→ estación de review regenerable
→ plan/capturas de evidencia
→ crítica y dashboard
```

`tools/asset_forge/asset-registry.json` conserva la identidad del artefacto, su expresión de fuente, perfil, slot, run, procedencia conceptual y rutas de evidencia. `camera-profiles.json` define límites tridimensionales, FOV, margen, aspect ratio de fallback y matriz semántica.

`ReplicatedStorage.MyceliumFront.Visuals.AssetReviewStation` crea `Workspace.MyceliumBuildZone.VisualAssetReviewStation`. Cada celda contiene `Hero`, fases/estados cuando existen, suelo de revisión y `CameraAnchors`. Todos los clones son `DisplayOnly`, `ProtectedSample`, anclados y sin colisión, touch o query.

Las sesiones fotográficas agregan una capa de orquestación sin crear otra fuente visual. Varios assets pueden permanecer preparados en slots, pero la captura es secuencial y aislada: se ocultan los demás assets y helpers, se fotografía un solo sujeto a resolución completa, se restaura el escenario y se continúa con el siguiente. Cada sesión persiste su cola, análisis de forma, vistas esperadas, estado y errores en `evidence/visual-benchmarks/photo-sessions/<session-id>/photo-session.json`.

La escala utiliza un único factor uniforme:

```text
min(límiteAlto / alto, límiteAncho / ancho, límiteProfundidad / profundidad)
```

La cámara no se deriva de una dimensión máxima. Para cada vista proyecta las ocho esquinas del bounding box contra el FOV vertical y el aspect ratio; calcula la distancia necesaria para restricciones horizontales, verticales y de profundidad. Antes de `screen_capture`, repite el ajuste con `CurrentCamera.ViewportSize` real.

Una captura reanudable requiere una firma coincidente de target, cámara, look-at, FOV, margen, bounds, viewport/aspect ratio y revisión. Si cualquiera cambia, se recaptura. Un error del transporte de screenshot no invalida el modelo ni demuestra un defecto visual.

Roblox cachea `require()` por ModuleScript durante la sesión. Las herramientas deterministas requieren un clon temporal con nombre único del módulo canónico y lo destruyen; las pruebas de gameplay siguen usando un Play VM fresco.

### 5. Cliente

El cliente es responsable de:

- input;
- cámara normal del jugador;
- selección del catálogo;
- preview local;
- resolución visual del objetivo;
- indicadores y notificaciones;
- interpolación visual batcheada desde atributos replicados;
- pulsos locales de flujo sin autoridad económica;
- envío de solicitudes al servidor.

El cliente nunca crea la entidad real ni decide el resultado económico.

### 6. Servidor

El servidor es responsable de:

- validar tipo, distancia, zona y espacio;
- comprobar propiedad y carpetas canónicas;
- asignar `EntityId`;
- crear o destruir entidades;
- crear, reubicar, desarmar, romper o iniciar la regeneración de conexiones;
- actualizar sedimentación, crecimiento y regeneración por lotes;
- mantener conteos;
- ejecutar auditorías;
- responder con un resultado autoritativo.

`BuildActionDispatcher` unifica las acciones y evita que cada remote implemente su propio protocolo.

## Organización actual dentro de Roblox Studio

La siguiente estructura resume las responsabilidades observadas en la versión `0.0.3`. Los nombres internos pueden ampliarse sin cambiar estos límites.

```text
ReplicatedStorage.MyceliumFront
├── Config
│   ├── PlacementCatalog
│   └── BuildConfig
├── Contracts
│   ├── BuildEntity
│   ├── ConnectionPorts
│   ├── PlacementRequest
│   ├── PlacementResult
│   ├── BuildActionRequest
│   └── BuildActionResult
├── UI
│   ├── PlantViewport
│   ├── Notifications
│   ├── PlacementHint
│   ├── WorldInteractionHint
│   └── UIAssetRegistry
└── Visuals
    ├── MyceliumLinkVisual
    ├── MushroomPortVisual
    └── AssetReviewStation

ServerScriptService.MyceliumFront
└── Services
    ├── PlacementService
    ├── BuildActionDispatcher
    ├── PlantFactory
    ├── ConnectionFactory
    └── BuildAudit

StarterPlayer.StarterPlayerScripts
├── PlacementController
├── BuildPresentationController
└── MyceliumFrontClient

Workspace.MyceliumBuildZone
├── PlacedObjects
├── Connections
├── Environment
├── ModelGallery
├── MushroomConceptWorkstation
└── VisualAssetReviewStation     # copias protegidas y regenerables
```

## Flujo de colocación

```text
Jugador elige definición
        ↓
Cliente crea preview local
        ↓
Cliente proyecta posición y comunica validez aproximada
        ↓
PlacementRequest(requestId, DefinitionId, posición, rotación)
        ↓
Servidor vuelve a validar todo
        ↓
PlantFactory crea una entidad con EntityId
        ↓
State = Sedimenting
        ↓
Actualización por lote de SedimentationProgress
        ↓
State = Active
```

La validez del preview mejora la experiencia, pero nunca sustituye la validación del servidor.

## Flujo de conexión

```text
Jugador toma un puerto Free o un extremo Occupied
        ↓
Cliente muestra MyceliumLinkVisual en preview y oculta localmente el tramo tomado
        ↓
Otro puerto Free → CreateConnection o RewireConnection
Clic en aire con preview nuevo → retracción y cancelación local
Clic en aire con conexión existente → retracción al extremo fijo y DismantleConnection
        ↓
Servidor valida propiedad, distancia, entidades, puertos y capacidad uno
        ↓
ConnectionFactory crea o reubica la conexión canónica en Young
        ↓
Servidor actualiza GrowthProgress/Maturity por lote
        ↓
BuildPresentationController anima MyceliumLinkVisual en Client
        ↓
Mature ↔ Broken → Regenerating → Mature
```

Actualmente la elección es manual entre puertos cardinales. La búsqueda automática de rutas pertenece a una fase posterior.

## Flujo de destrucción

### Romper una conexión

- La conexión permanece en `Connections`.
- Cambia a `State = Broken`.
- `Broken = true`.
- `Flow = 0`.
- Conserva identidad y extremos.
- `RegenerateConnection` valida propietario/carpeta/estado y transiciona a `Regenerating`.
- El servidor actualiza progreso y vuelve a `Mature`; el cliente sólo presenta la transición.

### Desarmar una conexión

- El jugador toma cualquiera de sus extremos desde el puerto ocupado o desde el tramo.
- El cliente mantiene el extremo opuesto como ancla y oculta localmente el tramo canónico mientras muestra el preview.
- Un clic en el aire retrae el preview hacia el extremo fijo.
- Al terminar, `DismantleConnection` valida propiedad, distancia y carpeta canónica.
- La conexión se destruye, ambos puertos quedan libres y se actualiza `ConnectionCount`.
- Esta acción no equivale a `BreakConnection`: no deja un enlace roto regenerable.

### Desmontar una planta

- El servidor valida que sea propia y esté en `PlacedObjects`.
- Busca conexiones que referencien su `EntityId`.
- Destruye únicamente esas conexiones.
- Marca y destruye la planta.
- Actualiza conteos.

## Idempotencia

Cada acción lleva un `requestId`. El dispatcher conserva temporalmente el resultado por jugador:

- mismo `requestId` y misma acción: devuelve el resultado anterior;
- mismo `requestId` y otra acción: rechazo;
- doble clic o reintento de red: no repite la mutación.

Esto no reemplaza una transacción económica futura, pero evita duplicados en la capa actual.

## Auditoría estructural

`BuildAudit` es de sólo lectura y comprueba:

- contratos completos;
- IDs únicos;
- ubicación canónica;
- extremos existentes;
- puertos válidos y capacidad máxima de una conexión por puerto;
- visual de conexión actualizado;
- `InteractionHitbox` presente, consultable y marcado como canónico;
- `VisualState` reconocido y progresos en rango;
- `Flow` numérico no negativo;
- conteos coherentes.

Debe ejecutarse:

1. antes de una modificación importante;
2. en Server durante Play;
3. después de acciones destructivas;
4. otra vez en Edit después de Stop.

## Estado y simulación futura

La red visual no debe convertirse accidentalmente en la economía. La simulación de nutrientes requerirá un ledger determinista por tick:

```text
producido
+ recibido
- enviado
- consumido
- perdido
- rechazado
= variación de almacenamiento
```

La presentación ya puede leer `Flow` y mostrar pulsos. En `0.0.2`, `Flow = 1.25` es un valor de demostración visual; la futura simulación deberá reemplazarlo por resultados del ledger sin trasladar cálculos al cliente.

## Persistencia futura

El guardado de colonia debe almacenar datos lógicos:

- `SchemaVersion`;
- definiciones;
- IDs;
- transformaciones;
- estados;
- salud y crecimiento;
- conexiones por IDs y puertos.

No se guardan beams, partículas, previews, labels ni modelos de galería. Se reconstruyen desde las fuentes canónicas.

## Límites que no deben romperse

- El cliente no crea entidades reales.
- La UI no decide reglas de juego.
- Los visuales no son la identidad de una entidad.
- Una conexión no depende del nombre de una parte.
- Ninguna planta recibe su propio bucle de simulación sin necesidad demostrada.
- Las muestras de galería no se mezclan con entidades jugables.
- Play no se considera prueba de persistencia en Edit o disco.
