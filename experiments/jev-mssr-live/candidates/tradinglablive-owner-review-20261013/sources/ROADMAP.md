# Roadmap — Trading Lab Live

## Principios del proyecto

- **Modo sombra primero:** ninguna orden real durante investigación.
- **Evidencia congelada:** cada decisión debe apuntar al paquete exacto usado.
- **Scripts para números, LLM para lenguaje:** el modelo no calcula retornos ni indicadores.
- **Abstenerse es una decisión válida:** no se fuerza una operación por ronda.
- **Separación por mercado:** acciones y criptomonedas necesitan contextos distintos.
- **Sin contaminación futura:** ningún dato posterior puede entrar en una decisión histórica.
- **Medir antes de optimizar:** no migrar de lenguaje o base de datos sin un cuello de botella demostrado.

## Estado actual

### Completado — v3

- API FastAPI e interfaz local.
- SQLite para hipótesis, snapshots, rondas y paquetes de investigación.
- Monitor de operaciones activas cada minuto.
- Scanner y paquetes técnicos de cinco minutos/diarios.
- Contexto de SEC, FRED y Alpha Vantage.
- Noticias con deduplicación, diversidad de fuentes y presupuesto de consultas.
- Registro de decisiones, abstenciones y resultados.
- Tres rondas iniciales de forward testing.

### En construcción — v4

- Observaciones continuas independientes de las operaciones.
- Features intradía alineadas con horizontes de 15, 30, 60 y 240 minutos.
- Síntesis pequeñas y verificables.
- Ranking determinista de candidatos.
- Etiquetado progresivo con MFE, MAE y barreras long/short.
- Scheduler idempotente e informes diarios.
- CLI unificada.

---

## Fase 0 — Fundaciones v4

**Objetivo:** disponer de un pipeline reproducible que no altere la v3.

- [x] Crear `trading_v4/` como paquete aislado.
- [x] Crear estructura `data/v4/` bajo demanda.
- [x] Definir configuración por defecto y archivo local opcional.
- [x] Guardado atómico de JSON y manifiestos.
- [x] Implementar observación de velas y features intradía iniciales.
- [x] Implementar síntesis determinista con referencias a archivos/campos.
- [x] Implementar filtros y puntuación preliminar de candidatos.
- [x] Crear CLI `trading_agent.py`.
- [x] Añadir pruebas unitarias de cálculos y clasificación.

**Criterio de salida:** `run-cycle` produce raw, features, summaries, candidates y manifest sin modificar hipótesis existentes.

## Fase 1 — Recolección continua y etiquetado

**Objetivo:** construir un dataset útil aunque no se opere.

- [x] Servicio/scheduler de observación cada 5 minutos.
- [x] Programación diferenciada para cripto 24/7 y acciones por sesión, con daemons y locks separados.
- [x] Identificadores idempotentes por ventana temporal y símbolo.
- [x] Etiquetar automáticamente retornos futuros a 15, 30, 60 y 240 minutos.
- [x] Calcular MFE y MAE de cada observación.
- [x] Simular qué objetivo/stop se habría tocado primero.
- [x] Registrar cobertura, frescura y archivos de evidencia de cada etiqueta.
- [x] Generar informe diario JSON y Markdown.
- [ ] Política de retención y compresión de datos raw.
- [x] Pruebas contra look-ahead bias e incertidumbre intravela.

**Criterio de salida:** al menos 300 observaciones etiquetadas por activo prioritario y cero observaciones con datos futuros filtrados.

## Fase 2 — Paquete cripto especializado

**Objetivo:** reemplazar contexto bursátil poco relevante por datos propios de cripto.

- [ ] Velas de 1, 5 y 15 minutos desde una API de exchange.
- [ ] RSI, EMA 9/20/50, MACD, ATR y VWAP intradía.
- [ ] Fuerza relativa contra BTC y ETH.
- [ ] Régimen general de BTC/ETH.
- [ ] Volumen spot por exchange y divergencias de precio.
- [ ] Funding de perpetuos.
- [ ] Open interest y cambios recientes.
- [ ] Liquidaciones agregadas.
- [ ] Basis spot/perpetuo.
- [ ] Imbalance y profundidad del libro de órdenes.
- [ ] Calidad y disponibilidad por proveedor.

**Criterio de salida:** paquete `crypto_packet_v4` con esquema estable y datos frescos suficientes para estrategias de 15–60 minutos.

## Fase 3 — Paquete de acciones especializado

**Objetivo:** adaptar el análisis a horarios, liquidez y catalizadores bursátiles.

- [x] Calendario de mercado y feriados mediante calendario NYSE, incluyendo cierres anticipados.
- [x] Premarket, sesión regular y after-hours separados.
- [x] VWAP de sesión y distancia respecto del precio; volumen relativo ajustado por hora sigue pendiente.
- [x] Rango inicial de 30 minutos; gap y niveles premarket avanzados siguen pendientes.
- [ ] Beta y fuerza relativa contra sector/índice.
- [ ] Earnings, guidance, SEC y calendario macro.
- [ ] Spread y liquidez estimada.
- [x] Evitar señales y observaciones automáticas con cotizaciones congeladas fuera de sesión.

