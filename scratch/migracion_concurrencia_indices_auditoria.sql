-- =============================================================================
-- PARCHE DE MIGRACIÓN: CONCURRENCIA, ÍNDICES Y AUDITORÍA REAL (Supabase/PostgreSQL)
-- Descripción: Script de ejecución única para el SQL Editor de Supabase.
-- Idioma: Español
-- =============================================================================

-- 1. Agregar columna de auditoría de usuario real en bitácora si no existe
alter table bitacora add column if not exists usuario_id uuid;

-- 2. Crear índices estructurales para optimización de Claves Foráneas (FK)
create index if not exists idx_ventas_cliente_id on ventas(cliente_id);
create index if not exists idx_ventas_usuario_id on ventas(usuario_id);
create index if not exists idx_detalles_ventas_venta_id on detalles_ventas(venta_id);
create index if not exists idx_detalles_ventas_producto_id on detalles_ventas(producto_id);
create index if not exists idx_compras_usuario_id on compras(usuario_id);
create index if not exists idx_detalles_compras_compra_id on detalles_compras(compra_id);
create index if not exists idx_detalles_compras_producto_id on detalles_compras(producto_id);

-- =============================================================================
-- 3. FUNCIÓN: fn_auditar_cambios (Redefinida para auditoría de identidad real)
-- =============================================================================
create or replace function fn_auditar_cambios()
returns trigger as $$
declare
    v_datos_anteriores jsonb := null;
    v_datos_nuevos jsonb := null;
    v_registro_id uuid;
    v_usuario_id uuid := null;
begin
    if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
        v_datos_anteriores := to_jsonb(old);
        v_registro_id := old.id;
    end if;
    
    if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
        v_datos_nuevos := to_jsonb(new);
        v_registro_id := new.id;
    end if;

    -- Capturar el ID de usuario real de la aplicación
    -- A. Intentar obtener el ID desde la variable de sesión 'app.current_user_id'
    begin
        v_usuario_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
    exception when others then
        v_usuario_id := null;
    end;

    -- B. Fallback: intentar obtener el ID de usuario de Supabase Auth
    if v_usuario_id is null then
        begin
            v_usuario_id := auth.uid();
        exception when others then
            v_usuario_id := null;
        end;
    end if;

    insert into bitacora (tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id)
    values (tg_table_name, tg_op, v_registro_id, v_datos_anteriores, v_datos_nuevos, v_usuario_id);

    return new;
end;
$$ language plpgsql;

-- =============================================================================
-- 4. PROCEDIMIENTO ALMACENADO: registrar_venta_credito (Prevención de Deadlocks)
-- =============================================================================
create or replace function registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_items jsonb
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- 1. Validar límite de crédito del cliente
    select saldo_deudor, limite_credito, nombre
    into v_saldo_deudor, v_limite_credito, v_nombre_cliente
    from clientes
    where id = p_cliente_id
    for update;

    if (v_saldo_deudor + p_total) > v_limite_credito then
        raise exception 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
            v_nombre_cliente, v_saldo_deudor, p_total, v_limite_credito
            using errcode = 'P0002';
    end if;

    -- 2. Insertar cabecera de la venta
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, 'Credito', 'Completada')
    returning id into v_venta_id;

    -- 3. Iterar sobre los productos ordenados ascendentemente por producto_id para prevenir deadlocks
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    -- 4. Actualizar el saldo deudor del cliente
    update clientes
    set saldo_deudor = saldo_deudor + p_total
    where id = p_cliente_id;

    return v_venta_id;
end;
$$ language plpgsql;

-- =============================================================================
-- 5. PROCEDIMIENTO ALMACENADO: registrar_venta_contado (Prevención de Deadlocks)
-- =============================================================================
create or replace function registrar_venta_contado(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_tipo_pago varchar(30),
    p_items jsonb
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- 1. Insertar cabecera de la venta al contado
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, p_tipo_pago, 'Completada')
    returning id into v_venta_id;

    -- 2. Iterar sobre los productos ordenados ascendentemente por producto_id para prevenir deadlocks
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    return v_venta_id;
end;
$$ language plpgsql;

-- =============================================================================
-- 6. FUNCIÓN: fn_revertir_venta_cancelada (Prevención de Deadlocks)
-- =============================================================================
create or replace function fn_revertir_venta_cancelada()
returns trigger as $$
declare
    v_item record;
begin
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    if old.estado_venta <> 'Cancelada' and new.estado_venta = 'Cancelada' then
        
        -- A. Iterar sobre todos los productos vendidos ordenados ascendentemente por producto_id para prevenir deadlocks
        for v_item in 
            select producto_id, cantidad 
            from detalles_ventas 
            where venta_id = new.id
            order by producto_id asc
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
