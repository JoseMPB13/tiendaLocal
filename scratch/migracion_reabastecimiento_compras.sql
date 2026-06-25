-- =============================================================================
-- SCRIPT DE MIGRACIÓN: REABASTECIMIENTO DE PRODUCTOS (COMPRAS)
-- Idioma: Español
-- =============================================================================

-- 1. Agregar columna proveedor_nombre a la tabla compras de forma segura
ALTER TABLE compras ADD COLUMN IF NOT EXISTS proveedor_nombre varchar(150);

-- 2. Procedimiento Almacenado Sobrecargado: registrar_reabastecimiento
--    Registra la cabecera de compra y itera sobre un arreglo JSON para registrar
--    los detalles, validar el control de costos y actualizar el precio de compra en el catálogo.
CREATE OR REPLACE FUNCTION registrar_reabastecimiento(
    p_usuario_id uuid,
    p_proveedor_nombre varchar(150),
    p_codigo_referencia varchar(100),
    p_total numeric(12, 2),
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_compra_id uuid;
    v_item record;
    v_precio_venta numeric(12, 2);
BEGIN
    -- 1. Insertar cabecera de la compra
    INSERT INTO compras (usuario_id, proveedor_nombre, codigo_referencia, total, estado_compra)
    VALUES (p_usuario_id, p_proveedor_nombre, p_codigo_referencia, p_total, 'Completada')
    RETURNING id INTO v_compra_id;

    -- 2. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    FOR v_item IN 
        SELECT (x.value->>'producto_id')::uuid AS prod_id,
               (x.value->>'cantidad')::integer AS cant,
               (x.value->>'costo_unitario')::numeric(12, 2) AS costo
        FROM jsonb_array_elements(p_items) AS x(value)
        ORDER BY prod_id ASC
    LOOP
        -- Bloquear y verificar el producto
        SELECT precio_venta INTO v_precio_venta
        FROM productos
        WHERE id = v_item.prod_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con ID % no existe en el catálogo.', v_item.prod_id
                USING ERRCODE = 'P0005';
        END IF;

        -- Validar que el costo de compra no sea mayor al precio de venta actual
        IF v_item.costo > v_precio_venta THEN
            RAISE EXCEPTION 'El costo de compra (%) no puede ser mayor al precio de venta actual (%) para el producto con ID %. Ajuste el precio de venta primero.',
                v_item.costo, v_precio_venta, v_item.prod_id
                USING ERRCODE = 'P0004';
        END IF;

        -- Insertar detalle de la compra (esto disparará el trigger tg_controlar_stock_compra)
        INSERT INTO detalles_compras (compra_id, producto_id, cantidad, costo_unitario, subtotal)
        VALUES (v_compra_id, v_item.prod_id, v_item.cant, v_item.costo, v_item.cant * v_item.costo);

        -- Actualizar el costo del producto en el catálogo
        UPDATE productos
        SET precio_compra = v_item.costo
        WHERE id = v_item.prod_id;
    END LOOP;

    RETURN v_compra_id;
END;
$$;

-- 3. Procedimiento Almacenado: cancelar_compra
--    Realiza la baja lógica de la compra, revierte el stock de los productos adquiridos
--    y registra la transacción en historial_stock, previniendo stock negativo.
CREATE OR REPLACE FUNCTION cancelar_compra(
    p_compra_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_estado varchar(30);
    v_item record;
    v_stock_actual integer;
BEGIN
    -- 1. Verificar existencia y estado de la compra con bloqueo
    SELECT estado_compra INTO v_estado
    FROM compras
    WHERE id = p_compra_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La compra especificada no existe.'
            USING ERRCODE = 'P0005';
    END IF;

    IF v_estado = 'Cancelada' THEN
        RAISE EXCEPTION 'La compra ya se encuentra cancelada.'
            USING ERRCODE = 'P0006';
    END IF;

    -- 2. Cambiar estado a Cancelada
    UPDATE compras
    SET estado_compra = 'Cancelada'
    WHERE id = p_compra_id;

    -- 3. Iterar sobre el detalle de compras para revertir el stock de forma segura
    FOR v_item IN
        SELECT producto_id, cantidad
        FROM detalles_compras
        WHERE compra_id = p_compra_id
        ORDER BY producto_id ASC
    LOOP
        -- Bloquear el producto antes de modificar su stock
        SELECT stock_actual INTO v_stock_actual
        FROM productos
        WHERE id = v_item.producto_id
        FOR UPDATE;

        -- Validar que al restar no quede stock negativo
        IF v_stock_actual < v_item.cantidad THEN
            RAISE EXCEPTION 'No se puede cancelar la compra. El stock actual (%) es menor que la cantidad comprada (%) para el producto con ID %.',
                v_stock_actual, v_item.cantidad, v_item.producto_id
                USING ERRCODE = 'P0007';
        END IF;

        -- Restar la cantidad comprada del stock actual
        UPDATE productos
        SET stock_actual = stock_actual - v_item.cantidad
        WHERE id = v_item.producto_id;

        -- Registrar el movimiento de reversión en historial_stock como 'Cancelacion Compra'
        INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        VALUES (v_item.producto_id, -v_item.cantidad, 'Cancelacion Compra', p_compra_id, 'Cancelación de compra registrada');
    END LOOP;

    RETURN p_compra_id;
END;
$$;
