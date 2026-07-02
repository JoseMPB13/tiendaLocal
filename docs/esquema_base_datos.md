# Esquema de Base de Datos — TiendaLocal

Documentación del diccionario de datos, relaciones, índices, políticas RLS y programabilidad SQL del sistema.

## 1. Despliegue desde cero

Ejecutar en el **SQL Editor de Supabase** en este orden:

| Orden | Archivo | Contenido |
|------|---------|-----------|
| 1 | `schema.sql` | Tablas core, RLS, triggers estructurales |
| 2 | `delivery_schema.sql` | Delivery, configuración del kiosco, GPS repartidores |
| 3 | `programmability.sql` | RPC, triggers de stock/facturación, dashboard, bitácora inventario |
| 4 | `scratch/setup_timezone.sql` | Zona horaria `America/La_Paz` (recomendado) |
| 5 | `scratch/seed_data.sql` | Datos de demostración (opcional) |

**Migración de datos históricos** (solo BDs ya existentes con fechas corruptas): `scratch/migracion_paso3_corregir_fechas_historicas.sql` — ejecutar una sola vez si aplica.

## 2. Reglas generales

- **Bajas lógicas:** No se usa `DELETE` en tablas de negocio. El campo `estado` pasa a `Inactivo` o `Cancelado`.
- **DB-First:** Stock, crédito, facturación, dashboard y kardex se resuelven en PL/pgSQL.
- **Zona horaria:** Almacenar con `now()` en columnas `timestamptz`; filtrar y mostrar con `America/La_Paz`.
- **Auditoría de acciones:** FastAPI registra en `bitacora_usuarios` (no hay triggers duplicados en tablas de negocio).
- **Módulo compras:** Desmantelado; el reabastecimiento se hace con `fn_ajustar_stock`.

## 3. Tablas (`schema.sql`)

| Tabla | Descripción |
|-------|-------------|
| `categorias` | Agrupación de productos |
| `productos` | Catálogo, precios, stock, `imagen_url`, código KIO- autogenerado |
| `usuarios` | Administrador, Cajero, Repartidor |
| `clientes` | Contacto, crédito, `enlace_ubicacion`, `latitud`, `longitud`, `enlace_mapa` |
| `ventas` | Cabecera; `tipo_pago` incluye **QR**; código factura **FAC-YYYYMMDD-XXXXX** |
| `detalles_ventas` | Ítems de venta |
| `historial_stock` | Kardex: `Venta`, `Ajuste`, `Cancelacion Venta` + columna `motivo` |
| `facturas` | Emitida/Anulada automáticamente al completar/cancelar venta |
| `bitacora_usuarios` | Auditoría de acciones (`operacion`, `datos_anteriores`, `datos_nuevos` JSONB) |

## 4. Tablas delivery y configuración (`delivery_schema.sql`)

| Tabla | Descripción |
|-------|-------------|
| `repartidores` | Perfil 1:1 con usuario; `latitud_actual`, `longitud_actual`, `ultima_actualizacion_gps` |
| `envios` | Por venta; estados `Por Despachar`, `Pendiente`, `En Camino`, `Entregado`, `Cancelado`; coordenadas y `motivo_cancelacion` |
| `configuracion_sistema` | Pares clave-valor: `kiosco_latitud`, `kiosco_longitud`, `kiosco_nombre`, `qr_pago_imagen`, `logo_url` |

## 5. Tabla legado (`programmability.sql`)

| Tabla | Descripción |
|-------|-------------|
| `bitacora` | Auditoría automática histórica (función `fn_auditar_cambios` sin triggers activos en tablas de negocio) |

## 6. Índices principales

- Productos: `codigo_barras`, `nombre`
- Clientes: `dni_ruc`, `nombre`, `(latitud, longitud)`
- Ventas: `codigo_factura`, `fecha_venta`, `cliente_id`, `usuario_id`
- Envíos: `estado_envio`, `repartidor_id`, coordenadas, pendientes libres
- Repartidores: `idx_repartidores_ubicacion_gps` (posición en tiempo real)
- Bitácora: `tabla_afectada`, `fecha`, `operacion`
- Configuración: `clave`

## 7. Funciones y triggers críticos (`programmability.sql`)

| Componente | Rol |
|--------------|-----|
| `fn_controlar_stock_venta` + `trg_detalles_ventas_before_insert` | Descuenta stock y registra kardex al vender |
| `fn_revertir_venta_cancelada` + `tg_revertir_venta_cancelada` | Devuelve stock y saldo deudor al cancelar |
| `generar_codigo_factura` / `fn_autogenerar_codigo_factura` | Correlativo diario **FAC-** en hora Bolivia |
| `fn_facturar_venta` + `trg_ventas_facturacion_automatica` | Crea fila en `facturas` |
| `cancelar_venta` | Anulación mismo día calendario Bolivia (`P0008`) |
| `actualizar_venta` | Edición atómica mismo día con delivery y coordenadas |
| `registrar_venta_credito` / `registrar_venta_contado` | RPC POS con envío `Por Despachar` y lat/long |
| `fn_ajustar_stock` | Ajustes manuales de inventario (`P0007` si stock negativo) |
| `obtener_metricas_dashboard` | KPIs con filtros de fecha en `America/La_Paz` |
| `obtener_metricas_categorias` | Valorización y categoría dominante |
| `obtener_movimientos_stock_agrupados` | Bitácora inventario por día/semana/mes (Bolivia) |
| `obtener_rendimiento_personal` | Métricas cajeros y repartidores |
| `obtener_proximo_codigo_factura` | Vista previa del siguiente FAC- del día |

## 8. Seguridad (RLS)

- `historial_stock`: SELECT + INSERT para `anon` y `authenticated` (triggers de stock).
- `bitacora_usuarios`: SELECT + INSERT para auditoría vía backend.
- `configuracion_sistema`: lectura pública; escritura controlada en endpoints FastAPI.
- `facturas`: RLS deshabilitado.

## 9. Códigos de error personalizados (SQLSTATE)

| Código | Significado |
|--------|-------------|
| `P0001` | Stock insuficiente |
| `P0002` | Límite de crédito excedido |
| `P0003` | Dirección de delivery obligatoria |
| `P0005` | Registro no encontrado |
| `P0007` | Stock resultante negativo en ajuste |
| `P0008` | Anulación/edición fuera del mismo día (Bolivia) |
| `P0009` | Producto inactivo |
