# Trading Lab Live

Laboratorio local de investigación de mercado y **paper trading**. Registra hipótesis, congela la evidencia disponible al decidir, sigue precios reales y mide resultados sin ejecutar operaciones en un broker.

> Estado: experimental. No opera dinero real ni garantiza rentabilidad.

## Objetivo

Construir un sistema verificable que separe claramente:

1. **Datos:** precios, velas, volumen, noticias y contexto.
2. **Cálculos:** indicadores reproducibles mediante Python.
3. **Síntesis:** resúmenes compactos con referencias a los archivos originales.
4. **Decisión:** `long`, `short` o `skip`, siempre registrada.
5. **Evaluación:** objetivo, invalidación, horizonte, costes y postmortem.

La v3 actual permite rondas manuales asistidas por IA. La nueva arquitectura v4 incorpora observación continua, datasets etiquetados y decisiones por evento. El plan completo está en [ROADMAP.md](ROADMAP.md).

## Inicio rápido en Windows

Requisitos: Python 3.10 o superior y conexión a internet.

```bat
iniciar_trading_lab.bat
```

La interfaz se abre en:

```text
http://127.0.0.1:8765
```

## Componentes actuales

| Componente | Función |
|---|---|
| `app.py` | API FastAPI e interfaz web |
| `monitor.py` | Seguimiento de hipótesis activas cada minuto |
| `research.py` | Paquetes de investigación v3 |
| `external_data.py` | Alpha Vantage, SEC y FRED |
| `scanner.py` | Escaneo inicial de candidatos |
| `ai_bridge_tool.py` | Registro de decisiones y abstenciones |
| `market_intel_cli.py` | CLI de inteligencia de mercado v3 |
| `trading_v4/` | Nueva base de observación y análisis continuo |
| `trading_agent.py` | CLI unificada de la v4 |

## Inteligencia de mercado v3

```bat
market_intel.bat status
market_intel.bat news AAPL
market_intel.bat packet AAPL
market_intel.bat prepare-round AMD GOOGL NFLX MSFT IWM TSLA
```

`prepare-round` congela los paquetes en `latest_round_context.json`. Las claves privadas se guardan exclusivamente en `.env.local`, que no debe compartirse ni incluirse en control de versiones.

## Trading Agent v4

La v4 permite observar criptomonedas y acciones, generar features, producir síntesis verificables, ordenar candidatos, etiquetar resultados futuros y ejecutar cadencias automáticas mediante schedulers locales separados.

### Crear estructura y comprobar configuración

```powershell
.\.venv\Scripts\python.exe trading_agent.py bootstrap
.\.venv\Scripts\python.exe trading_agent.py status
```

### Capturar una observación

```powershell
.\.venv\Scripts\python.exe trading_agent.py observe BTC-USD ETH-USD SOL-USD
```

### Ejecutar un ciclo completo

```powershell
.\.venv\Scripts\python.exe trading_agent.py run-cycle BTC-USD ETH-USD SOL-USD DOGE-USD
```

El ciclo realiza:

```text
captura raw → cálculo de features → síntesis verificable → ranking de candidatos
```

### Etiquetar observaciones maduras

```powershell
.\.venv\Scripts\python.exe trading_agent.py label
.\.venv\Scripts\python.exe trading_agent.py label --date 20260714
```

El etiquetador agrega progresivamente los horizontes de 15, 30, 60 y 240 minutos. Usa velas futuras de un minuto, calcula retorno, MFE, MAE y pruebas target/stop, y conserva las velas utilizadas como evidencia.

### Generar el informe diario

```powershell
.\.venv\Scripts\python.exe trading_agent.py report --date 2026-07-14
```

Produce `daily_report.json` para análisis automático y `daily_report.md` para lectura humana.

### Probar o iniciar la programación automática

```powershell
# Una sola pasada de las tareas vencidas
.\.venv\Scripts\python.exe trading_agent.py tick

# Ejecutar todo ahora, útil para una prueba integral
.\.venv\Scripts\python.exe trading_agent.py tick --force

# Servicio continuo en primer plano
.\.venv\Scripts\python.exe trading_agent.py daemon

# Alternativa con doble clic en Windows
iniciar_trading_v4_daemon.bat

# Detener el daemon iniciado en Windows
detener_trading_v4_daemon.bat
```

