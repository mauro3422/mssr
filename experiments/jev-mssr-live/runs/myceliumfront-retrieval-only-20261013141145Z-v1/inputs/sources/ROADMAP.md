# MyceliumFront — Roadmap técnico y de producto

**Versión base documentada:** `0.0.4`, con slices operativos `C001–C006`

**Estado:** fundaciones, construcción manual, edición mouse-only, ledger determinista de nutrientes y loop de combate C005/C006 verificados. El pipeline visual conserva tres V001 de hongos con `16/16` vistas en `needs-rework` y una familia B separada cuyo B003 corregido tiene cuatro renders Blender completos y aprobación humana como un hongo individual/base reutilizable. `Tres hongos unidos` permanece como otro asset lógico. Lo siguiente es congelar B003 como hero, crear LOD medio/lejano, integrarlo visualmente y ejecutar una sesión C007 de balance/UX.

**Documentos relacionados:** [README](README.md), [estado visual vigente](docs/VISUAL_PIPELINE_STATUS_2026-07-26.md), [arquitectura](docs/ARCHITECTURE.md), [metodología](docs/DEVELOPMENT_WORKFLOW.md), [notas](docs/PROJECT_NOTES.md) y [changelog 0.0.4](changelog/0.0.4.md).

## Objetivo del proyecto

Construir un tower defense persistente de automatización biológica en el que el jugador crea una colonia de plantas conectadas por micelio. La red debe crecer, transportar nutrientes, reaccionar a daños y defenderse con suficiente autonomía para sentirse como un organismo vivo.

La primera meta no es producir mucho contenido. Es validar una secuencia vertical completa:

> Elegir una planta → colocarla → sedimentarla → conectarla → alimentarla → activarla → dañarla → repararla.

Cuando esta secuencia sea clara, estable y divertida, se podrá ampliar el catálogo sin duplicar sistemas.

## Estado de implementación

Se probó un primer sistema de anclajes radiales para evaluar la presentación de opciones. La prueba dejó una decisión de diseño definitiva y el prototipo ya fue refactorizado:

