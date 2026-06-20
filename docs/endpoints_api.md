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

---

## 4. Módulo de Productos

### Crear Producto
* **Ruta:** `POST /productos/`
* **Permisos:** Solo `Administrador`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "categoria_id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
    "codigo_barras": null,
    "nombre": "Coca Cola 3L",
    "descripcion": "Gaseosa familiar descartable",
    "precio_compra": 2.50,
    "precio_venta": 3.50,
    "stock_actual": 20,
    "stock_minimo": 5
  }
  ```
  *(Nota: Si `codigo_barras` se envía nulo o vacío, el backend autogenera un código secuencial con formato `KIO-XXXXX`)*
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
      "categoria_id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
      "codigo_barras": "KIO-00001",
      "nombre": "Coca Cola 3L",
      "descripcion": "Gaseosa familiar descartable",
      "precio_compra": 2.50,
      "precio_venta": 3.50,
      "stock_actual": 20,
      "stock_minimo": 5,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:35:00Z",
      "fecha_actualizacion": "2026-06-20T13:35:00Z"
    }
  }
  ```

### Listar Productos
* **Ruta:** `GET /productos/`
* **Parámetros de Consulta (Query):**
  - `incluir_inactivos` (booleano, por defecto `false`).
* **Permisos:** Todos (`Administrador`, `Cajero`, `Repartidor`)
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
        "categoria_id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
        "codigo_barras": "KIO-00001",
        "nombre": "Coca Cola 3L",
        "descripcion": "Gaseosa familiar descartable",
        "precio_compra": 2.50,
        "precio_venta": 3.50,
        "stock_actual": 20,
        "stock_minimo": 5,
        "estado": "Activo",
        "fecha_creacion": "2026-06-20T13:35:00Z",
        "fecha_actualizacion": "2026-06-20T13:35:00Z"
      }
    ]
  }
  ```

---

## 5. Módulo de Clientes

### Crear Cliente
* **Ruta:** `POST /clientes/`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "dni_ruc": "10458796541",
    "nombre": "Distribuidora H&S",
    "telefono": "987654321",
    "direccion": "Av. Las Flores 123",
    "saldo_deudor": 0.00,
    "limite_credito": 1500.00
  }
  ```
  *(Nota: Se valida que `limite_credito` sea mayor o igual al `saldo_deudor`)*
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
      "dni_ruc": "10458796541",
      "nombre": "Distribuidora H&S",
      "telefono": "987654321",
      "direccion": "Av. Las Flores 123",
      "saldo_deudor": 0.00,
      "limite_credito": 1500.00,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:36:00Z",
      "fecha_actualizacion": "2026-06-20T13:36:00Z"
    }
  }
  ```

### Actualizar Cliente (Validación de Crédito)
* **Ruta:** `PUT /clientes/{cliente_id}`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "limite_credito": 500.00
  }
  ```
* **Respuesta (400 Bad Request en caso de error):**
  ```json
  {
    "detail": "El límite de crédito (500.0) no puede ser menor al saldo deudor actual (800.0)."
  }
  ```


