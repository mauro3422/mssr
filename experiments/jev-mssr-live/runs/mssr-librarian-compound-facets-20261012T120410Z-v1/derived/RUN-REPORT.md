# Corrida de facetas compuestas del Bibliotecario — 2026-10-12

## Pregunta

Run v1 encontró que consultas compuestas podían recuperar una cita que omitía parte de lo pedido. Aquí dividimos dos consultas en cuatro facetas, llamamos a Jev una vez por faceta y ensamblamos dos paquetes con citas exactas.

## Resultados

- Jev conectado seleccionó 4/4 facetas; el conjunto congelado tenía 38 candidatos.
- Las 4 selecciones se volvieron a buscar por su handle y coincidieron con el texto y fingerprint de la fuente congelada.
- Los dos paquetes tienen dos citas cada uno, enlazadas a los handles elegidos.
- La evidencia toca 4/4 facetas y cubre todas las líneas etiquetadas en 3/4. ROUTE-GATES eligió L10, mientras el soporte etiquetado abarca L9–L10.
- Dos revisores Luna, ciegos e independientes, calificaron completos ambos paquetes (4/4 valoraciones). Revisaron si las citas y extractos sostienen la respuesta; no adjudicaron la verdad de los procedimientos.
- En el baseline de dos consultas compuestas se tocaban 2/4 facetas. El tratamiento añadió las facetas de fixtures y cierre que habían quedado fuera de las citas únicas.
- Tratamiento: 6.421 tokens de entrada/568 de salida en cuatro llamadas. Baseline: 3.105/274 en dos llamadas (~2,07× entrada). No es una comparación a igual número de llamadas. Latencia media descriptiva: 764,725 ms frente a 719,85 ms.

## Interpretación

La señal es que facetar esas dos preguntas mejoró la cobertura y permitió redactar dos respuestas completas con citas verificables. No demuestra confiabilidad general. Scores de Jev (.41–.99 de confianza y .73–.94 de suficiencia) están sin calibrar: no son porcentajes de confianza ni justifican un umbral. ROUTE-GATES muestra que encontrar una faceta tampoco garantiza cubrir todas sus líneas.

## Límites y siguiente paso

Muestra exploratoria de un repositorio y dos documentos; etiquetas de una persona, sin gold adjudicado, holdout certificado ni controles negativos nuevos. No mide síntesis semántica general ni cambia thresholds, metadatos canónicos o política de producción.

Siguiente corrida: comparar en más casos congelados (a) una selección compuesta, (b) selección por facetas y (c) consulta de seguimiento solo si falta cobertura. Añadir negativos y revisión independiente de dueños; medir cobertura de soporte, citas incorrectas, abstención, tokens y latencia. Incluir explícitamente L9 de ROUTE-GATES.

## Archivos

Entradas congeladas y fuentes: `inputs/`; búsquedas: `raw/search-results.json`; respuestas Jev: `raw/jev-results.json`; fetches y paquetes: `raw/fetch-and-evidence-pack.json`; evaluación: `derived/case-results.json`, `derived/metrics.json`, `derived/blind-review.json`.
