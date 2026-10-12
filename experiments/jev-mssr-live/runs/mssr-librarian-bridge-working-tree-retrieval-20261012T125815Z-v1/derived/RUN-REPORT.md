# Run55 — búsqueda, selección JEV y evidencia exacta en documentos reales de Bridge

## Resultado

MSSR recuperó resultados de búsqueda en las cuatro preguntas, Jev eligió un rango en 4/4, y las cuatro lecturas exactas y packs de evidencia mantuvieron fingerprints y citas verificables. La primera pregunta era compuesta: Jev eligió L10, que resuelve reglas de destino pero deja fuera los metadatos de L8 y los límites de L12. La respuesta se adjudica **parcial**. Las otras tres respuestas fueron completas según dos revisiones ciegas Luna.

El seguimiento enlazado descompuso esa pregunta en tres facetas y limitó la representación a bloques. Con el snapshot de 5.221 bytes cuya SHA-256 y revisión son `8e2478f1…e42ad48`, la búsqueda incluyó cada bloque objetivo en el top 20 (rango 3); Jev eligió los tres bloques exactos, y fetch + pack preservaron los tres textos y citas, 941 caracteres en total. Dos revisores Luna, con los fragmentos literales, calificaron la respuesta compuesta como completa.

## Cadena observada

| Etapa | Run55 principal | Seguimiento de facetas exacto |
|---|---:|---:|
| Preguntas | 4 | 3 vinculadas a una pregunta |
| Clusters de documentos | 3 | 1 |
| Búsqueda top 20 | 4/4 con candidato pertinente | 3/3 con el bloque objetivo en rango 3 |
| Selección Jev | 4/4 | 3/3 bloques exactos con pool solo de bloques |
| Fetch exacto + fingerprint | 4/4 | 3/3 |
| Pack citado exacto | 4/4 | 3 citas, 941 caracteres |
| Respuestas completas | 3/4 | 3/3 facetas cubiertas en la composición |

En el run principal, la consulta de importación seleccionó L10 (253 caracteres), solo una de las tres facetas pedidas. El follow-up seleccionó L8 (375), L10 (253) y L12 (313); la composición tiene tres citas exactas. Las consultas repetidas y vinculadas no se cuentan como muestras independientes.

## Calidad de las respuestas

- **Importador:** parcial en el primer intento. La respuesta explicitó los campos ausentes en la evidencia, así que no inventó metadatos ni límites; aun así no contestó la pregunta completa. Un revisor la llamó completa pero enumeró esos dos faltantes, y el otro la marcó parcial. Se adjudica parcial por el alcance literal de la consulta.
- **Avisos:** completa; describe detección, emisión, cola, entrega en respuesta MCP posterior y los dos límites de entrega.
- **Situation Model:** completa; después se afinó el texto para nombrar `data/project-situation.json` y `BRIDGE_MCP_PROJECT_SITUATION_PATH`, además de los límites de privacidad.
- **Autoridad de recomendaciones:** completa sobre C2d, `ready` y `deferred`. La etiqueta congelada incluía L53, una acción de contexto vencido que la consulta no pidió; se excluyó mediante erratum append-only.
- **Respuesta compuesta de facetas:** completa, sin errores ni omisiones según dos revisores Luna ciegos que recibieron la evidencia literal exacta. La composición la produjo un agente Luna; Jev seleccionó evidencia.

## Lectura metodológica

Esto da evidencia positiva y acotada de una ruta útil para el Bibliotecario: búsqueda local bilingüe explícita → selección Jev → fetch con revisión/fingerprint → pack exacto citado → composición host-side. La descomposición por facetas reparó el caso compuesto de importación en este único cluster. El primer resultado también muestra que una selección única puede ser incompleta aunque el candidato de evidencia esté disponible; la inspección de cobertura y las consultas por faceta son el mecanismo observado que permitió recuperarlo.

Choice y Noul son descriptivos y **no están calibrados**. Los valores del follow-up válido fueron Choice 1,00/0,67/1,00 y Noul 0,82/0,74/0,96; no derivan un umbral de confianza. Los labels son source-derived, no gold de propietarios. El pack copia rangos literalmente: no prueba compactación semántica. La prosa la armó Luna, no Jev, así que esta corrida no demuestra generación autónoma de párrafos por Jev ni uso de EvidenceAtoms, relaciones/contradicciones o síntesis canónica.

## Integridad y descartes

Un primer follow-up quedó invalidado: el stdout de PowerShell agregó un LF al texto enviado, produciendo 41 líneas y revisión `707fb9a…` frente al snapshot congelado de 40 líneas y SHA `8e2478f…`. Jev y fetch concordaban entre sí, pero contra el texto modificado. Conservamos esas seis llamadas crudas y las excluimos completamente. El follow-up exacto v2 leyó el archivo con Bridge, verificó SHA, bytes, líneas y revisión antes de consultar Jev; todas las selecciones y fetches quedaron ligadas a la revisión congelada.

No se cambió Bridge, runtime, umbrales, etiquetas del proveedor ni comportamiento de producción. Las tres rutas sucias preexistentes del repo MSSR quedaron fuera de este trabajo.

## Artefactos

- [Follow-up válido y sus métricas](followups/asset-import-facets-exact-v2/derived/RUN-REPORT.md)
- [Métricas principales y follow-up](derived/metrics.json)
- [Erratum de etiquetas](derived/LABEL-ERRATUM.md)
- [Erratum de procedencia del intento descartado](followups/asset-import-facets/derived/PROVENANCE-ERRATUM.md)
