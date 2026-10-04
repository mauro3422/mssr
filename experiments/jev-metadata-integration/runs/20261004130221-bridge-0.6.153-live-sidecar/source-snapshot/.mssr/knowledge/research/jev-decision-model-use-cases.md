# Jev, decisiones tipadas y casos de uso para MSSR

**Fecha de corte:** 30 de septiembre de 2026
**Tipo:** investigación; propuestas exploratorias, no compromisos de implementación.

## Resumen ejecutivo

Jev es una API/modelo de decisiones acotadas: recibe un estado representado como texto/estructura y preguntas con respuestas tipadas predefinidas; devuelve elecciones, puntuaciones o probabilidades sí/no. Resulta más natural para clasificación, selección, ranking ordinal y gates que para escritura abierta. No ejecuta herramientas, no busca archivos, no compacta contexto ni redacta párrafos por sí mismo. Puede guiar un flujo en el que código/herramientas realizan búsqueda y acciones, y un modelo generativo sintetiza lenguaje.

El ejemplo local de QuietDesk sí demuestra un eslabón importante: una llamada live de Jev eligió uno de tres botones, el host ejecutó la acción con referencia fresca y un observador independiente confirmó el estado resultante. Es evidencia de una integración pequeña y controlada, no un benchmark de uso general ni evidencia de que MSSR ya esté conectado a Jev.

OpenAI anunció oficialmente una Decisions API en su recap de DevDay del **29 de septiembre de 2026**: preguntas del usuario con respuestas finitas, contexto de texto o imágenes, clasificación/enrutamiento/selección de próxima acción; estaba en **limited preview** ese día. A la fecha de corte no se verificó una especificación pública con endpoint, esquema, probabilidades/calibración, límites o SLA. La similitud del patrón con Jev no demuestra que compartan arquitectura, calidad o garantías.

Las 100 ideas de abajo son hipótesis de aplicación de decisiones discretas. No están validadas ni representan una decisión de producto. Cada uso necesita una decisión formulada con opciones observables, contexto mínimo suficiente, evaluación con casos etiquetados y una ruta de abstención/fallback.

## Qué es evidencia y qué no

- **Primaria / autorreportada por TypeSafe:** publicación de lanzamiento, documentación y demos propias. Útil para conocer interfaz y límites declarados; métricas comparativas y claims del fabricante no son evaluación independiente.
- **Demostración local observada en artefacto:** un run reproducible en el sentido de que se conserva su reporte JSON y cadena de evidencia local. No implica benchmark amplio.
- **Autorreporte en Reddit:** experimentos/proyectos de usuarios; separar la descripción del autor de resultados auditados externamente.
- **Paper/preprint:** evidencia independiente potencial, aún temprana y sujeta a revisión/replicación.
- **Propuesta:** idea inferida de la forma de entrada/salida; no evidencia de que Jev ya la haga bien.

## Capacidades y límites de Jev

