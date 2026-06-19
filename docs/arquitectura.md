# Arquitectura del Sistema - TiendaLocal

Este documento describe la arquitectura de software, patrones de diseño y flujo de datos para el proyecto **TiendaLocal**.

## 1. Vista General
El sistema utiliza una arquitectura desacoplada estructurada en un monorepo:
- **Backend:** Desarrollado en Python utilizando **FastAPI**. Actúa como una pasarela segura que maneja la autenticación, validación de esquemas y expone los endpoints necesarios.
- **Frontend:** Desarrollado en **React + Vite** con **Tailwind CSS**. Optimizado para una visualización responsiva tanto en dispositivos móviles (repartidores) como en pantallas de escritorio (administración y cajas).
- **Base de Datos:** **Supabase / PostgreSQL**. Se prioriza la ejecución de lógica de negocio (cálculo de stock, saldos, etc.) directamente en la base de datos mediante procedimientos almacenados (PL/pgSQL), triggers y restricciones de integridad.

## 2. Flujo de Datos
1. El cliente (Frontend) realiza solicitudes HTTP al Backend.
2. El Backend valida el token de autenticación, procesa los esquemas de entrada con Pydantic y ejecuta llamadas a Supabase.
3. Supabase ejecuta las funciones SQL, triggers y retorna los resultados al Backend.
4. El Backend formatea la respuesta y la devuelve al Frontend.
