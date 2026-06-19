# Esquema de Base de Datos - TiendaLocal

Este documento describe el diccionario de datos, la estructura de las tablas, relaciones, índices, triggers y funciones SQL del sistema.

## 1. Reglas Generales de la Base de Datos
- **Bajas Lógicas:** Queda terminantemente prohibido el borrado físico (`DELETE`) en las tablas principales. Se utiliza un campo `estado` (ej. 'Activo', 'Inactivo', 'Cancelado').
- **Cómputos e Integridad:** Los cálculos críticos como el stock disponible y los saldos deudores se ejecutan en la propia base de datos mediante triggers y procedimientos almacenados en **PL/pgSQL**.

# Esquema de Base de Datos - TiendaLocal

Este documento describe el diccionario de datos, la estructura de las tablas, relaciones, índices, triggers y funciones SQL del sistema.

## 1. Reglas Generales de la Base de Datos
- **Bajas Lógicas:** Queda terminantemente prohibido el borrado físico (`DELETE`) en las tablas principales. Se utiliza un campo `estado` (ej. 'Activo', 'Inactivo', 'Cancelado').
- **Cómputos e Integridad:** Los cálculos críticos como el stock disponible y los saldos deudores se ejecutan en la propia base de datos mediante triggers y procedimientos almacenados en **PL/pgSQL**.

## 2. Estructura de Tablas (schema.sql)
Se definen las siguientes 9 tablas maestras y relacionales en Supabase:
1. `categorias`: Agrupación lógica de productos.
2. `productos`: Catálogo general de artículos, precios y stock.
3. `usuarios`: Cuentas de acceso del personal (Administrador, Cajero, Repartidor).
4. `clientes`: Información de contacto, saldo deudor y límites de crédito asignados.
5. `ventas`: Cabecera de transacciones comerciales.
6. `detalles_ventas`: Ítems asociados a cada comprobante de venta.
7. `compras`: Cabecera de reabastecimiento de inventario.
8. `detalles_compras`: Ítems asociados a cada compra.
9. `historial_stock`: Kárdex histórico de movimientos de inventario (ventas, compras, ajustes).

Además, se cuenta con la tabla auxiliar `bitacora` para auditorías.

## 3. Índices Optimizados
Para agilizar las búsquedas en el sistema y optimizar tiempos de respuesta, se han creado los siguientes índices no agrupados sobre campos críticos:
- `idx_categorias_nombre` en `categorias(nombre)`
- `idx_productos_codigo_barras` en `productos(codigo_barras)`
- `idx_productos_nombre` en `productos(nombre)`
- `idx_usuarios_email` en `usuarios(email)`
- `idx_clientes_dni_ruc` en `clientes(dni_ruc)`
- `idx_clientes_nombre` en `clientes(nombre)`
- `idx_ventas_codigo_factura` en `ventas(codigo_factura)`
- `idx_ventas_fecha` en `ventas(fecha_venta)`
- `idx_compras_fecha` en `compras(fecha_compra)`
- `idx_historial_producto` en `historial_stock(producto_id)`
- `idx_bitacora_tabla` en `bitacora(tabla_afectada)`
- `idx_bitacora_fecha` en `bitacora(fecha_registro)`

## 4. Programabilidad y Funciones (programmability.sql)

### A. Trigger: Control de Stock en Ventas (`trg_detalles_ventas_before_insert`)
- **Evento:** `BEFORE INSERT ON detalles_ventas`
- **Función:** `fn_controlar_stock_venta()`
- **Comportamiento:** Realiza un bloqueo exclusivo `FOR UPDATE` sobre el registro del producto solicitado. Si el stock actual es menor a la cantidad requerida, lanza una excepción de error con código `P0001` y revierte la transacción. Si hay disponibilidad, descuenta la cantidad solicitada y registra el movimiento de salida en `historial_stock`.

### B. Procedimiento Almacenado: Registro de Ventas a Crédito (`registrar_venta_credito`)
- **Tipo:** Función PL/pgSQL
- **Parámetros:**
  - `p_cliente_id` (UUID)
  - `p_usuario_id` (UUID)
  - `p_codigo_factura` (Varchar)
  - `p_total` (Numeric)
  - `p_items` (JSONB) - Listado de productos a vender.
- **Validación:** Compara el `saldo_deudor` actual sumando el `p_total` contra el `limite_credito` del cliente. Si lo excede, genera una excepción con código `P0002` cancelando toda la transacción. En caso de cumplir con los requisitos, genera el registro de venta, itera para insertar los detalles correspondientes (desencadenando el trigger de stock) e incrementa el saldo deudor del cliente.

### C. Trigger: Auditoría de Datos (`trg_auditar_*`)
- **Eventos:** `AFTER INSERT OR UPDATE OR DELETE` sobre las tablas `productos`, `ventas` y `clientes`.
- **Función:** `fn_auditar_cambios()`
- **Comportamiento:** Guarda en la tabla `bitacora` el nombre de la tabla afectada, la operación realizada y almacena de forma estructurada en formato JSONB el estado anterior (`old`) y el nuevo estado (`new`) del registro.

