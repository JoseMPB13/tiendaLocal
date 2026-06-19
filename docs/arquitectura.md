# Arquitectura del Sistema - TiendaLocal

Este documento describe la arquitectura de software, patrones de diseño y flujo de datos para el proyecto **TiendaLocal**.

## 1. Vista General
El sistema utiliza una arquitectura desacoplada estructurada en un monorepo:
- **Backend:** Desarrollado en Python utilizando **FastAPI**. Actúa como una pasarela segura que maneja la autenticación, validación de esquemas y expone los endpoints necesarios.
- **Frontend:** Desarrollado en **React + Vite** con **Tailwind CSS**. Optimizado para una visualización responsiva tanto en dispositivos móviles (repartidores) como en pantallas de escritorio (administración y cajas).
- **Base de Datos:** **Supabase / PostgreSQL**. Se prioriza la ejecución de lógica de negocio (cálculo de stock, saldos, etc.) directamente en la base de datos mediante procedimientos almacenados (PL/pgSQL), triggers y restricciones de integridad.

## 2. Estructura del Backend (FastAPI - Modular)
El backend se encuentra estructurado en el directorio `/backend/app` bajo los siguientes submódulos:
- `/database`: Configuración del cliente y conexión centralizada a Supabase.
- `/routers`: Controladores y enrutadores HTTP de la API (por ejemplo, `prueba.py`).
- `/schemas`: Modelos de validación de datos de entrada/salida implementados mediante **Pydantic v2**.
- `/services`: Capa intermedia que coordina la lógica de negocio y realiza las transacciones/operaciones contra Supabase.
- `main.py`: Archivo principal encargado de inicializar FastAPI, configurar CORS y registrar los enrutadores.

## 3. Lógica Programada en Base de Datos (DB Programmability)
Para garantizar la integridad transaccional, rendimiento de concurrencia y rollbacks automáticos, se ha delegado la lógica pesada a la base de datos:
- **Triggers de Stock (`BEFORE INSERT`):** Validan la disponibilidad del inventario antes de guardar un detalle de venta, evitando ventas sin existencias a nivel físico.
- **Procedimientos Almacenados (PL/pgSQL):** Orquestan operaciones complejas como `registrar_venta_credito`, el cual valida límites de crédito de clientes fiados de forma atómica y bloquea registros necesarios para prevenir sobregiros.
- **Bitácora Automatizada:** Un trigger global asignado a tablas maestras (`productos`, `ventas`, `clientes`) audita automáticamente cualquier operación de inserción, actualización o eliminación en la tabla `bitacora`.

## 4. Flujo de Datos
1. El cliente (Frontend) realiza solicitudes HTTP al Backend.
2. El Backend valida el token de autenticación, procesa los esquemas de entrada con Pydantic y ejecuta llamadas a Supabase.
3. Supabase ejecuta las funciones SQL, triggers y retorna los resultados al Backend.
4. El Backend formatea la respuesta y la devuelve al Frontend.

