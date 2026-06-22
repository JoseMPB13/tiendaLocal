-- =============================================================================
-- SCRIPT DE PARCHE: Conectar Clientes Activos en Dashboard (fix_dashboard_clientes_activos.sql)
-- Idioma: Español
-- =============================================================================

CREATE OR REPLACE FUNCTION obtener_metricas_dashboard()
RETURNS jsonb AS $$
DECLARE
    v_total_ventas numeric(12, 2);
    v_cantidad_transacciones bigint;
    v_deudas_activas_calle numeric(12, 2);
    v_efectividad_delivery_porcentaje numeric(5, 2);
    v_clientes_activos bigint;
    v_ventas_por_categoria jsonb;
BEGIN
    -- 1. Suma total vendida y conteo (solo ventas Completadas)
    SELECT coalesce(sum(total), 0.00), count(*)
    INTO v_total_ventas, v_cantidad_transacciones
    FROM ventas
    WHERE estado_venta = 'Completada';

    -- 2. Deudas activas en la calle (suma de saldo deudor)
    SELECT coalesce(sum(saldo_deudor), 0.00)
    INTO v_deudas_activas_calle
    FROM clientes
    WHERE saldo_deudor > 0;

    -- 3. Efectividad del delivery (Porcentaje de envíos Entregados vs totales)
    SELECT coalesce(
        (count(*) filter (where estado_envio = 'Entregado')::numeric / nullif(count(*), 0) * 100),
        0.00
    )
    INTO v_efectividad_delivery_porcentaje
    FROM envios;

    -- 4. Cantidad de clientes activos
    SELECT count(*)
    INTO v_clientes_activos
    FROM clientes
    WHERE estado = 'Activo';

    -- 5. Distribución de ventas por categoría (excluye las que tienen 0.00 de ventas)
    SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
    INTO v_ventas_por_categoria
    FROM (
        SELECT c.nombre AS name, sum(dv.subtotal)::numeric(12, 2) as valor
        FROM detalles_ventas dv
        JOIN productos p ON p.id = dv.producto_id
        JOIN categorias c ON c.id = p.categoria_id
        JOIN ventas v ON v.id = dv.venta_id
        WHERE v.estado_venta = 'Completada'
        GROUP BY c.nombre
    ) t;

    -- Retornar el objeto JSON consolidado
    RETURN jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'deudas_activas_calle', v_deudas_activas_calle,
        'efectividad_delivery_porcentaje', v_efectividad_delivery_porcentaje,
        'clientes_activos', v_clientes_activos,
        'ventas_por_categoria', v_ventas_por_categoria
    );
END;
$$ LANGUAGE plpgsql;