Cadencia predeterminada para cripto:

```text
cada 5 min   → observación
cada 15 min  → síntesis y ranking
cada 5 min   → completar etiquetas maduras
cada día     → informe del día UTC anterior
```

El scheduler guarda estado e impide procesos duplicados mediante un lock. Los IDs se alinean a ventanas de cinco minutos para que un reinicio no cree ciclos duplicados.

### Perfil automático de acciones

El perfil de acciones usa el calendario oficial de NYSE mediante `pandas-market-calendars`, incluyendo feriados y cierres anticipados. Tiene almacenamiento, estado y lock independientes de cripto.

```powershell
# Estado y próxima sesión
.\\.venv\\Scripts\\python.exe trading_agent.py --config config\\trading_v4.equities.json status

# Observación o ciclo manual; fuera de sesión devuelve skipped sin guardar precios congelados
.\\.venv\\Scripts\\python.exe trading_agent.py --config config\\trading_v4.equities.json observe
.\\.venv\\Scripts\\python.exe trading_agent.py --config config\\trading_v4.equities.json run-cycle

# Daemon separado
iniciar_trading_v4_equities_daemon.bat

# Detener únicamente el daemon de acciones
detener_trading_v4_equities_daemon.bat
```

Watchlist inicial: `AMD`, `GOOGL`, `NFLX`, `MSFT`, `IWM` y `TSLA`.

```text
premarket     → observación y etiquetado; sin candidatos automáticos
sesión regular → observación, análisis y candidatos hasta 65 min antes del cierre
after-hours   → observación y etiquetado; sin candidatos automáticos
mercado cerrado, feriado o fin de semana → espera segura
```

Cada feature de acciones guarda sesión, retorno desde apertura, VWAP de sesión, rango inicial de 30 minutos y minutos restantes. Las etiquetas de 15/30/60 minutos nunca atraviesan un cierre: un horizonte incompatible queda marcado como `unavailable_session_boundary`.

Los datos de acciones se almacenan en `data/v4/equities/`; los de cripto existentes permanecen en `data/v4/`.

Los resultados de cripto se almacenan bajo `data/v4/`:

```text
data/v4/
├── raw/          # evidencia de mercado sin resumir
├── features/     # indicadores calculados por scripts
├── summaries/    # síntesis con referencias a raw/features
├── candidates/    # ranking y filtros deterministas
├── labels/        # resultados futuros por observación
├── label_sources/ # velas futuras usadas para verificar etiquetas
├── reports/       # informes diarios JSON y Markdown
├── state/         # estado y lock del scheduler
├── model_inputs/  # paquetes compactos para LLM, próxima etapa
└── manifests/     # índice de cada ciclo
```

## Configuración v4

Copiar y ajustar el archivo de ejemplo solo cuando sea necesario:

```powershell
Copy-Item config\trading_v4.example.json config\trading_v4.local.json
```

El archivo local está excluido de Git. Sin él se utilizan valores predeterminados seguros.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Decisión tecnológica

**Python sigue siendo el lenguaje correcto para esta etapa** porque concentra ingestión de datos, análisis con pandas, automatización, prototipado estadístico, APIs y conexión con modelos locales.

No conviene reescribir todo. La evolución prevista es híbrida:

- **Python:** investigación, features, entrenamiento, orquestación y API.
- **SQLite ahora / PostgreSQL después:** persistencia y consultas.
- **Rust o Go más adelante:** solo para conectores de exchange, streaming de alta frecuencia o ejecución crítica si las mediciones demuestran que Python es insuficiente.
- **TypeScript:** opcional para una interfaz web más grande; no es necesario para el motor analítico.

Para estrategias de 5 a 60 minutos, la latencia de Python no es actualmente el cuello de botella. La calidad de datos, el diseño del experimento y la validación estadística importan mucho más.

## Límites y seguridad

- `yfinance` es una fuente no oficial y puede sufrir retrasos o interrupciones.
- Alpha Vantage tiene cuotas y requiere una clave válida.
- Las noticias y las síntesis no reemplazan datos de mercado verificables.
- Todavía no se modelan completamente spread, comisiones, slippage, funding ni liquidez.
- No conectar una cuenta real hasta completar backtesting, forward testing y límites de riesgo.
