-- =============================================================================
-- SCRIPT DE LIMPIEZA TOTAL: TIENDALOCAL (limpiar_base_datos.sql)
-- Vacía todas las tablas de datos operativos y restaura valores por defecto.
-- NO elimina el esquema (tablas, funciones, triggers ni políticas RLS).
--
-- Uso recomendado en Supabase SQL Editor:
--   1. Ejecutar este script
--   2. Ejecutar scratch/seed_data.sql para datos de demostración
--
-- ADVERTENCIA: Esta operación es irreversible. Respalde antes en producción.
-- Idioma: Español
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Vaciar tablas en orden seguro (CASCADE resuelve dependencias FK)
-- -----------------------------------------------------------------------------
truncate table
    bitacora,
    bitacora_usuarios,
    detalles_ventas,
    facturas,
    historial_stock,
    envios,
    ventas,
    repartidores,
    productos,
    categorias,
    clientes,
    usuarios,
    configuracion_sistema
restart identity cascade;

-- -----------------------------------------------------------------------------
-- 2. Reiniciar secuencia de códigos KIO- para productos sin código de barras
-- -----------------------------------------------------------------------------
alter sequence if exists seq_codigo_barras_producto restart with 1;

-- -----------------------------------------------------------------------------
-- 3. Restaurar configuración base del kiosco (Bolivia)
-- -----------------------------------------------------------------------------
insert into configuracion_sistema (clave, valor)
values
    ('kiosco_latitud', '-17.7833'),
    ('kiosco_longitud', '-63.1667'),
    ('kiosco_nombre', 'Tienda Margarita'),
    ('qr_pago_imagen', ''),
    ('logo_url', '')
on conflict (clave) do update set valor = excluded.valor;

commit;

-- Verificación rápida (opcional, comentar si no se desea salida)
select 'limpieza_completada' as estado,
       (select count(*) from usuarios) as usuarios,
       (select count(*) from productos) as productos,
       (select count(*) from clientes) as clientes,
       (select count(*) from ventas) as ventas,
       (select count(*) from configuracion_sistema) as config_claves;
