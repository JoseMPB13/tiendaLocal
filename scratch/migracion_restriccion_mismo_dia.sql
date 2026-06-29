-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Módulo Punto de Venta (migracion_restriccion_mismo_dia.sql)
-- Propósito: 1. Corregir el bug v_item (SQLSTATE 42P01) en actualizar_venta()
--            2. Restringir la edición de ventas únicamente al mismo día (P0007)
--            3. Restringir la anulación de ventas únicamente al mismo día (P0008)
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN: cancelar_venta
-- Restringe la anulación de ventas para que solo sea permitida el mismo día de la venta.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_venta(p_venta_id uuid)
RETURNS uuid AS $$
DECLARE
    v_fecha_venta timestamptz;
BEGIN
    -- Validar existencia y extraer la fecha original de la venta
    SELECT fecha_venta INTO v_fecha_venta FROM ventas WHERE id = p_venta_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.'
            USING ERRCODE = 'P0005';
    END IF;

    -- Validar que la venta se haya realizado el mismo día actual del servidor
    IF v_fecha_venta::date <> current_date THEN
        RAISE EXCEPTION 'Solo se pueden anular ventas realizadas el mismo día.'
            USING ERRCODE = 'P0008';
    END IF;

    -- Actualizar estado a 'Cancelada'. Esto disparará automáticamente tg_revertir_venta_cancelada
    UPDATE ventas
    SET estado_venta = 'Cancelada'
    WHERE id = p_venta_id AND estado_venta <> 'Cancelada';

    -- Cambiar estado de la factura relacionada si existe
    UPDATE facturas
    SET estado = 'Anulada'
    WHERE venta_id = p_venta_id;

    RETURN p_venta_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancelar_venta IS 'Realiza la baja lógica de una venta y actualiza su factura asociada, restringido al mismo día.';


-- -----------------------------------------------------------------------------
-- FUNCIÓN: actualizar_venta
-- Modificación atómica de detalles de venta con reversión de stock y límite de crédito.
-- Se corrige el bug de 'v_item' y se restringe la edición al mismo día de venta.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_venta(
    p_venta_id uuid,
    p_cliente_id uuid,
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT null,
    p_costo_envio numeric DEFAULT 0.00
)
RETURNS uuid AS $$
DECLARE
    v_old_cliente_id uuid;
    v_old_tipo_pago varchar(30);
    v_old_total numeric(12, 2);
    v_old_estado_venta varchar(30);
    v_old_fecha_venta timestamptz;
    v_new_total numeric(12, 2) := 0.00;
    v_item record; -- Se cambia de jsonb a record para evitar errores DML con alias
    v_detail record;
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
    v_precio_oficial numeric(12, 2);
    v_subtotal numeric(12, 2);
BEGIN
    -- 1. Obtener datos actuales de la venta
    SELECT cliente_id, tipo_pago, total, estado_venta, fecha_venta
    INTO v_old_cliente_id, v_old_tipo_pago, v_old_total, v_old_estado_venta, v_old_fecha_venta
    FROM ventas
    WHERE id = p_venta_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.' USING ERRCODE = 'P0005';
    END IF;

    -- Validar restricción de edición al mismo día
    IF v_old_fecha_venta::date <> current_date THEN
        RAISE EXCEPTION 'Solo se pueden editar ventas realizadas el mismo día.' USING ERRCODE = 'P0007';
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
        SET saldo_deudor = greatest(0.00, saldo_deudor - v_old_total)
        WHERE id = v_old_cliente_id;
    END IF;

    -- 3. Calcular el nuevo total y validar stock/precios usando desempaquetamiento explícito
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid AS producto_id, 
               (x.value->>'cantidad')::integer AS cantidad, 
               (x.value->>'precio_unitario')::numeric AS precio_unitario 
        FROM jsonb_array_elements(p_items) AS x(value) 
    LOOP
        SELECT precio_venta, stock_actual, stock_minimo, nombre
        INTO v_precio_oficial, v_stock_actual, v_stock_minimo, v_nombre_prod
        FROM productos
        WHERE id = v_item.producto_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no existe en catálogo.' USING ERRCODE = 'P0001';
        END IF;

        -- Validar stock (recordando que acabamos de sumarle la cantidad anterior)
        IF v_stock_actual < v_item.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, solicitado: %', 
                v_nombre_prod, v_stock_actual, v_item.cantidad
                USING ERRCODE = 'P0001';
        END IF;

        v_new_total := v_new_total + (v_item.cantidad * v_precio_oficial);
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

    -- 6. Insertar nuevos detalles y descontar stock usando desempaquetamiento explícito
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid AS producto_id, 
               (x.value->>'cantidad')::integer AS cantidad, 
               (x.value->>'precio_unitario')::numeric AS precio_unitario 
        FROM jsonb_array_elements(p_items) AS x(value) 
    LOOP
        v_subtotal := v_item.cantidad * v_item.precio_unitario;
        
        INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (
            p_venta_id, 
            v_item.producto_id, 
            v_item.cantidad, 
            v_item.precio_unitario,
            v_subtotal
        );

        UPDATE productos
        SET stock_actual = stock_actual - v_item.cantidad
        WHERE id = v_item.producto_id;

        INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        VALUES (v_item.producto_id, -v_item.cantidad, 'Venta', p_venta_id, 'Ajuste de cantidad en venta');
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION actualizar_venta IS 'Actualiza una venta y sus detalles reajustando stock y deudas (atómico), restringido al mismo día.';