- Las plantas no dependen de casillas ni anclajes físicos.
- Todo terreno compatible puede utilizarse para plantar libremente.
- La cámara permanece libre durante toda la construcción.
- El término `slot` se reserva para espacios visuales de la paleta/HUD, no para posiciones del mundo.
- La silueta 3D, sus estados verde y rojo y el contorno holográfico sí se conservan.
- Los siete anclajes radiales, `SlotService` y `SlotCatalog` fueron retirados del gameplay.
- La validación autoritativa del servidor, `EntityId` y la transacción de construcción también se conservan.
- La paleta actual utiliza tres `BuildPaletteSlot` con modelos 3D en `ViewportFrame`; al elegir uno, el panel se oculta y el fantasma se proyecta directamente sobre `BuildSurface`.
- Clic izquierdo confirma y devuelve la paleta; `C` cancela únicamente colocación o sale del destructor. Las conexiones se cancelan o desarman con clic izquierdo en el aire. El clic derecho queda reservado para girar la cámara.
- `PlantViewport` y `Notifications` son componentes compartidos bajo `ReplicatedStorage.MyceliumFront.UI`; la arquitectura y contratos están documentados en `UI_ARCHITECTURE.md`.
- `PlacementHint` comunica clic izquierdo, `C`, validez y rotación sin bloquear la cámara; su mouse SVG está registrado en `UIAssetRegistry` y su revisión queda cubierta por la skill personal reutilizable `roblox-placement-ui-review`.
- El laboratorio de nutrientes es contextual: `N` lo abre cerca de la base, nodos o conexiones de esa red; se cierra al alejarse o al entrar al constructor.
- `UIAssetRegistry` centraliza futuras imágenes publicadas. SVG fuente y PNG exportados siguen el contrato de `assets/ui` y nunca se dispersan como IDs dentro de controladores.
- El constructor incorpora un modo destructor: `X` o el chip `Desmontar` ocultan la paleta; el cursor resalta en rojo plantas/conexiones activas y en azul conexiones rotas regenerables, y el clic izquierdo solicita la acción al servidor.
- Las muestras del laboratorio y la galería están protegidas; el servidor sólo acepta hijos directos de las carpetas canónicas y valida propietario y distancia.
- `BuildEntity` es el contrato común de runtime: toda planta construida y toda conexión intervenida exponen `EntityId`, `EntityType`, `DefinitionId`, `OwnerUserId`, `State` y `VisualRevision`; `PlantType` se conserva como alias de compatibilidad para las plantas.
- `BuildActionRequest`/`BuildActionResult` y `PlacementRequest` pasan por el mismo registro autoritativo `BuildActionDispatcher`. `Place`, `CreateConnection`, `RewireConnection`, `DismantleConnection`, `RemovePlant`, `BreakConnection` y `RegenerateConnection` se registran como handlers, en vez de bifurcarse desde el remote.
- El dispatcher memoriza el resultado durante 180 segundos por jugador y `requestId`: un doble clic o reintento recibe el mismo resultado sin repetir efectos. Al desmontar, se eliminan también las conexiones de `Connections` que referencien el `EntityId` de la planta mediante extremos canónicos.
- Las plantas propias cercanas exponen automáticamente cuatro puertos cardinales sin abrir `B` ni activar otro modo. Cada puerto tiene capacidad uno: verde indica `Free`, ámbar indica `Occupied` y celeste al apuntar un ocupado indica que puede tomarse esa unión. Clic en un puerto libre inicia una conexión; clic en un puerto ocupado o sobre el tramo toma el extremo correspondiente. Clic sobre otro puerto libre ejecuta `RewireConnection`; clic en el aire retrae una conexión nueva sin servidor o desarma una existente mediante `DismantleConnection`.
- `MyceliumLinkVisual` unifica laboratorio, preview elástico y conexiones construidas: tres hebras curvas, ocho nódulos, estados de flujo/madurez y un `InteractionHitbox` invisible sólo en conexiones construidas, bajo `VisualRevision = 7`.
- `BuildPresentationController` interpola sedimentación y conexión en Client desde atributos autoritativos, sin decidir reglas ni cantidades.
- Las conexiones recorren `Young → Mature → Broken → Regenerating → Mature`; `RegenerateConnection` pasa por el dispatcher y conserva identidad/extremos.
- Los pulsos de flujo son locales y temporales, pero su intensidad observa `Flow` autoritativo escrito por el ledger; la presentación no calcula ni conserva nutrientes.
- El nuevo Visual Asset Forge registra fuentes visuales, perfiles y slots en disco; reconstruye una estación protegida, deriva cámaras desde bounds, vuelve a ajustar con el viewport real y evita reutilizar capturas cuando cambia su firma.
- La escala de review conserva proporciones y se limita por alto, ancho y profundidad. La matriz sintética de objetos muy anchos, altos, largos/profundos y planos ya pasó.
- E/F/G del puerto-hongo están registrados y fueron recapturados secuencialmente como tres identidades V001 independientes. Cada uno tiene cuatro fases reales y cuatro perspectivas por fase: `16/16` capturas canónicas a `1920×1080`, policy completa y dashboard verificado. Los tres quedaron `needs-rework` por dirección artística, no por cámara, viewport ni CaptureService.

El constructor sedimenta de forma autoritativa por lote y presenta el progreso sin un bucle por planta. `ConnectionFactory` crea tramos visibles entre `EntityId` y puertos cardinales; todavía no busca rutas automáticamente. `BuildAudit` audita IDs, contratos, puertos, capacidad uno por puerto, revisión visual, estados/progresos y conteos sin mutar por defecto.

Siguiente incremento: B003 Hero/LOD1/LOD2 ya está integrado hacia `MushroomPortVisual` sin asumir identidad ni hitbox desde la geometría; `Tres hongos unidos` continúa como asset lógico separado. El siguiente gate jugable es C007.

## Principios de arquitectura

### 1. Datos, representación y comportamiento separados

Cada entidad se divide en tres capas:

- **Definición:** datos estáticos como coste, tamaño, consumo, puertos y habilidades.
- **Presentación:** modelo 3D, efectos, sonidos, animaciones y estados visuales.
- **Runtime:** identidad, propietario, salud, nutrientes, conexiones y estado actual.

Cambiar el modelo de un cactus no debe modificar su lógica. Agregar otra planta defensiva no debe requerir copiar un servicio entero.

### 2. Composición antes que herencia profunda

