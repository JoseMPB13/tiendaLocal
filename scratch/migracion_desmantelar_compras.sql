-- MIGRACIÓN: Desmantelar Compras, Integrar Ajustes Manuales y Métricas de Categorías
-- Propósito: Desmantelar compras físicas, añadir Ajustes manuales y Métricas de Categorías.
-- Idioma: Español

-- 1. Respaldar datos históricos de compras si existen
create table if not exists compras_auditoria_historica as 
select * from compras;

create table if not exists detalles_compras_auditoria_historica as 
select * from detalles_compras;

-- 2. Eliminar trigger y función asociada a compras
drop trigger if exists tg_controlar_stock_compra on detalles_compras;
drop function if exists fn_controlar_stock_compra();

-- 3. Eliminar procedimientos almacenados de compras obsoletos
drop function if exists registrar_reabastecimiento(uuid, uuid, integer, numeric, varchar);
drop function if exists registrar_reabastecimiento(uuid, varchar, varchar, numeric, jsonb);
drop function if exists cancelar_compra(uuid);

-- 4. Eliminar tablas de compras
drop table if exists detalles_compras cascade;
drop table if exists compras cascade;

-- 5. Actualizar registros históricos en historial_stock para no violar el nuevo CHECK
update historial_stock 
set tipo_movimiento = 'Ajuste',
    motivo = coalesce(motivo || ' (Migrado de Compras)', 'Ajuste de inventario (Migrado de Compras)')
where tipo_movimiento in ('Compra', 'Cancelacion Compra');

-- 6. Modificar la restricción CHECK en la tabla historial_stock
alter table historial_stock drop constraint if exists historial_stock_tipo_movimiento_check;
alter table historial_stock drop constraint if exists check_tipo_movimiento;
alter table historial_stock add constraint check_tipo_movimiento check (tipo_movimiento in ('Venta', 'Ajuste', 'Cancelacion Venta'));

-- 7. Crear función almacenada atómica para Ajustar Stock
create or replace function fn_ajustar_stock(
    p_producto_id uuid,
    p_cantidad_cambio integer,
    p_motivo text,
    p_usuario_id uuid
)
returns jsonb as $$
declare
    v_stock_actual integer;
    v_stock_nuevo integer;
    v_nombre_prod varchar(150);
begin
    -- Bloquear y verificar el producto para evitar race conditions
    select nombre, stock_actual into v_nombre_prod, v_stock_actual
    from productos
    where id = p_producto_id
    for update;

    if not found then
        raise exception 'El producto especificado no existe.'
            using errcode = 'P0005';
    end if;

    -- Calcular el nuevo stock y validar que no sea negativo
    v_stock_nuevo := v_stock_actual + p_cantidad_cambio;
    if v_stock_nuevo < 0 then
        raise exception 'No se puede realizar el ajuste. El stock resultante (%) no puede ser menor a cero.', v_stock_nuevo
            using errcode = 'P0007';
    end if;

    -- Actualizar el stock actual del producto
    update productos
    set stock_actual = v_stock_nuevo
    where id = p_producto_id;

    -- Registrar en el historial de stock
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
    values (p_producto_id, p_cantidad_cambio, 'Ajuste', p_usuario_id, p_motivo);

    -- Retornar el producto actualizado como JSONB
    return (
        select jsonb_build_object(
            'id', id,
            'nombre', nombre,
            'stock_actual', stock_actual,
            'precio_venta', precio_venta,
            'precio_compra', precio_compra,
            'categoria_id', categoria_id,
            'estado', estado
        )
        from productos
        where id = p_producto_id
    );
end;
$$ language plpgsql security definer;

-- 8. Crear la función RPC para obtener métricas ejecutivas de categorías
create or replace function obtener_metricas_categorias()
returns jsonb as $$
declare
    v_total_activas bigint;
    v_dominante_nombre varchar(150);
    v_dominante_stock bigint;
    v_valorizacion_total numeric(12, 2);
begin
    -- Conteo total de categorías activas
    select count(*) into v_total_activas
    from categorias
    where estado = 'Activo';

    -- Categoría dominante en inventario (mayor stock acumulado)
    select c.nombre, coalesce(sum(p.stock_actual), 0)
    into v_dominante_nombre, v_dominante_stock
    from categorias c
    left join productos p on p.categoria_id = c.id
    where c.estado = 'Activo' and p.estado = 'Activo'
    group by c.id, c.nombre
    order by sum(p.stock_actual) desc, c.nombre asc
    limit 1;

    -- Si no hay productos, establecer valores por defecto
    if v_dominante_nombre is null then
        v_dominante_nombre := 'Ninguna';
        v_dominante_stock := 0;
    end if;

    -- Valorización económica total (suma de precio_venta * stock_actual de productos activos de categorías activas)
    select coalesce(sum(p.precio_venta * p.stock_actual), 0.00)
    into v_valorizacion_total
    from productos p
    join categorias c on c.id = p.categoria_id
    where c.estado = 'Activo' and p.estado = 'Activo';

    return jsonb_build_object(
        'total_categorias_activas', v_total_activas,
        'categoria_dominante', jsonb_build_object(
            'nombre', v_dominante_nombre,
            'total_stock', v_dominante_stock
        ),
        'valorizacion_total', v_valorizacion_total
    );
end;
$$ language plpgsql security definer;
