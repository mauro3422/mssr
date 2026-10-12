# NeoPSE AI Benchmarks

## Comandos

```powershell
npm run test:toolcall  # smoke test de Gemma tool calling
npm run test:ai        # suite corta Gemma + WR CPU
npm run test:ai:historical
npm run test:ai:compare -- --profiles gemma,gemmaQat
```

Tambien se puede levantar un perfil manualmente:

```powershell
npx tsx scripts/debugger-llm.ts server gemma
npx tsx scripts/debugger-llm.ts server gemmaQat
npx tsx scripts/debugger-llm.ts server wrCpu
```

## Pipeline

El runner principal es `scripts/debugger-llm.ts`.

Hace tres cosas:

1. Verifica si el puerto esperado ya tiene `/health`.
2. Si no hay server, restaura `D:\ai-runtime\llama-b9360` desde el zip de respaldo y levanta `llama.exe server`.
3. Ejecuta tests y guarda un resumen en SQLite.

Resultados y artefactos:

- `benchmarks/data/benchmarks.db`: historico SQLite local, ignorado por Git.
- `NEOPSE_BENCHMARK_DB`: variable opcional para redirigir la DB.
- `benchmarks/results/latest.json`: ultimo resultado plano local, ignorado por Git.
- `benchmarks/results/latest-summary.md`: tabla local comparativa con pass rate, latencia, p95, tok/s y fallos, ignorada por Git.
- `benchmarks/results/<timestamp>.json`: snapshots locales por corrida, ignorados por Git.
- `benchmarks/results/<timestamp>.md`: resumen local por corrida, ignorado por Git.
- `logs/`: logs locales de servidores/procesos, ignorados por Git.
- `prompt_benchmarks.json`: suite historica de 50 casos, no se actualiza en la suite corta.

## Suite corta actual

| Caso | Modelo | Objetivo |
| --- | --- | --- |
| `Gemma-PSeInt-Bisiesto` | Gemma | Generacion PSeInt reconocible |
| `Gemma-Inline-Editar` | Gemma | Edicion inline de `node-1` |
| `Gemma-Conversacional` | Gemma | Explicacion pedagogica |
| `ToolCall-Gemma` | Gemma | Tool calling nativo con `sumar` |
| `WR-Seguridad-Conceptual` | WR CPU | Explicacion conceptual de seguridad |

## Criterios

Texto normal:

- Puede ser texto libre cuando `expectedResponse` es `assistant_text`.
- No debe contener patrones de salida corrupta.
- Debe incluir keywords minimas por caso.
- Si emite `tool_use` en un caso conversacional, se marca como `unexpected_tool_use`.

Acciones de canvas:

- Deben ser JSON valido cuando `expectedResponse` es `canvas_action_json`.
- Deben incluir `message` y `tool_use`.
- `tool_use.action` debe coincidir con la accion esperada cuando el caso la define.
- Si el primer intento viene incompleto o malformado, el benchmark permite un retry de reparacion estructurada.

Tool calling:

- Debe llegar `tool_calls[]`.
- Debe coincidir el nombre de herramienta esperado.

## Estado validado

El 2026-06-04 se confirmo:

- Avast era quien ponia en cuarentena `llama.exe`, `llama-server.exe`, `bench.dat` y `start-ai-server.ps1`.
- Con Avast desactivado, `npm run test:toolcall` pasa.
- Gemma levanta en `127.0.0.1:8000` y genera una llamada real a `sumar({"a":15,"b":27})`.

El 2026-06-05 se estabilizo el contrato de salida:

- Suite historica Gemma: 50/50.
- Guardrails locales: 12/12.
- Build: OK.

El 2026-06-06 se agrego comparacion A/B de modelos:

| Perfil | Modelo | Pass | Avg ms | P95 ms | Avg tok/s | Invalid JSON |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `gemma` | `google_gemma-4-E2B-it-Q4_K_M.gguf` | 50/50 | 15249 | 34795 | 12.11 | 0 |
| `gemmaQat` | `gemma-4-E2B_q4_0-it.gguf` | 50/50 | 16510 | 38392 | 12.09 | 0 |

Conclusion: el QAT oficial carga y pasa toda la suite, pero en esta corrida no fue mas rapido ni mejor que el baseline. Mantenerlo como candidato, no como default automatico.

## Limitaciones

- La suite corta es smoke test, no ranking de calidad.
- No ejecuta PSeInt ni valida semantica profunda.
- No simula el canvas real.
- WR CPU es lento y puede agotar el timeout si se amplia la suite.
- La comparacion de modelos usa la suite historica; para decidir default tambien conviene revisar 5-10 prompts manuales reales en la app.

## Proximos ajustes recomendados

- Probar `gemmaE4Qat` si se descarga el GGUF oficial.
- Probar `gemma12Qat` como modo calidad si la maquina lo sostiene.
- Agregar medicion de carga del modelo y memoria/VRAM por perfil.
- Agregar casos negativos donde no debe llamar herramientas.
