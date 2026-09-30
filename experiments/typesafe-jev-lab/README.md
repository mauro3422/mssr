# Jev + MSSR: primer experimento en español

## Resultado observado, 19 de septiembre de 2026

20 estados sintéticos, tres repeticiones intercaladas, siete preguntas por request:
contexto faltante, acción siguiente, riesgo de la operación propuesta y cuatro
skills independientes. Modelo devuelto: `jev-1.13.0`; SDK instalado: `0.6.0`.
Las etiquetas fueron propuestas por Codex antes de llamar al modelo, **no son
ground truth humano**. No se enviaron etiquetas al modelo.

Corrida corregida: `results/2026-09-19T21-09-45-405Z/`.

| Medida | Resultado |
|---|---:|
| Requests exitosas | 60/60 |
| Latencia p50 / p95, nearest-rank | 312 / 363 ms |
| Tokens entrada / salida | 83.739 / 10.410 |
| Costo estimado de esta corrida | US$ 0,003517 |
| Acuerdo de acción con etiqueta provisional | 60/60 |
| Casos con misma acción en las tres repeticiones | 20/20 |
| Contexto faltante, umbral descriptivo 0,5 | 60% |
| Relevancia: precisión / recall | 48,6% / 75% |
| Relevancia: TP / FP / TN / FN | 18 / 19 / 197 / 6 |
| Relevancia: exactitud / baseline siempre negativo | 89,6% / 90% |
| Relevancia: baseline MSSR lexical-fallback | 76,25% |

Precio de documentación oficial consultada: US$0,042 por millón de tokens de
entrada, salida gratis. **Estimación, no factura comprobada**. Primera corrida
US$0,003104; ambas suman US$0,006621. La prueba manual UI adicional usó 407/94 tokens,
769,2 ms, fuera de las estadísticas del benchmark. No extrapolar latencias a carga
concurrente: requests secuenciales, sin reintentos SDK, timeout de 20 segundos.

## Interpretación

El siguiente paso acotado es prometedor en casos explícitos y fáciles: acciones
estables y sin errores API. Esto no prueba razonamiento complejo, seguridad ni
calibración. Tres repeticiones del mismo caso no son observaciones independientes.

La señal de contexto requiere redefinición: incluso cuando recomienda `continue`
puede dar más de 0,5 a que falta contexto. Por ejemplo, benchmark-jev dio 0,62 en
la segunda repetición. Las preguntas son independientes y código debe manejar
desacuerdos, nunca convertir una probabilidad en permiso.

En relevancia, el agregado engaña por desbalance: solo 8/80 pares son positivos.
Varios falsos positivos de systematic-debugging pueden ser **etiquetas discutibles**
por la amplitud de su descripción. `review.json` mantiene los desacuerdos como
model_or_question_or_provisional_label_disagreement; no los declara errores del
modelo sin adjudicación humana. Las escalas de riesgo son subjetivas y los rangos
exactos pueden penalizar redondeos (3,99 frente a 4); no usar su acuerdo como KPI.

El baseline ejecuta `planSkillRoute` real sobre el catálogo local, pero usa
lexical-fallback en español. No es una comparación justa contra el routing normal
con intent estructurado. El manifiesto conserva candidatos/preguntas/estados y hash;
baseline.json conserva selecciones. El catálogo completo y el build instalado no
quedan congelados: repetir después de cambios puede producir otro baseline.

## Incidente: descripción multilínea de TypeSafe

La primera corrida `2026-09-19T21-06-06-796Z` conserva evidencia de que
FilesystemSkillProvider entregó `description: '>'` para typesafe-ai, aunque la skill
oficial tiene una descripción YAML folded multiline completa. Las otras tres
descripciones fueron completas. Esto es degradación de cobertura del candidato,
no evidencia de incapacidad de Jev. Su relevancia inicial no debe compararse como
benchmark limpio.

Corrección local: el harness recupera exclusivamente ese bloque del SKILL.md
oficial y rechaza descripciones vacías/cortas. Conserva `registryDescription` y
`descriptionSource`. El provider y el contrato productivo no se modificaron.
Seguimiento mínimo: reproducir y corregir el parser frontmatter de MSSR con tests
de YAML folded/literal y casos cercanos; requiere su propia revisión de contrato,
changelog y autoridades PROJECT_*. Sin cambio de skill. Promoción: evidencia
insuficiente para aprendizaje/routing automático.

## Ejecutar y revisar

Desde el repositorio:

```powershell
node experiments/typesafe-jev-lab/benchmark.mjs --dry-run
./experiments/typesafe-jev-lab/benchmark.ps1 -Repetitions 3
```

