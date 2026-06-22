-- =============================================================================
-- PARCHE DE MIGRACIÓN: OPTIMIZACIÓN DEL DASHBOARD DE REPORTES (Supabase/PostgreSQL)
-- Descripción: Script de ejecución única para el SQL Editor de Supabase.
-- Idioma: Español
-- =============================================================================

-- =============================================================================
-- FUNCIÓN: obtener_metricas_dashboard
-- DESCRIPCIÓN: Consolida en una única consulta de base de datos las métricas
--              financieras, recuentos de ventas, saldos deudores, efectividad
--              del delivery y distribución de ingresos por categoría del negocio.
-- PARÁMETROS: Ninguno.
-- RETORNO: jsonb
-- =============================================================================
create or replace function obtener_metricas_dashboard()
returns jsonb as $$
declare
    v_total_ventas numeric(12, 2);
    v_cantidad_transacciones bigint;
    v_deudas_activas_calle numeric(12, 2);
    v_efectividad_delivery_porcentaje numeric(5, 2);
    v_ventas_por_categoria jsonb;
begin
    -- 1. Suma total vendida y conteo (solo ventas Completadas)
    select coalesce(sum(total), 0.00), count(*)
    into v_total_ventas, v_cantidad_transacciones
    from ventas
    where estado_venta = 'Completada';

    -- 2. Deudas activas en la calle (suma de saldo deudor)
    select coalesce(sum(saldo_deudor), 0.00)
    into v_deudas_activas_calle
    from clientes
    where saldo_deudor > 0;

    -- 3. Efectividad del delivery (Porcentaje de envíos Entregados vs totales)
    select coalesce(
        (count(*) filter (where estado_envio = 'Entregado')::numeric / nullif(count(*), 0) * 100),
        0.00
    )
    into v_efectividad_delivery_porcentaje
    from envios;

    -- 4. Distribución de ventas por categoría (excluye las que tienen 0.00 de ventas)
    select coalesce(jsonb_agg(t), '[]'::jsonb)
    into v_ventas_por_categoria
    from (
        select c.nombre as name, sum(dv.subtotal)::numeric(12, 2) as valor
        from detalles_ventas dv
        join productos p on p.id = dv.producto_id
        join categorias c on c.id = p.categoria_id
        join ventas v on v.id = dv.venta_id
        where v.estado_venta = 'Completada'
        group by c.nombre
    ) t;

    -- Retornar el objeto JSON consolidado
    return jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'deudas_activas_calle', v_deudas_activas_calle,
        'efectividad_delivery_porcentaje', v_efectividad_delivery_porcentaje,
        'ventas_por_categoria', v_ventas_por_categoria
    );
end;
$$ language plpgsql;
