# LLM Rig

LLM Rig es una aplicación de escritorio, local y orientada a Windows para descubrir modelos GGUF, ejecutar benchmarks reproducibles con `llama.cpp` y explicar si un modelo funciona cómodamente en el equipo del usuario.

El objetivo no es mostrar solamente tokens por segundo. LLM Rig busca responder preguntas prácticas:

- ¿Qué modelos tengo instalados?
- ¿Cuánto tardan y cuánta memoria utilizan realmente?
- ¿Entran cómodamente en mi RAM y VRAM disponibles?
- ¿Qué modelo ofrece el mejor equilibrio en mi computadora?
- ¿La respuesta cumple mínimamente la tarea solicitada?
- ¿Puedo reproducir y compartir la prueba?

## Estado actual

LLM Rig es un prototipo funcional, todavía no un producto listo para distribución general.

Actualmente incluye:

- aplicación Tauri 2 con interfaz React y TypeScript;
- motor de detección y benchmark escrito en Rust;
- descubrimiento administrado de runtimes `llama.cpp` sólo desde `D:\ai-runtime` y `D:\Dev\LLM-Rig\runtimes`; los modelos GGUF se buscan en `D:\ai-models` y `D:\AI`;
- inventario GGUF clasificado: modelos únicos, proyectores `mmproj`, copias agrupadas y fixtures internos ignorados;
- búsqueda por nombre/ruta y filtro de cuantización;
- ejecución asíncrona de `llama-bench` sin bloquear la ventana;
- procesamiento de prompt y generación en tokens por segundo;
- configuración avanzada reproducible de threads, batch/microbatch, tokens de prueba, capas GPU, caché KV, Flash Attention, split, mmap, prioridad y capas MoE en CPU;
- detección de capacidades del runtime: sólo se aplican flags presentes en su ayuda y los incompatibles quedan registrados;
- auditor de `tokenizer.chat_template` por señales, tamaño y SHA-256, con comparación opcional contra una referencia sin exponer la plantilla completa;
- laboratorio Gemma 4 con perfiles secuenciales, resultados completos y ranking por velocidad;
- duración y pico de RAM del proceso;
- VRAM dedicada, memoria GPU compartida y utilización mediante WDDM;
- validación del contador de VRAM contra la memoria física del adaptador;
- historial local y comparación entre dos ejecuciones;
- archivo durable de hasta 100 benchmarks individuales en `data\benchmarks` dentro del proyecto, además del caché de interfaz;
- importación automática y deduplicada de benchmarks directos y matrices Gemma guardados en `.bridge/benchmarks`, etiquetados por origen en el dashboard;
- chat local multi-turno mediante `llama-server`: el modelo permanece cargado entre mensajes y cada token se entrega a la interfaz mediante un Channel de Tauri;
- TTFT real, duración total, tokens por segundo, tokens cacheados y reasoning visible por respuesta;
- panel inferior independiente para las métricas del último turno y telemetría periódica del `llama-server` persistente: RAM del proceso, VRAM dedicada, memoria GPU compartida, uso GPU y serie temporal;
- nombres humanos y catálogo desplegable de runtimes administrados: build/hash, recomendado, modificado, experimental, baseline y disponibilidad de `llama-server`;
- cancelación individual de una generación en curso sin cerrar LLM Rig;
- auto-descarga configurable por inactividad, descarga manual y recarga al cambiar modelo, runtime, contexto, GPU, threads, batch, Flash Attention o reasoning;
- descarga automática del servidor de chat antes de `llama-bench` o `BenchmarkCase`, para no contaminar la medición;
- cierre del `llama-server` administrado al salir de LLM Rig para evitar procesos huérfanos;
- selección explícita del runtime `llama.cpp` usado por cada prueba;
- múltiples ejecuciones simultáneas identificadas mediante `run_id`, con cancelación individual;
- supervisor de procesos `llama-bench`, `llama-cli` y `llama-server`, diferenciando procesos administrados y externos;
- verificación de integridad antes/después del GGUF y de `llama-bench` mediante tamaño, fecha y fingerprint rápido;
- detección de interferencias de otras instancias de llama.cpp durante el benchmark;
- recomendación básica del resultado más rápido;
- exportación JSON y CSV;
- metadatos de reproducibilidad;
- motor Rust incrustado en el ejecutable Tauri.
- cancelación segura del árbol de procesos del benchmark, sin registrar cancelaciones como éxitos;
- línea base, mínimo durante la prueba y muestra posterior de RAM, con margen y presión externa heurísticos;
- VRAM física y picos dedicados/compartidos por proceso mediante WDDM, con datos globales marcados como no disponibles cuando el driver no los garantiza;
- series temporales monotónicas limitadas a 240 muestras y gráfico de RAM;
- `BenchmarkCase v1`, caso incorporado, ejecución real con `llama-cli`, copiado y persistencia local;
- validación Rust de coincidencias obligatorias/prohibidas y regex lineal con límites;
- timeout configurable, cancelación del árbol de generación, SHA-256 del modelo y commit del runtime;
- timeout configurable también para `llama-bench`, con terminación del árbol y diagnóstico `benchmark_timeout`;
- fingerprint rápido del modelo (tamaño + SHA-256 del primer y último MiB), identificado como confianza media y no equivalente a un SHA-256 completo;
- parser GGUF binario nativo y acotado para versión, arquitectura, nombre, file type, contexto, embedding, bloques, tamaño declarado y cantidad de tensores;
- gráficos temporales de RAM del proceso, VRAM, memoria compartida y utilización GPU.
- tooltip temporal con valores medidos y compactación histórica a un máximo de 120 muestras por ejecución;

