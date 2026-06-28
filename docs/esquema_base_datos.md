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
7. `compras`: [DESMANTELADO] Cabecera de reabastecimiento de inventario (Migrado a compras_auditoria_historica para auditoría).
8. `detalles_compras`: [DESMANTELADO] Ítems asociados a cada compra (Migrado a detalles_compras_auditoria_historica para auditoría).
9. `historial_stock`: Kárdex histórico de movimientos de inventario. Admite únicamente movimientos de tipo 'Venta', 'Ajuste' o 'Cancelacion Venta' mediante una restricción CHECK en `tipo_movimiento`.
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
- idx_compras_fecha [OBSOLETO]
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

### G. Función Almacenada: fn_ajustar_stock (SECURITY DEFINER)
- **Tipo:** Función PL/pgSQL
- **Parámetros:**
  - `p_producto_id` (UUID)
  - `p_cantidad_cambio` (Integer)
  - `p_motivo` (Text)
  - `p_usuario_id` (UUID)
- **Comportamiento:** Realiza un ajuste de stock manual sobre un producto atómicamente. Valida que el producto exista y que el stock resultante no sea menor a cero (código de error `P0007`). Registra la transacción en `historial_stock` con tipo de movimiento 'Ajuste' y retorna el producto actualizado en formato JSONB.

### H. Función Almacenada: obtener_metricas_categorias
- **Tipo:** Función PL/pgSQL
- **Parámetros:** Ninguno
- **Comportamiento:** Consolida métricas de inventario para las categorías del negocio. Retorna un objeto JSONB que incluye el conteo total de categorías activas, los datos de la categoría dominante (aquella con el stock acumulado de productos más alto) y la valorización económica total en base a la suma de `precio_venta * stock_actual` de productos y categorías activas.

### I. Función Almacenada: actualizar_venta (SECURITY DEFINER)
- **Tipo:** Función PL/pgSQL
- **Parámetros:**
  - `p_venta_id` (UUID)
  - `p_cliente_id` (UUID)
  - `p_tipo_pago` (Varchar)
  - `p_items` (JSONB)
  - `p_para_delivery` (Boolean)
  - `p_direccion_despacho` (Text)
  - `p_costo_envio` (Numeric)
- **Comportamiento:** Permite actualizar de forma atómica y transaccional los detalles de una venta, revirtiendo primero el stock y deudas previas, recalculando y aplicando las nuevas cantidades y montos, y actualizando la facturación y el estado de entrega. Se ejecuta con privilegios de `SECURITY DEFINER` para evitar violaciones de RLS al escribir en `historial_stock`.

### J. Función Almacenada: obtener_metricas_dashboard
- **Tipo:** Función PL/pgSQL
- **Parámetros:** `p_fecha_inicio` (Date, Opcional), `p_fecha_fin` (Date, Opcional)
- **Comportamiento:** Consolida las métricas financieras, conteo de transacciones, saldos deudores, efectividad de entregas y ventas por categoría del negocio. Si se especifican las fechas de inicio y fin, filtra el análisis para ese rango inclusivo y calcula la tendencia de ventas comparándola contra el período espejo anterior de igual duración exacta.


