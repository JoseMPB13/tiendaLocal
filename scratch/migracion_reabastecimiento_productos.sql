-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Reabastecimiento Integrado de Productos (migracion_reabastecimiento_productos.sql)
-- Idioma: Español
-- =============================================================================

-- Procedimiento almacenado para registrar compras y reabastecer stock de productos
create or replace function registrar_reabastecimiento(
    p_producto_id uuid,
    p_usuario_id uuid,
    p_cantidad integer,
    p_costo_compra numeric(12, 2),
    p_codigo_referencia varchar(100)
)
returns uuid as $$
declare
    v_compra_id uuid;
    v_precio_venta numeric(12, 2);
    v_total numeric(12, 2);
begin
    -- 1. Bloquear y verificar el producto
    select precio_venta into v_precio_venta
    from productos
    where id = p_producto_id
    for update;

    if not found then
        raise exception 'El producto especificado no existe.'
            using errcode = 'P0005';
    end if;

    -- 2. Validar que el costo de compra no sea mayor al precio de venta actual
    if p_costo_compra > v_precio_venta then
        raise exception 'El costo de compra no puede ser mayor al precio de venta actual. Ajuste el precio de venta primero.'
            using errcode = 'P0004';
    end if;

    -- 3. Insertar cabecera de la compra
    v_total := p_cantidad * p_costo_compra;
    insert into compras (usuario_id, codigo_referencia, total, estado_compra)
    values (p_usuario_id, p_codigo_referencia, v_total, 'Completada')
    returning id into v_compra_id;

    -- 4. Insertar detalle de la compra (esto disparará el trigger tg_controlar_stock_compra)
    insert into detalles_compras (compra_id, producto_id, cantidad, costo_unitario, subtotal)
    values (v_compra_id, p_producto_id, p_cantidad, p_costo_compra, v_total);

    -- 5. Actualizar el costo del producto en el catálogo
    update productos
    set precio_compra = p_costo_compra
    where id = p_producto_id;

    return p_producto_id;
end;
$$ language plpgsql;