**Criterio de salida:** paquete `equity_packet_v4` y reglas de sesión verificadas.

## Fase 4 — Síntesis local y paquetes para modelos

**Objetivo:** reducir contexto sin perder auditabilidad.

- [ ] Adaptador común `LocalSummarizer`.
- [ ] Backend Ollama.
- [ ] Backend LM Studio compatible con OpenAI.
- [ ] Backend OpenCode mediante comando configurable.
- [ ] Salida JSON validada contra esquema.
- [ ] Cada afirmación debe citar archivo y ruta JSON.
- [ ] Comparación entre síntesis determinista y síntesis LLM.
- [ ] Fallback determinista cuando el modelo local falle.
- [ ] Presupuesto de tokens y tiempo máximo.

**Criterio de salida:** síntesis menor a 5 KB, verificable y sin cifras inventadas en un conjunto de pruebas.

## Fase 5 — Motor estadístico

**Objetivo:** estimar probabilidades con evidencia histórica, no solo intuición.

- [ ] Baseline de regresión logística.
- [ ] Modelos de árboles/gradient boosting.
- [ ] División temporal train/validation/test.
- [ ] Walk-forward validation.
- [ ] Calibración de probabilidades.
- [ ] Métricas por activo, horario, régimen y confianza.
- [ ] Comparar contra buy-and-hold, random y reglas simples.
- [ ] Detección de drift.
- [ ] Registro de versión de features/modelo.

**Criterio de salida:** ventaja fuera de muestra, después de costes, con intervalos de incertidumbre y tamaño de muestra suficiente.

## Fase 6 — Decisiones por evento

**Objetivo:** llamar al analista principal solamente cuando existe una oportunidad válida.

- [ ] Gate determinista de calidad y liquidez.
- [ ] `model_input.json` compacto.
- [ ] Decisiones `long`, `short`, `skip` y `conditional`.
- [ ] Entradas condicionadas con vencimiento.
- [ ] Stops/targets derivados de volatilidad y estructura.
- [ ] Reglas máximas de exposición y correlación.
- [ ] Explicación y contradicciones obligatorias.
- [ ] Postmortem automático.

**Criterio de salida:** 100+ decisiones en modo sombra, sin operaciones forzadas y con trazabilidad completa.

## Fase 7 — Paper broker realista

**Objetivo:** simular ejecución, no solo dirección.

- [ ] Capital virtual y tamaño de posición.
- [ ] Comisiones.
- [ ] Spread.
- [ ] Slippage según liquidez.
- [ ] Funding para perpetuos.
- [ ] Órdenes market, limit, stop y stop-limit.
- [ ] Rellenos parciales.
- [ ] Límites diarios de pérdida.
- [ ] Kill switch.

**Criterio de salida:** resultados netos y reproducibles durante varias semanas de forward testing.

## Fase 8 — Integración con broker/exchange

**Objetivo:** preparar una conexión real con riesgo limitado. No se habilita automáticamente.

- [ ] Elegir proveedor regulado/disponible para la jurisdicción.
- [ ] API keys sin permisos de retiro.
- [ ] Entorno sandbox/testnet.
- [ ] Servicio separado para ejecución.
- [ ] Idempotencia de órdenes.
- [ ] Confirmación y reconciliación de posiciones.
- [ ] Alertas, auditoría y recuperación ante fallos.
- [ ] Aprobación manual antes de activar capital real.

**Criterio de salida:** paper trading estable, estrategia validada y revisión explícita de seguridad/riesgo.

---

## Decisiones técnicas

### Lenguaje

Mantener Python como lenguaje principal durante las fases 0–7. Considerar Rust o Go únicamente para un servicio de ejecución/streaming si existen métricas que demuestren problemas de latencia, estabilidad o concurrencia.

### Persistencia

- SQLite durante prototipo y uso local de un solo proceso escritor.
- Migrar a PostgreSQL cuando haya ingestión concurrente, varios workers o consultas analíticas que lo justifiquen.
- Archivos JSON/Parquet para datasets versionados y auditoría.

### Modelos de lenguaje

Los LLM son componentes intercambiables. Ningún proveedor debe ser una dependencia estructural del sistema. Toda decisión debe conservar el paquete de entrada, la versión del prompt/modelo y la respuesta original.

## Métricas obligatorias

No usar solamente porcentaje de aciertos. Medir:

- Retorno neto y retorno medio por operación.
- Profit factor.
- Expectancy.
- Drawdown máximo.
- Sharpe/Sortino cuando exista suficiente muestra.
- MFE y MAE.
- Precisión por nivel de confianza.
- Calibración probabilística.
- Resultados por activo, horario y régimen.
- Costes como porcentaje del beneficio bruto.
- Tasa y valor de las abstenciones.

## Próximo hito

Dejar el scheduler v4 recolectando datos durante varias horas, completar progresivamente etiquetas de 15/30/60/240 minutos y revisar los informes diarios. Después, agregar la programación por sesión para acciones y el paquete cripto especializado antes de introducir modelos estadísticos o LLM locales.
