-- =============================================================================
-- SCRIPT DE PARCHE: Solución RLS historial_stock (fix_rls_historial_stock.sql)
-- Idioma: Español
-- =============================================================================

-- 1. Función para controlar el stock al realizar una venta
CREATE OR REPLACE FUNCTION fn_controlar_stock_venta()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
BEGIN
    -- Obtener información actual del producto con bloqueo para evitar condiciones de carrera (Race Conditions)
    SELECT stock_actual, stock_minimo, nombre 
    INTO v_stock_actual, v_stock_minimo, v_nombre_prod
    FROM productos 
    WHERE id = new.producto_id
    FOR UPDATE;

    -- Validar disponibilidad de stock
    IF v_stock_actual < new.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, solicitado: %', 
            v_nombre_prod, v_stock_actual, new.cantidad
            USING errcode = 'P0001'; -- Código de error personalizado para inventario insuficiente
    END IF;

    -- Descontar el stock del producto
    UPDATE productos 
    SET stock_actual = stock_actual - new.cantidad
    WHERE id = new.producto_id;

    -- Registrar movimiento en el historial de stock
    INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
    VALUES (new.producto_id, -new.cantidad, 'Venta', new.venta_id);

    RETURN new;
END;
$$;

-- 2. Función para controlar el stock al realizar una compra
CREATE OR REPLACE FUNCTION fn_controlar_stock_compra()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nombre_prod varchar(150);
BEGIN
    -- Bloquear la fila del producto para evitar condiciones de carrera (Race Conditions)
    -- en actualizaciones concurrentes de stock.
    SELECT nombre 
    INTO v_nombre_prod
    FROM productos 
    WHERE id = new.producto_id
    FOR UPDATE;

    -- Incrementar el stock actual del producto con la cantidad comprada
    UPDATE productos 
    SET stock_actual = stock_actual + new.cantidad
    WHERE id = new.producto_id;

    -- Registrar el movimiento de tipo 'Compra' en el historial de stock
    INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
    VALUES (new.producto_id, new.cantidad, 'Compra', new.compra_id);

    RETURN new;
END;
$$;

-- 3. Función para revertir stock y deuda al cancelar una venta
CREATE OR REPLACE FUNCTION fn_revertir_venta_cancelada()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
BEGIN
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    IF old.estado_venta <> 'Cancelada' AND new.estado_venta = 'Cancelada' THEN
        
        -- 1. Iterar sobre todos los productos que forman parte de la venta ordenados por producto_id para prevenir deadlocks
        FOR v_item IN 
            SELECT producto_id, cantidad 
            FROM detalles_ventas 
            WHERE venta_id = new.id
            ORDER BY producto_id ASC
        LOOP
            -- Bloquear el producto antes de modificar su stock para evitar race conditions
            PERFORM id FROM productos WHERE id = v_item.producto_id FOR UPDATE;

            -- Devolver (sumar) las cantidades vendidas al stock_actual
            UPDATE productos 
            SET stock_actual = stock_actual + v_item.cantidad
            WHERE id = v_item.producto_id;

            -- Registrar el movimiento de reversión en historial_stock como 'Cancelacion Venta'
            INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
            VALUES (v_item.producto_id, v_item.cantidad, 'Cancelacion Venta', new.id);
        END LOOP;

        -- 2. Si la venta original fue bajo modalidad de 'Credito', ajustar la deuda del cliente
        IF new.tipo_pago = 'Credito' THEN
            -- Bloquear la fila del cliente para garantizar la consistencia en el saldo
            PERFORM id FROM clientes WHERE id = new.cliente_id FOR UPDATE;

            -- Restar el total de la venta del saldo deudor, asegurando que no descienda de 0
            UPDATE clientes 
            SET saldo_deudor = greatest(0.00, saldo_deudor - new.total)
            WHERE id = new.cliente_id;
        END IF;

    END IF;

    RETURN new;
END;
$$;