No se creará una cadena como `Organismo → Planta → Defensa → Cactus → CactusRaro`. En Roblox/Luau resulta más mantenible construir plantas mediante componentes pequeños:

- `HealthComponent`
- `NutrientStorageComponent`
- `NutrientProducerComponent`
- `NutrientConsumerComponent`
- `NetworkPortsComponent`
- `TargetingComponent`
- `AttackComponent`
- `GrowthComponent`
- `RepairComponent`
- `DirectControlComponent`

Una definición declara qué componentes necesita. Por ejemplo, el cactus combina salud, consumo, puertos, selección de objetivo y ataque. El girasol combina salud, producción, almacenamiento y puertos.

### 3. El servidor es la autoridad

El cliente muestra el fantasma de colocación y solicita acciones. El servidor siempre valida:

- Tipo de planta conocido.
- Superficie y tipo de terreno válidos.
- Distancia máxima del jugador.
- Espacio libre y pendiente permitida.
- Recursos suficientes.
- Límites por jugador o sector.
- Compatibilidad entre puertos.
- Permisos sobre la colonia.

Solo después de validar, el servidor crea la entidad y descuenta el coste. Así se evitan duplicados, colocaciones imposibles y desincronización.

### 4. Identidad estable y estado versionado

Cada entidad creada recibe un `EntityId` único. Las referencias persistentes usan ese identificador y nunca el nombre o la posición del modelo.

Todo guardado incluirá `SchemaVersion`. Las migraciones transformarán estados antiguos cuando cambie el formato.

### 5. Una sola fuente canónica

Las definiciones, fábricas y modelos visuales tienen una ubicación canónica. Las galerías, previews y entidades de Play son copias regenerables. Cada versión visual usa `VisualRevision` para detectar copias antiguas.

## Modelo propuesto de una planta

```lua
PlantDefinition = {
    Id = "CactusSentry",
    DisplayName = "Cactus centinela",
    Category = "Defense",
    ModelId = "CactusSentry",
    Footprint = { Radius = 2.4, Height = 6.2 },
    Placement = {
        SurfaceTypes = { "Soil" },
        MaxSlopeDegrees = 18,
        AllowFreePlacement = true,
    },
    Economy = {
        BuildCost = { Nutrient = 25 },
        UpkeepPerSecond = 0.4,
    },
    Ports = {
        { Id = "RootIn", Type = "Nutrient", Direction = "Input" },
        { Id = "Signal", Type = "Signal", Direction = "Bidirectional" },
    },
    Components = {
        Health = { Max = 120 },
        NutrientStorage = { Capacity = 12 },
        Targeting = { Range = 32 },
        Attack = { Damage = 10, Cooldown = 1.1 },
        Growth = { BuildDuration = 3.5 },
    },
}
```

La fábrica lee esta definición, crea el modelo y registra los componentes. Los componentes no buscan objetos por nombres ambiguos; reciben referencias verificadas durante la construcción.

## Construcción libre y presentación de opciones

### Regla de cámara

La cámara del jugador permanece libre. Abrir el modo construcción no la fija, no la desplaza y no cambia su objetivo. El jugador puede caminar, rotar, acercarse y alejarse mientras mantiene abierta la HUD.

Solo el control directo de una planta puede ofrecer una cámara especializada, y siempre debe devolver al jugador a su cámara normal al terminar.

### Colocación sobre el terreno

Todas las plantas se colocan libremente sobre terreno compatible. Un `PlacementSurface` o sistema de materiales define:

- Tipo de suelo.
- Límites del sector.
- Pendiente máxima.
- Zonas bloqueadas.
- Separación mínima.
- Densidad permitida.

El servidor proyecta la solicitud sobre el suelo, calcula la orientación y revisa solapamientos con una caja o radio de ocupación.

No existen círculos predeterminados que limiten dónde plantar. La cuadrícula, si se usa, sirve únicamente para alinear suavemente y puede desactivarse o refinarse más adelante.

### Slots visuales de la HUD

Un `BuildPaletteSlot` es un espacio de presentación para una opción del catálogo. No representa una coordenada del mundo y nunca puede estar ocupado.

Cada slot visual contiene:

