# Run50 — canary sintético de contradicción

## Resultado

Jev 1.13.0 clasificó como contradictorios dos claims sintéticos que comparten servicio, policy, ruta, recurso y periodo exactos. El juicio cubrió los dos atoms y citó ambos bloques. La relación quedó como candidate, pero el evaluador la dejó en review por la contradicción y la falta de verificación independiente; no concedió permiso de escritura ni propuso un merge.

- Resultado esperado congelado antes de llamar: contradicts.
- Resultado Jev: contradicts, confianza cruda 1,00; no se devolvió distribución de probabilidades.
- Revisión portable: review; motivos contradictory-relations e independent-verification-unavailable.
- Cobertura: 2/2 atoms citados; fetches exactos en la misma revisión de fuente.
- Uso: 1 llamada, 1 par, 1.459 tokens de entrada / 71 de salida, 746,35 ms reportados por Jev.
- Hash de la fuente previo a la llamada: 8554396bb8f25c8be30c8a7c5935efaf99047e6d385198a20b3f4ec1fde5db78. La etiqueta quedó separada y no fue enviada.

## Alcance

Este canary solo prueba que el plumbing reconoce una contradicción controlada con comparabilidad completa y conserva el gate review. La fuente fue escrita para esta prueba y no describe una política real de MSSR ni ningún servicio real. Un caso sintético no estima la calidad de detección en documentos de usuario, no es owner-gold, holdout ni calibración.

El manifest, la fuente, la etiqueta y los hashes PRECALL se mantienen sin cambios. La solicitud y respuesta estructurada se guardan en este directorio bajo derived; no se capturaron los bytes crudos del transporte proveedor.
