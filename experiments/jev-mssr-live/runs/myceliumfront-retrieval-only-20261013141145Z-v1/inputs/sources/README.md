# MyceliumFront

Tower defense persistente de automatización biológica para Roblox. El jugador construye una colonia de plantas conectadas por micelio, distribuye nutrientes y mantiene una red viva frente a ataques de insectos infectados.

## Estado actual

**Versión del prototipo:** `0.0.4`

La versión `0.0.4` incorpora el primer puerto-hongo procedural, conceptos E/F/G y un Visual Asset Forge transversal con registro, estación regenerable, escala tridimensional, cámaras adaptativas, firmas, críticas y dashboard. Ninguna candidata reemplaza todavía las esferas de puerto dentro del gameplay.

El estado visual vigente del 26 de julio está consolidado en [`docs/VISUAL_PIPELINE_STATUS_2026-07-26.md`](docs/VISUAL_PIPELINE_STATUS_2026-07-26.md). Allí se separan las versiones artísticas de sus recapturas técnicas, se registran los successors canónicos de suelo, las `48` capturas completas de hongos y el cierre durable de los dos proof runs protegidos que ya no aparecen como versiones activas. El frontend del dashboard también quedó dividido en nueve módulos canónicos sin cambio visual observable.

### Abrir el proyecto

1. Abrir `1.rbxl` desde la raíz del repositorio.
2. Confirmar que Roblox Studio lo muestra en modo Edit antes de modificar contenido persistente.
3. Leer `AGENTS.md` y la documentación enlazada antes de una iteración amplia.
4. No utilizar la ruta retirada `D:\Dev\mc-roblox\MyceliumFront`; en esta máquina la raíz canónica es `D:\Dev\MyceliumFront`.

El código Luau continúa embebido en el lugar. Clonar el repositorio recupera el proyecto y su documentación, pero todavía no permite editar scripts externos mediante Rojo.

**Repositorio privado:** `https://github.com/mauro3422/MyceliumFront`

### Dashboard de iteraciones visuales

Abrir el índice global con:

```bat
open-visual-dashboard.cmd
```

El dashboard se genera desde evidencias versionadas en `evidence/visual-benchmarks/`. La portada muestra **assets lógicos**, aunque varios compartan un mismo paquete técnico: `Puerto hongo`, `Carrier de tierra`, `Tierra + micelio` y `Micelio cardinal`. Cada tarjeta abre directamente su iteración destacada; los historiales y comparaciones quedan limitados al mismo asset mediante `assetTrack`, mientras dependencias como `Tierra + micelio → Carrier V8.3.1` se muestran sin fusionar versiones. La arquitectura, contratos de navegación y QA están en [`docs/VISUAL_DASHBOARD_SYSTEM.md`](docs/VISUAL_DASHBOARD_SYSTEM.md); el readback y los pendientes vigentes están en [`docs/VISUAL_PIPELINE_STATUS_2026-07-26.md`](docs/VISUAL_PIPELINE_STATUS_2026-07-26.md). Para reconstruir todo:

```bat
rebuild-all-visual-dashboards.cmd
```

Verificación canónica del pipeline:

```bat
verify-visual-pipeline.cmd --quick
verify-visual-pipeline.cmd
```

`--quick` ejecuta 18 contratos de archivos, catálogo y dashboard sin adquirir Studio. Sin argumentos ejecuta 23 gates completos: Chrome real, Luau, Phase 2, auditoría de residuos temporales en `Workspace`/`ReplicatedStorage`/`ServerStorage`/`StarterPlayerScripts` y readback final del owner de Studio. Una verificación normal guarda el detalle bajo `.bridge/runtime/` y no reescribe evidencia versionada; `--full --refresh-evidence` se reserva para una actualización intencional del reporte canónico.

Para registrar una nueva iteración visual se usa `run-visual-benchmark.cmd`; el comando exporta la fuente desde Roblox Studio, reanuda o captura la matriz, actualiza metadatos y regenera el índice. La guía completa del puerto-hongo está en [evidence/visual-benchmarks/mushroom-port/README.md](evidence/visual-benchmarks/mushroom-port/README.md).

### Visual Asset Forge

Los assets visuales nuevos ya no requieren inventar una estación y coordenadas de cámara para cada iteración. El sistema transversal vive en `tools/asset_forge/`:

```text
fuente canónica
→ asset-registry.json
→ VisualAssetReviewStation
→ escala uniforme por alto/ancho/profundidad
→ CameraAnchors por perfil
→ ajuste final al viewport real
→ capturas firmadas
→ comparación, crítica y dashboard
```

Comandos:

```bat
register-visual-asset.cmd --asset <id>
run-asset-forge.cmd --asset <id> --open
```

El encuadre proyecta las ocho esquinas del bounding box contra el FOV y el aspect ratio. Por eso se adapta a modelos altos, muy anchos, largos/profundos o planos, en vez de calcular distancia sólo por altura o dimensión máxima. La estación también limita la escala de review con una caja tridimensional y conserva las proporciones del asset.

E/F/G del puerto-hongo ya están registrados y recapturados como tres identidades V001 independientes. Cada asset posee `16/16` capturas canónicas a `1920×1080`, con cuatro perspectivas en cada checkpoint `25/50/75/100`, CaptureService completo y cierre de sesión verificado. Las fotografías permiten crítica, pero los tres modelos siguen `needs-rework`; no deben recapturarse otra vez hasta cambiar la fuente artística.

La guía operativa está en [tools/asset_forge/README.md](tools/asset_forge/README.md).

Implementado y verificado:

- colocación libre de plantas sobre `BuildSurface`;
- catálogo inicial con `SolarBloom`, `RelayBud` y `CactusSentry`;
- preview tridimensional y paleta con modelos canónicos;
- validación autoritativa de distancia, zona, espacio, propiedad y estructura;
- identidad estable mediante `EntityId` y contrato común `BuildEntity`;
- sedimentación autoritativa por lote desde `Sedimenting` hasta `Active`;
- presentación local suave de sedimentación derivada de `SedimentationStartedAt`, `SedimentationEndsAt` y `SedimentationProgress`;
- cuatro puertos cardinales por planta: `North`, `East`, `South` y `West`;
- creación de conexiones mediante remotes y validación del servidor;
- capacidad autoritativa de una conexión por puerto, con estados locales `Free` y `Occupied`;
- puertos libres verdes, ocupados ámbar y ocupados seleccionables en celeste al apuntarlos;
- reconexión de cualquiera de los dos extremos mediante `RewireConnection`, conservando la identidad del enlace;
- clic en el aire para cancelar una conexión nueva o desarmar una existente con retracción hacia el extremo fijo mediante `DismantleConnection`;
- `BuildAudit` detecta reutilización estructural de un mismo puerto por más de una conexión;
- `MyceliumLinkVisual` revisión `7`, con crecimiento origen → destino, tres hebras animadas, nódulos y estados `Young`, `Mature`, `Broken` y `Regenerating`;
- pulsos locales de flujo gobernados por `Flow` autoritativo, calculado por `NutrientGraph` y observado por la presentación Client;
- modo destructor para desmontar plantas, romper conexiones o regenerarlas;
- limpieza automática de conexiones cuando se elimina una planta;
- idempotencia por jugador y `requestId` durante 180 segundos;
- protección estructural de las muestras de galería y laboratorio;
- auditoría de integridad mediante `BuildAudit`;
- primer ledger determinista de nutrientes: `SolarBloom` produce, `MyceliumLink` transporta y `CactusSentry` consume, conserva reserva y puede quedar `Starved`;
- microvertical C001 de combate: oleada de cinco hormigas infectadas greybox, targeting y proyectiles del cactus, brecha autoritativa de conexión y recuperación mediante la acción pública existente;
- arena C002: superficie principal `120 × 80`, borde rojo durante oleadas, tres hormigueros derivados del carrier V831, cinco bocas de spawn y rutas autoritativas por origen;
- sesión C004: cinco oleadas completas, entrada contextual al arena, victoria verificable y estado de combate sincronizado entre Client y Server;
- loop cerrado C005: salud de colonia, derrota por brecha, curación, reparación de conexiones, gasto de esporas y reinicio autoritativo;
- HUD C006: barra compacta permanente y expansión contextual para salud, oleada, enemigos, esporas y acciones de recuperación;
- utilidad editorial `WorldTopDownGrid`, con IDs semánticos, coordenadas, bounds, solapes y representación ASCII top-down del layout;
- laboratorio contextual de nutrientes y componentes UI reutilizables;
- Visual Asset Forge con registro versionado, estación regenerable, escala tridimensional, cámaras adaptativas, firmas de captura y QA de formas extremas;
- guardado local verificado y baselines de recuperación externos, con manifiesto y SHA-256, únicamente antes de cambios amplios o destructivos.