No incluye todavía:

- progreso basado en eventos reales de `llama-bench`;
- benchmark conversacional reproducible y persistido para comparar TTFT, caché y calidad entre modelos;
- validadores JSON Schema o estructurados;
- lectura exhaustiva de metadatos GGUF;
- instalador, actualizaciones o servicio comunitario.

Consulta [ROADMAP.md](ROADMAP.md) para el plan completo y [CHANGELOG.md](CHANGELOG.md) para el historial de cambios.

## Arquitectura

```text
React + TypeScript
        │
   comandos Tauri
        │
  aplicación Rust
        ├────────────────────┐
 motor CLI incrustado        llama-server persistente
        │                    │
 llama-bench / llama-cli     chat HTTP local
        └──────────┬─────────┘
                   │
         GGUF + WDDM + sistema
```

El motor se incrusta dentro del ejecutable de escritorio y se extrae en el directorio temporal al ejecutarse. Esto elimina la dependencia del binario de desarrollo, aunque `llama.cpp` y los modelos continúan siendo recursos externos detectados en el equipo.

## Estructura

```text
llm-rig-probe/
├── src/main.rs             CLI, descubrimiento y benchmark
├── src/benchmark_case.rs   contrato, ejecución y validación de casos
├── src/gguf.rs             parser binario GGUF acotado
├── src/process_control.rs  deadlines y terminación de árboles
├── app/src/                interfaz React
├── app/src-tauri/          integración nativa Tauri
├── Cargo.toml              dependencias del motor
└── ROADMAP.md              plan técnico y de producto
```

El frontend separa contratos (`types.ts`), persistencia/retención (`storage.ts`), componentes de telemetría/diagnóstico (`components.tsx`) y orquestación (`main.tsx`).

## Desarrollo

Requisitos actuales:

- Windows 10/11;
- Rust estable;
- Node.js y npm;
- WebView2;
- una instalación compatible de `llama.cpp`;
- uno o más modelos GGUF.

Compilar el motor:

```powershell
cargo build --release
```

Escanear el equipo desde la CLI:

```powershell
.\target\release\llm-rig-probe.exe scan --output inventory.json
```

Ejecutar una prueba:

```powershell
.\target\release\llm-rig-probe.exe bench `
  --model "D:\ai-models\modelo.gguf" `
  --runtime "D:\ai-runtime\llama.cpp\llama-bench.exe" `
  --repetitions 3 `
  --gpu-layers 999 `
  --threads 6 `
  --batch-size 1024 `
  --ubatch-size 256 `
  --prompt-tokens 256 `
  --generation-tokens 64 `
  --flash-attention auto `
  --output result.json
```

Auditar la plantilla de chat embebida sin imprimir su contenido:

```powershell
.\target\release\llm-rig-probe.exe template-audit `
  --model "D:\ai-models\modelo.gguf" `
  --reference ".bridge\references\gemma4-official-chat-template.jinja" `
  --output template-audit.json
```

