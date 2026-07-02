-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Persistencia de coordenadas de delivery (Corregido)
-- Guardado en: scratch/migracion_persistencias_delivery.sql
-- Idioma: Español
-- =============================================================================

-- 1. Agregar columnas latitud y longitud a la tabla envios
ALTER TABLE envios ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 8) DEFAULT NULL;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS longitud NUMERIC(11, 8) DEFAULT NULL;

-- 2. Agregar validación/rango de coordenadas en envios
ALTER TABLE envios DROP CONSTRAINT IF EXISTS chk_envios_latitud_rango;
ALTER TABLE envios ADD CONSTRAINT chk_envios_latitud_rango 
    CHECK (latitud IS NULL OR (latitud >= -90.00000000 AND latitud <= 90.00000000));

ALTER TABLE envios DROP CONSTRAINT IF EXISTS chk_envios_longitud_rango;
ALTER TABLE envios ADD CONSTRAINT chk_envios_longitud_rango 
    CHECK (longitud IS NULL OR (longitud >= -180.00000000 AND longitud <= 180.00000000));

-- 3. Redefinición de la función registrar_venta_credito para incorporar coordenadas de delivery (Sin p_codigo_factura)
CREATE OR REPLACE FUNCTION registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00,
    p_latitud numeric DEFAULT NULL,
    p_longitud numeric DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item record;
    v_subtotal numeric(12, 2);