No implementado todavía:

- prioridades de distribución, almacenamiento especializado, rutas alternativas y economía completa de nutrientes;
- crecimiento biológico avanzado de plantas y variaciones visuales por especie;
- rutas automáticas o búsqueda de caminos entre nodos;
- balance final del combate, jefe, arte final, progresión y expansión de contenido;
- persistencia de colonias entre sesiones;
- múltiples superficies o materiales plantables;
- cooperativo y múltiples bases.

## Prueba integral de la versión 0.0.2

La prueba end-to-end del 21 de julio de 2026 confirmó:

1. baseline limpio en Edit con `BuildAudit.Ok = true`, `Gallery = 3`, `PlacedObjects = 0` y `Connections = 0`;
2. colocación autoritativa de `SolarBloom` y `RelayBud` mediante `PlacementRequest`;
3. progreso de sedimentación distinto pero coherente en Server y presentación Client, seguido de `Active`;
4. conexión `East → West` mediante `BuildActionRequest`, iniciada en `Young` y completada en `Mature`;
5. tres `Beam` canónicos con índices, curvas y anchos independientes, más un hitbox invisible seleccionable por raycast;
6. rotura real a `Broken`, `Flow = 0`, y regeneración real a `Regenerating → Mature`;
7. tres pulsos de flujo observados en una ventana cliente de 2,4 segundos;
8. rechazo de conexión duplicada, autoconexión y modificación de galería;
9. `BuildAudit.Ok = true` con dos plantas y una conexión, y otra vez tras desmontar todo;
10. consola sin errores ni advertencias y regreso a Edit sin contaminación;
11. guardado verificado de `1.rbxl` con `159788` bytes y SHA-256 `5B0F16888FCA2541B3E258841554AB8D94F94CF5A1ECA19BB2EFA1C5AEDF7D38`;
12. backup posterior con tamaño y hash idénticos;
13. raycast cliente resuelto desde `Strands.InteractionHitbox` hasta la conexión canónica antes de romper/regenerar.

Detalles completos en [changelog/0.0.2.md](changelog/0.0.2.md).

## Prueba integral de la versión 0.0.3

La prueba del 21 de julio de 2026 confirmó:

1. selección por clic real del extremo `Source` y del extremo `Target` desde sus puertos ocupados;
2. clic en el aire sobre una conexión nueva: retracción local y cancelación sin mutación del servidor;
3. clic en el aire sobre una conexión existente: retracción hacia el extremo fijo y `DismantleConnection` autoritativa;
4. reconexión del extremo `Source` desde `SolarBloom_01.East` hacia `CactusSentry_03.West`, conservando una sola conexión;
5. liberación del puerto anterior y ocupación del nuevo puerto;
6. rechazo de reutilización del puerto de origen y del puerto de destino con mensajes explícitos;
7. puertos `Free` en verde y `Occupied` en ámbar, con selección celeste al apuntar un puerto ocupado;
8. `BuildAudit.Ok = true`, `Issues = 0`, runtime final en `PlacedObjects = 0` y `Connections = 0`;
9. consola sin errores ni advertencias y regreso a Edit sin contaminación;
10. guardado verificado de `1.rbxl` con `164277` bytes y SHA-256 `95FCCEFEDAA65AE8B8015B85B952BB90CB4172F2B8C386BD1C98184CD0881EB4`;
11. backup posterior con tamaño y hash idénticos.

Detalles completos en [changelog/0.0.3.md](changelog/0.0.3.md).

## Controles actuales

| Entrada | Acción |
|---|---|
| `B` | Abrir o cerrar la paleta de construcción |
| Clic izquierdo | Seleccionar, colocar, tomar/conectar/reubicar un puerto o ejecutar la acción activa |
| Clic izquierdo en el aire | Cancelar una conexión nueva o desarmar una conexión existente con retracción |
| Botón derecho / cámara | Conservar el control normal de la cámara |
| `C` | Cancelar colocación o salir del modo destructor; no cancela conexiones |
| `X` | Alternar el modo destructor |
| `N` | Abrir o cerrar el laboratorio contextual de nutrientes |
| `Escape` | Cerrar el laboratorio contextual |
| `E` mantenida | Acción contextual sobre conexiones cuando aparece el prompt |