Ejecutar la matriz Gemma incorporada:

```powershell
.\target\release\llm-rig-probe.exe gemma-speed-lab `
  --model "D:\ai-models\gemma-e2b-q4km.gguf" `
  --model "D:\ai-models\gemma-e2b-q40.gguf" `
  --model "D:\ai-models\gemma-e4b-q4km.gguf" `
  --runtime "D:\ai-runtime\llama.cpp\llama-bench.exe" `
  --profiles balanced,compact-batch,flash-on,compact-flash `
  --output gemma-speed-lab.json
```

La documentación y el alcance de estos perfiles están en [docs/GEMMA_SPEED_LAB.md](docs/GEMMA_SPEED_LAB.md).

Compilar la aplicación:

```powershell
cd app
npm install
npm run build
npm run tauri build -- --no-bundle
```

El motor debe compilarse primero porque Tauri lo incorpora durante su propia compilación.

Ejecutar el release ya compilado:

```powershell
.\run-llm-rig.cmd
```

También puede abrirse directamente `app\src-tauri\target\release\llm-rig-desktop.exe`. La interfaz React está embebida en ese ejecutable; `localhost:1420` sólo aparece durante `tauri dev`. El chat tiene selectores propios de modelo y runtime, muestra únicamente runtimes que contienen `llama-server.exe` y lo inicia en `127.0.0.1` al pulsar **Prender modelo**.

## Métricas y significado

### Rendimiento

- `prompt tokens/s`: velocidad de lectura/procesamiento de la entrada.
- `generation tokens/s`: velocidad de generación visible para el usuario.
- `duration_ms`: duración completa de la prueba.

### Memoria

- `peak_process_memory_bytes`: pico de RAM privada/residente del proceso observado.
- `vram_peak_bytes`: pico de memoria GPU dedicada atribuido al PID por WDDM.
- `shared_gpu_memory_peak_bytes`: memoria del sistema compartida con la GPU.
- `gpu_utilization_peak_percent`: máxima utilización observada.

La VRAM se marca con fuente y confianza. Un valor WDDM solo se considera de confianza alta cuando hay muestras positivas coherentes y el pico no supera la memoria física reportada por el adaptador.

### Memoria disponible y margen

La implementación actual registra RAM total/usada/disponible antes, mínimo disponible durante y recuperación a los 750 ms. Clasifica el margen como saludable (>20%), reducido (10–20%) o crítico (<10%); son heurísticas, no garantías. La presión previa se marca cuando otras cargas ya ocupaban más del 25% de la RAM.

La VRAM global usada/libre se devuelve como `null` cuando WDDM y el driver no proporcionan un total global coherente por adaptador. En ese caso la interfaz muestra “no disponible” y conserva la razón, en lugar de estimarla.

Una medición futura registrará tres estados:

1. línea base antes de cargar el modelo;
2. mínimo disponible durante la ejecución;
3. recuperación después de descargarlo.

El resultado deberá distinguir:

- consumo atribuible al modelo/proceso;
- consumo total del sistema;
- memoria disponible antes de empezar;
- margen restante en el peor momento;
- presión causada por otras aplicaciones.

Esto evita decir que un modelo “entra bien” solo porque no falló. Un modelo puede completar una prueba y dejar al sistema sin margen práctico.

## Casos de prueba con prompt y validación

El formato previsto para pruebas de calidad es declarativo y editable:

```json
{
  "id": "json-contact-v1",
  "name": "Extracción de contacto",
  "category": "structured-output",
  "prompt": "Devuelve nombre y email en JSON para: Ana, ana@example.com",
  "expected": {
    "type": "regex",
    "pattern": "(?s)\\{.*\\\"name\\\"\\s*:\\s*\\\"Ana\\\".*\\\"email\\\"\\s*:\\s*\\\"ana@example\\.com\\\".*\\}",
    "flags": ["i"]
  },
  "generation": {
    "temperature": 0,
    "max_tokens": 128
  }
}
```

La interfaz deberá mostrar siempre:

- prompt exacto enviado;
- parámetros de generación;
- salida completa recibida;
- expectativa general;
- resultado de la validación;
- explicación del fallo.

