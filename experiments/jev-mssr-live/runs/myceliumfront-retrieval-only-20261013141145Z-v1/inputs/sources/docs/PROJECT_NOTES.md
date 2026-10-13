# MyceliumFront — Notas de proyecto

## Estado de referencia

- Versión base: `0.0.4`.
- Lugar principal: `1.rbxl`.
- Tamaño verificado: `171032` bytes.
- SHA-256 de referencia: `0B56582B8CEE7D996C117DBF0399DADB51691B5745CEAE71B643AAEF4A45217A`.
- Puerto-hongo canónico de gameplay: `MushroomPortVisual.VisualRevision = 4`; aún no fue reemplazado por una candidata conceptual.
- `v1-user-approved-baseline` permanece archivado como referencia histórica. Las 79 imágenes visualmente rechazadas de V2–V7 fueron eliminadas el 2026-07-26 tras autorización explícita; sus metadata, reviews y fuentes históricas permanecen. Las tres V001 activas fueron reemplazadas fotográficamente por runs de perspectivas completas: `16/16` vistas por asset, `48` en total. Siguen `needs-rework` y no aprobadas.
- `AssetReviewStation.VisualRevision = 1`; hash de fuente instalado `b66c47aecd46ebd28304e154edc72742181f60ff20d3a69fa28c10cdbc81d9b6`.
- Ruta local canónica actual: `D:\Dev\MyceliumFront`.
- Ruta anterior retirada: `D:\Dev\mc-roblox\MyceliumFront`.
- El proyecto fue trasladado con Roblox Studio cerrado. Se compararon 21 archivos antes y después por ruta relativa, tamaño y SHA-256, sin faltantes ni cambios.

La ruta local es una nota operativa de esta máquina. El repositorio debe seguir siendo portable: para abrirlo en otra instalación basta con usar `1.rbxl` desde la raíz clonada.

## Qué está validado

Las versiones `0.0.2` y `0.0.3` verificaron en Play VM fresco:

- colocación autoritativa de `SolarBloom` y `RelayBud`;
- sedimentación presentada suavemente en Client desde timestamps/progreso de Server;
- conexión manual `East → West` mediante remotes reales;
- `VisualRevision = 7`, tres hebras animadas, crecimiento origen → destino y hitbox canónico seleccionable;
- transición `Young → Mature → Broken → Regenerating → Mature`;
- tres pulsos de flujo observados en 2,4 segundos;
- rechazo de duplicado, autoconexión y galería protegida;
- eliminación de ambas plantas y limpieza exacta de la conexión;
- `BuildAudit.Ok = true` durante el runtime, después de la limpieza y otra vez en Edit;
- consola sin errores ni advertencias;
- retorno a Edit sin contaminación del DataModel persistente;
- guardado y backup posterior de `0.0.2` con `159788` bytes y hash coincidente;
- selección por clic real de una conexión existente desde el extremo `Source` y desde el extremo `Target`;
- reconexión autoritativa mediante `RewireConnection`, conservando una sola entidad de conexión;
- cancelación mouse-only de una conexión nueva mediante clic en el aire y retracción local;
- desarmado mouse-only de una conexión existente mediante retracción al extremo fijo y `DismantleConnection`;
- capacidad máxima de una conexión por puerto, rechazada tanto en origen como en destino;
- puertos locales `Free` verdes y `Occupied` ámbar, seleccionables en celeste;
- `BuildAudit` detecta reutilización estructural de puertos.

El detalle reproducible está en [`changelog/0.0.2.md`](../changelog/0.0.2.md) y [`changelog/0.0.3.md`](../changelog/0.0.3.md).

## Visual Asset Forge verificado