## Archivos principales

```text
MyceliumFront/
├── 1.rbxl                       # lugar local principal
├── IDEA_JUEGO.md                # visión de producto
├── ROADMAP.md                   # fases técnicas y de producto
├── UI_ARCHITECTURE.md           # contratos específicos de interfaz
├── README.md                    # entrada general al proyecto
├── changelog/
│   ├── 0.0.1.md
│   ├── 0.0.2.md
│   └── 0.0.3.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   └── PROJECT_NOTES.md
├── tools/asset_forge/           # registro, perfiles, estación, QA y loop visual
├── tools/visual_benchmark/      # captura, auditoría, verificación y dashboard
├── evidence/visual-benchmarks/  # evidencia durable, críticas y manifiestos
├── .bridge/                     # contexto durable y runtime local ignorado
└── assets/ui/                   # fuentes y exportaciones de iconos
```

Los directorios `backups/` y `.bridge/backups/` no forman parte de la estructura canónica. Los baselines de riesgo viven fuera del repositorio bajo `D:\\Dev\\_mycelium-baselines\\`, acompañados por un manifiesto y SHA-256. La primera base limpia conserva el snapshot previo en `first-version-cleanup-20260726-123425`; Git mantiene la recuperación histórica de los antiguos backups versionados.

El código Luau vive actualmente dentro de `1.rbxl`; todavía no existe una extracción completa a Rojo o a un repositorio de scripts separado.

## Documentación

- [Idea original y fantasía del juego](IDEA_JUEGO.md)
- [Roadmap técnico y de producto](ROADMAP.md)
- [Arquitectura general](docs/ARCHITECTURE.md)
- [Arquitectura de interfaz](UI_ARCHITECTURE.md)
- [Metodología de desarrollo y verificación](docs/DEVELOPMENT_WORKFLOW.md)
- [Higiene del repositorio, clones temporales y política de recuperación](docs/REPOSITORY_HYGIENE.md)
- [Índice del pipeline visual, referencias, Photo Rig y dashboards](docs/VISUAL_PIPELINE_INDEX.md)
- [Arquitectura y contratos del dashboard visual](docs/VISUAL_DASHBOARD_SYSTEM.md)
- [Visual Asset Forge](tools/asset_forge/README.md)
- [Notas y decisiones abiertas](docs/PROJECT_NOTES.md)
- [Cambios de la versión 0.0.1](changelog/0.0.1.md)
- [Cambios de la versión 0.0.2](changelog/0.0.2.md)
- [Cambios de la versión 0.0.3](changelog/0.0.3.md)
- [Cambios de la versión 0.0.4](changelog/0.0.4.md)

## Próximo incremento

Cerrar el handoff visual pendiente y después validar el loop jugable ya implementado:

1. hecho: B003 quedó aprobado como un hongo individual y base reutilizable de la familia B;
2. hecho: B003 fue congelado como Hero y tiene LOD1/LOD2 Blender registrados (6.872/1.808 triángulos, cinco meshes por material);
3. conservar `Tres hongos unidos` como asset lógico independiente; su relación con B003 es sólo de referencia visual;
4. hecho: Hero/LOD1/LOD2 fueron importados e integrados mediante `MushroomPortVisual`; `InteractionRoot` continúa siendo la única hitbox consultable y un controlador cliente compartido aplica histéresis con máximo un Hero;
5. C007 automática original completada y recuperación reemplazada: la red comprometida no pausa la sesión, el HUD no cura ni repara y la colonia pierde al llegar a cero. La regresión con 12 conexiones rotas avanzó de oleada 1 a 2; completar la pasada humana y la derrota deliberada descritas en [`docs/COMBAT_C007_BALANCE_UX_2026-08-01.md`](docs/COMBAT_C007_BALANCE_UX_2026-08-01.md).

El ledger determinista y el loop C005/C006 ya existen. Persistencia de colonias, búsqueda automática de rutas y producción amplia de contenido permanecen fuera de este incremento.

## Regla de evidencia

Para considerar terminado un cambio se distinguen tres resultados independientes:

- existe en el DataModel de **Edit**;
- funciona en un Play VM fresco, separando **Client** y **Server**;
- quedó persistido en `1.rbxl` mediante un guardado de disco verificable.

Ninguno de esos resultados se usa como prueba automática de los otros dos.