Regex será solamente un validador mínimo, no una medida universal de inteligencia. Para evitar expresiones peligrosas se aplicarán límites de longitud, tiempo máximo, conjunto restringido de flags y un motor resistente a retroceso catastrófico. Cuando sea posible se preferirán validadores estructurados: JSON Schema, comparación numérica, coincidencia de campos o pruebas ejecutables en sandbox.

La implementación usa `regex` de Rust, sin backreferences, look-around ni backtracking exponencial. Limita el patrón a 256 bytes, la salida a 65.536 bytes, los flags a `i`, `m` y `s`, y la memoria del autómata. El resultado declara fuente, alcance y confianza; nunca presenta una coincidencia como evaluación semántica.

```powershell
.\target\release\llm-rig-probe.exe case --model "D:\ai-models\modelo.gguf" --case-json "caso.json" --timeout-seconds 120 --output "resultado-caso.json"
```

## Privacidad

Actualmente todo se ejecuta localmente. El historial se conserva en el WebView y como JSON individuales en `data\benchmarks` dentro del proyecto; los prompts y respuestas del chat no se guardan en ese archivo. Las exportaciones adicionales sólo se crean por acción del usuario.

Una futura base comunitaria deberá ser voluntaria y mostrar exactamente qué campos se enviarán. Nunca se deben subir prompts, respuestas, nombres de usuario o rutas locales sin consentimiento explícito.

## Limitaciones conocidas

- WDDM puede entregar cero o datos incorrectos según el driver; por eso se conserva fuente y confianza.
- La utilización sumada de múltiples motores GPU puede requerir normalización adicional.
- La telemetría utiliza muestreo y puede no capturar picos más cortos que el intervalo.
- El historial conserva como máximo 100 ejecuciones y compacta series a 120 muestras; el resultado recién ejecutado mantiene hasta 240 durante la sesión.
- El streaming procesa eventos SSE del runtime local y los envía al WebView; si una versión futura de `llama-server` cambia ese contrato, el parser deberá actualizarse.
- La cancelación es cooperativa: LLM Rig cierra la respuesta HTTP y conserva el servidor para el próximo mensaje; la liberación efectiva del slot depende del runtime.
- El servidor de chat usa un solo slot (`--parallel 1`) para priorizar una conversación local estable; aún no administra colas ni concurrencia de usuarios.
- Las recomendaciones actuales priorizan rendimiento observado, no calidad de respuesta.
- Los nombres de archivo no son una identidad suficiente; se necesitan metadatos GGUF y hash.
- Los metadatos GGUF se leen directamente del encabezado y se marcan con fuente, alcance y confianza; tipos/versiones incompatibles se muestran como no disponibles con su razón.
- La aplicación se ha validado principalmente con Windows, Vulkan y una Radeon RX 570.
- Algunos proveedores WDDM se consultan mediante procesos PowerShell con límite de tiempo; si no responden, la muestra se omite y la métrica queda como no disponible.
- El timeout limita el tiempo permitido al proceso de inferencia; en Windows, la terminación y verificación posterior del árbol puede añadir tiempo de limpieza antes de devolver el error.
- El build `b9360` probado solo emite carga de backends en stderr y entrega prompt/generación juntos al finalizar el JSON. Por eso la UI muestra actividad indeterminada durante la ejecución y no inventa etapas ni porcentajes.

## Validación realizada

- compilación release del motor, TypeScript/Vite y Tauri;
- catorce pruebas unitarias del motor y cuatro pruebas Tauri, incluida la normalización de evidencia de scripts para el dashboard;
- benchmark y BenchmarkCase reales con LFM2.5-1.2B-Instruct Q8_0, Vulkan y Radeon RX 570;
- chat persistente real con Gemma 4 E2B Q4_0 y llama.cpp b9593: primera consulta 6,37 s; segunda 3,69 s; 15 tokens de prompt reutilizados y 14,09 tok/s en la segunda generación;
- importación real de `.bridge/benchmarks` al archivo durable: 32 registros JSON creados al iniciar el dashboard;
- timeout forzado con código de error y comprobación de cero procesos huérfanos;
- arranque real del release Tauri, con cero procesos llama.cpp antes de pulsar **Prender modelo**.

## Licencia

La licencia del proyecto todavía no está definida. Antes de distribuirlo deben revisarse las licencias de las dependencias, de `llama.cpp`, de cada modelo y de cualquier paquete de benchmarks incluido.