- `DefinitionId` de la planta.
- Nombre, categoría, coste y disponibilidad.
- Silueta o miniatura 3D obtenida del modelo canónico.
- Estados bloqueada, disponible, seleccionada o sin recursos.
- Acción para convertir esa opción en el fantasma activo.

Los slots visuales solamente existen mientras la HUD de constructor está abierta. Pueden mostrarse como una barra, rueda, bandeja o lista; cambiar su layout no afecta la lógica de colocación.

### Fantasma tridimensional

1. El jugador abre la HUD sin perder el control de la cámara.
2. Elige una planta desde un slot visual.
3. `GhostFactory` crea o reutiliza una copia simplificada del modelo canónico.
4. Un raycast desde el cursor proyecta el fantasma sobre el terreno.
5. La silueta sigue el suelo, conserva la rotación elegida y comunica validez por color.
6. Al confirmar, el cliente envía `DefinitionId`, posición y rotación.
7. El servidor vuelve a resolver y validar el terreno, espacio, distancia y coste.
8. Si todo es válido, crea una sola entidad y comienza la sedimentación; si falla, no cobra recursos.

La silueta se muestra únicamente durante construcción y dentro de una distancia razonable. Las plantas reales no conservan marcadores flotantes permanentes.

## Estados comunes de una entidad

Todas las plantas y módulos usan una máquina de estados pequeña y compartida:

- `Preview`: representación local no autorizada.
- `Constructing`: existe en servidor, pero todavía no opera.
- `Connecting`: busca o desarrolla una conexión válida.
- `Active`: funciona normalmente.
- `Starved`: no recibe suficientes nutrientes.
- `Saturated`: almacenamiento completo o flujo bloqueado.
- `Damaged`: rendimiento reducido o esperando reparación.
- `Disconnected`: sin ruta hacia un núcleo compatible.
- `Destroyed`: desmontaje, restos y limpieza de componentes y conexiones.

Cada cambio de estado emite una señal. La presentación escucha esa señal y reproduce la animación correspondiente; no decide las reglas del juego.

## Fases del roadmap

### Fase 0 — Fundaciones y contrato técnico

**Objetivo:** asegurar que todos los prototipos futuros compartan la misma estructura.

Entregables:

- Catálogo central de definiciones.
- `EntityId`, `PlantId` y `VisualRevision`.
- Fábrica única de plantas.
- Registro y ciclo de vida de componentes.
- Máquina de estados común.
- Separación entre servicios de servidor y controladores de cliente.
- Herramientas de diagnóstico para listar entidades, estados, huellas y conexiones.
- Registro transversal de assets visuales, perfiles de review, estación regenerable y cámaras adaptativas versionadas.
- QA sintético de encuadre para objetos extremos y firmas que invalidan capturas obsoletas.

Criterio de salida:

- Crear y destruir cien plantas de prueba sin referencias huérfanas, conexiones duplicadas ni errores de consola.

### Fase 1 — Colocación manual robusta

**Objetivo:** hacer que construir sea claro, agradable y seguro.

Entregables:

- Catálogo de plantas y selector.
- Slots visuales de HUD alimentados por el catálogo.
- Preview verde, amarillo o rojo según validez.
- Silueta 3D obtenida del modelo canónico.
- Cámara completamente libre durante construcción.
- Rotación, confirmación y cancelación.
- Colocación libre sobre suelo.
- Comprobación de coste y devolución ante fallos.
- Hecho en `0.0.2`: animación de sedimentación derivada de timestamps/progreso autoritativos.
- Modo destructor con foco inequívoco, permisos autoritativos y acciones idempotentes.

Criterio de salida:

- El jugador puede plantar en cualquier punto válido; dos solicitudes simultáneas no pueden superponerse ni generar dos plantas pagando una vez.

### Fase 2 — Crecimiento visual y conexión automática

**Objetivo:** comunicar que la colonia construye una red viva.

Entregables:

- Búsqueda de puertos cercanos compatibles.
- Parcial en `0.0.2`: crecimiento visual origen → destino de tres hebras; la segmentación/ruta automática sigue pendiente.
- Parcial en `0.0.2`: estados joven, maduro, roto y regenerando; saturado y dañado dependen de la futura simulación.
- Nódulos en bifurcaciones.
- Dirección visual pendiente: suelo orgánico plantable, micelio más ramificado lateralmente y puertos modelados como pequeños hongos/nodos fúngicos.
- Los puertos-hongo deberán brotar gradualmente y permitir familias estéticas sin alterar `EntityId`, puerto lógico ni validación del servidor.
- Rutas alternativas sencillas.
- Herramienta visual para inspeccionar qué entidades están conectadas.

