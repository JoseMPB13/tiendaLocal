-- =============================================================================
-- PARCHE DE MIGRACIÓN: CONTROL DE INVENTARIO Y REVERSIONES (Supabase/PostgreSQL)
-- Descripción: Script de ejecución única para el SQL Editor de Supabase.
-- Idioma: Español
-- =============================================================================

-- 1. Eliminar triggers existentes para evitar conflictos
drop trigger if exists tg_controlar_stock_compra on detalles_compras;
drop trigger if exists tg_revertir_venta_cancelada on ventas;

-- =============================================================================
-- FUNCIÓN: fn_controlar_stock_compra
-- =============================================================================
create or replace function fn_controlar_stock_compra()
returns trigger as $$
declare
    v_nombre_prod varchar(150);
begin
    -- Bloquear la fila del producto para evitar condiciones de carrera (Race Conditions)
    -- en actualizaciones concurrentes de stock.
    select nombre 
    into v_nombre_prod
    from productos 
    where id = new.producto_id
    for update;

    -- Incrementar el stock actual del producto con la cantidad comprada
    update productos 
    set stock_actual = stock_actual + new.cantidad
    where id = new.producto_id;

    -- Registrar el movimiento de tipo 'Compra' en el historial de stock
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
    values (new.producto_id, new.cantidad, 'Compra', new.compra_id);

    return new;
end;
$$ language plpgsql;

-- 2. Crear Trigger tg_controlar_stock_compra BEFORE INSERT
create trigger tg_controlar_stock_compra
before insert on detalles_compras
for each row
execute function fn_controlar_stock_compra();


-- =============================================================================
-- FUNCIÓN: fn_revertir_venta_cancelada
-- =============================================================================
create or replace function fn_revertir_venta_cancelada()
returns trigger as $$
declare
    v_item record;
begin
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    if old.estado_venta <> 'Cancelada' and new.estado_venta = 'Cancelada' then
        
        -- A. Iterar sobre todos los productos que forman parte de la venta
        for v_item in 
            select producto_id, cantidad 
            from detalles_ventas 
            where venta_id = new.id
        loop
            -- Bloquear el producto antes de modificar su stock para evitar race conditions
            perform id from productos where id = v_item.producto_id for update;

            -- Devolver (sumar) las cantidades vendidas al stock_actual
            update productos 
            set stock_actual = stock_actual + v_item.cantidad
            where id = v_item.producto_id;

            -- Registrar el movimiento de reversión en historial_stock como 'Cancelacion Venta'
            insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
            values (v_item.producto_id, v_item.cantidad, 'Cancelacion Venta', new.id);
        end loop;

        -- B. Si la venta original fue bajo modalidad de 'Credito', ajustar la deuda del cliente
        if new.tipo_pago = 'Credito' then
            -- Bloquear la fila del cliente para garantizar la consistencia en el saldo
            perform id from clientes where id = new.cliente_id for update;

            -- Restar el total de la venta del saldo deudor, asegurando que no descienda de 0
            update clientes 
            set saldo_deudor = greatest(0.00, saldo_deudor - new.total)
            where id = new.cliente_id;
        end if;

    end if;

    return new;
end;
$$ language plpgsql;

-- 3. Crear Trigger tg_revertir_venta_cancelada AFTER UPDATE
create trigger tg_revertir_venta_cancelada
after update on ventas
for each row
execute function fn_revertir_venta_cancelada();
