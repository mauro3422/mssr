# NeoPSE - Registro de Cambios

Todos los cambios notables en este proyecto serán documentados en este archivo y en los registros detallados de versión.

## [v0.8.0] - 2026-04-26
### "LLM Robustness & Technical Debt"
- **Desduplicación de Lógica**: Eliminación de `LayoutEngine.isOverlapping` redirigiendo colisiones a `GeometricEngine.intersectRects`.
- **Tipado Estricto (No Any)**: Remoción de payloads genéricos en `EventEmitter.ts` y `AIToolbox.ts`.
- **Robustez en IA Local**:
  - Sanitización de JSON en `AIService.ts` para tolerar respuestas envueltas en markdown o texto extra.
  - Expansión del Router Semántico (CPU/GPU) con más palabras clave para tareas pesadas.
- **Auditoría del Sistema**: Creación de [neopse_system_analysis.md](file:///C:/Users/mauro/.gemini/antigravity/brain/f27dd15d-0b05-4758-9c26-1e4b387e4105/neopse_system_analysis.md) detectando falta de empaquetado de binarios en Tauri y herramientas muertas.

## [v0.7.0] - 2026-04-25
### "Stability & UX Hardening"
- **Arquitectura de Managers (POO)**: Introducción de `BlockManager` para centralizar el ciclo de vida de componentes y desacoplar el core.
- **Unificación de Configuración**: Fusión de `Constants` y `Config` en una única fuente de verdad tipada.
- **Hardening Geométrico (DRY)**: Consolidación de `GeometricEngine` eliminando utilidades duplicadas y aplicando Genéricos para preservación de tipos.
- **Excelencia UX & Hitbox (Pixel Perfect)**: 
    - Hitboxes de carpetas optimizados mediante técnica de "Ghost Container" (0 activaciones accidentales).
    - Sustitución de emojis por Iconos SVG vectoriales de alta fidelidad.
    - Sistema de deselección inteligente: clic en el fondo ahora limpia la selección actual.
    - Soporte nativo para borrado vía teclado (`Delete`/`Backspace`) con seguridad anti-typing.
    - Menú contextual con opción de borrado rápido.
- **Mecanismo de Agujero Blanco (Expulsión)**:
    - Implementación de persistencia anidada para bloques dentro de carpetas.
    - Animación "White Hole Burst" con partículas, brillo y aterrizaje elástico.
    - Restauración automática de enlaces al abrir módulos.
    - Fix crítico: los bloques ahora se rehidratan correctamente con su contenido al ser expulsados.
- **Hardening SOLID**: Refactorización de gestión de eventos en `Block.ts` mediante delegación de acciones.
- **Type Safety Total**: Resolución de todas las dependencias circulares y errores de TSC (Exit Code 0).
- **Centralización de Entrada**: Refactor de `InputSystem` para gestionar todos los atajos globales.

## [v0.6.0] - 2026-04-24
### "Mauro Mode & Deep Work"
- **Protocolo de Tiempo Consciente**: Integración de reglas de anclaje temporal en `GEMINI.md`.
- **Workflows Globales**: Implementación de comandos `/time` y `/mauro-mode-audit` para mantenimiento de sesión.
- **Skill de Hardening**: Nueva capacidad `deep-work` con auditoría automatizada (`audit.ps1`).
- **Green Build Standards**: Requisito obligatorio de `tsc --noEmit` para dar por terminada cualquier tarea.
- **Skills Index**: Centralización y registro de todas las capacidades del agente.

## [v0.5.0] - 2026-04-24
### "Quantum Flux & Modules"
- **Sistema de Módulos (Folder)**: Implementación de contenedores con estética "Pure Icon" Glassmorphism.
- **Motor de Física Gravitacional**: Animación de succión basada en coordenadas reales (succión de fideo).
- **Succión Recursiva en Cadena**: Algoritmo que detecta redes completas de bloques y los absorbe en secuencia elástica.
- **Redibujado en Tiempo Real**: Los cables siguen dinámicamente a los bloques durante las animaciones de succión.
- **Hardening de Arquitectura**: Resolución de dependencias circulares y desacoplamiento de registros.
- **Fixes**: Bloqueo de traducción automática de Chrome y limpieza de handles de resize en iconos.

## [v0.4.0] - 2026-04-24
### "Advanced Interaction"
- **Menú Contextual**: Creación dinámica de bloques en el punto de clic.
- **Sistema de Redimensionamiento (Resize)**: Tiradores dinámicos con persistencia de tamaño.
- **Mouse System Pro**: Implementación de umbral (threshold) de drag para permitir escritura fluida.
- **Limpieza de UI**: Eliminación de controles legacy en favor de una UX contextual.
- Registro centralizado de definiciones de bloques mejorado.

## [v0.2.0] - 2026-04-24
### "Modular Engine"
- Arquitectura desacoplada basada en registros.
- Motor geométrico unificado.
- Persistencia y rehidratación de workspace.
- [Ver registro detallado](./docs/changelogs/v0.2.0.md)

## [v0.1.0] - 2026-04-23
### Hardening de Motor de Arrastre
- Centralización de eventos de Drag & Drop.
- Motor de enlaces heurístico.
- Soporte para zoom y paneo infinito.
- [Ver registro detallado](./docs/changelogs/v0.1.0.md)

---
*NeoPSE: El IDE de pseudocódigo robusto.*
