-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Módulo de Compras (migracion_optimizacion_abastecimiento.sql)
-- Propósito: 1. Optimizar y centralizar validaciones de reabastecimiento en la BD.
--            2. Validar que el producto a abastecer esté en estado 'Activo' (P0009).
-- Idioma: Español
-- =============================================================================

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
    v_estado varchar(30);
    v_nombre_producto varchar(150);
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
        -- Bloquear y verificar el producto en caliente
        SELECT precio_venta, estado, nombre INTO v_precio_venta, v_estado, v_nombre_producto
        FROM productos
        WHERE id = v_item.prod_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con ID % no existe en el catálogo.', v_item.prod_id
                USING ERRCODE = 'P0005';
        END IF;

        -- Validar que el producto esté activo para reabastecimiento
        IF v_estado <> 'Activo' THEN
            RAISE EXCEPTION 'El producto "%" no está activo para reabastecimiento.', v_nombre_producto
                USING ERRCODE = 'P0009';
        END IF;

        -- Validar que el costo de compra no sea mayor al precio de venta actual
        IF v_item.costo > v_precio_venta THEN
            RAISE EXCEPTION 'El costo de compra (%) no puede ser mayor al precio de venta actual (%) para el producto "%". Ajuste el precio de venta primero.',
                v_item.costo, v_precio_venta, v_nombre_producto
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

COMMENT ON FUNCTION registrar_reabastecimiento IS 'Registra una compra y actualiza el costo de los productos correspondientes con validaciones de negocio en la BD.';
