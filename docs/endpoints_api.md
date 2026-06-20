# Endpoints de la API - TiendaLocal

Este documento define el catálogo de endpoints expuestos por el Backend (FastAPI), incluyendo contratos de entrada/salida, códigos de respuesta HTTP y políticas de validación.

## 1. Estándares de la API
- **Formato:** JSON (UTF-8).
- **Envoltura Global de Éxito:** `{"ok": true, "data": ...}`
- **Cabeceras de Control:**
  - `X-User-Rol`: Cabecera temporal requerida para emular la verificación de roles (`Administrador`, `Cajero`, `Repartidor`).
- **Códigos de Estado HTTP:**
  - `200 OK`: Operación exitosa con retorno de datos.
  - `201 Created`: Recurso creado exitosamente.
  - `400 Bad Request`: Error de validación o parámetros incorrectos.
  - `401 Unauthorized`: Autenticación faltante o inválida.
  - `403 Forbidden`: Permisos insuficientes (roles no autorizados).
  - `404 Not Found`: Recurso no encontrado.
  - `500 Internal Server Error`: Error inesperado en el servidor.

---

## 2. Módulo de Usuarios

### Crear Usuario
* **Ruta:** `POST /usuarios/`
* **Permisos:** Solo `Administrador`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "email": "cajero1@tienda.local",
    "password": "contrasenaSegura123",
    "nombre_completo": "Juan Pérez",
    "rol": "Cajero"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "email": "cajero1@tienda.local",
      "nombre_completo": "Juan Pérez",
      "rol": "Cajero",
      "id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:30:00Z",
      "fecha_actualizacion": "2026-06-20T13:30:00Z"
    }
  }
  ```

### Listar Usuarios
* **Ruta:** `GET /usuarios/`
* **Permisos:** `Administrador`, `Cajero`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "email": "cajero1@tienda.local",
        "nombre_completo": "Juan Pérez",
        "rol": "Cajero",
        "id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
        "estado": "Activo",
        "fecha_creacion": "2026-06-20T13:30:00Z",
        "fecha_actualizacion": "2026-06-20T13:30:00Z"
      }
    ]
  }
  ```

---

## 3. Módulo de Categorías

### Crear Categoría
* **Ruta:** `POST /categorias/`
* **Permisos:** Solo `Administrador`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "nombre": "Gaseosas",
    "descripcion": "Bebidas carbonatadas embotelladas"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "nombre": "Gaseosas",
      "descripcion": "Bebidas carbonatadas embotelladas",
      "id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:30:00Z",
      "fecha_actualizacion": "2026-06-20T13:30:00Z"
    }
  }
  ```

### Listar Categorías
* **Ruta:** `GET /categorias/`
* **Parámetros de Consulta (Query):**
  - `incluir_inactivas` (booleano, por defecto `false`).
* **Permisos:** Todos (`Administrador`, `Cajero`, `Repartidor`)
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "nombre": "Gaseosas",
        "descripcion": "Bebidas carbonatadas embotelladas",
        "id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
        "estado": "Activo",
        "fecha_creacion": "2026-06-20T13:30:00Z",
        "fecha_actualizacion": "2026-06-20T13:30:00Z"
      }
    ]
  }
  ```

### Eliminar Categoría (Baja Lógica)
* **Ruta:** `DELETE /categorias/{categoria_id}`
* **Permisos:** Solo `Administrador`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "nombre": "Gaseosas",
      "descripcion": "Bebidas carbonatadas embotelladas",
      "id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
      "estado": "Inactivo",
      "fecha_creacion": "2026-06-20T13:30:00Z",
      "fecha_actualizacion": "2026-06-20T13:32:00Z"
    }
  }
  ```

