-- =============================================================================
-- MIGRACIÓN: migracion_bitacora_rls_fix.sql
-- Propósito: Corrección definitiva del módulo de Bitácora de Inventario.
--
-- PROBLEMAS RESUELTOS:
--   1. historial_stock tiene RLS habilitado pero SIN política de INSERT.
--      Los triggers de ventas (fn_controlar_stock_venta, fn_revertir_venta_cancelada)
--      intentaban insertar pero el RLS los bloqueaba silenciosamente. La tabla
--      quedaba vacía aunque las ventas se registraran con éxito.
--
--   2. obtener_movimientos_stock_agrupados(p_periodo) no tenía cláusula WHERE
--      de rango de fechas — retornaba toda la historia o vacío si la tabla
--      estaba sin datos, ignorando completamente el período seleccionado.
--
-- EJECUTAR: Supabase SQL Editor (una sola vez por entorno).
-- =============================================================================


-- =============================================================================
-- PASO 1: POLÍTICA RLS DE INSERT PARA historial_stock
-- =============================================================================
-- Sin esta política, el RLS de Supabase bloquea TODOS los INSERTs a esta tabla
-- desde triggers y funciones, incluso los que usan SECURITY DEFINER.

DROP POLICY IF EXISTS "Permitir insert de historial_stock a autenticados" ON historial_stock;

CREATE POLICY "Permitir insert de historial_stock a autenticados"
ON historial_stock
FOR INSERT
TO anon, authenticated
WITH CHECK (true);


-- =============================================================================
-- PASO 2: CORRECCIÓN DE LA FUNCIÓN RPC obtener_movimientos_stock_agrupados
-- =============================================================================
-- La versión anterior SOLO agrupaba por granularidad temporal pero NO filtraba
-- por el período activo (hoy, semana actual, mes actual). Ahora se agregan las
-- variables v_inicio_periodo y v_fin_periodo para restringir el resultado al
-- período seleccionado por el usuario en la UI.
-- Se agrega también SECURITY DEFINER para que el SELECT no sea bloqueado
-- por el RLS de historial_stock en el contexto de la sesión authenticated.

CREATE OR REPLACE FUNCTION obtener_movimientos_stock_agrupados(p_periodo text)
RETURNS TABLE (
    periodo_fecha       timestamp with time zone,
    producto_id         uuid,
    producto_nombre     varchar(150),
    tipo_movimiento     varchar(50),
    total_entradas      numeric,
    total_salidas       numeric,
    balance_neto        numeric,
    cantidad_movimientos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trunc_period   text;
    v_inicio_periodo timestamptz;
    v_fin_periodo    timestamptz;
BEGIN
    -- Calcular inicio y fin del período activo en UTC
    IF p_periodo = 'dia' THEN
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day',   now() AT TIME ZONE 'UTC');
        v_fin_periodo    := v_inicio_periodo + INTERVAL '1 day';

    ELSIF p_periodo = 'semana' THEN
        v_trunc_period   := 'week';
        v_inicio_periodo := date_trunc('week',  now() AT TIME ZONE 'UTC');
        v_fin_periodo    := v_inicio_periodo + INTERVAL '1 week';

    ELSIF p_periodo = 'mes' THEN
        v_trunc_period   := 'month';
        v_inicio_periodo := date_trunc('month', now() AT TIME ZONE 'UTC');
        v_fin_periodo    := v_inicio_periodo + INTERVAL '1 month';

    ELSE
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day',   now() AT TIME ZONE 'UTC');
        v_fin_periodo    := v_inicio_periodo + INTERVAL '1 day';
    END IF;

    RETURN QUERY
    SELECT
        date_trunc(v_trunc_period, hs.fecha_movimiento)::timestamp with time zone AS periodo_fecha,
        hs.producto_id,
        p.nombre AS producto_nombre,
        hs.tipo_movimiento,
        COALESCE(SUM(CASE WHEN hs.cantidad_cambio > 0 THEN hs.cantidad_cambio ELSE 0 END), 0)::numeric AS total_entradas,
        COALESCE(SUM(CASE WHEN hs.cantidad_cambio < 0 THEN hs.cantidad_cambio ELSE 0 END), 0)::numeric AS total_salidas,
        COALESCE(SUM(hs.cantidad_cambio), 0)::numeric                                                   AS balance_neto,
        COUNT(*)::bigint                                                                                  AS cantidad_movimientos
    FROM historial_stock hs
    JOIN productos p ON p.id = hs.producto_id
    WHERE hs.fecha_movimiento >= v_inicio_periodo   -- Solo el período activo
      AND hs.fecha_movimiento <  v_fin_periodo       -- Límite superior exclusivo
    GROUP BY 1, hs.producto_id, p.nombre, hs.tipo_movimiento
    ORDER BY 1 DESC, p.nombre ASC;
END;
$$;

COMMENT ON FUNCTION obtener_movimientos_stock_agrupados(text)
    IS 'Retorna movimientos de stock del período activo (dia/semana/mes) desde ahora en UTC, con SECURITY DEFINER para bypass RLS.';


-- =============================================================================
-- PASO 3: SEED DE DATOS DE PRUEBA DEL DÍA ACTUAL (UTC)
-- =============================================================================
-- Verifica que existan al menos 3 registros del día de hoy en historial_stock.
-- Si no los hay, inserta movimientos de demostración en el primer producto activo
-- para que la pestaña "Diario" muestre resultados inmediatamente tras la migración.

DO $$
DECLARE
    v_prod_id  uuid;
    v_count    integer;
BEGIN
    SELECT count(*) INTO v_count
    FROM historial_stock
    WHERE fecha_movimiento >= date_trunc('day', now() AT TIME ZONE 'UTC');

    IF v_count < 3 THEN
        SELECT id INTO v_prod_id
        FROM productos
        WHERE estado = 'Activo'
        ORDER BY nombre ASC
        LIMIT 1;

        IF v_prod_id IS NOT NULL THEN
            INSERT INTO historial_stock
                (producto_id, cantidad_cambio, tipo_movimiento, motivo, fecha_movimiento)
            VALUES
                (v_prod_id, -2, 'Venta',           'Venta de prueba — seed Bitácora',            now()),
                (v_prod_id,  5, 'Ajuste',           'Ajuste de inventario — seed Bitácora',       now()),
                (v_prod_id,  2, 'Cancelacion Venta','Anulación de venta de prueba — seed Bitácora', now());

            RAISE NOTICE 'Seed: 3 movimientos insertados en historial_stock para producto %', v_prod_id;
        ELSE
            RAISE NOTICE 'Seed omitido: no se encontró ningún producto activo.';
        END IF;
    ELSE
        RAISE NOTICE 'Seed omitido: ya existen % registros de hoy en historial_stock.', v_count;
    END IF;
END $$;