- Registro canónico: `tools/asset_forge/asset-registry.json`.
- Perfiles: `tools/asset_forge/camera-profiles.json`.
- Estación persistente protegida: `Workspace.MyceliumBuildZone.VisualAssetReviewStation`.
- La escala usa un único factor contra límites de alto, ancho y profundidad.
- Las cámaras proyectan las ocho esquinas contra FOV/aspect ratio y se reajustan con el viewport real antes del screenshot.
- La reanudación exige una firma coincidente de target, cámara, bounds, viewport, margen, FOV y revisión.
- `run-photo-session.cmd` prepara múltiples assets en slots, clasifica automáticamente sus proporciones y los captura secuencialmente con un solo sujeto por frame; el manifiesto reanudable vive en `evidence/visual-benchmarks/photo-sessions/`.
- La prueba `pipeline-photo-stage-smoke` preparó correctamente `soil-mycelium-mound`, detectó forma `flat`, generó cinco tomas esperadas y no intentó usar el backend de imagen.
- La matriz de QA pasó con objetos `100×4×4`, `4×100×4`, `4×4×100` y `100×2×70`; todos los ratios proyectados quedaron por debajo de `1` y los temporales fueron limpiados.
- Las herramientas requieren un clon temporal único de `AssetReviewStation` para evitar `require()` cacheado.
- El backend canónico ya usa CaptureService con watcher de PNG temporal, worker serial y verificación de viewport/yaw. Las recapturas de suelo y hongos quedaron completas; los fallos históricos de `ReadFile is not a valid ImageFormat` permanecen sólo como incidentes resueltos, no como bloqueo actual.

## Decisiones consolidadas

### Construcción

- La colocación es libre sobre superficies compatibles.
- No existen slots físicos ni anclajes radiales como restricción del mundo.
- `BuildPaletteSlot` sólo describe una posición visual en la HUD.
- La cámara normal permanece libre durante la construcción.
- El cliente propone y previsualiza; el servidor valida y crea.

### Identidad y autoridad

- `EntityId` es la identidad estable.
- `BuildEntity` es el contrato mínimo común.
- Las referencias usan IDs y puertos, nunca nombres visuales.
- `BuildActionDispatcher` centraliza acciones y resultados idempotentes.
- Las galerías y muestras permanecen fuera de las carpetas jugables.

### Presentación

- `PlantViewport` reutiliza modelos canónicos en UI.
- `MyceliumLinkVisual` es la única representación de preview y conexión real.
- `BuildPresentationController` es la única capa batcheada para sedimentación, crecimiento y pulsos locales.
- `VisualRevision = 7` permite detectar copias antiguas.
- La presentación observa estado autoritativo; no calcula reglas económicas.
- `Flow` es propiedad del ledger autoritativo: `NutrientGraph` calcula transferencias por tick y `BuildPresentationController` sólo observa el valor para presentar pulsos.

### Conexiones e interacción

- Cada puerto lógico admite una sola conexión simultánea.
- Un puerto ocupado no inicia una segunda unión: permite tomar el extremo ya conectado.
- `RewireConnection` mueve únicamente el extremo elegido y conserva la identidad del enlace.
- Clic en el aire sobre una conexión nueva sólo cancela el preview local.
- Clic en el aire sobre una conexión existente retrae el tramo hacia el extremo fijo y solicita `DismantleConnection`.
- `BreakConnection` conserva un enlace roto regenerable; `DismantleConnection` lo elimina y libera ambos puertos.
- La tecla `C` no participa en conexiones; se conserva para colocación y salida del destructor.

### Dirección visual pendiente

- Sustituir la superficie plana por suelo orgánico sin perder colocación libre.
- Ramificar el micelio hacia los costados para aproximarlo a una red de hifas.
- Modelar pequeños hongos como representación canónica de los puertos.
- Hacer crecer esos puertos-hongo de forma progresiva junto con la planta o su activación.
- Permitir familias estéticas de hongos como presentación intercambiable, sin alterar el puerto lógico ni la autoridad del servidor.

### B003 integrado como visual canónico — 2026-07-30

- `ReplicatedStorage.MyceliumFront.Visuals.MushroomPortVisual.B003Templates` conserva Hero, LOD1 y LOD2 con los hashes del run `b003-hero-lod-package-blender`.
- La geometría B003 es sólo presentación: está anclada, no colisiona, no recibe touch y no participa en queries.
- `InteractionRoot` sigue siendo `PrimaryPart`, transparente, no colisionable y la única hitbox consultable (`MushroomPortHitbox=true`).
- `StarterPlayerScripts.MushroomPortLODController` evalúa todos los puertos en un loop compartido cada `0,2 s`, usa histéresis `240/192` y `80/64` píxeles y limita Hero a una instancia.
- Client fresco confirmó que sólo queda visible el LOD elegido; Server conserva el contrato lógico y ambas consolas cerraron sin errores.

