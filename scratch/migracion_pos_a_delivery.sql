-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Automatización de POS a Delivery (migracion_pos_a_delivery.sql)
-- Idioma: Español
-- =============================================================================

-- Redefinición de la función registrar_venta_credito para incorporar delivery
create or replace function registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
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
            using errcode = 'P0002'; -- Código de error personalizado para límite de crédito
    end if;

    -- 2. Insertar cabecera de la venta con tipo de pago 'Credito'
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, 'Credito', 'Completada')
    returning id into v_venta_id;

    -- 3. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
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

    -- 5. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
    end if;

    return v_venta_id;
end;
$$ language plpgsql;

-- Redefinición de la función registrar_venta_contado para incorporar delivery
create or replace function registrar_venta_contado(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
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

    -- 2. Iterar sobre los productos e insertarlos en el detalle
    -- Esto disparará automáticamente el trigger trg_detalles_ventas_before_insert que verifica stock con FOR UPDATE
    -- Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
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

    -- 3. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
    end if;

    return v_venta_id;
end;
$$ language plpgsql;