Requiere `dist/` MSSR disponible, catálogo de skills local, dependencias del lab
instaladas mediante `npm ci`, Node 20+ y la credencial de Windows existente.
Sin clave, `--dry-run` y lectura del informe funcionan; la inferencia termina con
error explícito y no influye en MSSR. En un sandbox la credencial puede no ser
visible aunque esté presente en la sesión Windows autorizada.

Cada corrida guarda manifest.json, baseline.json, records.jsonl y summary.json en
una carpeta nueva. El wrapper valida respuestas y crea review.json, luego regenera
public/index.html desde report-template.html. Se conserva progreso por request;
una interrupción puede dejar una corrida parcial sin summary, no mezclar con latest.
No se registran mensajes/cuerpos de errores del SDK para evitar reflejar secretos.

La página en http://127.0.0.1:8788 permite elegir caso/repetición, ver probabilidades,
confidence, score/legend, tokens, latencias y JSON, y hacer consultas manuales.
Las manuales se comparan durante la visita, no se persisten ni alteran estadísticas.

## Auditoría breve de credencial y límites

CredReadW/CredWriteW con credencial genérica y persistencia Windows local. Se
verificó inferencia desde un PowerShell nuevo sin imprimir la clave. El servidor
escucha solo 127.0.0.1; no devuelve la clave en health. start.ps1 y benchmark.ps1
restauran el entorno previo al terminar, incluso ante error. Las cadenas gestionadas
y el entorno del proceso no permiten garantizar borrado total de memoria.
La auditoría es de código y funcionamiento, no una certificación de seguridad.
El servidor original permanece corriendo; la mejora de limpieza aplica a próximos
arranques. No cambiar la credencial ni copiarla a archivos.

## Experimentos posteriores

- [Referencias reales y tamaño de catálogo](REFERENCE_BENCHMARK.md): 144 llamadas autorizadas, 35 referencias de cinco skills y tamaños 8/20/35; comparación con la función determinista real de selección de módulos MSSR.
- [Contexto, memorias y compactación](CONTEXT_BENCHMARK.md): 96 llamadas iniciales y 32 diagnósticas.
- [Responder después del recorte](CONTINUATION_BENCHMARK.md): 151 llamadas, doce escenarios nuevos, cinco políticas de contexto y recuperación de originales. Incluye una etiqueta ambigua sin corregir retrospectivamente.

La UI principal muestra las cuatro baterías. Para regenerar todas sus secciones,
ejecutar `report.mjs`, luego `context-report.mjs` y finalmente
`continuation-report.mjs`, y por último `reference-report.mjs`. El de continuación también genera `public/continuation.html`
como documento autónomo; el servidor existente solo sirve la página principal.

## Próximo paso mínimo de la primera batería

Revisar manualmente los 20 labels y agregar pares español/inglés equilibrados con
casos ambiguos y abstención. Congelar un holdout antes de ajustar preguntas o
umbrales. Luego comparar contexto/skills con intent estructurado y el mismo
catálogo, y medir precisión/recall por skill. Context relevance, supersesión,
reranking y consistencia R4 quedan pendientes de suites específicas; no afirmar
que esta batería los validó. No implementar todavía SemanticJudgmentProvider.

Hashes, permisos, tests, vigencia/autoridad de claims y reglas de seguridad siguen
siendo deterministas. `routingInfluence=false`; no commit ni push.

## Fuentes y verificación

Se leyó la skill oficial instalada y docs live: [SDK](https://docs.typesafe.ai/sdk/javascript),
[primitivas](https://docs.typesafe.ai/primitives), [confidence](https://docs.typesafe.ai/confidence),
[state](https://docs.typesafe.ai/concepts/state), [API](https://docs.typesafe.ai/api),
[modelos/precio](https://docs.typesafe.ai/models), [reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe).
El índice llms.txt y how-to-build no fueron accesibles mediante web; se usaron las
páginas oficiales directas y los tipos del SDK instalado. Inglés es el idioma
principal de entrenamiento según docs; esta prueba mide entradas españolas.

Verificado: esquema y distribuciones de las 60 respuestas finales, límites Noul,
ausencia de confidence en Noul, opciones válidas Choice, Score/legend, integridad
de repeticiones, lectura real de UI, cambio de caso/repetición y consulta manual.
No se corrió la suite productiva porque no se editó el core. PROJECT_CONTEXT,
PROJECT_MEMORY y PROJECT_STATE: reviewed-none; experimento local sin release.

## Modelo mental y usos

Para una explicación corta de cómo pensar Jev, la diferencia entre pesos/probabilidades y significado, integración con documentación fresca, y posibles usos en Kode/MSSR, ver [JEV_MENTAL_MODEL.md](JEV_MENTAL_MODEL.md).
