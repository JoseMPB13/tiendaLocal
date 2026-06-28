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

### Reabastecer Producto (Stock y Costo)
* **Ruta:** `POST /productos/reabastecer`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
    "cantidad": 10,
    "costo_compra": 2.80,
    "codigo_referencia": "Factura-789-Proveedor"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
      "categoria_id": "e2298e82-e02c-473d-9d7a-1ee824c9c1b8",
      "codigo_barras": "KIO-00001",
      "nombre": "Coca Cola 3L",
      "descripcion": "Gaseosa familiar descartable",
      "precio_compra": 2.80,
      "precio_venta": 3.50,
      "stock_actual": 30,
      "stock_minimo": 5,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:35:00Z",
      "fecha_actualizacion": "2026-06-22T22:38:00Z"
    }
  }
  ```
* **Respuesta (400 Bad Request — Costo de Compra Excede Precio Venta):**
  ```json
  {
    "detail": "El costo de compra no puede ser mayor al precio de venta actual. Ajuste el precio de venta primero."
  }
  ```

---

## 5. Módulo de Clientes

### Crear Cliente
* **Ruta:** `POST /clientes/`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  *(Nota: Los campos `latitud` y `longitud` son opcionales. Si se envía un `enlace_mapa` o `enlace_ubicacion` válido de Google Maps u OpenStreetMap y no se especifican coordenadas de latitud/longitud, el servidor extraerá automáticamente las coordenadas mediante expresiones regulares. `limite_credito` debe ser mayor o igual al `saldo_deudor`).*
  ```json
  {
    "dni_ruc": "10458796541",
    "nombre": "Distribuidora H&S",
    "telefono": "987654321",
    "direccion": "Av. Las Flores 123",
    "enlace_mapa": "https://www.google.com/maps/place/-16.4839,-68.1302",
    "latitud": null,
    "longitud": null,
    "saldo_deudor": 0.00,
    "limite_credito": 1500.00
  }
  ```
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
      "enlace_ubicacion": "https://www.google.com/maps/place/-16.4839,-68.1302",
      "enlace_mapa": "https://www.google.com/maps/place/-16.4839,-68.1302",
      "latitud": -16.48390000,
      "longitud": -68.13020000,
      "saldo_deudor": 0.00,
      "limite_credito": 1500.00,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:36:00Z",
      "fecha_actualizacion": "2026-06-20T13:36:00Z"
    }
  }
  ```

### Listar Clientes
* **Ruta:** `GET /clientes/`
* **Permisos:** `Administrador`, `Cajero` *(El rol `Repartidor` tiene prohibido el acceso, devolviendo HTTP 403)*
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
        "dni_ruc": "10458796541",
        "nombre": "Distribuidora H&S",
        "telefono": "987654321",
        "direccion": "Av. Las Flores 123",
        "enlace_ubicacion": "https://www.google.com/maps/place/-16.4839,-68.1302",
        "enlace_mapa": "https://www.google.com/maps/place/-16.4839,-68.1302",
        "latitud": -16.48390000,
        "longitud": -68.13020000,
        "saldo_deudor": 0.00,
        "limite_credito": 1500.00,
        "estado": "Activo",
        "fecha_creacion": "2026-06-20T13:36:00Z",
        "fecha_actualizacion": "2026-06-20T13:36:00Z"
      }
    ]
  }
  ```

### Obtener Cliente por ID
* **Ruta:** `GET /clientes/{cliente_id}`
* **Permisos:** `Administrador`, `Cajero` *(El rol `Repartidor` tiene prohibido el acceso, devolviendo HTTP 403)*
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
      "dni_ruc": "10458796541",
      "nombre": "Distribuidora H&S",
      "telefono": "987654321",
      "direccion": "Av. Las Flores 123",
      "enlace_ubicacion": "https://www.google.com/maps/place/-16.4839,-68.1302",
      "enlace_mapa": "https://www.google.com/maps/place/-16.4839,-68.1302",
      "latitud": -16.48390000,
      "longitud": -68.13020000,
      "saldo_deudor": 0.00,
      "limite_credito": 1500.00,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:36:00Z",
      "fecha_actualizacion": "2026-06-20T13:36:00Z"
    }
  }
  ```