### Simulación vigente y extensiones futuras

- No hay un `Heartbeat` independiente por planta.
- `PlacementService` ejecuta ticks controlados y `NutrientGraph` conserva producción, transferencia, consumo, reserva, rechazo y balance.
- `Flow` se deriva de la transferencia autoritativa; los pulsos visuales continúan siendo sólo presentación.
- Las extensiones pendientes incluyen prioridades de distribución, almacenamiento especializado, rutas alternativas y balance de economía.
- La persistencia futura guardará estado lógico, no beams, partículas, previews o modelos de galería.

## Próximo incremento acordado

Orden de trabajo:

1. hecho: excluir durablemente `v8-technique-proof` y `v83-terraced-carrier-proof`, conservando archivos y hashes;
2. hecho: reconciliar `asset-registry.json` con `v831-static-turntable-fixed-20260726` y `v844-static-turntable-fixed-20260726`;
3. hecho: regenerar dashboards con cero proofs activos, faltantes o hashes inconsistentes;
4. hecho: implementar el ledger determinista, alimentar `Flow` desde transferencias autoritativas y verificar conservación;
5. hecho: cerrar C005/C006 con cinco oleadas, derrota/victoria, economía de reparación/curación, reinicio y HUD compacta;
6. hecho: B003 corregido quedó aprobado como un hongo individual/base reutilizable de la familia B;
7. hecho: congelar B003 como Hero byte-idéntico y derivar LOD1/LOD2 Blender (6.872/1.808 triángulos y cinco meshes por material), registrados en `b003-hero-lod-package-blender`;
8. hecho: importar e integrar Hero/LOD1/LOD2 manteniendo separados visual, puerto lógico, hitbox, identidad y autoridad; la VM fresca confirmó cero errores y una sola variante visible;
9. C007 automática original completada y regla de recuperación corregida el 2026-08-01: una red comprometida no pausa oleadas; no hay curación ni reparación desde el HUD; la colonia pierde al llegar a cero. Cerrar pasada humana y variante deliberada de derrota. Evidencia: `docs/COMBAT_C007_BALANCE_UX_2026-08-01.md`.

UX de inspección, 2026-08-01:

- el inspector de plantas muestra `Health/MaxHealth`, nutrientes y estado de marchitamiento;
- el alcance de habilidad se deriva de atributos runtime o, como fallback, de `PlacementCatalog`, y se proyecta sobre `BuildSurface`;
- `CactusSentry` hereda rango, daño y cooldown desde `CombatConfig`;
- el harness inicial puede limpiarse antes de comenzar mediante una acción autoritativa que sólo destruye instancias `NightlyHarness`.

No conviene implementar DataStore ni producción amplia de contenido antes de estabilizar la integración visual y el balance de C007.

## Decisiones durables del dashboard visual

- La unidad visible para el usuario es el **asset lógico** (`assetTrack`), no la carpeta física del benchmark.
- Un paquete técnico puede alojar varios assets lógicos, pero sus historiales y comparaciones permanecen separados.
- Las dependencias se muestran como relaciones explícitas (`uses-base` u otras futuras); nunca se resuelven mezclando versiones.
- La portada abre directamente la iteración destacada mediante `#run=<runId>`.
- La crítica principal vive junto a la imagen en el inspector; no se duplica como tarjeta hero inferior.
- La comparación es la vista inferior predeterminada y sólo ofrece versiones del mismo asset.
- Los estados usan texto, SVG y color semántico; el color no es el único indicador.
- Las plantillas bajo `tools/visual_benchmark/dashboard_templates/` son canónicas. El contenido generado en `evidence/` no se edita a mano.
- El frontend de detalle se divide en nueve módulos bajo `dashboard_templates/artifact/modules/`; `app.js` es sólo bootstrap. El orden de scripts es explícito y no existe una segunda registry dentro de los dashboards generados.
- El dashboard está en mantenimiento. Nuevos cambios requieren un problema observable o una necesidad semántica real, no decoración adicional.

