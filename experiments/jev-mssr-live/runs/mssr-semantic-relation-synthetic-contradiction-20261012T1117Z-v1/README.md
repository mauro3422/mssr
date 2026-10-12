# Run50 — canary sintético de contradicción

Esta corrida comprueba si la ruta tipada puede reconocer una contradicción con
scope y periodo explícitos. La fuente es sintética y no describe MSSR, Bridge ni
ningún sistema real. La etiqueta de referencia permanece en `inputs/labels.json`
y no se incluye en la solicitud a Jev.

El directorio y sus hashes previos se congelan antes de la llamada. Después de
ejecutarla, conservar intactos esos inputs; guardar respuesta, métricas y
validación en `derived/`. El resultado será solo un canary funcional, no una
medida de precisión, fiabilidad, calibración ni evidencia de producción.
