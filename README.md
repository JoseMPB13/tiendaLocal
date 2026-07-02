<div align="center">

# TiendaLocal

### Sistema integral de ventas, inventario y delivery para kioscos

**Punto de venta · Kardex · Crédito · Facturación · Reparto GPS · Reportes PDF**

Operación nativa en zona horaria **Bolivia (`America/La_Paz`)**

<br>

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.138-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

[Inicio rápido](#inicio-rápido) · [Módulos](#módulos-del-sistema) · [Roles](#roles-y-accesos) · [API](#api-rest) · [Base de datos](#base-de-datos) · [Documentación](#documentación)

</div>

<br>

## ¿Qué es TiendaLocal?

**TiendaLocal** (marca comercial: *Tienda Margarita*) es una plataforma **full-stack** pensada para tiendas de barrio, minimarkets y kioscos que necesitan vender en mostrador, controlar stock, fiar a clientes y repartir a domicilio desde un solo lugar.

| Pilar | Descripción |
|:------|:------------|
| **DB-First** | Stock, crédito, facturas y kardex se resuelven en PostgreSQL con triggers y RPC |
| **Tres roles** | Administrador, Cajero y Repartidor con interfaces adaptadas a cada uno |
| **100 % responsivo** | Escritorio para caja y administración; móvil optimizado para repartidores |
| **Auditoría completa** | Bitácora de inventario y registro de acciones de usuarios con diffs JSON |
| **Bolivia-ready** | Fechas, correlativos de factura y restricciones legales en hora de La Paz |

---

## Módulos del sistema

Cada bloque funcional incluye interfaz gráfica, endpoints REST y lógica persistida en base de datos.

### Ventas y punto de venta (`PuntoVenta.jsx`)

- Catálogo visual con búsqueda, debounce y filtros por nombre o categoría.
- **Lector de código de barras** compatible con pistolas USB (detección instantánea sin debounce).
- Carrito con cálculo en **centavos enteros** para evitar errores de redondeo float.
- Métodos de pago: Efectivo, Tarjeta, Transferencia, **QR** y **Crédito**.
- Validación de stock y límite de crédito en cliente **y** servidor.
- Correlativo de factura en tiempo real (`GET /ventas/proximo-numero-factura`).
- Códigos automáticos **`FAC-YYYYMMDD-XXXXX`** (día calendario boliviano).
- **Delivery opcional** en el modal de cobro con mapa Leaflet y geocodificación inversa.
- Panel de estadísticas: total, unidades, cliente, alertas de stock crítico.
- Historial de las últimas facturas de la sesión con vista de ticket.
- Pestaña **Historial de ventas** con filtros, paginación y vista tabla/tarjetas.
- **Edición de ventas** el mismo día: recarga al carrito, ajuste dinámico de stock.
- **Anulación** con reversión atómica de inventario y saldo deudor.
- Comprobante térmico **80 mm** con `window.print` y CSS `@media print`.

### Inventario y productos (`GestionProductos.jsx`)

- CRUD completo con modales, paginación y bajas lógicas (`estado = Inactivo`).
- Códigos comerciales o autogenerados **`KIO-XXXXX`** vía trigger SQL.
- Carga de **imagen de producto** (`POST /productos/upload-imagen`).
- **Ajuste manual de stock** → RPC `fn_ajustar_stock` + registro en kardex.
- Mini-dashboard: stock bajo, valor de inventario, totales y variedad de categorías.
- Tabla premium en escritorio; **tarjetas responsivas** en móvil.
- Filtros modulares por nombre, código de barras y categoría.

### Categorías (`GestionCategorias.jsx`)

- CRUD con protección: no se inactiva una categoría con productos activos.
- Métricas consolidadas de valorización por familia de productos.

### Clientes y crédito (`GestionClientes.jsx`)

- Registro con DNI/RUC, teléfono, dirección y crédito (`limite_credito`, `saldo_deudor`).
- **Mapa interactivo Leaflet** con marcador arrastrable (React 19 + `useRef`).
- Extractor universal de coordenadas desde enlaces de Google Maps u otros dominios.
- Geocodificación inversa con **Nominatim** al soltar el marcador o pegar enlace.
- Bloqueo de baja lógica si el cliente tiene deuda activa.

### Delivery y envíos

| Vista | Función |
|:------|:--------|
| `GestionEnvios.jsx` | Panel admin/cajero: asignar repartidor, mapa de seguimiento, estados |
| `DeliveryReparto.jsx` | App móvil repartidor: acordeones por estado, swipe para confirmar |
| `DeliveryHistorial.jsx` | Historial de entregas del repartidor |

**Estados de envío:** `Por Despachar` → `Pendiente` → `En Camino` → `Entregado` / `Cancelado`

- GPS del repartidor en tiempo real (`PUT /delivery/mi-ubicacion`).
- Mapa de seguimiento con rutas **OSRM** (`MapaSeguimiento.jsx`).
- Apertura de navegación nativa (`geo:`) con fallback a Google Maps.
- Confirmación táctil segura con **`DeslizadorInteractivo`** (arrastre al 92 %).
- Costo de envío, coordenadas de destino y motivo de cancelación.

### Dashboard ejecutivo (`DashboardAdmin.jsx`)

- KPIs con selector de rango de fechas en **hora Bolivia**.
- Gráficos de ventas, categorías y tendencias (**Recharts**).
- Ranking de **rendimiento del personal** (cajeros y repartidores).
- Panel de **reportes PDF** descargables desde el backend (streaming).
- Alertas de productos con stock bajo o crítico.

### Reportes PDF (`reportes.py` + ReportLab)

| Endpoint | Contenido |
|:---------|:----------|
| `GET /reportes/pdf/ventas` | Ventas por rango de fechas |
| `GET /reportes/pdf/productos` | Catálogo e inventario |
| `GET /reportes/pdf/categorias` | Métricas por categoría |
| `GET /reportes/pdf/clientes` | Cartera y créditos |
| `GET /reportes/pdf/envios` | Logística y entregas |
| `GET /reportes/cierre-pdf` | **Cierre de caja diario** |

### Bitácora y auditoría (`BitacoraSistema.jsx`)

- **Kardex de inventario:** movimientos agrupados por día, semana o mes (RPC Bolivia).
- **Auditoría de usuarios:** acciones CRUD con `datos_anteriores` / `datos_nuevos` JSON expandibles.
- Fechas preformateadas en hora boliviana desde el backend.
- Filtros por tabla, operación, acción y rango de fechas.

### Usuarios (`GestionUsuarios.jsx`)

- Solo **Administrador**. Alta de cajeros, repartidores y otros admins.
- Contraseñas con hash **bcrypt**; validación mínima 6 caracteres en cliente.
- Métricas de rendimiento vía `GET /usuarios/rendimiento`.

### Configuración (`Configuracion.jsx`)

- Nombre del kiosco y coordenadas base del mapa.
- Subida de **logotipo PNG** (visible en login y sidebar).
- Imagen de **código QR de pago**.
- Endpoint público `GET /delivery/configuracion/publica/logo_url` (sin JWT).

### Autenticación (`Login.jsx`)

- Login JWT con expiración de 12 horas.
- Logo de tienda precargado al iniciar la aplicación.
- Redirección automática según rol tras autenticación.
- Logout forzado si el token expira (`RutaProtegida.jsx`).

---

## Roles y accesos

| Módulo | Admin | Cajero | Repartidor |
|:-------|:-----:|:------:|:----------:|
| Dashboard y reportes PDF | ✓ | ✓ | — |
| Punto de venta | ✓ | ✓ | — |
| Productos y categorías | ✓ | ✓ | — |
| Clientes | ✓ | ✓ | — |
| Gestión de envíos | ✓ | ✓ | — |
| Usuarios | ✓ | — | — |
| Bitácora del sistema | ✓ | — | — |
| Configuración (logo, QR) | ✓ | — | — |
| Reparto móvil | — | — | ✓ |
| Historial de entregas | — | — | ✓ |

La autorización se aplica en **dos capas**: rutas protegidas en React y `verificar_roles` en FastAPI.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND          React 19 · Vite · Tailwind · Zustand     │
│  ─────────          Leaflet · Recharts · Axios              │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS + JWT Bearer
┌──────────────────────────▼──────────────────────────────────┐
│  BACKEND           FastAPI · Pydantic · bcrypt · ReportLab  │
│  ────────           Routers → Services → Supabase Client     │
└──────────────────────────┬──────────────────────────────────┘
                           │  PostgREST + RPC
┌──────────────────────────▼──────────────────────────────────┐
│  BASE DE DATOS     PostgreSQL (Supabase)                    │
│  ─────────────      schema.sql · delivery_schema.sql         │
│                     programmability.sql (triggers + RPC)     │
└─────────────────────────────────────────────────────────────┘
```

**Flujo de una venta**

1. Cajero confirma pago en el POS.
2. FastAPI valida JWT, sanitiza UUIDs y llama a `registrar_venta_contado` o `registrar_venta_credito`.
3. PostgreSQL valida stock, crédito y asigna código `FAC-` en transacción atómica.
4. Trigger `fn_controlar_stock_venta` descuenta inventario y escribe en `historial_stock`.
5. Si hay delivery → envío `Por Despachar` con coordenadas.
6. FastAPI registra la acción en `bitacora_usuarios`.

---

## Stack tecnológico

**Frontend**

React 19 · Vite 8 · Tailwind CSS 4 · Zustand · React Router 7 · Axios · Leaflet · OSRM · Recharts · Lucide React · react-hot-toast · html2canvas / jsPDF

**Backend**

Python 3 · FastAPI · Pydantic v2 · Supabase Python client · bcrypt · PyJWT · ReportLab · python-multipart

**Infraestructura**

PostgreSQL (Supabase) · PL/pgSQL · Row Level Security · Render (Web Service + Static Site) · GitHub

---

## Estructura del repositorio

```
tienda/
├── schema.sql                 # DDL: tablas core, índices, RLS
├── delivery_schema.sql        # Delivery, GPS, configuración
├── programmability.sql        # RPC, triggers, dashboard SQL
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI + CORS + /health
│   │   ├── routers/           # auth, ventas, productos, delivery…
│   │   ├── schemas/           # Modelos Pydantic
│   │   ├── services/          # Orquestación y bitácora
│   │   └── utils/             # Zona horaria Bolivia
│   ├── uploads/               # Logo, QR, imágenes de productos
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── views/             # 14 pantallas principales
│       ├── components/        # Mapas, layouts, modales
│       ├── services/          # Clientes HTTP por módulo
│       └── store/             # authStore, cartStore
├── docs/                      # Manuales técnicos
└── scratch/                   # Seed, limpieza, tests manuales
```

---

## Base de datos

### Scripts maestros (despliegue desde cero)

Ejecutar en el **SQL Editor de Supabase**, en orden:

| # | Archivo | Qué crea |
|:-:|:--------|:---------|
| 1 | `schema.sql` | Categorías, productos, usuarios, clientes, ventas, kardex, facturas, bitácora |
| 2 | `delivery_schema.sql` | Repartidores, envíos, `configuracion_sistema` |
| 3 | `programmability.sql` | Triggers de stock, RPC de ventas, dashboard, cancelación |
| 4 | `scratch/setup_timezone.sql` | Zona `America/La_Paz` |
| 5 | `scratch/seed_data.sql` | Datos de demostración *(opcional)* |

### Reset rápido de datos

```
scratch/limpiar_base_datos.sql  →  scratch/seed_data.sql
```

`limpiar_base_datos.sql` vacía tablas operativas, reinicia secuencias KIO- y restaura config del kiosco.

### Entidades principales

- **Catálogo:** `categorias`, `productos` (con `imagen_url`)
- **Personas:** `usuarios`, `clientes`, `repartidores` (GPS)
- **Ventas:** `ventas`, `detalles_ventas`, `facturas`
- **Inventario:** `historial_stock` (kardex)
- **Logística:** `envios`
- **Auditoría:** `bitacora_usuarios`, `bitacora`
- **Config:** `configuracion_sistema` (logo, QR, coords kiosco)

### Lógica SQL destacada

| Componente | Función |
|:-----------|:--------|
| `fn_controlar_stock_venta` | Descuenta stock al vender |
| `fn_revertir_venta_cancelada` | Devuelve stock y deuda al anular |
| `generar_codigo_factura` | Correlativo FAC- diario Bolivia |
| `registrar_venta_credito/contado` | RPC transaccional del POS |
| `cancelar_venta` / `actualizar_venta` | Mismo día calendario (P0008) |
| `fn_ajustar_stock` | Ajustes manuales de inventario |
| `obtener_metricas_dashboard` | KPIs con filtros de fecha Bolivia |

Detalle completo → [`docs/esquema_base_datos.md`](docs/esquema_base_datos.md)

---

## API REST

Base URL local: `http://localhost:8000`

| Prefijo | Responsabilidad |
|:--------|:----------------|
| `/auth` | Login y emisión de JWT |
| `/usuarios` | CRUD, rendimiento del personal |
| `/categorias` | CRUD, métricas, baja lógica |
| `/productos` | CRUD, ajuste stock, upload imagen |
| `/clientes` | CRUD, mapas, resolver enlace GPS |
| `/ventas` | POS, historial, edición, cancelación |
| `/delivery` | Envíos, repartidores, GPS, config, logo |
| `/reportes` | Dashboard, kardex, PDFs, cierre caja |
| `/bitacora` | Inventario y auditoría de usuarios |
| `/compras` | Deshabilitado (HTTP 410) |

Formato de respuesta estándar: `{ "ok": true, "data": ... }`

Catálogo completo con payloads → [`docs/endpoints_api.md`](docs/endpoints_api.md)

---

## Pantallas del frontend

| Ruta | Pantalla | Quién |
|:-----|:---------|:------|
| `/login` | Inicio de sesión | Todos |
| `/escritorio` | Dashboard y reportes | Admin, Cajero |
| `/punto-venta` | POS + historial ventas | Admin, Cajero |
| `/productos` | Inventario | Admin, Cajero |
| `/categorias` | Familias de productos | Admin, Cajero |
| `/clientes` | Cartera y mapas | Admin, Cajero |
| `/envios` | Logística y seguimiento | Admin, Cajero |
| `/usuarios` | Gestión de operadores | Admin |
| `/bitacora` | Kardex y auditoría | Admin |
| `/configuracion` | Logo, QR, kiosco | Admin |
| `/delivery` | Reparto en ruta | Repartidor |
| `/delivery/historial` | Entregas pasadas | Repartidor |

Detalle de componentes → [`docs/arquitectura_frontend.md`](docs/arquitectura_frontend.md)

---

## Inicio rápido

### Requisitos

Python 3.11+ · Node.js 20+ · Cuenta Supabase · Git

### 1. Clonar e instalar

```bash
git clone https://github.com/JoseMPB13/tiendaLocal.git
cd tiendaLocal

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Frontend (otra terminal)
cd frontend
npm install
```

### 2. Variables de entorno

**`backend/.env`**

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_supabase
ORIGENES_PERMITIDOS=http://localhost:5173
DEBUG=true
JWT_SECRET=clave-secreta-desarrollo
```

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
```

### 3. Base de datos

Aplicar scripts maestros en Supabase (ver [Base de datos](#base-de-datos)), luego opcionalmente:

```text
scratch/limpiar_base_datos.sql  →  scratch/seed_data.sql
```

### 4. Ejecutar

```bash
# Terminal 1 — API
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI
cd frontend
npm run dev
```

| Servicio | URL |
|:---------|:----|
| Aplicación | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

### Credenciales de demostración

Contraseña para todos: **`123456`**

| Rol | Correo |
|:----|:-------|
| Administrador | `admin@tiendalocal.com` |
| Cajero | `cajero@tiendalocal.com` |
| Repartidor | `repartidor@tiendalocal.com` |

El seed incluye **5 categorías**, **30 productos**, **10 clientes** con GPS y **1 repartidor** activo.

---

## Seguridad

- JWT firmado HS256 · expiración 12 h · bcrypt para contraseñas.
- `usuario_id` de ventas tomado del token, nunca del body del cliente.
- Precios validados contra catálogo oficial en servidor.
- CORS configurable con `ORIGENES_PERMITIDOS`.
- RLS en `historial_stock`, `bitacora_usuarios` y `configuracion_sistema`.
- Archivos `.env` excluidos de Git.

---

## Zona horaria Bolivia

| Capa | Archivo / mecanismo |
|:-----|:--------------------|
| Almacenamiento | Columnas `timestamptz` con `now()` (UTC) |
| SQL | `AT TIME ZONE 'America/La_Paz'` en RPC y facturación |
| Backend | `backend/app/utils/zona_horaria.py` |
| Frontend | `frontend/src/utils/fechaBolivia.js` |

Afecta a: dashboard, correlativo FAC-, edición/anulación mismo día, bitácora y reportes.

---

## Validación antes de desplegar

```bash
cd backend  && python -m compileall app -q
cd frontend && npm run build
```

Tests manuales en `scratch/`: `test_bitacora.py`, `test_kardex.py`, `test_sale.py`

---

## Despliegue en producción

Guía completa para **Render** → [`docs/guia_despliegue.md`](docs/guia_despliegue.md)

**Backend (Web Service)**

| Variable | Descripción |
|:---------|:------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_KEY` | Clave API |
| `ORIGENES_PERMITIDOS` | URL del frontend (CORS) |
| `JWT_SECRET` | Obligatorio en producción |
| `DEBUG` | `false` en producción |

**Frontend (Static Site)**

| Variable | Descripción |
|:---------|:------------|
| `VITE_API_URL` | URL pública del backend |

---

## Documentación

| Archivo | Contenido |
|:--------|:----------|
| [`docs/esquema_base_datos.md`](docs/esquema_base_datos.md) | Tablas, índices, RPC, RLS, SQLSTATE |
| [`docs/endpoints_api.md`](docs/endpoints_api.md) | Contratos REST completos |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Backend y flujo de datos |
| [`docs/arquitectura_frontend.md`](docs/arquitectura_frontend.md) | POS, mapas, reportes, React 19 |
| [`docs/guia_despliegue.md`](docs/guia_despliegue.md) | Render paso a paso |
| [`scratch/README.md`](scratch/README.md) | Seeds y scripts auxiliares |
| [`.antigravityRules.md`](.antigravityRules.md) | Reglas del equipo |

---

## Convenciones de desarrollo

- Documentación y comentarios en **español**.
- Lógica de negocio crítica en **PL/pgSQL** (DB-First).
- **Bajas lógicas** — sin `DELETE` en tablas de negocio.
- Cambios SQL: incremental en `scratch/` + consolidación en maestros.
- Commits: Conventional Commits en español (`feat(ventas): …`).
- UI: solo Tailwind; tablas → tarjetas en móvil.
- Mapas: Leaflet imperativo con `useRef` (React 19).

---

<div align="center">

**TiendaLocal** — Punto de venta, inventario y delivery en un solo sistema

Repositorio: [github.com/JoseMPB13/tiendaLocal](https://github.com/JoseMPB13/tiendaLocal)

</div>