Criterio de salida:

- Una planta nueva encuentra una conexión válida, la desarrolla y queda operativa sin intervención adicional.

### Fase 3 — Simulación de nutrientes

**Objetivo:** convertir la red visual en el sistema estratégico principal.

Entregables:

- Producción, consumo y almacenamiento.
- Capacidad y velocidad por tramo.
- Prioridades de distribución.
- Pulsos que representen transferencias reales.
- Estados de hambre y saturación.
- Panel de diagnóstico por nodo y por red.

Criterio de salida:

- Cortar un tramo cambia el suministro; una ruta alternativa recupera el funcionamiento de manera comprensible.

### Fase 4 — Primer combate vertical

**Objetivo:** probar si construir y mantener la red resulta divertido bajo presión.

Entregables:

- Camino y generador de oleadas.
- Tres enemigos: numeroso, blindado y cortador de red.
- Cactus centinela completamente funcional.
- Selección de objetivos y proyectiles.
- Daño a plantas y conexiones.
- Reparación automática básica.
- Cinco oleadas y un jefe sencillo.

Slices verificados:

- `C001`: cinco hormigas greybox, targeting/proyectiles, brecha de conexión y recuperación pública sobre el ledger real.
- `C002`: arena `120 × 80`, borde de amenaza rojo, tres hormigueros derivados de V831, cinco bocas/sockets y rutas por origen; layout auditable mediante `WorldTopDownGrid`.
- `C004`: entrada contextual al arena, cinco oleadas completas, victoria y sincronización Client/Server.
- `C005`: salud de colonia, derrota por brecha, curación, reparación de conexiones, economía de esporas y reinicio autoritativo.
- `C006`: HUD de combate compacta con expansión contextual, sin trasladar autoridad al Client.

Criterio de salida:

- El jugador debe modificar o reparar su red para superar las oleadas; colocar defensas sin logística no alcanza.

#### Línea diferencial — plantas en reposo y respuesta morfológica

**Estado:** dirección futura de producto; todavía no implementada.

La colonia no debe leerse como un conjunto de torres siempre desplegadas. Las plantas defensivas y de soporte permanecen compactas cuando no existe amenaza y despliegan una forma mayor, especializada y más costosa cuando enemigos relevantes entran en su zona sensorial.

Estados propuestos:

```text
Compacta
→ Alerta
→ Desplegándose
→ Combate
→ Agotada o marchita
→ Recuperación
→ Compacta
```

Entregables futuros:

- `ThreatPressure` autoritativo por planta o sector, derivado de enemigos cercanos y compartible por micelio sensorial.
- `MorphState` separado de `NutrientState`, para no confundir forma visual con disponibilidad de energía.
- formas compactas de bajo consumo y formas de combate con mayor tamaño, silueta, alcance, daño o función;
- transición reversible que preserve `EntityId`, puertos, conexión y dueño lógico;
- demanda energética dinámica: `IdleDemand`, `DeployCost`, `CombatDemand` y `RecoveryDemand`;
- reservas orgánicas que absorban picos de consumo cuando los productores no alcancen;
- prioridades automáticas configurables para defensa, producción, curación, reparación y almacenamiento;
- estrés de productores: un girasol puede reducir producción, agotarse o marchitarse temporalmente si se lo fuerza fuera de su régimen sostenible;
- recuperación gradual después de la oleada, sin reset instantáneo ni energía gratuita;
- enemigos capaces de priorizar productores, reservas, sensores, defensas activas o conexiones críticas;
- telemetría legible de demanda, reserva, déficit, tiempo sostenible y causa de marchitado.

Loop estratégico buscado:

```text
colonia compacta y eficiente
→ aparece una amenaza
→ las plantas se despliegan
→ aumenta el consumo
→ producción instantánea insuficiente
→ las reservas sostienen el pico
→ el jugador prioriza, repara o apaga sectores
→ termina la amenaza
→ las plantas se repliegan y recuperan reservas
```

