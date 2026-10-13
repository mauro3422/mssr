# Diagnóstico live: búsqueda y sidecar del Bibliotecario

**Fecha:** 2026-10-13 UTC 11:02Z

**Clasificación:** post hoc, un único documento MSSR ya expuesto; diagnóstico de desarrollo, fuera de holdout, owner-gold y calibración.

**Fuente congelada:** commit `f624be5b6603fb2e0ee7fdffc4d85ceb9fe75a9f`; `.mssr/knowledge/research/jev-decision-model-use-cases.md`; SHA-256 `a44d90231af23eb9fc6123a7c06bfc53c9a058d7cc556c4c476a8e18ab5c3469`.
**Pregunta:** «¿Qué etapas describe la sección de composición para combinar búsqueda tipo grep, selección de evidencia, compacción sin pérdida y armado de párrafos con citas?»

## Resultado

- **Búsqueda léxica, metadatos apagados:** 20 candidatos; la sección de composición quedó en rango 1 y su bloque exacto en rango 2. Jev 1.13.0 eligió `block-20`, líneas 62–66. Choice reportado: 0,42; evidencia suficiente: 0,86. Fetch exacto y paquete de evidencia pasaron la validación de fuente/fingerprint. Uso reportado: 3.969 tokens de entrada y 247 de salida; 663,9 ms.
- **Filtro sidecar `domain=agent-orchestration`:** el pool quedó en 1 candidato: sección «100 hipótesis de uso», líneas 78–211. El índice declaró 4 entradas, proyectó 1 y omitió 3 porque sus fuentes no estaban entre las refs expresamente suministradas. El target de composición no apareció. Jev se abstuvo; Choice 0,98 y suficiencia 0,04. El fetch del candidato verificó exactamente su fuente, pero la revisión ciega lo calificó parcial y muy amplio. Uso reportado: 722 tokens de entrada y 54 de salida; 818,6 ms.
- **Revisión ciega:** el bloque seleccionado cubre directamente las cuatro facetas, aunque añade acciones/verificación. La sección filtrada solo cubre claramente búsqueda y selección; menciona composición/citas sin explicar las etapas.

## Lectura

En este caso el filtro de metadatos redujo 20 candidatos a uno, pero excluyó la evidencia suficiente. La abstención de Jev fue coherente con la insuficiencia del candidato retenido. Esto señala una limitación de granularidad/cobertura de la declaración actual del sidecar para esta pregunta; no demuestra que los metadatos fallen en general. La búsqueda sin filtro sí recuperó la respuesta, y el encadenamiento Jev → fetch exacto → evidence pack conservó procedencia y texto.

Los scores son descriptores crudos del proveedor y siguen sin calibrar; no son probabilidades de corrección ni umbrales de confianza. El caso usa una fuente expuesta y no aporta independencia estadística. No se cambió código, metadatos, política, umbrales ni runtime.

## Siguiente paso técnico

Revisar si el manifiesto canónico puede declarar la sección de composición como rango independiente y asignarle metadatos de composición/búsqueda; luego repetir un par congelado con y sin filtro y revisar la cobertura antes de llamar a Jev. Mantener separados el efecto del filtro sobre recall, la selección de Jev y la suficiencia semántica.