### Actualizar Cliente (Validación de Crédito e Integración de Mapas)
* **Ruta:** `PUT /clientes/{cliente_id}`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "enlace_mapa": "https://www.google.com/maps/@-16.5000,-68.1500,17z",
    "limite_credito": 500.00
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
      "dni_ruc": "10458796541",
      "nombre": "Distribuidora H&S",
      "telefono": "987654321",
      "direccion": "Av. Las Flores 123",
      "enlace_ubicacion": "https://www.google.com/maps/@-16.5000,-68.1500,17z",
      "enlace_mapa": "https://www.google.com/maps/@-16.5000,-68.1500,17z",
      "latitud": -16.50000000,
      "longitud": -68.15000000,
      "saldo_deudor": 0.00,
      "limite_credito": 500.00,
      "estado": "Activo",
      "fecha_creacion": "2026-06-20T13:36:00Z",
      "fecha_actualizacion": "2026-06-25T18:55:00Z"
    }
  }
  ```
* **Respuesta (400 Bad Request en caso de error de crédito):**
  ```json
  {
    "detail": "El límite de crédito (500.0) no puede ser menor al saldo deudor actual (800.0)."
  }
  ```
* **Respuesta (400 Bad Request en caso de coordenadas fuera de rango):**
  ```json
  {
    "detail": "La latitud ingresada no es válida. Debe estar entre -90 y 90."
  }
### Resolver Enlace Google Maps
* **Ruta:** `GET /clientes/resolver-enlace-mapa/`
* **Permisos:** `Administrador`, `Cajero`
* **Parámetros de Consulta (Query):**
  - `url` (String, Obligatorio): Enlace de ubicación de mapas acortado (ej: `https://maps.app.goo.gl/...`).
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "latitud": -16.500000,
      "longitud": -68.150000
    }
  }
  ```

---

## 6. Módulo de Ventas

### Registrar Venta (Contado / Crédito)
* **Ruta:** `POST /ventas/`
* **Permisos:** `Administrador`, `Cajero`
* **Cuerpo de Petición (JSON):**
  *(Nota: El campo `usuario_id` es opcional en la petición. El servidor ignorará cualquier valor enviado en este campo y lo sobrescribirá con el identificador de usuario autenticado en el token JWT. Asimismo, los campos `precio_unitario` de cada producto se validan contra el precio de venta oficial del catálogo para productos con estado 'Activo'. El campo `tipo_pago` acepta los siguientes valores: 'Efectivo', 'Tarjeta', 'Credito', 'Transferencia' o 'QR').*
  ```json
  {
    "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
    "usuario_id": null,
    "codigo_factura": "F001-000001",
    "tipo_pago": "Credito",
    "para_delivery": true,
    "direccion_despacho": "Calle Los Laureles 123",
    "costo_envio": 5.00,
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
* **Respuesta (400 Bad Request — Discrepancia de Precio o Inactividad):**
  ```json
  {
    "detail": "El precio unitario enviado para 'Coca Cola 3L' (Bs. 1.00) no coincide con el oficial de inventario (Bs. 3.50)."
  }
  ```
* **Respuesta (400 Bad Request — Dirección Faltante para Delivery):**
  ```json
  {
    "detail": "La dirección de despacho es obligatoria para pedidos con delivery."
  }
  ```

### Listar Ventas (Filtros y Paginación)
* **Ruta:** `GET /ventas/`
* **Permisos:** `Administrador`, `Cajero`
* **Parámetros de Consulta (Query):**
  - `estado_venta` (string, opcional: `'Completada'`, `'Cancelada'`, `'Pendiente'`)
  - `skip` (integer, opcional, por defecto `0`)
  - `limit` (integer, opcional, por defecto `100`)
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
        "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
        "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
        "codigo_factura": "F001-000001",
        "tipo_pago": "Credito",
        "total": 7.00,
        "estado_venta": "Completada",
        "fecha_venta": "2026-06-20T13:50:00Z"
      }
    ]
  }
  ```

### Obtener Próximo Número de Factura
* **Ruta:** `GET /ventas/proximo-numero-factura`
* **Permisos:** `Administrador`, `Cajero`
* **Descripción:** Calcula y retorna el correlativo de factura que corresponderá a la siguiente venta en tiempo real para mostrarlo en el POS antes de consolidar la venta.
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": "FAC-20260624-00001"
  }
  ```