Ver [`VISUAL_DASHBOARD_SYSTEM.md`](VISUAL_DASHBOARD_SYSTEM.md).

## Preguntas abiertas

- ¿La conexión seguirá siendo siempre manual o tendrá una ayuda opcional de auto-enlace?
- ¿Los puertos cardinales alcanzan para la primera vertical slice o se necesitarán puertos definidos por especie?
- ¿Qué información mínima debe mostrar el laboratorio sin convertirlo en un panel permanente?
- ¿Qué frecuencia de tick permite una red grande sin perder legibilidad ni rendimiento?
- ¿Cuándo conviene extraer el código embebido en `1.rbxl` a Rojo?

Estas preguntas no bloquean el próximo incremento de simulación.

## Política de archivos y Git

- `1.rbxl` es el artefacto principal y debe versionarse como binario.
- Los backups de hitos se conservan localmente en `backups/` con nombre, fecha y propósito claros; la carpeta está ignorada por Git y los hashes se registran en changelog.
- `*.rbxl.lock`, autosaves, logs y archivos temporales no se versionan.
- Antes de una migración amplia se crea snapshot o backup.
- Después de una versión importante se registra el hash en el changelog.
- Un commit no reemplaza el backup del lugar ni la prueba en Studio.

## Uso de skills y MSSR

Las skills utilizadas en las pruebas `0.0.1` y `0.0.2` mejoraron la cobertura del proceso: forzaron baseline, prueba por remotes reales, observación separada de Client y Server, idempotencia, casos protegidos, auditoría post-Stop y persistencia verificable.

No se midió un benchmark A/B de calidad de código. La mejora demostrada es de disciplina, trazabilidad y detección de errores. Los detalles del proceso están en [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md).

## Pruning visual de suelo y Flor solar — historial y estado vigente 2026-07-26

La primera poda dejó como diagnóstico los runs `v831-static-model-refresh-20260725` y `v844-static-model-refresh-20260725`. Ese snapshot queda preservado como historial, pero fue supersedido por recapturas técnicas con cámaras corregidas:

- `Carrier de tierra` canónico: `v831-static-turntable-fixed-20260726`, V8.3.1, cinco vistas lógicas.
- `Tierra + micelio` canónico: `v844-static-turntable-fixed-20260726`, V8.4.4, cinco vistas lógicas.
- Los predecessors defectuosos son tombstones sin píxeles activos; `artVersionChanged=false`.
- `Micelio cardinal + Flor solar` continúa `pending-recapture` mediante `cardinal-mycelium-plant-v4-pending-recapture-20260726`.
- Los proofs `v83-terraced-carrier-proof` y `v8-technique-proof` permanecen protegidos en disco, pero deben estar excluidos editorialmente del dashboard activo.
- `1.rbxl` no fue modificado por las sesiones fotográficas.

Autoridades:

- `evidence/visual-benchmarks/soil-mycelium-mound/audits/2026-07-26-soil-cardinal-visual-pruning-plan.json` — poda inicial;
- `evidence/visual-benchmarks/soil-mycelium-mound/audits/2026-07-26-soil-turntable-capture-successor-pruning-plan.json` — sucesión técnica y poda verificable final;
- [`VISUAL_PIPELINE_STATUS_2026-07-26.md`](VISUAL_PIPELINE_STATUS_2026-07-26.md) — readback vigente y pendientes.

## Incidente de interacción y estado persistente — 2026-07-30

- Síntoma: el clic sobre una planta propia en modo destructor podía no enviar
  `RemovePlant`; el HUD persistente también podía alternar entre red lista y red
  incompleta.
- Causa: `PlacementController` descartaba primero los clics marcados como
  procesados por Roblox, incluso cuando el destructor era el dueño activo del
  input. `CombatService` usaba una muestra instantánea de `Flow` para decidir si
  la red estaba lista.
