-- =============================================================================
-- SCRIPT DE MIGRACIÓN: PARCHE DE PROCEDIMIENTOS ALMACENADOS DE VENTAS
-- Propósito: Corregir el tipo de la variable temporal v_item de JSONB a RECORD 
--             en los procedimientos registrar_venta_contado y registrar_venta_credito.
--             Esto soluciona el error SQLSTATE 22P02 / invalid input syntax for type json (Token "a2c3d4e5" is invalid)
--             causado al asignar una tupla/fila del SELECT ordenado a una variable JSONB.
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROCEDIMIENTO ALMACENADO: registrar_venta_credito
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
)
RETURNS uuid AS $$
DECLARE
    v_venta_id uuid;
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item record; -- Corregido de jsonb a record
    v_subtotal numeric(12, 2);
BEGIN
    -- 1. Validar límite de crédito del cliente
    SELECT saldo_deudor, limite_credito, nombre
    INTO v_saldo_deudor, v_limite_credito, v_nombre_cliente
    FROM clientes
    WHERE id = p_cliente_id
    FOR UPDATE;

    IF (v_saldo_deudor + p_total) > v_limite_credito THEN
        RAISE EXCEPTION 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
            v_nombre_cliente, v_saldo_deudor, p_total, v_limite_credito
            USING errcode = 'P0002'; -- Código de error personalizado para límite de crédito
    END IF;

    -- 2. Insertar cabecera de la venta con tipo de pago 'Credito'
    INSERT INTO ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    VALUES (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, 'Credito', 'Completada')
    RETURNING id INTO v_venta_id;

    -- 3. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        FROM jsonb_array_elements(p_items) as x(value)
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
                USING errcode = 'P0003';
        END IF;

        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_venta_credito IS 'Registra la cabecera y el detalle de una venta a crédito validando el límite (versión corregida con record loop).';


-- -----------------------------------------------------------------------------
-- 2. PROCEDIMIENTO ALMACENADO: registrar_venta_contado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_venta_contado(
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
RETURNS uuid AS $$
DECLARE
    v_venta_id uuid;
    v_item record; -- Corregido de jsonb a record
    v_subtotal numeric(12, 2);
BEGIN
    -- 1. Insertar cabecera de la venta al contado
    INSERT INTO ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    VALUES (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, p_tipo_pago, 'Completada')
    RETURNING id INTO v_venta_id;

    -- 2. Iterar sobre los productos e insertarlos en el detalle
    -- Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        FROM jsonb_array_elements(p_items) as x(value)
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

    -- 3. Registrar envío de delivery si se requiere
    IF p_para_delivery THEN
        IF p_direccion_despacho IS NULL OR p_direccion_despacho = '' THEN
            RAISE EXCEPTION 'La dirección de despacho es obligatoria para pedidos con delivery.'
                USING errcode = 'P0003';
        END IF;

        INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        VALUES (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
    END IF;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_venta_contado IS 'Registra la cabecera y el detalle de una venta al contado (versión corregida con record loop).';
