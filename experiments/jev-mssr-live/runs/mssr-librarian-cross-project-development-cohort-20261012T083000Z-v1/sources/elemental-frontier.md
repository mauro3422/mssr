# Combat Lab Test Protocol

## Objetivo

Convertir "se siente bien" en observaciones repetibles sin eliminar el juicio humano.

Cada sesión prueba una sola pregunta. Ejemplos:

- ¿Qué input de dash se siente más natural?
- ¿Cuánto steering conviene conservar durante un dash?
- ¿Cuánto recovery hace legible un ataque fuerte?
- ¿Una animación anticipa suficientemente el hit?
- ¿El movimiento conserva momentum al terminar?

## Condiciones comunes

Para comparaciones directas:

- mismo perfil de vídeo/FPS;
- mismo FOV y sensibilidad;
- misma perspectiva cuando se compare animación;
- mismo tramo de arena;
- misma dirección inicial;
- misma condición sprint/suelo/aire;
- sin shaders salvo prueba específica;
- preferir singleplayer/local para eliminar ping;
- repetir cada medición al menos 5 veces si el dato es cuantitativo.

No mezclar configuraciones "tuneadas a gusto" con defaults en la misma fila. Registrar el cambio de config.

## Medición

### Tiempo

Con vídeo de tasa conocida:

`milisegundos = frames / FPS * 1000`

Marcas principales:

- input;
- primer frame de respuesta;
- primer frame activo/hit;
- último frame activo;
- retorno a control neutral.

De ahí salen startup, active, recovery y duración.

### Distancia

Usar una pista marcada en bloques y, cuando haga falta precisión, coordenadas inicial/final.

`distancia horizontal = sqrt(dx² + dz²)`

Registrar vertical por separado en saltos/launches.

### Velocidad

`velocidad media = distancia / duración`

Peak speed sólo se informa cuando exista evidencia suficiente; no inferirla de distancia total.

## Escalas subjetivas 1–5

- Steering: 1 rígido, 5 control libre.
- Air control: 1 casi nulo, 5 fuerte.
- Readability: 1 impredecible, 5 se lee antes del impacto.
- Feel: 1 incómodo, 5 excelente.

La puntuación nunca sustituye notas.

## Prueba contra rival

Para ataques/combat:

1. atacante repite el mismo movimiento;
2. defensor mira al atacante, no al HUD;
3. registrar cuándo entiende qué ataque viene;
4. intentar esquiva/bloqueo;
5. identificar qué pista lo hizo legible: pose, VFX, sonido, desplazamiento o timing.

## Resultado

Cada sesión termina en uno:

- `keep-principle`: conservar el principio casi tal cual;
- `adapt`: conservar idea, cambiar números/input/animación;
- `discard`: no trasladar;
- `unreviewed`: falta prueba.

No copiar assets o código propietario por haber aprobado un principio.
