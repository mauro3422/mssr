# Pruebas de MSSR

## Regresión de salud de la fuente Roblox

La regresión determinista de `scripts/test-v060-tools.mjs` debe cubrir tres estados del catálogo remoto:

1. tools vivas presentes -> `healthy`;
2. tools vivas vacías con último catálogo sano -> `degraded` y `usingCachedTools=true`;
3. tools vivas vacías sin caché -> `unavailable` con warning accionable.

Para verificar la integración viva, llamar `roblox_mcp_status` y `roblox_mcp_tool_list` con `refresh=true`. Una respuesta que detecta Studio pero tiene `liveToolCount=0` nunca debe presentarse como sana, aunque schemas cacheados preserven operación parcial.

## Qué se prueba realmente

Las pruebas no envían un mensaje a un modelo y esperan una respuesta impredecible. Invocan directamente el registry compilado con el mismo objeto que enviaría el agente:

```json
{
  "task": "Dale",
  "context": "La propuesta aceptada fue implementar una red de micelio, con edición segura, playtest y guardado...",
  "intent": {
    "domains": ["roblox"],
    "actions": ["create", "edit"],
    "artifacts": ["network-system"],
    "needs": ["safe-editing", "playtest"],
    "risk": "write",
    "ambiguity": "medium"
  }
}
```

Luego se inspeccionan `loadOrder`, `deferredLoadOrder`, fases, warnings y cobertura.

## Capas

### 1. Fixtures versionados

`config/skill-routing/skill-routing-fixtures.json` contiene frases reales, continuaciones ambiguas y casos negativos. Un caso puede declarar `taskVariants` para comprobar que distintas formas de aceptación o continuación mantienen el mismo routing sin duplicar todo el fixture.

Cada caso puede exigir:

- skills que deben estar activas;
- skills que no deben estar activas;
- skills que deben quedar diferidas;
- modo estructurado o fallback;
- uso del contexto previo;
- fases requeridas que deben quedar sin cobertura, normalmente ninguna mediante `missingRequiredPhases`.

### 2. Auditoría estructural

`skill_route_audit` comprueba:

- skills propias sin metadata explícita;
- configuración obsoleta;
- dependencias y workflows rotos;
- ciclos;
- duplicados;
- archivos ilegibles;
- descripciones faltantes;
- skills que ameritan revisar su tamaño.

### 3. Regresión aislada

`scripts/test-skill-routing.mjs` descubre el catálogo local mediante el provider de filesystem y ejecuta todas las fixtures versionadas contra el motor independiente.

La regresión también crea una skill dentro de `plugins/cache`, excluye deliberadamente esa ruta de la política general del Bridge y exige que el descubridor la encuentre mediante su límite interno de sólo lectura. Así se prueba que habilitar plugins no concede acceso general a `.codex`.

### 4. Suite integral

`npm run verify` ejecuta typecheck, build, pruebas del core, registry, MCP, routing fixtures y auditoría. Los hosts consumidores conservan sus propias pruebas de integración.

## Comandos

```powershell
npm run test:skill-routing
npm run verify
```

## Añadir un caso

Para cada activación importante agregar:

1. un caso positivo;
2. un caso negativo semánticamente cercano;
3. un caso con `context` cuando el usuario pueda aprobar una propuesta con una frase breve;
4. fases posteriores cuando existan verificación o persistencia.
5. `caller` cuando la ruta de herramientas cambie entre Codex local y ChatGPT web;
6. `agentFallbackPhases` cuando una obligación de fase no tenga una skill especializada.

Los fixtures deben describir comportamiento observable, no detalles internos del algoritmo de puntaje.

## Compatibilidad multi-cliente y multi-Studio

Además del catálogo, comprobar que:

1. `ownership.childPid` identifica el hijo administrado por el Bridge;
2. probes concurrentes comparten single-flight y la política es `serialized-single-connection`;
3. `roblox_mcp_studio_list` informa si existen varias instancias;
4. una acción sin `studioId` falla cuando hay más de una;
5. selección y ejecución no pueden intercalarse con otra sesión del Bridge;
6. un catálogo cacheado nunca habilita dispatch ni carga de una skill Roblox;
7. shutdown HTTP/stdio libera el transporte hijo.

Para un falso positivo o falso negativo confirmado, conserva primero la salida que falla, añade el incidente a `INCIDENTS.md` y crea un fixture que exija tanto la selección correcta como la exclusión explícita de las ramas incorrectas. Después de modificar código o contrato, lee de vuelta los archivos: un exit code exitoso de un script no demuestra por sí solo que la configuración cambió.

## Benchmark de activación y resultado

Los fixtures responden “¿la ruta determinista seleccionó correctamente?”. El Bridge MSSR Observatory agrega dos niveles posteriores:

1. **Activation benchmark:** correlaciona `route_planned` con `skill_loaded`, calcula cobertura de cargas requeridas, loads huérfanos y replans.
2. **Outcome benchmark:** correlaciona la ruta con checkpoints de verificación, persistencia, resultado, fricción y correcciones del usuario.

La cadena de evidencia preferida es:

```text
recommended → loaded → followed → verified → persisted → outcome / recurrence
```

Las pruebas de integración de Bridge usan una base SQLite temporal y clientes MCP in-memory nuevos para cada llamada. Exigen que una ruta sin ID manual sobreviva al patrón stateless y propague la misma traza a cargas requeridas, wrapper de dispatch, replan, verificación, persistencia y outcome; también prueban carga huérfana, mismatch, skill requerida omitida, outcome sin ruta, reemplazo prematuro, schema sin `stage` y dos agentes ambiguos. Cierran bases y providers antes de limpiar el sandbox.

`trace-contract-v1` abre una época lógica nueva sólo después de pasar esa regresión. `scope=active` mide el contrato actual; `scope=all` conserva la telemetría anterior sin retrofabricarla como trazas correctas.
