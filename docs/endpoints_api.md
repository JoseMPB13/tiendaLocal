# Endpoints de la API - TiendaLocal

Este documento define el catálogo de endpoints expuestos por el Backend (FastAPI), incluyendo contratos de entrada/salida, códigos de respuesta HTTP y políticas de validación.

## 1. Estándares de la API
- **Formato:** JSON (UTF-8).
- **Autenticación:** Tokens Bearer (JWT) validados por el Backend.
- **Códigos de Estado HTTP:**
  - `200 OK`: Operación exitosa con retorno de datos.
  - `210 Created`: Recurso creado exitosamente.
  - `400 Bad Request`: Error de validación o parámetros incorrectos.
  - `401 Unauthorized`: Token faltante o inválido.
  - `403 Forbidden`: Permisos insuficientes.
  - `404 Not Found`: Recurso no encontrado.
  - `500 Internal Server Error`: Error inesperado en el servidor.
