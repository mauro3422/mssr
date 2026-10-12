# v36.0 - Touch Zoom & Print Optimization Engine
**Fecha:** 2026-04-22
**Módulos Afectados:** Zoom Engine, UI/Navbar, Core Engine.

## ✨ Nuevas Funcionalidades
- **Pinch-to-Zoom (Soporte Táctil Pro):** El Zoom Engine ahora soporta el gesto de "pellizco" con 2 dedos en dispositivos móviles. Utiliza un algoritmo de cálculo de distancia euclidiana (Math.hypot) y escala focálmente respecto al centro exacto entre los dos dedos.
- **Transición Táctil Fluida:** El sistema reconoce cuando se suelta un dedo y re-ancla la cámara sin que la pantalla "salte", permitiendo continuar el paneo suave con el dedo restante.
- **Smart Print Mode (Auto Light-Theme):** Ahora al presionar "Imprimir" (o Ctrl+P), el mapa intercepta la solicitud (`beforeprint`), cambia automáticamente el entorno gráfico de *Noche Profunda* al tema *Paper (Light)* re-dibujando el SVG instantáneamente con tintas fuertes y fondo blanco para ahorrar tinta y mejorar la lectura. Terminado el proceso, restaura el tema oscuro.
- **Clean Paper UI:** Mediante reglas `@media print`, al imprimir se elimina por completo el menú superior, botones de zoom, leyenda y footer, enviando a la impresora un esquema PDF limpio de 1 sola hoja vectorizada.

## 🐛 Fixes & Mejoras de Interfaz
- **UI:** El menú de temas personalizados fue refactorizado. Ahora el botón de eliminación (🗑️) y el icono de activo (✓) se agrupan del lado derecho del texto, eliminando desplazamientos o empujes extraños en el flexbox.
- **UI:** Los temas secundarios incluidos en la base (El Estado y Derechos Humanos) ahora pueden ocultarse visualmente si el usuario lo desea. El tema principal de "Ciudadanía y Gobierno" permanece inborrable como pivote maestro.
- **Bug Fix:** Se solucionó una omisión en la firma de `layout-strategy.js (snake.position)` que impedía la carga del mapa en producción en la versión v35.1 debido a la falta de pase de parámetros en el callback de dibujado.
