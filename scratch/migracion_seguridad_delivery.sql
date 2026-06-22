-- =============================================================================
-- MIGRACIÓN DE SEGURIDAD Y RENDIMIENTO: DELIVERY (migracion_seguridad_delivery.sql)
-- Idioma: Español
-- =============================================================================

-- 1. Crear índice compuesto para optimizar la consulta de ruta activa de los repartidores
create index if not exists idx_envios_repartidor_estado 
on envios(repartidor_id, estado_envio);

-- 2. Crear índice parcial para optimizar la asignación atómica de pedidos pendientes libres
create index if not exists idx_envios_pendientes_libres 
on envios(id) 
where estado_envio = 'Pendiente' and repartidor_id is null;

comment on index idx_envios_repartidor_estado is 'Optimiza la consulta de envíos en camino asignados a repartidores.';
comment on index idx_envios_pendientes_libres is 'Optimiza la asignación atómica y búsqueda de envíos libres.';
