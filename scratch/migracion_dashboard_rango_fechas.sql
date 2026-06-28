-- MIGRACIÓN: Módulo Dashboard - Rango de Fechas y Períodos Espejo
-- Propósito: Rediseñar la función RPC obtener_metricas_dashboard para aceptar dos parámetros de fecha opcionales.
-- Idioma: Español

-- Eliminar firmas anteriores para evitar ambigüedades
drop function if exists obtener_metricas_dashboard(date);
drop function if exists obtener_metricas_dashboard();
drop function if exists obtener_metricas_dashboard(date, date);

-- Crear función rediseñada
create or replace function obtener_metricas_dashboard(p_fecha_inicio date default null, p_fecha_fin date default null)
returns jsonb as $$
declare
    v_total_ventas numeric(12, 2);
    v_cantidad_transacciones bigint;
    v_deudas_activas_calle numeric(12, 2);
    v_efectividad_delivery_porcentaje numeric(5, 2);
    v_clientes_activos bigint;
    v_ventas_por_categoria jsonb;
    
    -- Variables para tendencias
    v_total_actual numeric(12, 2);
    v_total_anterior numeric(12, 2);
    v_tendencia_ventas numeric(5, 2);
    v_duracion_dias integer;
    v_inicio_anterior date;
    v_fin_anterior date;
begin
    -- 1. Suma total vendida y conteo (solo ventas Completadas)
    select coalesce(sum(total), 0.00), count(*)
    into v_total_ventas, v_cantidad_transacciones
    from ventas
    where estado_venta = 'Completada'
      and (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and fecha_venta::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and fecha_venta::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and fecha_venta::date between p_fecha_inicio and p_fecha_fin)
      );

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
    from envios
    where (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and fecha_creacion::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and fecha_creacion::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and fecha_creacion::date between p_fecha_inicio and p_fecha_fin)
      );

    -- 4. Cantidad de clientes activos
    select count(*)
    into v_clientes_activos
    from clientes
    where estado = 'Activo';

    -- 5. Distribución de ventas por categoría (excluye las que tienen 0.00 de ventas)
    select coalesce(jsonb_agg(t), '[]'::jsonb)
    into v_ventas_por_categoria
    from (
        select c.nombre as name, sum(dv.subtotal)::numeric(12, 2) as valor
        from detalles_ventas dv
        join productos p on p.id = dv.producto_id
        join categorias c on c.id = p.categoria_id
        join ventas v on v.id = dv.venta_id
        where v.estado_venta = 'Completada'
          and (
            (p_fecha_inicio is null and p_fecha_fin is null) or
            (p_fecha_inicio is not null and p_fecha_fin is null and v.fecha_venta::date = p_fecha_inicio) or
            (p_fecha_inicio is null and p_fecha_fin is not null and v.fecha_venta::date = p_fecha_fin) or
            (p_fecha_inicio is not null and p_fecha_fin is not null and v.fecha_venta::date between p_fecha_inicio and p_fecha_fin)
          )
        group by c.nombre
    ) t;

    -- 6 y 7. Ventas del período actual y anterior para tendencia
    if p_fecha_inicio is not null or p_fecha_fin is not null then
        -- Determinar fechas efectivas de inicio y fin del periodo actual
        declare
            v_actual_inicio date := coalesce(p_fecha_inicio, p_fecha_fin);
            v_actual_fin date := coalesce(p_fecha_fin, p_fecha_inicio);
        begin
            v_duracion_dias := v_actual_fin - v_actual_inicio + 1;
            v_inicio_anterior := v_actual_inicio - v_duracion_dias;
            v_fin_anterior := v_actual_fin - v_duracion_dias;

            -- Ventas del periodo actual
            select coalesce(sum(total), 0.00)
            into v_total_actual
            from ventas
            where estado_venta = 'Completada'
              and fecha_venta::date between v_actual_inicio and v_actual_fin;

            -- Ventas del periodo espejo anterior de igual duración exacta
            select coalesce(sum(total), 0.00)
            into v_total_anterior
            from ventas
            where estado_venta = 'Completada'
              and fecha_venta::date between v_inicio_anterior and v_fin_anterior;
        end;
    else
        -- Ventas del período actual (últimos 30 días)
        select coalesce(sum(total), 0.00)
        into v_total_actual
        from ventas
        where estado_venta = 'Completada'
          and fecha_venta >= timezone('utc'::text, now()) - interval '30 days';

        -- Ventas del período anterior (días 31 al 60 hacia atrás)
        select coalesce(sum(total), 0.00)
        into v_total_anterior
        from ventas
        where estado_venta = 'Completada'
          and fecha_venta >= timezone('utc'::text, now()) - interval '60 days'
          and fecha_venta < timezone('utc'::text, now()) - interval '30 days';
    end if;

    -- 8. Cálculo de tendencia porcentual
    if v_total_anterior = 0.00 then
        if v_total_actual > 0.00 then
            v_tendencia_ventas := 100.00;
        else
            v_tendencia_ventas := 0.00;
        end if;
    else
        v_tendencia_ventas := round(((v_total_actual - v_total_anterior) / v_total_anterior * 100.00)::numeric, 2);
    end if;

    -- Retornar el objeto JSON consolidado
    return jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'deudas_activas_calle', v_deudas_activas_calle,
        'efectividad_delivery_porcentaje', v_efectividad_delivery_porcentaje,
        'clientes_activos', v_clientes_activos,
        'ventas_por_categoria', v_ventas_por_categoria,
        'tendencia_ventas', v_tendencia_ventas
    );
end;
$$ language plpgsql;
