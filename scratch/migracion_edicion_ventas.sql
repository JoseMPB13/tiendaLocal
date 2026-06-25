-- =============================================================================
-- SCRIPT DE MIGRACIÓN: EDICIÓN DE COMPROBANTES DE VENTAS Y AJUSTE DE STOCK
-- Propósito: Implementar la función actualizar_venta que permite modificar 
--             de forma atómica el cliente, tipo de pago, delivery y detalles
--             de una venta realizando la reversión y reaplicación de stock y deudas.
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN: actualizar_venta
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_venta(
    p_venta_id uuid,
    p_cliente_id uuid,
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
)
RETURNS uuid AS $$
DECLARE
    v_old_cliente_id uuid;
    v_old_tipo_pago varchar(30);
    v_old_total numeric(12, 2);
    v_old_estado_venta varchar(30);
    v_new_total numeric(12, 2) := 0.00;
    v_item jsonb;
    v_detail record;
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
    v_precio_oficial numeric(12, 2);
    v_subtotal numeric(12, 2);
BEGIN
    -- 1. Obtener datos actuales de la venta
    SELECT cliente_id, tipo_pago, total, estado_venta
    INTO v_old_cliente_id, v_old_tipo_pago, v_old_total, v_old_estado_venta
    FROM ventas
    WHERE id = p_venta_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.' USING ERRCODE = 'P0005';
    END IF;

    IF v_old_estado_venta = 'Cancelada' THEN
        RAISE EXCEPTION 'No se puede modificar una venta cancelada.' USING ERRCODE = 'P0006';
    END IF;

    -- 2. Revertir deudas y stock de la venta anterior
    -- Revertir stock
    FOR v_detail IN 
        SELECT producto_id, cantidad 
        FROM detalles_ventas 
        WHERE venta_id = p_venta_id
    LOOP
        UPDATE productos 
        SET stock_actual = stock_actual + v_detail.cantidad
        WHERE id = v_detail.producto_id;

        -- Registrar contra-movimiento de stock temporal (descuento revertido por ajuste)
        INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        VALUES (v_detail.producto_id, v_detail.cantidad, 'Ajuste', p_venta_id, 'Reversión por ajuste de venta');
    END LOOP;

    -- Revertir deuda del cliente anterior
    IF v_old_tipo_pago = 'Credito' THEN
        UPDATE clientes 
        SET saldo_deudor = GREATEST(0.00, saldo_deudor - v_old_total)
        WHERE id = v_old_cliente_id;
    END IF;

    -- 3. Calcular el nuevo total y validar stock/precios
    FOR v_item IN SELECT jsonb_array_elements(p_items)
    LOOP
        SELECT precio_venta, stock_actual, stock_minimo, nombre
        INTO v_precio_oficial, v_stock_actual, v_stock_minimo, v_nombre_prod
        FROM productos
        WHERE id = (v_item.value->>'producto_id')::uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no existe en catálogo.' USING ERRCODE = 'P0001';
        END IF;

        -- Validar stock (recordando que acabamos de sumarle la cantidad anterior)
        IF v_stock_actual < (v_item.value->>'cantidad')::integer THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, solicitado: %', 
                v_nombre_prod, v_stock_actual, (v_item.value->>'cantidad')::integer
                USING ERRCODE = 'P0001';
        END IF;

        v_new_total := v_new_total + ((v_item.value->>'cantidad')::integer * v_precio_oficial);
    END LOOP;

    -- 4. Validar límite de crédito del nuevo cliente si el pago es a crédito
    IF p_tipo_pago = 'Credito' THEN
        DECLARE
            v_saldo_deudor numeric(12, 2);
            v_limite_credito numeric(12, 2);
            v_nombre_cliente varchar(150);
        BEGIN
            SELECT saldo_deudor, limite_credito, nombre
            INTO v_saldo_deudor, v_limite_credito, v_nombre_cliente
            FROM clientes
            WHERE id = p_cliente_id
            FOR UPDATE;

            IF (v_saldo_deudor + v_new_total) > v_limite_credito THEN
                RAISE EXCEPTION 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
                    v_nombre_cliente, v_saldo_deudor, v_new_total, v_limite_credito
                    USING ERRCODE = 'P0002';
            END IF;
        END;
    END IF;

    -- 5. Eliminar detalles viejos
    DELETE FROM detalles_ventas WHERE venta_id = p_venta_id;

    -- 6. Insertar nuevos detalles y descontar stock
    FOR v_item IN SELECT jsonb_array_elements(p_items)
    LOOP
        v_subtotal := (v_item.value->>'cantidad')::integer * (v_item.value->>'precio_unitario')::numeric;
        
        INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (
            p_venta_id, 
            (v_item.value->>'producto_id')::uuid, 
            (v_item.value->>'cantidad')::integer, 
            (v_item.value->>'precio_unitario')::numeric,
            v_subtotal
        );

        UPDATE productos
        SET stock_actual = stock_actual - (v_item.value->>'cantidad')::integer
        WHERE id = (v_item.value->>'producto_id')::uuid;

        INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        VALUES ((v_item.value->>'producto_id')::uuid, -(v_item.value->>'cantidad')::integer, 'Venta', p_venta_id, 'Ajuste de cantidad en venta');
    END LOOP;

    -- 7. Actualizar cabecera de la venta
    UPDATE ventas
    SET cliente_id = p_cliente_id,
        tipo_pago = p_tipo_pago,
        total = v_new_total
    WHERE id = p_venta_id;

    -- 8. Aplicar la deuda al nuevo cliente si es Crédito
    IF p_tipo_pago = 'Credito' THEN
        UPDATE clientes
        SET saldo_deudor = saldo_deudor + v_new_total
        WHERE id = p_cliente_id;
    END IF;

    -- 9. Actualizar factura asociada si existe
    UPDATE facturas
    SET total = v_new_total
    WHERE venta_id = p_venta_id;

    -- 10. Actualizar envío de delivery si aplica
    IF p_para_delivery THEN
        IF p_direccion_despacho IS NULL OR p_direccion_despacho = '' THEN
            RAISE EXCEPTION 'La dirección de despacho es obligatoria para pedidos con delivery.'
                USING ERRCODE = 'P0003';
        END IF;
        
        -- Si ya existe envío, lo actualizamos. Si no, lo insertamos
        IF EXISTS (SELECT 1 FROM envios WHERE venta_id = p_venta_id) THEN
            UPDATE envios 
            SET direccion_despacho = p_direccion_despacho,
                costo_envio = p_costo_envio
            WHERE venta_id = p_venta_id;
        ELSE
            INSERT INTO envios (venta_id, direccion_despacho, costo_envio, estado_envio)
            VALUES (p_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
        END IF;
    ELSE
        -- Si ya no requiere delivery, eliminamos el registro si estaba en estado Pendiente
        DELETE FROM envios WHERE venta_id = p_venta_id AND estado_envio = 'Pendiente';
    END IF;

    RETURN p_venta_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actualizar_venta IS 'Actualiza una venta y sus detalles reajustando stock y deudas (atómico).';
