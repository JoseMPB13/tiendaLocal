-- =============================================================================
-- MIGRACIÓN: migracion_bitacora_fix.sql
-- Propósito: Corregir el CHECK constraint de historial_stock para incluir todos
--            los valores de tipo_movimiento insertados por las stored procedures
--            activas, y poblar datos de prueba con fechas del día actual (UTC).
-- Ejecutar: Supabase SQL Editor (una vez por entorno).
-- =============================================================================

-- 1. AMPLIAR CHECK CONSTRAINT DE historial_stock
-- -----------------------------------------------------------------------------
-- El constraint previo solo aceptaba 'Venta', 'Ajuste', 'Cancelacion Venta'.
-- Las stored procedures de edición de ventas y reabastecimiento de compras
-- insertan también 'Ajuste Edicion', 'Compra' y 'Cancelacion Compra'.
-- Esto provocaba que los INSERTs fallaran silenciosamente y la tabla quedara
-- vacía para los períodos filtrados.

ALTER TABLE historial_stock DROP CONSTRAINT IF EXISTS historial_stock_tipo_movimiento_check;
ALTER TABLE historial_stock DROP CONSTRAINT IF EXISTS check_tipo_movimiento;

ALTER TABLE historial_stock ADD CONSTRAINT check_tipo_movimiento
    CHECK (tipo_movimiento IN (
        'Venta',
        'Ajuste',
        'Cancelacion Venta',
        'Compra',
        'Cancelacion Compra',
        'Ajuste Edicion'
    ));


-- 2. POBLACIÓN DE DATOS DE PRUEBA DEL DÍA ACTUAL (UTC)
-- -----------------------------------------------------------------------------
-- Garantiza que la pestaña "Diario" de la Bitácora muestre al menos algunos
-- registros al abrir la vista por primera vez, facilitando la verificación visual.
-- Se insertan movimientos vinculados a los primeros productos existentes.

DO $$
DECLARE
    v_prod_id  uuid;
    v_count    integer;
BEGIN
    -- Solo poblar si hay muy pocos registros en el día de hoy en UTC
    SELECT count(*) INTO v_count
    FROM historial_stock
    WHERE fecha_movimiento >= date_trunc('day', now() AT TIME ZONE 'UTC');

    IF v_count < 3 THEN
        -- Tomar el primer producto activo disponible
        SELECT id INTO v_prod_id FROM productos WHERE estado = 'Activo' LIMIT 1;

        IF v_prod_id IS NOT NULL THEN
            INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, motivo, fecha_movimiento)
            VALUES
                (v_prod_id, -2, 'Venta',             'Venta de prueba hoy (seed Bitácora)',       now()),
                (v_prod_id,  5, 'Ajuste',             'Ajuste de inventario hoy (seed Bitácora)',  now()),
                (v_prod_id,  2, 'Cancelacion Venta',  'Anulación de venta hoy (seed Bitácora)',    now());

            RAISE NOTICE 'Datos de prueba de historial_stock insertados para el producto %', v_prod_id;
        ELSE
            RAISE NOTICE 'No se encontró ningún producto activo para insertar datos de prueba.';
        END IF;
    ELSE
        RAISE NOTICE 'Ya existen % registros de hoy en historial_stock. No se insertan datos de prueba.', v_count;
    END IF;
END $$;