Criterio de prueba futuro:

- una red sin reservas puede sobrevivir a actividad normal pero colapsa ante un pico prolongado;
- la misma red, con almacenamiento y prioridades coherentes, sostiene la transformación sin energía infinita;
- el jugador entiende qué planta se desplegó, cuánto consume, qué reserva la alimenta y por qué se agotó o marchitó.

Esta línea conecta Fase 3 y Fase 4 y es candidata a convertirse en la identidad mecánica principal de MyceliumFront.

### Fase 5 — Control directo y respuesta del organismo

**Objetivo:** permitir que el jugador intervenga personalmente sin reemplazar la automatización.

Entregables:

- Sincronización con una planta compatible.
- Cámara, puntería y habilidad manual.
- Coste o enfriamiento para el control directo.
- Retorno seguro al modo colonia.
- Feedback de la red cuando una planta recibe prioridad manual.

Criterio de salida:

- Controlar una planta aporta precisión o una decisión táctica, pero la colonia sigue operando por sí misma.

### Fase 6 — Persistencia y progresión

**Objetivo:** conservar la colonia entre sesiones de forma recuperable.

Entregables:

- Esquema versionado de guardado.
- Serialización de entidades, posición, rotación, salud, crecimiento y conexiones.
- Validación completa al cargar.
- Migraciones de versiones antiguas.
- Guardado periódico, al salir y en puntos importantes.
- Recuperación ante datos parciales o incompatibles.

Criterio de salida:

- Guardar, cerrar, volver a entrar y reconstruir la misma colonia sin duplicar entidades ni perder conexiones.

### Fase 7 — Expansión modular de contenido

**Objetivo:** demostrar que la arquitectura permite agregar contenido barato y seguro.

Contenido inicial sugerido:

- Girasol productor.
- Brote relé/distribuidor.
- Cactus centinela.
- Depósito orgánico.
- Planta médica.
- Hongo mortero.
- Micelio básico, vascular y regenerativo.

Criterio de salida:

- Una planta nueva se agrega mediante definición, presentación y componentes existentes, sin editar servicios centrales.

### Fase 8 — Sectores, varias bases y cooperativo

**Objetivo:** alcanzar la fantasía de una colonia persistente distribuida.

Entregables:

- Sectores cargables y límites de simulación.
- Varios núcleos y redes que pueden unirse.
- Ataques simultáneos.
- Propiedad y permisos cooperativos.
- Límites de entidades y presupuestos de actualización.
- Simulación simplificada para sectores lejanos.

Esta fase solamente comienza después de validar rendimiento, persistencia y diversión del primer mapa.

## Estructura lógica sugerida

```text
ReplicatedStorage/MyceliumFront
├── Definitions
│   ├── Plants
│   ├── Network
│   └── Enemies
├── Shared
│   ├── Types
│   ├── StateMachine
│   └── Signals
└── Remotes

ServerScriptService/MyceliumFront
├── Services
│   ├── EntityService
│   ├── PlacementService
│   ├── NetworkService
│   ├── NutrientService
│   ├── CombatService
│   └── PersistenceService
├── Components
└── Factories

StarterPlayerScripts
├── PlacementController
├── BuildPaletteController
├── GhostPreviewController
├── NetworkViewController
├── ColonyUIController
└── DirectControlController
```

Los nombres pueden adaptarse a la estructura actual. Lo importante es conservar las responsabilidades.

## Formato mínimo de persistencia

```lua
SaveData = {
    SchemaVersion = 1,
    ColonyId = "...",
    Entities = {
        {
            EntityId = "...",
            DefinitionId = "CactusSentry",
            Transform = { Position = {...}, RotationY = 90 },
            State = "Active",
            Health = 96,
            StoredNutrients = 7,
            Growth = 1,
        },
    },
    Connections = {
        {
            ConnectionId = "...",
            FromEntityId = "...",
            FromPortId = "RootOut",
            ToEntityId = "...",
            ToPortId = "RootIn",
        },
    },
}
```

Los modelos y efectos no se guardan. Se reconstruyen desde `DefinitionId` y el estado lógico.

## Reglas anti-bugs

