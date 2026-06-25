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
Se definen las siguientes 10 tablas maestras y relacionales en Supabase:
1. `categorias`: Agrupación lógica de productos.
2. `productos`: Catálogo general de artículos, precios y stock.
3. `usuarios`: Cuentas de acceso del personal (Administrador, Cajero, Repartidor).
4. `clientes`: Información de contacto, saldo deudor, límites de crédito asignados y coordenadas geográficas (`latitud`, `longitud`, `enlace_mapa`) para envíos.
5. `ventas`: Cabecera de transacciones comerciales.
6. `detalles_ventas`: Ítems asociados a cada comprobante de venta.
7. `compras`: Cabecera de reabastecimiento de inventario. Contiene el campo `proveedor_nombre` para el registro del proveedor.
8. `detalles_compras`: Ítems asociados a cada compra.
9. `historial_stock`: Kárdex histórico de movimientos de inventario (ventas, compras, ajustes).
10. `facturas`: Documentos de facturación asociados automáticamente a ventas completadas.

Además, se cuenta con la tabla auxiliar `bitacora` para auditorías.

## 3. Índices Optimizados
Para agilizar las búsquedas en el sistema y optimizar tiempos de respuesta, se han creado los siguientes índices no agrupados sobre campos críticos:
- `idx_categorias_nombre` en `categorias(nombre)`
- `idx_productos_codigo_barras` en `productos(codigo_barras)`
- `idx_productos_nombre` en `productos(nombre)`
- `idx_usuarios_email` en `usuarios(email)`
- `idx_clientes_dni_ruc` en `clientes(dni_ruc)`
- `idx_clientes_nombre` en `clientes(nombre)`
- `idx_clientes_coordenadas` en `clientes(latitud, longitud)`
- `idx_ventas_codigo_factura` en `ventas(codigo_factura)`
- `idx_ventas_fecha` en `ventas(fecha_venta)`
- `idx_compras_fecha` en `compras(fecha_compra)`
- `idx_historial_producto` en `historial_stock(producto_id)`
- `idx_bitacora_tabla` en `bitacora(tabla_afectada)`
- `idx_bitacora_fecha` en `bitacora(fecha_registro)`
- `idx_facturas_venta_id` en `facturas(venta_id)`
- `idx_facturas_codigo` en `facturas(codigo_factura)`

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

### D. Trigger: Facturación Automática (`trg_ventas_facturacion_automatica`)
- **Evento:** `AFTER INSERT OR UPDATE ON ventas`
- **Función:** `fn_facturar_venta()`
- **Comportamiento:** Si la venta se crea como `'Completada'` o transiciona a dicho estado, se inserta de forma automática la factura correspondiente en la tabla `facturas`.

### E. Función Almacenada: Cancelación de Ventas (`cancelar_venta`)
- **Tipo:** Función PL/pgSQL
- **Parámetros:** `p_venta_id` (UUID)
- **Comportamiento:** Valida la existencia de la venta, cambia su estado a `'Cancelada'` y marca su factura relacionada como `'Anulada'`. Esto a su vez dispara `tg_revertir_venta_cancelada` para devolver el stock e historial (Kardex).

### F. Función Almacenada: Obtener Próximo Código de Factura (`obtener_proximo_codigo_factura`)
- **Tipo:** Función PL/pgSQL
- **Comportamiento:** Lee el estado de la secuencia `seq_codigo_factura` para calcular el siguiente correlativo asignable, sin consumirlo.

### G. Función Almacenada Sobrecargada: registrar_reabastecimiento
- **Tipo:** Función PL/pgSQL
- **Parámetros:**
  - `p_usuario_id` (UUID)
  - `p_proveedor_nombre` (Varchar)
  - `p_codigo_referencia` (Varchar)
  - `p_total` (Numeric)
  - `p_items` (JSONB) - Arreglo JSON de ítems a reabastecer.
- **Comportamiento:** Registra de forma transaccional una compra a proveedores. Itera sobre los detalles de la compra, bloquea los productos involucrados en el catálogo para evitar condiciones de carrera, valida que el costo de compra unitario no sea superior al precio de venta del catálogo (código de error `P0004`), inserta en `detalles_compras` (disparando el trigger `tg_controlar_stock_compra` para incrementar el stock), y finalmente actualiza el `precio_compra` del producto en la tabla `productos`.

### H. Función Almacenada: cancelar_compra
- **Tipo:** Función PL/pgSQL
- **Parámetros:** `p_compra_id` (UUID)
- **Comportamiento:** Cambia el estado de una compra a `'Cancelada'`. Itera sobre sus detalles de compra, bloquea cada producto y valida que el stock disponible no sea menor a la cantidad a restar (evitando stock negativo con código de error `P0007`). Resta del stock la cantidad comprada y registra el movimiento de tipo `'Cancelacion Compra'` en `historial_stock`.

