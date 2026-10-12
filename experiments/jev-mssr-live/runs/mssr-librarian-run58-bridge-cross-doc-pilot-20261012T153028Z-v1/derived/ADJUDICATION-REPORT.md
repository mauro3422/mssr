# Run58 — adjudicación del piloto cross-document

Fecha de ejecución: 2026-10-12. Run: `mssr-librarian-run58-bridge-cross-doc-pilot-20261012T153028Z-v1`.

## Alcance y procedencia

El paquete congeló nueve documentos Markdown distintos de un solo proyecto Bridge, nueve preguntas, etiquetas derivadas de las fuentes y sus hashes. Dos revisiones ciegas de los casos y las fuentes precedieron las llamadas; las etiquetas no son gold del dueño. Jev 1.13.0 se llamó en serie por el adaptador local Bridge 0.6.175 / MSSR 0.2.127. Las nueve solicitudes terminaron sin error. El paquete registra 59.085 tokens de entrada y 4.550 de salida. No se devolvieron IDs de request del proveedor, y el manifiesto aclara que esta corrida no prueba la activación en el catálogo del servidor MCP separado.

La cadena observada fue búsqueda del Bibliotecario → selección de Jev → fetch exacto → evidence pack. El manifiesto, las entradas congeladas, los registros del proveedor y la finalización no se modifican con este informe derivado.

## Resultados

| Medida | Resultado | Interpretación |
|---|---:|---|
| Solicitudes Jev completadas | 9/9 | Sin fallas de proveedor en este paquete |
| Disposición positiva | 8/8 seleccionadas | Las ocho etiquetas positivas recibieron selección |
| Control negativo fechado | 1/1 abstención | Un control; evidencia muy limitada |
| Decisiones de answerability | 9/9 | Exactitud de disposición frente a estas etiquetas source-derived, no tasa general |
| Rango objetivo presente en búsqueda, métrica estricta | 3/8 positivos | La recuperación del objetivo sigue siendo el cuello de botella |
| Selección final en rango etiquetado | 2/8 positivos | Métrica literal; fuera de rango no significa automáticamente respuesta incorrecta |
| Fetch/fingerprint exacto | 8/8 seleccionados | Confirma integridad y procedencia del texto elegido, no que responda todo |
| Evidence packs validados | 8/8 seleccionados | Ensamble trazable del rango, no síntesis semántica |

## Revisión semántica ciega

Un revisor juzgó suficientes los ocho extractos positivos. El segundo coincidió en seis y marcó dos parciales; ambos desacuerdos quedan abiertos y no se convierten en aciertos por mayoría:

- **D — modern-chatgpt-live-tunnel-gate:** Jev eligió la línea 41, que pide una llamada moderna segura y continuación MSSR con el mismo trace. La consulta pregunta por el gate de túnel; falta la prueba explícita de que una conversación actual y una refrescada puedan listar y llamar herramientas, documentada en la línea 42. Parcial.
- **H — core-recovery-safeguards:** Jev eligió el flujo de emergencia de las líneas 20–30. Sí contiene expectedSha256, readback de hashes, salvaguardas de fallback y una instrucción de detenerse ante estado inseguro. No explicita un preflight contractValid antes del reemplazo, así que la cobertura de los requisitos de seguridad queda parcial.

Los rangos también son una fuente de ruido del scorer. Por ejemplo, el caso E obtuvo líneas 38–44 frente a un gold 36–44: el fragmento responde la pregunta, pero el corte literal lo marca fuera. Las métricas estrictas deben acompañarse de revisión semántica y de etiquetas mínimas que distingan span suficiente de contexto vecino.

## Conclusión y límites

La corrida demuestra que esta versión puede ejecutar el flujo y preservar texto exacto con fingerprint y cita en los casos seleccionados. Todavía no demuestra recuperación confiable: el objetivo apareció en búsqueda solo 3/8 bajo la etiqueta estricta, y hubo dos selecciones parciales en la revisión conservadora. El control negativo es una sola pregunta fechada. Choice/evidence-sufficiency son scores del proveedor sin calibrar; nueve casos del mismo proyecto no son un holdout estadístico.

Run58 no midió la detección de contradicciones, composición final de párrafos, compactación semántica, ni calibración. Tampoco es una prueba de producción: usó el adaptador local Bridge 0.6.175 / MSSR 0.2.127, mientras que el estado de proyecto registra producción Bridge 0.6.173 / MSSR 0.2.127.

### Próximo gate

Construir un conjunto prospectivo con etiquetas adjudicadas por el dueño, agrupado por proyecto y módulo de origen. Congelar por separado rangos exactos y spans semánticamente suficientes; incluir consultas en español e inglés, positivos, negativos, facetas compuestas y casos temporales. Medir recuperación, selección, abstención, fetch, cobertura de citas y composición como etapas independientes. No ajustar umbrales con Run58 ni llamar calibrado al score; no mezclar los casos de un mismo origen como muestras independientes.
