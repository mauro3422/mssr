# Análisis técnico independiente del resultado exploratorio

## Métricas por partición

Recall @100 significa que la sección exacta etiquetada apareció en la lista devuelta; no significa que el resultado sea suficiente para responder.

| Idioma | Variante | Todos | Desarrollo | Holdout previamente abierto |
|---|---|---:|---:|---:|
| EN | baseline | 18/26 (69,2%) | 13/20 (65,0%) | 5/6 (83,3%) |
| EN | lexicon rewrite | 14/26 (53,8%) | 11/20 (55,0%) | 3/6 (50,0%) |
| EN | baseline + rewrite | 18/26 (69,2%) | 14/20 (70,0%) | 4/6 (66,7%) |
| ES | baseline | 4/26 (15,4%) | 4/20 (20,0%) | 0/6 |
| ES | lexicon rewrite | 9/26 (34,6%) | 9/20 (45,0%) | 0/6 |
| ES | baseline + rewrite | 7/26 (26,9%) | 7/20 (35,0%) | 0/6 |
| ES → consulta EN pareada | referencia diagnóstica | 18/26 (69,2%) | 13/20 (65,0%) | 5/6 (83,3%) |

Entre baseline, lexicon y merge, Recall @5 fue 1/26 para EN baseline y 0/26 para las otras variantes EN; para ES fue 2/26 en baseline, lexicon y merge. La consulta pareada como referencia obtuvo 2/26 para EN y 1/26 para ES. Ninguna variante encontró la sección etiquetada en el primer puesto. El diccionario cubrió en promedio 19,3% de los tokens ES y 25,7% de los tokens EN.

## Lectura

- La sustitución léxica mejora el recall ES @100 solo en desarrollo: +5 casos sobre 26 en el conjunto completo, pero **ningún caso del holdout previamente abierto**. El resultado no sostiene una mejora generalizable ni justifica habilitar el diccionario en producción.
- La misma reescritura perjudica EN: el recall baja de 18 a 14 casos y el MRR @100 de 0,0326 a 0,0161.
- La fusión por puntuación máxima recorta candidatos: retiene 7 de los 9 hits de la variante léxica ES; mezcla 100+ candidatos por consulta y vuelve a truncar a 100. No hay evidencia para desplegar esa fusión.
- La consulta inglesa pareada recupera 18/26 objetivos en ES, lo que localiza gran parte de la brecha en el idioma/forma de consulta. Es una paráfrasis humana ya disponible en el benchmark, **no** un traductor probado dentro del sistema ni un upper bound matemático.
- Este corpus evaluó Markdown y rangos estructurales que MSSR deriva de Markdown. El runner no suministró `records` de catálogo ni `searchableMetadata`; por eso no probó todavía el beneficio de átomos, skills, refs ni otros metadatos indexables del sistema completo.
- El fetch exacto, la suficiencia Noul, la selección Jev de este shortlist, citas, contradicciones, síntesis/compacción y calibración permanecen fuera de esta corrida.

## Decisión y siguiente experimento

Mantener el buscador de producción sin cambios y no convertir scores en un umbral de confianza. El siguiente ensayo útil debe comparar las consultas originales y una reformulación traducida por el host sobre el mismo inventario real que incluye documentos, refs, skills y registros de metadatos; preservar la unión de candidatos antes de que Jev seleccione; y evaluar selección, abstención, fetch y fidelidad de cita por separado. Congelar antes un corpus por proyecto/documento y etiquetas de rangos aceptables adjudicadas por el dueño de la documentación. El holdout de esta familia ya fue abierto, así que no sirve para confirmar una promoción.