### Obtener Detalle de Venta Completa
* **Ruta:** `GET /ventas/{venta_id}`
* **Permisos:** `Administrador`, `Cajero`, `Repartidor`
* **Descripción:** Obtiene los datos de cabecera de la venta junto con el detalle completo de los artículos/productos asociados.
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
      "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
      "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
      "codigo_factura": "F001-000001",
      "tipo_pago": "Credito",
      "total": 7.00,
      "estado_venta": "Completada",
      "fecha_venta": "2026-06-20T13:50:00Z",
      "detalles": [
        {
          "id": "1ab2e34c-d56f-478a-b89c-c0f1f2e3d4b5",
          "venta_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
          "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
          "cantidad": 2,
          "precio_unitario": 3.50,
          "subtotal": 7.00
        }
      ]
    }
  }
  ```

### Cancelar Venta (Baja Lógica y Reversión)
* **Ruta:** `PUT /ventas/{venta_id}/cancelar`
* **Permisos:** `Administrador`, `Cajero`
* **Descripción:** Realiza la baja lógica de una venta (`estado_venta = 'Cancelada'`). Reaviva el stock en inventario de los productos y revierte deudas de crédito del cliente. La factura asociada también cambia a `'Anulada'`.
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
      "estado_venta": "Cancelada"
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
* **Gobernanza por Rol:**
  - `Administrador` y `Cajero`: Exentos de restricciones, pueden realizar cualquier cambio o transición (excepto sobre envíos ya finalizados en estado 'Entregado' o 'Cancelado').
  - `Repartidor`:
    - Desde estado `'Pendiente'`, solo puede transicionar a `'En Camino'` (fase de autoasignación atómica).
    - Desde estado `'En Camino'`, solo puede transicionar a `'Entregado'` o `'Cancelado'` y no puede alterar datos como la dirección, costo de envío o el repartidor asignado.
    - No puede modificar envíos asignados a otros repartidores.
* **Cuerpo de Petición (JSON) para Entregado:**
  ```json
  {
    "estado_envio": "Entregado"
  }
  ```
* **Cuerpo de Petición (JSON) para Cancelado (Obligatorio enviar `motivo_cancelacion`):**
  ```json
  {
    "estado_envio": "Cancelado",
    "motivo_cancelacion": "Dirección incorrecta, cliente no responde llamadas"
  }
  ```
* **Códigos de Error Posibles:**
  - `400 Bad Request`: Si el repartidor intenta una transición de estado inválida, intenta modificar campos restringidos, el envío ya fue cerrado, o si se transiciona a `'Cancelado'` sin proporcionar un `motivo_cancelacion` no vacío.
  - `403 Forbidden`: Si el repartidor intenta modificar un envío que le pertenece a otro.
  - `409 Conflict`: Si dos repartidores intentan autoasignarse el mismo envío pendiente simultáneamente.
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
      "motivo_cancelacion": null,
      "fecha_despacho": "2026-06-20T13:52:00Z",
      "fecha_entrega": "2026-06-20T14:05:00Z",
      "fecha_creacion": "2026-06-20T13:50:00Z",
      "fecha_actualizacion": "2026-06-20T14:05:00Z"
    }
  }
  ```

