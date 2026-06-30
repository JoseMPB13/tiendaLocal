-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Estado inicial 'Por Despachar' para envíos
-- Guardado en: scratch/migracion_estado_por_despachar.sql
-- Idioma: Español
-- =============================================================================

-- 1. Modificar la restricción check de estado_envio en la tabla envios
ALTER TABLE envios DROP CONSTRAINT IF EXISTS envios_estado_envio_check;
ALTER TABLE envios ADD CONSTRAINT envios_estado_envio_check 
    CHECK (estado_envio IN ('Por Despachar', 'Pendiente', 'En Camino', 'Entregado', 'Cancelado'));

-- 2. Redefinición de registrar_venta_credito para que inserte en envios con estado 'Por Despachar'
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

        -- Se inserta inicialmente en estado 'Por Despachar'
        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Redefinición de registrar_venta_contado para que inserte en envios con estado 'Por Despachar'
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

        -- Se inserta inicialmente en estado 'Por Despachar'
        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;
