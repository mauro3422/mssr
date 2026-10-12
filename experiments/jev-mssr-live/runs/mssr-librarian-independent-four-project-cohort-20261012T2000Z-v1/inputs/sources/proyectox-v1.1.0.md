# v1.1.0 - Estandarización de arquitectura y widgets

**Fecha de Lanzamiento:** 21 de Abril de 2026

## Resumen

Esta iteración convirtió la base visual y funcional en un sistema más modular y escalable. El objetivo fue que sumar módulos, widgets y secciones nuevas sea más simple, más predecible y con menos duplicación.

## Cambios Principales

- **CSS dividido por capas**: el estilo global dejó de vivir en archivos monolíticos y pasó a organizarse en tokens, base, componentes y páginas.
- **Plantillas compartidas**: se separó el sistema de layout y cards en helpers reutilizables para evitar HTML repetido.
- **Sistema de páginas más limpio**: `home`, `modules`, `lesson` y `glossary` quedaron apoyadas en plantillas comunes.
- **Flujo principal modularizado**: el arranque de la app y las interacciones globales quedaron divididos en módulos chicos.
- **Lecciones estandarizadas**: se agregó un registro central de secciones y una plantilla para crear nuevas secciones con un patrón uniforme.
- **Widgets estandarizados**: se agregó plantilla para widgets y se dividieron los bloques más pesados en submódulos internos.
- **Tablas refactorizadas**: el laboratorio, las tablas interactivas y las tablas mágicas pasaron a tener capas separadas de render, estado e interacciones.
- **Módulos estandarizados**: el catálogo de módulos y el template base quedaron listos para copiar y extender con menos fricción.
- **Higiene de texto**: se corrigieron cadenas rotas y textos con encoding incorrecto para dejar la base más mantenible.

## Impacto

- Menos acoplamiento entre UI, estado e interacciones.
- Menos archivos monolíticos.
- Más fácil crear un módulo nuevo, un widget nuevo o una sección nueva sin tocar demasiado el resto del sistema.
- Base más apta para seguir creciendo sin perder orden.
