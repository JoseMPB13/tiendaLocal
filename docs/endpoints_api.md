# Endpoints de la API - TiendaLocal

Este documento define el catálogo de endpoints expuestos por el Backend (FastAPI), incluyendo contratos de entrada/salida, códigos de respuesta HTTP y políticas de validación.

## 1. Estándares de la API
- **Formato:** JSON (UTF-8).
- **Envoltura Global de Éxito:** `{"ok": true, "data": ...}`
- **Cabeceras de Control:**
  - `Authorization`: Cabecera obligatoria de autenticación real para endpoints protegidos en el formato `Bearer <TOKEN_JWT_FIRMADO>`.
- **Códigos de Estado HTTP:**
  - `200 OK`: Operación exitosa con retorno de datos.
  - `201 Created`: Recurso creado exitosamente.
  - `400 Bad Request`: Error de validación o parámetros incorrectos.
  - `401 Unauthorized`: Autenticación faltante o inválida (firma JWT incorrecta, token expirado).
  - `403 Forbidden`: Permisos insuficientes (roles no autorizados).
  - `404 Not Found`: Recurso no encontrado.
  - `500 Internal Server Error`: Error inesperado en el servidor.

---

## 1.5 Módulo de Autenticación (JWT)

### Iniciar Sesión (Login)
* **Ruta:** `POST /auth/login`
* **Permisos:** Público
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "email": "cajero1@tienda.local",
    "password": "contrasenaSegura123"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "usuario": {
        "id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
        "email": "cajero1@tienda.local",
        "nombre_completo": "Juan Pérez",
        "rol": "Cajero"
      },
      "rol": "Cajero"
    }
  }
  ```


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

---

## 6. Módulo de Ventas

### Registrar Venta (Contado / Crédito)
* **Ruta:** `POST /ventas/`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
    "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
    "codigo_factura": "F001-000001",
    "tipo_pago": "Credito",
    "detalles": [
      {
        "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
        "cantidad": 2,
        "precio_unitario": 3.50
      }
    ]
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
      "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
      "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
      "codigo_factura": "F001-000001",
      "total": 7.00,
      "tipo_pago": "Credito",
      "estado_venta": "Completada",
      "fecha_venta": "2026-06-20T13:50:00Z"
    }
  }
  ```

---

## 7. Módulo de Delivery & Reparto

### Registrar Repartidor
* **Ruta:** `POST /delivery/repartidores`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "usuario_id": "fa808796-78e2-4752-9b2f-34d3d2c88f28",
    "vehiculo": "Motocicleta Honda Cargo",
    "placa": "M-78965"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "e44d5c9c-5f80-4df2-abcc-189f6bead678",
      "usuario_id": "fa808796-78e2-4752-9b2f-34d3d2c88f28",
      "vehiculo": "Motocicleta Honda Cargo",
      "placa": "M-78965",
      "estado_repartidor": "Disponible",
      "fecha_creacion": "2026-06-20T13:50:00Z",
      "fecha_actualizacion": "2026-06-20T13:50:00Z"
    }
  }
  ```

### Registrar Envío (Delivery)
* **Ruta:** `POST /delivery/envios`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "venta_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
    "repartidor_id": "e44d5c9c-5f80-4df2-abcc-189f6bead678",
    "direccion_despacho": "Calle Los Laureles 456",
    "costo_envio": 5.00
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "2b9bc88a-d14f-4d6a-bb91-4c6bead98712",
      "venta_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
      "repartidor_id": "e44d5c9c-5f80-4df2-abcc-189f6bead678",
      "direccion_despacho": "Calle Los Laureles 456",
      "costo_envio": 5.00,
      "estado_envio": "Pendiente",
      "fecha_despacho": null,
      "fecha_entrega": null,
      "fecha_creacion": "2026-06-20T13:50:00Z",
      "fecha_actualizacion": "2026-06-20T13:50:00Z"
    }
  }
  ```

### Actualizar Envío (Flujo Logístico)
* **Ruta:** `PUT /delivery/envios/{envio_id}`
* **Permisos:** `Administrador`, `Cajero`, `Repartidor`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "estado_envio": "Entregado"
  }
  ```
  *(Nota: Si el estado actual del envío en la BD es 'Entregado', cualquier intento posterior de modificación lanzará un error HTTP 400)*
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "2b9bc88a-d14f-4d6a-bb91-4c6bead98712",
      "venta_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
      "repartidor_id": "e44d5c9c-5f80-4df2-abcc-189f6bead678",
      "direccion_despacho": "Calle Los Laureles 456",
      "costo_envio": 5.00,
      "estado_envio": "Entregado",
      "fecha_despacho": "2026-06-20T13:52:00Z",
      "fecha_entrega": "2026-06-20T14:05:00Z",
      "fecha_creacion": "2026-06-20T13:50:00Z",
      "fecha_actualizacion": "2026-06-20T14:05:00Z"
    }
  }
  ```

---

## 8. Módulo de Reportes & Cierre de Caja

### Obtener Métricas de Dashboard
* **Ruta:** `GET /reportes/dashboard`
* **Permisos:** Solo `Administrador`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "total_ventas": 125430.50,
      "cantidad_transacciones": 1540,
      "deudas_activas_calle": 8450.00,
      "efectividad_delivery_porcentaje": 94.20
    }
  }
  ```

### Consultar Kárdex de Inventario
* **Ruta:** `GET /reportes/kardex`
* **Parámetros de Consulta (Query):**
  - `producto_id` (UUID, Opcional)
  - `fecha_inicio` (Fecha YYYY-MM-DD, Opcional)
  - `fecha_fin` (Fecha YYYY-MM-DD, Opcional)
  - `tipo_movimiento` (String: Venta, Compra, Ajuste, Opcional)
* **Permisos:** Solo `Administrador`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "4ac8e19b-a010-449e-8c31-c4f4f3ff5d82",
        "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
        "nombre_producto": "Coca Cola 3L",
        "cantidad_cambio": -2,
        "tipo_movimiento": "Venta",
        "referencia_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
        "fecha_movimiento": "2026-06-20T13:50:00Z"
      }
    ]
  }
  ```

### Descargar Cierre de Caja Diario (PDF)
* **Ruta:** `GET /reportes/cierre-pdf`
* **Parámetros de Consulta (Query):**
  - `fecha` (Fecha YYYY-MM-DD, Obligatorio)
* **Permisos:** Solo `Administrador`
* **Respuesta (200 OK):**
  - Retorna un flujo binario directo de tipo `application/pdf` con la cabecera `Content-Disposition: attachment; filename=cierre_caja_YYYY-MM-DD.pdf` para descarga automática.