### Obtener Ruta Activa (Mis Envíos Activos)
* **Ruta:** `GET /delivery/mis-envios-activos`
* **Permisos:** Solo `Repartidor`
* **Descripción:** Devuelve los envíos asignados al repartidor autenticado que están en estado `'En Camino'`. Enriquece cada registro con la información de contacto y dirección registrada del cliente (incluyendo el enlace de geolocalización), previniendo fuga de PII ajenos.
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "2b9bc88a-d14f-4d6a-bb91-4c6bead98712",
        "venta_id": "7ac2e19b-a010-449e-8c31-c4f4f3ff5d82",
        "repartidor_id": "e44d5c9c-5f80-4df2-abcc-189f6bead678",
        "direccion_despacho": "Calle Los Laureles 456",
        "costo_envio": 5.00,
        "estado_envio": "En Camino",
        "motivo_cancelacion": null,
        "fecha_despacho": "2026-06-20T13:52:00Z",
        "fecha_entrega": null,
        "fecha_creacion": "2026-06-20T13:50:00Z",
        "fecha_actualizacion": "2026-06-20T13:52:00Z",
        "cliente": {
          "nombre_completo": "Distribuidora H&S",
          "telefono": "987654321",
          "direccion": "Av. Las Flores 123",
          "enlace_ubicacion": "https://maps.google.com/?q=-16.5001,-68.1502"
        }
      }
    ]
  }
  ```


---

## 8. Módulo de Reportes & Cierre de Caja

### Obtener Métricas de Dashboard
* **Ruta:** `GET /reportes/dashboard`
* **Parámetros de Consulta (Query):**
  - `fecha_inicio` (Fecha YYYY-MM-DD, Opcional): Fecha inicial del rango para filtrar el resumen analítico.
  - `fecha_fin` (Fecha YYYY-MM-DD, Opcional): Fecha final del rango para filtrar el resumen analítico.
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


---

## 9. Módulo de Compras (Reabastecimiento)

### Listar Compras (Historial)
* **Ruta:** `GET /compras/`
* **Parámetros de Consulta (Query):**
  - `estado_compra` (String: 'Completada', 'Cancelada', Opcional)
  - `skip` (Integer, por defecto `0`, Opcional)
  - `limit` (Integer, por defecto `100`, Opcional)
* **Permisos:** `Administrador`, `Cajero`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": "e2a14e91-e402-4c28-98e3-ea62b32b8aa0",
        "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
        "proveedor_nombre": "Distribuidora Arcor",
        "codigo_referencia": "FAC-COMPRA-981",
        "total": 540.00,
        "estado_compra": "Completada",
        "fecha_compra": "2026-06-24T18:45:00Z"
      }
    ]
  }
  ```

### Obtener Detalle de Compra Completa
* **Ruta:** `GET /compras/{compra_id}`
* **Permisos:** `Administrador`, `Cajero`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "e2a14e91-e402-4c28-98e3-ea62b32b8aa0",
      "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
      "proveedor_nombre": "Distribuidora Arcor",
      "codigo_referencia": "FAC-COMPRA-981",
      "total": 540.00,
      "estado_compra": "Completada",
      "fecha_compra": "2026-06-24T18:45:00Z",
      "detalles": [
        {
          "id": "4ac8e19b-a010-449e-8c31-c4f4f3ff5d82",
          "compra_id": "e2a14e91-e402-4c28-98e3-ea62b32b8aa0",
          "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
          "cantidad": 12,
          "costo_unitario": 45.00,
          "subtotal": 540.00,
          "producto_name": "Bon o Bon Caja 30u"
        }
      ]
    }
  }
  ```

### Registrar Reabastecimiento (Compra)
* **Ruta:** `POST /compras/`
* **Permisos:** Solo `Administrador`
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "proveedor_nombre": "Distribuidora Arcor",
    "codigo_referencia": "FAC-COMPRA-981",
    "detalles": [
      {
        "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
        "cantidad": 12,
        "costo_unitario": 45.00
      }
    ]
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "e2a14e91-e402-4c28-98e3-ea62b32b8aa0",
      "usuario_id": "a933f2bd-1fb7-4e78-becc-82f5d918b958",
      "proveedor_nombre": "Distribuidora Arcor",
      "codigo_referencia": "FAC-COMPRA-981",
      "total": 540.00,
      "estado_compra": "Completada",
      "fecha_compra": "2026-06-24T18:45:00Z"
    }
  }
  ```
* **Errores Controlados:**
  - `400 Bad Request` (SQLSTATE `P0004`): Si el costo de compra es mayor al precio de venta del catálogo.
  - `404 Not Found` (SQLSTATE `P0005`): Si alguno de los productos no existe.

### Cancelar Compra
* **Ruta:** `PUT /compras/{compra_id}/cancelar`
* **Permisos:** Solo `Administrador`
* **Respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "id": "e2a14e91-e402-4c28-98e3-ea62b32b8aa0",
      "estado_compra": "Cancelada"
    }
  }
  ```
* **Errores Controlados:**
  - `400 Bad Request` (SQLSTATE `P0007`): Si la reversión del stock resulta en inventario negativo (es decir, el stock actual es menor a la cantidad que se compró originalmente).
  - `404 Not Found` (SQLSTATE `P0005`): Si la compra no existe.




