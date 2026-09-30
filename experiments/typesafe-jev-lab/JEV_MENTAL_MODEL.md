# Jev — modelo mental simple

> Nota de trabajo experimental. No convierte a Jev en autoridad de MSSR ni de Kode.

## 1. La idea principal

Jev no "aprende las palabras" dentro de nuestro router en cada request. El modelo ya llega entrenado con una representación interna del lenguaje. Nosotros le damos un estado y una pregunta acotada; Jev devuelve una distribución de probabilidad sobre respuestas permitidas.

Ejemplo:

```text
state: "se modificaron archivos pero todavía no se corrieron tests"
question: "¿qué hacer ahora?"
options: inspect_context | run_tests | ask_user | stop

run_tests       0.83
ask_user        0.09
inspect_context 0.07
stop            0.01
```

El router puede tratar esas probabilidades como pesos para decidir qué candidato merece atención, pero el significado semántico lo aporta el modelo, no una tabla de pesos que estemos entrenando nosotros en ese momento.

## 2. Tres formas de preguntar

- `Noul`: ¿se cumple esta condición? Devuelve P(sí). Útil cuando varias etiquetas pueden ser verdaderas a la vez.
- `Choice`: ¿cuál de estas alternativas compite mejor? Útil cuando debe elegirse una sola opción.
- `Score`: ¿en qué grado está sobre una escala ordenada? Útil para riesgo, importancia, urgencia o intensidad.

Regla mental: Noul = pertenece/no pertenece; Choice = cuál; Score = cuánto.
## 3. "¿A qué área corresponde?"

Sí: si definimos áreas conocidas, Jev puede repartir probabilidad entre ellas.

```text
UI            0.08
editor        0.21
AI runtime    0.61
persistence   0.06
networking    0.04
```

Eso sirve para routing, etiquetas, filtros, priorización o para elegir qué subsistema inspeccionar primero. Si varias áreas pueden aplicar simultáneamente, conviene usar varios Noul en vez de forzar un único Choice.

## 4. Documentación siempre actualizada

Jev no busca documentación ni se actualiza solo. La arquitectura correcta separa responsabilidades:

```text
fuente/docs/web
    ↓
watcher / sync / freshness
    ↓
metadatos deterministas: versión, fecha, procedencia, hash
    ↓
recuperación de candidatos: exacto / lexical / vector
    ↓
Jev: relevancia, relación, importancia, discrepancia posible
    ↓
context builder
    ↓
LLM o workflow que necesita razonar
```

Así Jev puede ayudar a decidir qué documentación fresca importa para la tarea actual sin convertirse en la fuente de verdad. La vigencia, autoridad, versión y procedencia deben seguir siendo deterministas.

## 5. Aplicaciones posibles en Kode

- Etiquetar actividad del agente: búsqueda, lectura, edición, test, git, red, configuración.
- Puntuar importancia de eventos para timeline/notice layer.
- Agrupar diagnósticos que parecen compartir causa.
- Priorizar hunks/archivos para revisión de diffs.
- Elegir comandos de Kode desde lenguaje natural.
- Seleccionar acciones útiles para una selección de código.
- Evaluar si una acción sigue alineada con la intención del usuario.
- Rerankear resultados de búsqueda, símbolos, docs o memorias.
- Decidir si un evento merece checkpoint o contexto futuro.
- Seleccionar modelo/worker cuando la política determinista deja varias opciones válidas.
## 6. Aplicaciones posibles en MSSR/contexto

- Relevancia de skill o módulo de contexto.
- Needs-more-context antes de continuar.
- Reranking de candidatos recuperados.
- Relación semántica entre claims o memorias.
- Importancia de una posible contradicción.
- Evidence sufficiency antes de escalar a un LLM.
- Keep/drop sugerido para compactación, siempre con restricciones protegidas y originales recuperables.

La política recomendada sigue siendo:

```text
hechos/reglas exactas → código determinista
juicios semánticos acotados → Jev
razonamiento complejo/generación → LLM
```

## 7. Lo que NO significa una probabilidad

`0.93` no significa automáticamente "93% de verdad" ni permiso para ejecutar. En `Choice` y `Score`, confidence describe concentración de la distribución; en `Noul`, el valor es P(sí). La utilidad real y los thresholds se calibran con datos del dominio.

Por eso Jev debe producir evidencia/judgments reutilizables y el software decide la política final.

## 8. Relación con el trabajo MSSR actual

MSSR ya tiene mecanismos deterministas para freshness, provenance, candidate retrieval y semantic consistency. Jev encaja mejor como una capa opcional/shadow de juicio semántico sobre candidatos ya acotados. No debe transformar similitud o probabilidad en canonical truth.

El experimento local ya mostró que seleccionar contexto puede funcionar en casos pequeños, pero también que una selección semántica puede omitir restricciones importantes. Por eso los elementos `protected`, las fuentes originales y la recuperación/fallback siguen siendo necesarios.

## 9. Resumen en una frase

Jev es una pequeña función de "sentido común programable": recibe estado + pregunta + respuestas permitidas, y devuelve pesos probabilísticos que el código puede combinar con reglas exactas.