TypeSafe anunció Jev el **15-sep-2026** como su primer “System One Model”. La interfaz documentada consiste en estado más preguntas acotadas, con salidas `choice`, `score` y `noul` (sí/no probabilístico); devuelve valores tipados y probabilidades. TypeSafe afirma que responde en paralelo en una llamada y publica cifras de coste/latencia/calibración. La propia entrada explica que su evaluación de workflows usa salidas de Astra y Fable como referencia, que los workflows fueron diseñados por miembros de su equipo de capacidades y que el ejemplo visual simplifica el estado. Por tanto, esas comparaciones son claims y evaluaciones del proveedor, no ground truth neutral. [Lanzamiento y matices del proveedor](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

**Fortalezas plausibles y mostradas:** salida limitada a las opciones declaradas; respuesta directamente consumible por software; probabilidades para construir umbrales de revisión/fallback; fan-out de preguntas independientes; velocidad apta para decisiones interactivas si la latencia del proveedor/red lo permite. El formato evita errores de sintaxis/tipo en la respuesta, pero no evita que la elección semántica sea errónea.

**Límites relevantes:** no genera lenguaje abierto; no sustituye escritura, planificación extensa, aritmética exacta, permisos ni verificación externa. El modelo no recibe píxeles/imágenes de forma directa según el material de Jev; Doom recibe estado estructurado derivado de los objetos del juego, no cuadros de pantalla. Para trabajar con imagen, primero otro componente debe extraer OCR, atributos o una descripción estructurada. Contexto irrelevante puede degradar decisiones; conviene enviar un estado compacto. Umbrales, opciones, rúbricas y nombres importan: la formulación puede inclinar la respuesta. Una confianza alta tampoco convierte un juicio en verdad o autorización.

## Evidencia local: QuietDesk

Reporte versionado en `D:\Dev\QuietDesk\docs\benchmarks\visible-jev-lab\visible-jev-lab-2026-09-24T23-16-36-795Z.json`
`runId`: `visible-jev-lab-2026-09-24T23-16-36-795Z`
SHA-256 del reporte: `20D75E08967D5D057AA671C5FA379DB21FA773E3D16CC48A483514DCA53C0ADF`

La corrida tiene `status=pass`, `providerMode=jev`, modelo `jev-1.13.0`. QuietDesk observó una app de destino separada y ofreció tres candidatos permitidos. Jev seleccionó **“QD Lab Complete Demo”** con confianza 0,97. Esa llamada tuvo `providerLatencyMs=814`; el valor de **149 ms** es `execution.latencyMs` del executor, no latencia de Jev. El plan refiere el target concreto y un `freshnessToken`; la política permitió una acción reversible, foreground semantic. El executor informó `succeeded`. Luego el verificador hizo otra observación: `verification.confirmed=true`, etiqueta `QD Lab Result complete`, `independentObservationRef=desktop:1790291815667`, control `uia:9713d8:rid:42_51579996`. La captura posterior tiene SHA-256 `457014ab78a703adc159707047cdf056e643f6ca49a2e0cfc259abc4236d6a22`.

**Qué establece:** en esa demo acotada hubo una selección live de Jev, una acción host separada y una confirmación posterior independiente de Jev. La confianza observada pertenece a la respuesta de Jev; el executor y verifier pertenecen a QuietDesk.

**Qué no establece:** precisión de propósito general, calibración poblacional, robustez con opciones/contextos cambiantes, autonomía sostenida, seguridad para acciones irreversibles, trabajo con imágenes por Jev, desempeño de grep/resumen/redacción ni integración MSSR↔Jev. El estado visual/U​​IA lo produjo QuietDesk; el reporte no es una evaluación con múltiples clases y ground truth independiente.

## Juegos: qué demuestran y qué no

El repo comunitario [Jev Plays Doom](https://github.com/tirukovelamanoj/jev-plays-doom) registra una prueba `defend_the_center`, 20 episodios, seed 1234: random 0,75 kills de media; bot de aim codificado a mano 6,55; Jev 6,55; latencia informada 212 ms en 2.642 llamadas. Bajo una variante que describe intención sin explicitar un umbral numérico, Jev nunca atacó en 30 decisiones y la partida acabó con munición llena; su confianza bajó y el harness contempla fallback bajo un umbral. El README advierte que cubre un escenario y cuatro frases, que los resultados son estocásticos y que la variación por episodios supera varias diferencias medidas. Esto respalda una decisión repetida sobre estado derivado y opciones; a la vez muestra sensibilidad al contrato de opciones. No muestra visión directa ni superioridad sobre una política especializada.

El lanzamiento oficial de TypeSafe también presenta Doom y Wikiracing. La propia empresa aclara que Doom usa estado estructurado como datos/texto, no imágenes, y que un bot no-AI podría jugar mejor. Wikiracing muestra selección de enlaces entre opciones de alta cardinalidad, con una ruta en dos etapas para cardinalidades superiores a 255; es una demo del proveedor, no un estudio controlado independiente. [Demos y matices](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

El caso de Pokémon Red que cubrió Tom’s Hardware atribuye al proyecto del desarrollador un logro de Hall of Fame el **23-sep-2026**. Jev escogía de listas de opciones; Claude Opus 5 revisaba logs, ajustaba las opciones/contexto y ayudaba con bloqueos; el desarrollador y espectadores también aportaron. El artículo refiere 474 entradas de cambios/fallos de harness. Esto es un sistema compuesto y una historia de proyecto, no evidencia de que Jev por sí solo descubrió estrategia, vio la pantalla o mantuvo autonomía sin coaching. [Reporte de prensa](https://www.tomshardware.com/tech-industry/artificial-intelligence/developer-says-jev-decision-model-beat-pokemon-red-in-under-a-week-non-llm-engine-succeeds-where-traditional-chatbots-stalled-for-months-but-claude-opus-5-coached-the-model-through-its-dead-ends)

## Reddit y otras evaluaciones tempranas

- Un usuario de r/ClaudeCode describe `jev-kit`: reglas de código dejan pasar ~93% de llamadas de herramienta en ~33 ms; Jev evalúa el área gris, ayuda a dimensionar subagentes, detecta reportes de “terminado” sin verificación y el sistema usa `plocate`/Everything para localizar archivos. Es un **autorreporte de su propia integración**, no benchmark revisado. [Post](https://www.reddit.com/r/ClaudeCode/comments/1wol4y5/jevkit_all_the_jev_stuff_ive_wired_into_claude/)
- El autor de Entagl reporta benchmark de Jev frente a Gemini en 1.759 decisiones: 98,5% vs 99,0%, mediana 329 ms vs 1.598 ms y cerca de 25× menos coste, además de 402 decisiones de tráfico real revisadas. Reporta errores en dialectos árabes, falta de contexto sobre el dueño de una conversación y un falso positivo turco con confianza 0,95. Tiene valor como informe con método/casos de fallo, pero es **autopublicado en Reddit por un builder comercial**, muestra limitada y no evaluación académica independiente. [Post y advertencias reportadas](https://www.reddit.com/r/LLMDevs/comments/1wo000s/we_benchmarked_typesafes_new_jev_a_decisiononly/)
- Otro autor en r/AI_India compara SST-2, AG News y Banking77; reporta que en Banking77 un DistilBERT afinado con 10k ejemplos superó Jev por 12 puntos y menor latencia/coste marginal; indica intervalo de confianza aproximado ±2,5 puntos con n=500 y sesgos de dataset/preentrenamiento. Es **experimento individual autorreportado**, no conclusión universal; sugiere comparar contra un clasificador local cuando hay datos etiquetados. [Post](https://www.reddit.com/r/AI_India/comments/1wmvyqz/i_benchmarked_typesafes_jev_against_llms_bert_and/)
- La revisión preprint [Typed Decision Models: An Early Evidence Audit](https://arxiv.org/abs/2609.32160), fechada 26-sep-2026, estudia 28 papers publicados entre 19–24 sep. Su conclusión preliminar: aún no se demuestra que la salida tipada por sí sola dé una ventaja independiente de precisión frente a probabilidades sobre etiquetas comparables; las ganancias más claras de Jev en los primeros estudios son coste/latencia, mientras la precisión cae en tareas difíciles. El corpus sólo cubre nueve días desde el lanzamiento de un modelo alojado; leer como mapa temprano, no consenso ni revisión definitiva.

## OpenAI Decisions API: anuncio verificado, esquema pendiente

El recap oficial de DevDay, publicado **29-sep-2026**, anunció **Decisions API**: “real-time decision-making” al enfocar Luna en preguntas definidas por el usuario y respuestas finitas predefinidas; el desarrollador da contexto por texto o imágenes y recibe respuestas para clasificación, routing o próxima acción de agente. El estado publicado era **limited preview today**, con release amplio previsto “in the coming days”. [OpenAI DevDay 2026 Recap](https://openai.com/index/devday-2026-recap/)

La descripción se parece al patrón de Jev (estado + preguntas/alternativas + decisión consumible por software) y añade explícitamente imagen como entrada. En la revisión del 2-oct-2026, el anuncio oficial aún describía limited preview; la búsqueda en documentación pública oficial no localizó un esquema verificable de endpoint/request/response, límites, distribución/confianza, calibración, pricing, latencia o garantías. No atribuirle características técnicas de Jev ni prometer equivalencia. Revalidar cuando OpenAI publique documentación técnica.

## Composición: cómo cubrir grep, selección, compacción y párrafos

Una aplicación completa puede juntar piezas diferentes, sin adjudicar a Jev el trabajo de las otras:

1. **Búsqueda:** Jev puede escoger entre búsquedas candidatas, clasificar intención de consulta o puntuar relevancia de resultados. El host ejecuta `grep`, índice textual/vectorial u otras herramientas y recoge líneas/rutas con procedencia.
2. **Selección de evidencia:** código filtra duplicados, permisos, rutas y revisiones. Jev podría clasificar qué fragmentos parecen pertinentes o qué rama requiere lectura; la autoridad/proveniencia se comprueba por reglas del sistema.
3. **Compacción sin pérdida:** la receta oficial de Structure recovery usa Jev para juzgar pares de líneas y clasificar bloques; código une líneas que continúan una oración y renderiza el formato con las palabras originales. Es compacción estructural guiada por Jev, distinta de resumir o reescribir semánticamente.
4. **Armado de párrafos:** no hace falta un generador si el objetivo es reconstruir estructura: decisiones Jev + ensamblador determinístico pueden producir párrafos, listas y encabezados conservando el texto. Un generador o persona sí hace falta para redactar frases nuevas. Jev puede además evaluar citas/soporte y seleccionar una estructura entre alternativas.
5. **Acción y verificación:** código limita acciones permitidas; Jev puede elegir una acción candidata o señalar incertidumbre. El host aplica permisos, frescura, umbrales y confirmación humana según riesgo. Un verificador independiente comprueba el efecto observable; no se acepta la confianza de Jev como prueba.

El patrón más útil es `herramienta determinista para obtener candidatos → decisión estrecha → política/ejecución del host → verificación independiente → fallback a LLM/humano cuando corresponda`. TypeSafe publica también un ejemplo de reranking con BM25 y Jev: 30 pasajes candidatos por consulta, 40 consultas CLERC, top-1 5%→18% y top-10 38%→62%; son cifras del cookbook/proveedor que MSSR no ha replicado. Para MSSR, ya existen búsqueda/fetch, selección Jev, revisión relacional y preview reversible; esta entrega añade una proyección de metadata tipada ligada a rangos exactos. Ninguna de estas piezas activa por sí sola el loop completo ni la integración Bridge.

La observación de Mauro —grep inteligente, selección, compacción y armado de
párrafos en una sola experiencia— encaja con la cadena documentada por
TypeSafe: el modelo decide; el host recupera; código conserva/une/renderiza el
texto o un generador redacta; la verificación comprueba citas y efecto. La
estructura de párrafos puede resultar del ensamblador determinístico, no
necesariamente de prosa generada. Esa observación informa casos a probar, no es
por sí misma un benchmark independiente ni prueba que Jev aislado haga todo.

## 100 hipótesis de uso

Los siguientes casos describen **preguntas candidatas** que podrían expresarse como `choice`, `score` o `noul`. Son propuestas; excepto donde se identificó una demo o autorreporte arriba, no son usos demostrados. Las categorías visuales requieren primero un modelo/servicio que convierta imagen/audio/video a texto o rasgos estructurados cuando se use Jev.

### A. Orquestación del sistema y agentes

1. Elegir skill/ruta entre capacidades ya registradas.
2. Escoger modelo rápido, equilibrado o frontier según dificultad.
3. Recomendar tamaño/nivel de subagente para una tarea.
4. Elegir herramienta entre un conjunto autorizado.
5. Clasificar llamada como permitir, confirmar o bloquear (el host aplica la política).
6. Decidir si el subobjetivo está completo o requiere más trabajo.
7. Detectar que un informe “terminado” carece de evidencia verificadora.
8. Clasificar fallo como reintento, fallback, escalamiento o cierre.
9. Elegir qué resultado de herramienta conservar, truncar o descartar.
10. Elegir ejecución en paralelo o secuencial entre opciones predefinidas.

### B. Búsqueda, archivos y recuperación de conocimiento

11. Escoger la consulta grep más prometedora entre alternativas generadas.
12. Elegir qué rutas inspeccionar primero entre candidatos del índice.
13. Priorizar refs/documentos para cargar en contexto.
14. Reordenar candidatos de recuperación por relevancia a una pregunta.
15. Clasificar pasajes como duplicados, cercanos o distintos.
16. Elegir autoridad probable según dueño y procedencia ya provistos.
17. Señalar si una ref está potencialmente desactualizada y requiere revisar.
18. Elegir la siguiente acción de recuperación: buscar, abrir, seguir enlace o parar.
19. Clasificar si una cita respalda directamente una afirmación candidata.
20. Estimar si el conjunto de resultados basta para contestar o requiere otra búsqueda.

### C. Redacción y composición editorial (con generador externo)

21. Elegir qué evidencia incluir en un párrafo entre fragmentos recuperados.
22. Seleccionar el orden de secciones de un esquema existente.
23. Clasificar el rol de un párrafo: contexto, método, resultado o limitación.
24. Seleccionar un borrador de entre varias versiones generadas.
25. Evaluar si una frase es respaldada, no respaldada o contradictoria con refs.
26. Detectar una posible contradicción entre afirmaciones candidatas.
27. Elegir en qué afirmación debe colocarse una cita disponible.
28. Clasificar tono entre opciones autorizadas.
29. Decidir si el texto requiere edición humana antes de publicarse.
30. Detectar si una sección exigida está ausente del borrador.

### D. Desarrollo, revisión y release

31. Elegir qué tests correr según archivos cambiados y mapa de dependencias.
32. Priorizar severidad de un bug reportado.
33. Sugerir equipo/owner probable usando catálogo conocido.
34. Clasificar riesgo de una dependencia modificada.
35. Seleccionar estrategia de reparación entre alternativas escritas por el agente.
36. Clasificar severidad de comentarios de revisión.
37. Estimar riesgo de regresión para cambios descritos.
38. Elegir categoría de cambio para el changelog.
39. Señalar si el release cumple las puertas de salida indicadas.
40. Clasificar si una migración de esquema requiere compatibilidad gradual.

### E. MSSR, contexto y conocimiento del proyecto

41. Clasificar dominio observable de una solicitud.
42. Elegir fase de trabajo actual: descubrir, implementar, verificar, persistir o cerrar.
43. Seleccionar módulos de contexto relevantes entre módulos indexados.
44. Priorizar carga de contexto principal/opcional según necesidad concreta.
45. Marcar un documento de estado como revisión requerida por cambio observado.
46. Recomendar dueño canónico de una actualización entre AGENTS/PROJECT_*/skill.
47. Clasificar una propuesta de persistencia como válida, incompleta o conflictiva.
48. Detectar posible deuda de routing/skill que amerita auditoría.
49. Señalar si nuevas observaciones piden replantear la ruta.
50. Elegir un outcome/estado compacto al cerrar una traza.

### F. Juegos y simulaciones

51. Elegir una acción legal entre botones de juego a partir de estado estructurado.
52. Priorizar objetivo/enemigo según distancia, salud y recursos provistos.
53. Seleccionar dirección de movimiento entre rutas permitidas.
54. Decidir cuándo usar un consumible según inventario y situación.
55. Elegir diálogo entre opciones cerradas.
56. Seleccionar próximo nodo/camino en un mapa de juego.
57. Clasificar intención de un NPC a partir de texto/estado suministrado.
58. Recomendar siguiente tutorial según error/telemetría observados.
59. Detectar si la política repite un ciclo sin progreso.
60. Cambiar entre estrategias registradas según eventos observables.

### G. UX y señales multimodales preprocesadas

61. Elegir control objetivo de una UI tras que visión/OCR entregue controles candidatos.
62. Decidir si OCR de una captura es suficientemente confiable o pedir VLM/humano.
63. Clasificar severidad de defecto visual descrito/medido por otro componente.
64. Elegir asset candidato según descripción, tags y metadatos.
65. Clasificar siguiente acción de UI a partir de estado de pantalla estructurado.
66. Clasificar intención a partir de una transcripción de voz ya producida.
67. Enrutar el turno a reconocimiento, agente de voz o respuesta asíncrona.
68. Elegir keyframes de video para inspección según puntuaciones upstream.
69. Clasificar imagen en categorías de seguridad cuando upstream la describió.
70. Decidir si evidencia OCR y VLM discrepan y necesita revisión.

### H. Soporte y operaciones empresariales

71. Enrutar ticket al equipo de soporte correspondiente.
72. Marcar urgencia/impacto a partir de mensaje y datos adjuntos transcritos.
73. Elegir si un caso de facturación sigue el flujo estándar o excepción.
74. Clasificar severidad de incidente operacional.
75. Elegir siguiente acción en CRM entre opciones autorizadas.
76. Detectar posible ticket duplicado de un caso activo.
77. Clasificar tipo de documento entrante.
78. Elegir cola de aprobación según políticas/datos presentes.
79. Identificar riesgo de onboarding de proveedor a partir de campos estructurados.
80. Elegir artículo de conocimiento más pertinente para una consulta.

### I. Seguridad y privacidad

81. Clasificar sospecha de prompt injection en contenido recuperado.
82. Puntuar posibilidad de exposición de secreto en un diff/log.
83. Clasificar riesgo de un comando shell antes de que código policy lo procese.
84. Clasificar riesgo de una acción de navegador entre niveles predefinidos.
85. Asignar sensibilidad de datos para dirigir manejo/retención.
86. Clasificar contenido moderable entre categorías de política.
87. Elegir si una excepción de política debe escalar a una persona.
88. Clasificar indicio de acceso/login sospechoso con campos de telemetría.
89. Evaluar indicios de phishing a partir de texto y metadatos provistos.
90. Detectar si hace falta redacción de identificadores antes de compartir.

### J. Productos, recomendaciones y fiabilidad del servicio

91. Clasificar categoría de producto desde descripción/campos.
92. Clasificar intención de consulta de catálogo.
93. Elegir si una recomendación cumple restricciones declaradas.
94. Seleccionar sustituto de inventario entre candidatos compatibles.
95. Elegir si un reembolso sigue regla automática o requiere excepción.
96. Estimar banda de riesgo de abandono para ofrecer revisión/ayuda.
97. Priorizar feedback de cliente por tema/impacto.
98. Elegir cohorte de experimento según criterios predefinidos.
99. Clasificar anomalía operacional para descartar, inspeccionar o escalar.
100. Elegir proveedor fallback según salud/latencia observadas.

## Evaluación mínima antes de considerar cualquier caso

Para cada propuesta: fijar opciones y rúbricas sin solapamiento; conservar ejemplos difíciles, ambiguos y negativos; proporcionar el contexto que realmente tendría producción; medir precisión por clase, matriz de confusión y calibración por bandas; comparar con reglas/código, clasificador local etiquetado y modelo general con salida estructurada; medir p50/p95, coste, cambios de distribución e impacto de omitir hechos; fijar abstención/fallback y comprobarlo con fallos adversariales. Separar la validez semántica de la mera validez del tipo de salida. Acciones con impacto requieren política ejecutable, autorización del host y verificación independiente.

## Fuentes

1. TypeSafe AI, “Introducing System One Models & Jev”, publicado 15-sep-2026: https://typesafe.ai/blog/introducing-system-one-models-and-jev
2. OpenAI, “DevDay 2026 Recap”, 29-sep-2026, Decisions API (limited preview): https://openai.com/index/devday-2026-recap/
3. QuietDesk, reporte local de benchmark: `D:\Dev\QuietDesk\docs\benchmarks\visible-jev-lab\visible-jev-lab-2026-09-24T23-16-36-795Z.json` (runId y SHA-256 indicados arriba; evidencia privada local, no enlace público).
4. tirukovelamanoj, “Jev Plays Doom”, README con implementación, métricas y limitaciones: https://github.com/tirukovelamanoj/jev-plays-doom
5. Tom’s Hardware, Pokémon Red y coaching de Claude Opus 5, 27-sep-2026: https://www.tomshardware.com/tech-industry/artificial-intelligence/developer-says-jev-decision-model-beat-pokemon-red-in-under-a-week-non-llm-engine-succeeds-where-traditional-chatbots-stalled-for-months-but-claude-opus-5-coached-the-model-through-its-dead-ends
6. Reddit r/ClaudeCode, Jev-kit (autorreporte), 23-sep-2026: https://www.reddit.com/r/ClaudeCode/comments/1wol4y5/jevkit_all_the_jev_stuff_ive_wired_into_claude/
7. Reddit r/LLMDevs, benchmark Entagl (autorreporte), 23-sep-2026: https://www.reddit.com/r/LLMDevs/comments/1wo000s/we_benchmarked_typesafes_new_jev_a_decisiononly/
8. Reddit r/AI_India, Jev vs. clasificador afinado (autorreporte), 22-sep-2026: https://www.reddit.com/r/AI_India/comments/1wmvyqz/i_benchmarked_typesafes_jev_against_llms_bert_and/
9. Tang & Zheng, “Typed Decision Models: An Early Evidence Audit and Evaluation Checklist”, arXiv:2609.32160, 26-sep-2026 (preprint temprano): https://arxiv.org/abs/2609.32160
10. TypeSafe AI, [Primitives](https://docs.typesafe.ai/primitives), [Re-ranking cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe), [Structure recovery cookbook](https://docs.typesafe.ai/cookbooks/autoformat), and [Confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing), reviewed 2-oct-2026. Cookbook measurements are provider-published examples and are not MSSR replications.
