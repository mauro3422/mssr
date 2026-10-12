# Referencias de animación Minecraft — índice verificable

**Versión:** Minecraft Java 1.21.8 / NeoForge 21.8.54 / Parchment 2025.09.14.
**Registro principal:** [MINECRAFT_REFERENCE_LIVE_AUDIT_20261011.md](MINECRAFT_REFERENCE_LIVE_AUDIT_20261011.md).

| Recurso | Origen | Estado |
|---|---|---|
| Huellas de nueve clases originales `PlayerModel`, `HumanoidModel`, `Mth` y otras | Artefacto NeoForm local, hashes SHA-256 | **Verificado, versionado**: `MINECRAFT_REFERENCE_SOURCE_FINGERPRINTS_1_21_8.properties` |
| Fórmulas y cubos de Steve/Alex | Código fuente Minecraft instalado / adaptador del estudio | **Verificado para subconjunto neutral**; Walk/Sprint del visor Swing aún usan entradas sintéticas |
| Idle, caminar, Sprint, DASH, crouch, jump, strafe, backward y cámara frontal | **Cliente real NeoForge**, instancia Prism independiente `ef-animation-reference-qa` | **13 sesiones reales**: 750 muestras de modelo, 18.000 partes por etapa y 39 PNG auténticos |
| Antes/después por cada `PlayerModel` y `PlayerRenderState` | Mixin `PlayerModel.setupAnim` después de vanilla y composición de EF | **Verificado en runtime** con CSV completos y auditoría de pares |
| Contact sheets, curvas y marcadores geométricos | Capturas reales + analizador `MinecraftReferenceCli` y `ModelPartGeometryAudit` | **Verificado**: cada sesión dispone de `joint-risks.csv`, `joint-analysis.md`, `pose-curves.png`, originales PNG y metadatos |
| Inclinación del torso vanilla vs DASH propio | Datos cliente real | **Verificado**: Sprint torso 0°; DASH pico 25–26°; 5,3–5,4 model px de desplazamiento de centro cadera proxy |
| Banderas de físicas (suelo, pared, agua) | Estado de entidad cliente en segundo lote | **Verificado**: 0 choques horizontales en las sesiones diurnas de DASH, Sprint y crouch; no prueba ausencia de penetración visual de mallas |
| Ataque con objetos, transición de manos, agua/swim, elytra | Capturas aún no ejecutadas con equipamiento y estado adecuado | **Pendiente** |
| Visión lateral real F5 en pleno DASH | El sistema dispone de frente y espalda, no cámara lateral dedicada | **Pendiente** para gate visual humano |
| Reproducción de estados reales CSV dentro de Animation Studio | Actualmente el visor Swing usa fixtures | **Pendiente de integración y comparación** |

**Ubicación de datos locales:** `D:\Dev\elemental-frontier-animations\qa\minecraft-reference\live\<session-id>`, ignorada en Git. Copia original: `%APPDATA%\PrismLauncher\instances\ef-animation-reference-qa\minecraft\qa\vanilla-reference\sessions`. Mantener ambas y no reescribir los PNG originales.

**Scripts:** `tools/minecraft-reference/provision-qa-instance.ps1` prepara la copia segura, `run-live-suite.ps1` pide secuencias reales dentro del cliente ya abierto, `RUN_MINECRAFT_REFERENCE_CLI.cmd` analiza y verifica procedencia.

**Contratos obligatorios:** [MINECRAFT_REFERENCE_HARNESS_V1.md](MINECRAFT_REFERENCE_HARNESS_V1.md) y [ANIMATION_VANILLA_FIDELITY_CONTRACT.md](ANIMATION_VANILLA_FIDELITY_CONTRACT.md). No llamar colisión física a separación entre cubos del renderer. Los resultados numéricos no sustituyen la revisión de vídeo lateral real, y no autorizan un cambio automático de producción.

## Nuevas sesiones validadas en servidor Paper (dirección y cadera)

Contrato y resultados: [DASH_DIRECTION_AUTHORITY_CONTRACT_20261011.md](DASH_DIRECTION_AUTHORITY_CONTRACT_20261011.md).

Además de las 13 sesiones históricas del primer lote, se generaron 4 sesiones **de servidor integrado QA** y 4 sesiones **cliente + Paper autoridad real** con `dash-left`, `dash-right`, `dash-last-left`, `dash-last-right`. Todos los CSV y screenshots originales se preservan en `qa/minecraft-reference/live/` ignorado en Git. El plugin Paper aplicó velocidades X de signo contrario y se verificó el handshake v2 en el cliente. Las sesiones nuevas provienen del sampler con torso acotado (anteriormente 27°), por lo que nunca mezclar valores históricos con estas métricas como si fueran el mismo build.

Pendiente: aprobación humana de sensibilidad y legibilidad en F5 con cámara en movimiento, cámara lateral fija y VFX; el dash en Singleplayer sin Paper no representa movimiento del producto.