- Corrección: el destructor resuelve primero el clic izquierdo fuera de su UI.
  La disponibilidad de combate usa cactus `Active` y `Powered` más una conexión
  `Active` y no rota; `Flow` permanece como presentación/telemetría y no como
  identidad ni autoridad.
- Regresión verificada: en una VM Play fresca, forzar `Flow=0` mantuvo
  `CombatWaveReady=true`; una solicitud real `RemovePlant` eliminó la planta y
  limpió dos conexiones sin errores de consola.
- Seguimiento: confirmar manualmente el clic físico del viewport, porque el MCP
  valida la ruta de código y el remoto real pero no sintetiza ese clic de forma
  confiable.

## Cierre de UI, reconexión y puntería — 2026-08-01

- El constructor reutiliza el inspector de planta para presentar la definición seleccionada antes de colocarla. Las plantas base ya no muestran un coste falso de `0 ESPORAS`; producción y consumo se leen desde `definition.Nutrients`.
- El HUD de combate conserva una sola acción `LIMPIAR ZONA DE PRUEBA`, dentro del panel persistente de 380 px; no se añadió un botón duplicado.
- `BuildPresentationController` restaura la presentación base cuando una planta pasa de un estado no alimentado a `Powered`. En Play fresco, `CactusSentry` completó `Starved → Powered` y registró `RenderedPowerRestoredAt`.
- `BiologicalFeedbackRuntime` orienta `SporeBarrel` y `MuzzleBloom` como una unidad hacia el objetivo y lanza el proyectil con trayectoria recta suavizada. La prueba runtime obtuvo alineación `dot=0.99999988`, unión cañón-boca `gap=0` y atributos `AimTarget`/`MuzzleWorldPosition` presentes.
- La consola de la prueba no mostró errores: sólo los mensajes de inicio de laboratorio, colocación y combate.
- QA pendiente humana: confirmar el clic físico de una tarjeta de paleta y revisar la ficha en tamaño real. `user_mouse_input` agotó dos intentos de 60 s; la lógica ya había sido comprobada en una VM previa, pero esta última pasada no pudo repetir el clic automatizado.
- Incidente de herramienta: `roblox_screen_capture_save` dejó una operación activa prolongada; se esperó su liberación y se usó una captura de ventana sólo como revisión preliminar. No se registró una imagen incompleta como evidencia del pipeline.
- Persistencia: el intento anterior no pudo confirmar la ventana, pero el cierre C007 posterior guardó `D:\Dev\MyceliumFront\1.rbxl` mediante `roblox_place_save`. El hash cambió a `7f973feeffc2055145eaab797eddaeb05bfb31298460927240247d002bf9d9eb`; Studio quedó en Edit y sin `CombatRuntime` residual.

## Cráter Semilla V5 construible — 2026-08-01

