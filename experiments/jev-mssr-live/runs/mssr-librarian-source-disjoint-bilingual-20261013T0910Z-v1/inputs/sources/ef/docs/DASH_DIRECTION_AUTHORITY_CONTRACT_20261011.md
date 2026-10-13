# Elemental Frontier — DASH, dirección y autoridad (contrato 2026-10-11)

**Estado:** corrección en `feat/animation-studio-v1`; QA real cliente NeoForge 1.21.8 + Paper 1.21.8, plugin EF Paper v0.1.5. No fusionar automáticamente a `main`.

## Problema reproducido

El video del usuario `20261011-2054-41.0657131.mp4` dura 18,24 s a 30 FPS, resolución 544×522. En tercera persona se ve una pose de dash/rotación de las piernas, pero **no resulta claro un desplazamiento lateral**. Se observaron fotogramas de 0–18 s por muestreo periódico; no confundir un movimiento aparente de cámara con velocidad física.

**Causas separadas:**

1. `ClientDashInput` requería tecla Sprint recién presionada y WASD activo en los siguientes **3 ticks**; no guardaba ninguna dirección si se soltaba WASD. Resultados subjetivos dependían de mantener Sprint y movimiento simultáneamente.
2. El video y las primeras sesiones correspondían a **Minecraft Singleplayer**, sin autoridad Paper. El cliente podía predecir una pose de DASH mientras el impulso `player.setVelocity` existe realmente en `server-paper/.../DashExecutor.java`, y por ello el personaje parecía caminar en lugar de impulsarse.
3. `DashPoseSampler` inclinaba solamente el `body` (hermano separado de las piernas en `PlayerModel`) hasta **27°**, con unión visual abierta. La auditoría previa del cliente real midió **5,3–5,4 model px** de desplazamiento del centro inferior del torso respecto de pivotes de piernas, no la anchura exacta del hueco.

## Contrato obligatorio de controles

- **Ctrl** sigue siendo Sprint vanilla, y genera **un solo intento de dash por flanco de pulsación**, condicionado a cooldown. No se introducen slots numéricos ni se usan Alt ni teclas incompatibles con BUILD/COMBAT.
- Con **W/A/S/D actualmente pulsadas**, su vector gana. `A` = strafe negativo, `D` = positivo, `W` = adelante, `S` = atrás. Diagonales se normalizan y se conservan como diagonales. No forzar adelante si el jugador pidió un lateral.
- Con **ninguna tecla pulsada**, Ctrl reutiliza la **última dirección válida en coordenadas del mundo**. Girar la cámara/personaje después de soltarlas no gira el vector almacenado. `W+S` o `A+D` que cancelan explícitamente **no** recurren a memoria. Se borra memoria al cambiar de conexión.
- Si nunca hubo dirección válida, el dash no se ejecuta ni inventa movimiento frontal.
- Paper recibe `(strafe,forward)` actual o reproyectado a la orientación presente. Paper sigue validando movimiento, cooldown y aplicando velocidad: **el cliente no adquiere autoridad en multiplayer**.
- En Singleplayer ordinario, sin sincronización del canal Paper, no mostrar un DASH inmóvil. Se muestra una indicación discreta una vez y permanece Sprint vanilla.
- **Excepción explícita QA:** únicamente el perfil aislado `ef-animation-reference-qa`, con ambos flags JVM y servidor integrado, puede aplicar un impulso equivalente para probar física local. **NO** se ejecuta cuando hay Paper dedicado y nunca afecta otros perfiles, servidores o mundos.

## Contrato de pose / cadera

- `DashPoseSampler` sigue compartido entre Animation Studio Swing y cliente NeoForge. Para todos los rumbos, la rotación propia del torso queda acotada a aproximadamente **5° en X y 5° en Z**; con `A` o `D` puros, **body.xRot adicional = 0°**. La lectura lateral recae en extremidades.
- Está prohibido "simular inclinación completa" rotando 27° sólo el torso separado de las piernas; una animación de inclinación corporal completa requerirá un pivote padre coherente, no esta deformación.
- No modificar arbitrariamente físicas y distancias de Paper sólo para esconder un error de render. Animación y traslado se validan por separado y conjuntamente.

