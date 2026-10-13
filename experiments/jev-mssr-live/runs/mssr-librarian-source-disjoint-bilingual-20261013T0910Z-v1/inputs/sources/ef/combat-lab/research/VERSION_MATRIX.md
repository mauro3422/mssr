# Combat Lab Version Matrix

Baseline común de comparación:

- Minecraft Java 1.21.8
- NeoForge 21.8.54
- Java 21
- Prism Launcher 11.1.1

La versión final del servidor **no queda fijada por este baseline**. El laboratorio usa la versión común más reciente entre las referencias principales para comparar comportamiento bajo condiciones equivalentes.

| Perfil | Minecraft | Build fijada | Uso | Licencia / regla |
|---|---|---|---|---|
| Enhanced Movement | 1.21.8 | 2.1.3 | dash, air-dash, double-tap, ledge | MIT según metadata de la build fijada |
| ParCool stable | 1.21.8 | 3.4.3.3 | parkour, vault, wall movement, transiciones | LGPL-3.0-only |
| Better Combat | 1.21.8 | 3.0.1 | timing, telegraph, hit window, recovery | All Rights Reserved: referencia; no copiar código/assets |
| Bending Styles | 1.21.8 | 1.1.1 | input elemental, movilidad, animación y VFX | GPLv3 |
| ParCool 4.0 experimental | 1.21.1 | 4.0.0.5 | estudiar el motor/animaciones 4.x | excepción aislada; no entra en comparación baseline directa |

## Locks

`combat-lab/locks/*.json` conserva IDs exactos, dependencias, hashes y URLs resueltas. Sólo refrescar un lock de forma deliberada con `resolve <perfil> --refresh`.

## Bending Styles

La build 1.21.8 declara directamente:

- Minecraft exactamente 1.21.8.
- NeoForge >= 21.8.31.

El baseline 21.8.54 satisface esa restricción. No declara otra dependencia requerida dentro de `neoforge.mods.toml`.

## Better Combat

El resolver incluye automáticamente dependencias requeridas compatibles con 1.21.8. En el lock actual se fijan Better Combat + Player Animation Library + Cloth Config.

## Regla

Nunca actualizar un perfil a mitad de una ronda de medición. Una ronda completa conserva los mismos locks.