BEGIN
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Validar límite de crédito del cliente
    SELECT saldo_deudor, limite_credito, nombre
    INTO v_saldo_deudor, v_limite_credito, v_nombre_cliente
    FROM clientes
    WHERE id = p_cliente_id
    FOR UPDATE;

    IF (v_saldo_deudor + p_total) > v_limite_credito THEN
        RAISE EXCEPTION 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
            v_nombre_cliente, v_saldo_deudor, p_total, v_limite_credito
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Insertar cabecera de la venta con tipo de pago 'Credito'
    INSERT INTO ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    VALUES (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, 'Credito', 'Completada')
    RETURNING id INTO v_venta_id;

    -- 3. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid AS prod_id,
               (x.value->>'cantidad')::integer AS cant,
               (x.value->>'precio_unitario')::numeric(12, 2) AS precio
        FROM jsonb_array_elements(p_items) AS x(value)
        ORDER BY prod_id ASC
    LOOP
        v_subtotal := v_item.cant * v_item.precio;
        
        INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    END LOOP;

    -- 4. Actualizar el saldo deudor del cliente
    UPDATE clientes
    SET saldo_deudor = saldo_deudor + p_total
    WHERE id = p_cliente_id;

    -- 5. Registrar envío de delivery si se requiere
    IF p_para_delivery THEN
        IF p_direccion_despacho IS NULL OR p_direccion_despacho = '' THEN
            RAISE EXCEPTION 'La dirección de despacho es obligatoria para pedidos con delivery.'
                USING ERRCODE = 'P0003';
        END IF;

        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente', p_latitud, p_longitud);
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Redefinición de la función registrar_venta_contado para incorporar coordenadas de delivery (Sin p_codigo_factura)
CREATE OR REPLACE FUNCTION registrar_venta_contado(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00,
    p_latitud numeric DEFAULT NULL,
    p_longitud numeric DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_item record;
    v_subtotal numeric(12, 2);
BEGIN
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Insertar cabecera de la venta al contado
    INSERT INTO ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    VALUES (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, p_tipo_pago, 'Completada')
    RETURNING id INTO v_venta_id;

    -- 2. Iterar sobre los productos e insertarlos en el detalle
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid AS prod_id,
               (x.value->>'cantidad')::integer AS cant,
               (x.value->>'precio_unitario')::numeric(12, 2) AS precio
        FROM jsonb_array_elements(p_items) AS x(value)
        ORDER BY prod_id ASC
    LOOP
        v_subtotal := v_item.cant * v_item.precio;
        
        INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    END loop;

    -- 3. Registrar envío de delivery si se requiere
    IF p_para_delivery THEN
        IF p_direccion_despacho IS NULL OR p_direccion_despacho = '' THEN
            RAISE EXCEPTION 'La dirección de despacho es obligatoria para pedidos con delivery.'
                USING ERRCODE = 'P0003';
        END IF;

        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente', p_latitud, p_longitud);
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Redefinición de la función actualizar_venta para incorporar coordenadas de delivery
CREATE OR REPLACE FUNCTION actualizar_venta(
    p_venta_id uuid,
    p_cliente_id uuid,
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean default false,
    p_direccion_despacho text default null,
    p_costo_envio numeric default 0.00,
    p_latitud numeric default null,
    p_longitud numeric default null
)
returns uuid as $$
declare
    v_old_cliente_id uuid;
    v_old_tipo_pago varchar(30);
    v_old_total numeric(12, 2);
    v_old_estado_venta varchar(30);
    v_old_fecha_venta timestamptz;
    v_new_total numeric(12, 2) := 0.00;
    v_item record;
    v_detail record;
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
    v_precio_oficial numeric(12, 2);
    v_subtotal numeric(12, 2);
begin
    -- 1. Obtener datos actuales de la venta
    select cliente_id, tipo_pago, total, estado_venta, fecha_venta
    into v_old_cliente_id, v_old_tipo_pago, v_old_total, v_old_estado_venta, v_old_fecha_venta
    from ventas
    where id = p_venta_id
    for update;

    if not found then
        raise exception 'La venta especificada no existe.' using errcode = 'P0005';
    end if;

    -- Validar restricción de edición al mismo día
    if v_old_fecha_venta::date <> current_date then
        raise exception 'Solo se pueden editar ventas realizadas el mismo día.' using errcode = 'P0007';
    end if;

    if v_old_estado_venta = 'Cancelada' then
        raise exception 'No se puede modificar una venta cancelada.' using errcode = 'P0006';
    end if;

    -- 2. Revertir deudas y stock de la venta anterior
    for v_detail in 
        select producto_id, cantidad 
        from detalles_ventas 
        where venta_id = p_venta_id
    loop
        update productos 
        set stock_actual = stock_actual + v_detail.cantidad
        where id = v_detail.producto_id;

        insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        values (v_detail.producto_id, v_detail.cantidad, 'Ajuste', p_venta_id, 'Reversión por edición de comprobante');
    end loop;

    if v_old_tipo_pago = 'Credito' then
        update clientes
        set saldo_deudor = saldo_deudor - v_old_total
        where id = v_old_cliente_id;
    end if;

    -- 3. Borrar los detalles anteriores de la venta
    delete from detalles_ventas where venta_id = p_venta_id;

    -- 4. Iterar sobre los productos nuevos para validar stock y registrar detalles
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        select stock_actual, stock_minimo, nombre, precio_venta
        into v_stock_actual, v_stock_minimo, v_nombre_prod, v_precio_oficial
        from productos
        where id = v_item.prod_id
        for update;

        if not found then
            raise exception 'El producto con ID % no existe.', v_item.prod_id using errcode = 'P0005';
        end if;

        if v_item.cant > v_stock_actual then
            raise exception 'Stock insuficiente para el producto "%". Stock actual: %, Solicitado: %',
                v_nombre_prod, v_stock_actual, v_item.cant using errcode = 'P0001';
        end if;

        v_subtotal := v_item.cant * v_item.precio;
        v_new_total := v_new_total + v_subtotal;

        update productos
        set stock_actual = stock_actual - v_item.cant
        where id = v_item.prod_id;

        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (p_venta_id, v_item.prod_id, v_item.cant, v_item.precio, v_subtotal);

        insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        values (v_item.prod_id, -v_item.cant, 'Venta', p_venta_id, 'Descuento por edición de comprobante');
    end loop;

    -- 5. Validar límite de crédito del nuevo cliente si aplica
    if p_tipo_pago = 'Credito' then
        declare
            v_saldo_deudor numeric(12, 2);
            v_limite_credito numeric(12, 2);
            v_nombre_cliente varchar(150);
        begin
            select saldo_deudor, limite_credito, nombre
            into v_saldo_deudor, v_limite_credito, v_nombre_cliente
            from clientes
            where id = p_cliente_id
            for update;

            if (v_saldo_deudor + v_new_total) > v_limite_credito then
                raise exception 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
                    v_nombre_cliente, v_saldo_deudor, v_new_total, v_limite_credito using errcode = 'P0002';
            end if;
        end;
    end if;

    -- 6. Actualizar cabecera de la venta
    update ventas
    set cliente_id = p_cliente_id,
        tipo_pago = p_tipo_pago,
        total = v_new_total
    where id = p_venta_id;

    -- 7. Aplicar la deuda al nuevo cliente si es Crédito
    if p_tipo_pago = 'Credito' then
        update clientes
        set saldo_deudor = saldo_deudor + v_new_total
        where id = p_cliente_id;
    end if;

    -- 8. Actualizar factura asociada si existe
    update facturas
    set total = v_new_total
    where venta_id = p_venta_id;

    -- 9. Actualizar envío de delivery si aplica
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;
        
        if exists (select 1 from envios where venta_id = p_venta_id) then
            update envios 
            set direccion_despacho = p_direccion_despacho,
                costo_envio = p_costo_envio,
                latitud = p_latitud,
                longitud = p_longitud
            where venta_id = p_venta_id;
        else
            insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
            values (p_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente', p_latitud, p_longitud);
        end if;
    else
        delete from envios where venta_id = p_venta_id and estado_envio = 'Pendiente';
    end if;

    return p_venta_id;
end;
$$ language plpgsql security definer;