## Gates automatizados

- `DashDirectionMemoryTest` valida lateral puro, diagonales, prioridad del input actual, memoria tras soltar, giro de cámara a 90°, contradicciones y reinicio por conexión.
- `DashPoseSamplerTest` valida extremos neutros, límites de torso, simetría lateral, continuidad, determinismo, ausencia de pose residual y valores finitos.
- `client-neoforge gradlew test build --offline --no-daemon`: PASS.
- `server-paper gradlew test build --offline --no-daemon`: PASS.
- `ModelPartGeometryAudit` analiza poses **del renderer real**, no colisión hitbox.

## QA físico en juego integrado (sólo datos de prueba)

Cliente Prism QA en mundo EFProto *copiado*; `ClientDashQaImpulse` es un adaptador permitido **sólo allí**. Secuencias `dash-left`, `dash-right`, `dash-last-left`, `dash-last-right` fueron registradas desde render real + delta de entidad:

| Movimiento | Velocidad horizontal máxima observada |
|---|---:|
| Izquierda | 0,720 bloques/tick |
| Derecha | 0,720 bloques/tick |
| Última izquierda, tecla soltada | 0,666 bloques/tick |
| Última derecha, tecla soltada | 0,666 bloques/tick |

Se observaron signos opuestos de velocidad X entre izquierda y derecha. Son magnitudes muestreadas por tick del cliente, no el impulso constante del servidor ni la distancia total recorrida. Cadera: máximo cercano a **0,98 model px**, contra **5,3–5,4 px antes del cambio**.

## QA REAL Paper, sin simulación de movimiento local

Servidor Paper creado desde el JAR previamente disponible, **127.0.0.1:25567 exclusivamente**, directorio aislado `qa/paper-dash-lab` ignorado en Git, mundo nuevo plano `qa_flat`, plugin del worktree compilado. Cliente Prism `ef-animation-reference-qa` conectado a Paper, handshake protocol v2 confirmado. Sin `Minecraft.getSingleplayerServer()`, por lo que **no se invoca ClientDashQaImpulse**: el movimiento fue ejecutado por `DashExecutor` de Paper.

| Prueba | Pico velocidad X del cliente | Sesión |
|---|---:|---|
| A + Ctrl | +0,666 bloques/tick | `f9d62a58ccad41d58857777a31392a73` |
| D + Ctrl | −0,720 bloques/tick | `51d2a95d11e7474db03790ce503a9b1a` |
| A, soltar, luego Ctrl | +0,666 bloques/tick | `3abe1f531da348ada1ddda00b2bab581` |
| D, soltar, luego Ctrl | −0,666 bloques/tick | `6f1e7d3b8f6a4057bc2c4b280b293577` |

Las sesiones Paper contienen `model-parts.csv`, `reference-analysis.md`, `joint-analysis.md`, `pose-curves.png`, `joint-risks.csv`, `minecraft-contact-sheet.png` y tres PNG originales; guardadas bajo `qa/minecraft-reference/live/<id>` (fuera de Git). Las capturas Paper muestran partículas CLOUD y poses laterales de Steve, no la ropa del skin personal usado en el Singleplayer.

**Limitaciones:** la cámara de tercera persona sigue al jugador y puede hacer subjetivamente menos evidente su traslación. Un video lateral a 60 FPS, telemetría de desplazamiento por tick en mundo con paredes reales, HUD/cámara/VFX para legibilidad y revisión humana siguen pendientes. No asegurar "dash perfecto" sólo por estos resultados. No existe validación de todos los ángulos ni armas/ataques.

## Seguridad de la prueba

- Los originales del usuario no se alteran. `provision-paper-qa.ps1` requiere EULA ya aceptada, utiliza `server-ip=127.0.0.1`, genera un mundo nuevo, instala sólo el plugin compilado y rechaza sobrescribir una instancia QA ya existente.
- Paper QA usa `online-mode=false` **exclusivamente por escuchar en loopback**, no debe exponerse a ninguna interfaz de red ni utilizarse en producción.
- Al finalizar, detener el cliente QA normalmente y el Paper QA con el comando `stop`; no matar procesos de otros proyectos ni dejar instancias pesadas innecesarias.