- Ninguna solicitud del cliente crea directamente una entidad.
- La cámara nunca es modificada por abrir o cerrar el constructor.
- La HUD no crea posiciones permitidas: únicamente selecciona definiciones.
- El servidor nunca confía en la posición válida mostrada por el cliente.
- Crear, cobrar y registrar debe comportarse como una única transacción.
- Destruir una entidad siempre desconecta puertos y elimina componentes.
- Una conexión usa identificadores de entidades y puertos, no referencias visuales.
- Todos los bucles y eventos se limpian al destruir su entidad.
- Las actualizaciones de simulación usan frecuencias controladas; no un `Heartbeat` independiente por planta.
- Las galerías y previews nunca se registran como entidades jugables.
- Cargar datos valida definiciones, límites, transformaciones y referencias antes de instanciar.
- Las pruebas siempre terminan con auditoría post-Stop y revisión de errores de consola.

## Próximo bloque recomendado

La simulación determinista de la **Fase 3** y el loop mínimo de la **Fase 4** ya están implementados. El siguiente bloque debe cerrar la decisión visual y después probar balance/UX:

1. Hecho: formalizar `BuildEntity` y aplicar el contrato desde la fábrica de plantas; la galería conserva el contrato pero queda en estado `Display` y fuera de las carpetas autorizadas.
2. Hecho: registrar las acciones de construcción en `BuildActionDispatcher`, con caché idempotente por `requestId` y propietario.
3. Hecho: sedimentación autoritativa, conexiones con identidad estable, `BuildAudit`, crecimiento, rotura, regeneración y presentación local desacoplada.
4. Hecho: Photo Rig con pivot/yaw verificado, viewport estable, matriz rectangular y CaptureService canónico.
5. Hecho: successors técnicos de V8.3.1/V8.4.4 y tres V001 de hongos con `16/16` vistas cada una.
6. Hecho: `v8-technique-proof` y `v83-terraced-carrier-proof` están excluidos editorialmente mediante tombstones durables, con píxeles protegidos y sin editar outputs generados a mano.
7. Hecho: `asset-registry.json` apunta a los successors técnicos; los dashboards regenerados tienen cero proofs activos, faltantes o hashes inconsistentes.
8. Hecho: ledger determinista por tick, conservación verificable y `Flow` derivado de transferencias autoritativas.
9. Hecho: slices C001–C006, incluyendo cinco oleadas, derrota/victoria, reparación, curación, reinicio y HUD compacta.
10. Hecho: revisión humana de las cuatro vistas corregidas; B003 quedó aprobado como un hongo individual/base de la familia B.
11. Hecho: B003 se congeló byte por byte como Hero y se derivaron LOD1/LOD2 Blender (6.872/1.808 triángulos; cinco meshes empaquetados), con 15 PNG y dashboard registrado.
12. Hecho: Hero/LOD1/LOD2 se importaron como geometría exclusivamente visual bajo `MushroomPortVisual`; `InteractionRoot`, identidad y puertos permanecen separados. El cliente selecciona LOD en un loop compartido de 0,2 s con histéresis y máximo un Hero.
13. C007 automática original completada el 2026-08-01 y regla de recuperación reemplazada: una red comprometida ya no detiene la sesión, curar/reparar desaparecieron del HUD y la colonia pierde al llegar a cero. La regresión con 12 conexiones rotas avanzó de oleada 1 a 2 sin pausa. Siguiente gate: pasada humana de legibilidad/sensación y variante deliberada de derrota.
14. Hecho: CraterSeedTechniqueProof V5 convierte el proof aislado en un laboratorio construible de 14 celdas, con cuatro estados seleccionables, continuidad axial autoritativa, dos clusters unidos, reset y ocultar/mostrar. La animación de aparición y crecimiento queda diferida hasta revisión humana del run crater-seed-cs2-v005-build-lab.
15. Hecho: Crater Seed V6 entra al constructor canónico `[B]` bajo la categoría `SUELO`, con cuatro estados persistentes, preview 3D cenital-oblicuo, carrier caminable estable y aparición/germinación visual batcheada. Cliente y servidor comparten un pregrid axial hexagonal; dos segmentos vecinos se aceptan a 5.7158 studs y una segunda ocupación del mismo hex se rechaza.

No conviene implementar persistencia de colonias ni producción amplia de contenido antes de estabilizar esta integración visual y el balance del loop cerrado.