- `Workspace.CraterSeedTechniqueProof` conserva el carrier `70 × 54` en la candidata este y pasa a `VisualRevision=5`, `InteractiveLab=true`, `PrototypeOnly=true`, `CanonicalMapContent=false`.
- `HexBuildLab` contiene 14 ranuras deterministas y una semilla base `H01`; `H02 ↔ H12` conecta dos clusters axiales.
- `CraterSeedBuildLabController` ofrece cuatro estados, reset y visibilidad reversible. Se ubicó a la izquierda para no solapar el HUD de combate ni `Construir [B]`.
- `PlacementService` reutiliza `BuildActionDispatcher` para `CraterSeedPlaceCell`, `CraterSeedReset` y `CraterSeedSetVisible`; el servidor valida distancia, slot, estado, ocupación y continuidad.
- Play fresco verificó selección UI y clic de mundo reales, rechazos, idempotencia, extensión al segundo cluster, tablero `14/14`, ocultar/mostrar y reset a una celda.
- Server y Client coincidieron; consola limpia, un solo collider, `RuntimeSubject` vacío y cero raíces temporales post-Stop.
- Evidencia durable: run `crater-seed-cs2-v005-build-lab`, cuatro capturas, dashboard estático/runtime sin issues, revisión humana pendiente.
- Recuperación externa: baseline previo V4 y copia posterior V5 bajo `D:\Dev\_mycelium-baselines\`, cada una con manifiesto y SHA-256.
- Persistencia V5: `D:\Dev\MyceliumFront\1.rbxl`, 5,046,174 bytes, SHA-256 `bce5a4b65d5086ad77dc1af1da230dea9e54adbb7145607320cc197d167a14a5`, verificado en Edit por `roblox_place_save`.

## Cráter Semilla V6 integrado al constructor — 2026-08-01

- `PlacementCatalog` revisión 4 conserva las plantas y agrega la categoría `Terrain`/`SUELO` con `CraterSeedDry`, `CraterSeedGerminating`, `CraterSeedLiving` y `CraterSeedInfected`.
- `PlacementController` reutiliza el flujo `[B]`, separa `PLANTAS` y `SUELO`, muestra previews heredados de la fábrica y desactiva el panel aislado mientras el constructor está abierto.
- `CraterSeedTechniqueProof` revisión 6 expone `CreateFloorSegment`: geometría/estado visual separados de `StableCarrier`, que es colisionable, caminable y nunca se anima.
- `CraterSeedSegmentAnimator` usa un único `RenderStepped` batcheado. La aparición sube, escala y vibra suavemente; el estado final se restaura exactamente.
- `HexGrid` es la autoridad matemática compartida para el pregrid pointy-top. La prueba aceptó dos centros vecinos a `5.7157669` studs y rechazó volver a ocupar el mismo hex.
- `PlantViewport` mantiene el contrato estricto de procedencia y admite explícitamente `CraterSeedTechniqueProof.CreateFloorSegment`; los segmentos usan `CameraProfile=TerrainTopOblique` para no verse de canto.
- Play verificó los cuatro estados, rechazo de tipo desconocido, idempotencia por `requestId`, colisión/raycast sobre `StableCarrier`, progreso de animación `0→1` y ausencia de errores nuevos en consola.
- El primer guardado no envió `Ctrl+S` porque Studio no pudo confirmarse en foreground. Se activó únicamente la ventana exacta `D:\Dev\MyceliumFront\1.rbxl - Roblox Studio` y el segundo intento quedó verificado.
- `verify-visual-pipeline.cmd` mantiene su cierre integral; la integración V6 no registra como evidencia la captura fallida que volvió a Edit antes de fotografiar el constructor.
- La aparición construible ya sube, crece y vibra mediante un controlador batcheado; `StableCarrier` permanece inmóvil y caminable. La extensión temporal y desaparición como mecánicas quedan para el siguiente incremento.

Persistencia V6: `D:\Dev\MyceliumFront\1.rbxl`, 5,052,026 bytes, SHA-256 `6311f8f59e18e7d13866fdd92baaec385075080f945c6ccc5bf25259587f727e`, guardado y verificado en Edit.

## Corrección V7 — cardinalidad exclusiva de plantas

- `CraterSeedTechniqueProof` revisión 7 separa la celda técnica del segmento jugable. `CreateFloorSegment` ya no genera `SEG`, `CellPerimeter` ni `SurfaceMark`; el laboratorio V5 conserva sus ayudas de diagnóstico.
- `BuildPresentationController` procesa sedimentación y nutrientes únicamente cuando `PlantType` es una cadena. `TerrainSegment`, zonas y otros modelos de `PlacedObjects` quedan fuera del cache de plantas.
- Edit verificó `0` labels, `0` outlines y `0` marcas en el suelo, manteniendo `StableCarrier` colisionable. Play Client verificó que el terreno no recibió `RenderedSedimentationProgress`, mientras una planta de control sí; consola limpia.
- Persistencia: `D:\Dev\MyceliumFront\1.rbxl`, 5,052,098 bytes, SHA-256 `1f0589ea29ec364f61b8205e505e8d6c94f26447057e44799ec71c809ca4a41d`.

> V7 quedó supersedida visualmente por V8: los hexágonos y sus trazos eran geometría deseada del suelo; los puntos cian de `ConnectionPorts` eran la cardinalidad que debía excluirse.

## Corrección V8 — suelo hexagonal y puertos sólo para plantas

- `CraterSeedTechniqueProof` revisión 8 vuelve a conservar seis bordes, trazos de superficie y la identidad `SEG`, pero reemplaza la cerámica circular visible por seis `WedgePart` que forman una superficie hexagonal real. El cilindro interno queda invisible y sólo funciona como ancla técnica.
- `ConnectionPorts.GetAll` excluye explícitamente modelos cuyo `EntityType` o `BuildKind` sea `TerrainSegment`; esto evita puntos cian en suelo aunque el catálogo conserve un `PlantType` visual para previews heredados.
- Verificación fresca en Edit y Play: `6` superficies hexagonales, `6` bordes, `0` cilindros visibles, grosor mundial `1.02`, `0` puertos para el segmento y `4` para una planta de control.
- Play construyó `CraterSeedGerminating`, `CraterSeedLiving` y `CraterSeedInfected` sin errores nuevos de consola. Post-Stop quedó en Edit y sin raíces temporales V8.
- Persistencia V8 verificada: `D:\Dev\MyceliumFront\1.rbxl`, 5,052,406 bytes, SHA-256 `a2458e8690bd27e84e7ccb9c8ccc8653cad6b0ff0f22893b99a627ba2d257fa2`.

## Corrección V9 — asset hexagonal de una sola malla

- La revisión humana de V8 detectó puntas y escalones: las seis `WedgePart` cumplían el conteo estructural, pero se solapaban visiblemente al formar la losa y al colocar segmentos adyacentes.
- `ReplicatedStorage.MyceliumFront.Visuals.CraterSeedHexSurfaceTemplate` es ahora la fuente canónica: un `MeshPart` cerrado de radio `3.3`, tamaño `5.7157679 × 0.32 × 6.6`, generado con doce vértices perimetrales y tapas trianguladas.
- `CraterSeedTechniqueProof` revisión 9 clona una única malla por segmento; conserva estado/material, borde, trazos, `SEG`, `StableCarrier`, pregrid y animación, sin depender de piezas visibles superpuestas.
- El asset quedó registrado como `crater-seed-hex-surface`, run `v9-single-mesh`, fuente `game.ReplicatedStorage.MyceliumFront.Visuals.CraterSeedHexSurfaceTemplate`.
- Captura preliminar `v9-hex-mesh-review-close.jpg`: cuatro celdas adyacentes sin puntas de superficie; revisión humana todavía pendiente antes de promoción artística.
- Play fresco: `2` segmentos, `2` MeshParts, `0` WedgeParts, `2` StableCarrier colisionables, `0` puertos de terreno y consola sin errores. Post-Stop quedó sin raíces temporales V9.
- Persistencia V9 verificada: `D:\Dev\MyceliumFront\1.rbxl`, 5,053,784 bytes, SHA-256 `d4b1373e905a0695db083e0d43c9ae3ec20ec11611b0ade846fc4232583b5833`.

## Corrección de orientación del ghost de suelo — 2026-08-02

- `PlacementController` conserva el modelo canónico del preview y aplica una corrección de eje de `90°` exclusivamente cuando `definition.Kind == "GroundSegment"`; las plantas no cambian de orientación.
- Una VM Play fresca seleccionó `CraterSeedDry` mediante la paleta real. El script instalado contiene un único `ghostTransform` condicionado.
- Se eliminaron `ServerStorage.__GhostInspect` y `ServerStorage.__GhostVerify`, residuos del diagnóstico por Command Bar.
- El incidente MCP se resolvió sin reiniciar: Studio estaba conectado pero inactivo; `get_studio_state` sobre su `studioId` lo activó. La regla reusable ahora exige recuperar y reintentar MCP antes de usar pantalla.
- Persistencia: `D:\Dev\MyceliumFront\1.rbxl`, 5,061,374 bytes, SHA-256 `7db734020c6db60c5bb3b76b1043bd6ae366708e008928a1d15a754af3f125f1`.
