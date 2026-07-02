-- =============================================================================
-- MIGRACIÓN: Filtros de fecha del dashboard en zona horaria America/La_Paz
-- Propósito: Corregir el desfase de un día en obtener_metricas_dashboard al
--            comparar timestamps UTC con fechas locales de Bolivia.
-- Aplicar en: Base de datos activa de Supabase/PostgreSQL
-- Idioma: Español
-- =============================================================================

drop function if exists obtener_metricas_dashboard(date);
drop function if exists obtener_metricas_dashboard();
drop function if exists obtener_metricas_dashboard(date, date);

create or replace function obtener_metricas_dashboard(p_fecha_inicio date default null, p_fecha_fin date default null)
returns jsonb as $$
declare
    v_total_ventas numeric(12, 2);
    v_cantidad_transacciones bigint;
    v_deudas_activas_calle numeric(12, 2);
    v_efectividad_delivery_porcentaje numeric(5, 2);
    v_clientes_activos bigint;
    v_ventas_por_categoria jsonb;
    v_pedidos_delivery bigint;
    v_productos_vendidos bigint;
    v_total_actual numeric(12, 2);
    v_total_anterior numeric(12, 2);
    v_tendencia_ventas numeric(5, 2);
    v_duracion_dias integer;
    v_inicio_anterior date;
    v_fin_anterior date;
begin
    select coalesce(sum(total), 0.00), count(*)
    into v_total_ventas, v_cantidad_transacciones
    from ventas
    where estado_venta = 'Completada'
      and (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and (fecha_venta at time zone 'America/La_Paz')::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and (fecha_venta at time zone 'America/La_Paz')::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and (fecha_venta at time zone 'America/La_Paz')::date between p_fecha_inicio and p_fecha_fin)
      );

    select coalesce(sum(saldo_deudor), 0.00)
    into v_deudas_activas_calle
    from clientes
    where saldo_deudor > 0;

    select coalesce(
        (count(*) filter (where estado_envio = 'Entregado')::numeric / nullif(count(*), 0) * 100),
        0.00
    )
    into v_efectividad_delivery_porcentaje
    from envios
    where (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and (fecha_creacion at time zone 'America/La_Paz')::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and (fecha_creacion at time zone 'America/La_Paz')::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and (fecha_creacion at time zone 'America/La_Paz')::date between p_fecha_inicio and p_fecha_fin)
      );

    select count(*)
    into v_pedidos_delivery
    from envios
    where (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and (fecha_creacion at time zone 'America/La_Paz')::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and (fecha_creacion at time zone 'America/La_Paz')::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and (fecha_creacion at time zone 'America/La_Paz')::date between p_fecha_inicio and p_fecha_fin)
      );

    select count(*)
    into v_clientes_activos
    from clientes
    where estado = 'Activo';

    select coalesce(sum(dv.cantidad), 0)
    into v_productos_vendidos
    from detalles_ventas dv
    join ventas v on v.id = dv.venta_id
    where v.estado_venta = 'Completada'
      and (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and (v.fecha_venta at time zone 'America/La_Paz')::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and (v.fecha_venta at time zone 'America/La_Paz')::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and (v.fecha_venta at time zone 'America/La_Paz')::date between p_fecha_inicio and p_fecha_fin)
      );

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
            (p_fecha_inicio is not null and p_fecha_fin is null and (v.fecha_venta at time zone 'America/La_Paz')::date = p_fecha_inicio) or
            (p_fecha_inicio is null and p_fecha_fin is not null and (v.fecha_venta at time zone 'America/La_Paz')::date = p_fecha_fin) or
            (p_fecha_inicio is not null and p_fecha_fin is not null and (v.fecha_venta at time zone 'America/La_Paz')::date between p_fecha_inicio and p_fecha_fin)
          )
        group by c.nombre
    ) t;

    if p_fecha_inicio is not null or p_fecha_fin is not null then
        declare
            v_actual_inicio date := coalesce(p_fecha_inicio, p_fecha_fin);
            v_actual_fin date := coalesce(p_fecha_fin, p_fecha_inicio);
        begin
            v_duracion_dias := v_actual_fin - v_actual_inicio + 1;
            v_inicio_anterior := v_actual_inicio - v_duracion_dias;
            v_fin_anterior := v_actual_fin - v_duracion_dias;

            select coalesce(sum(total), 0.00)
            into v_total_actual
            from ventas
            where estado_venta = 'Completada'
              and (fecha_venta at time zone 'America/La_Paz')::date between v_actual_inicio and v_actual_fin;

            select coalesce(sum(total), 0.00)
            into v_total_anterior
            from ventas
            where estado_venta = 'Completada'
              and (fecha_venta at time zone 'America/La_Paz')::date between v_inicio_anterior and v_fin_anterior;
        end;
    else
        select coalesce(sum(total), 0.00)
        into v_total_actual
        from ventas
        where estado_venta = 'Completada'
          and fecha_venta >= timezone('utc'::text, now()) - interval '30 days';

        select coalesce(sum(total), 0.00)
        into v_total_anterior
        from ventas
        where estado_venta = 'Completada'
          and fecha_venta >= timezone('utc'::text, now()) - interval '60 days'
          and fecha_venta < timezone('utc'::text, now()) - interval '30 days';
    end if;

    if v_total_anterior = 0.00 then
        if v_total_actual > 0.00 then
            v_tendencia_ventas := 100.00;
        else
            v_tendencia_ventas := 0.00;
        end if;
    else
        v_tendencia_ventas := round(((v_total_actual - v_total_anterior) / v_total_anterior * 100.00)::numeric, 2);
    end if;

    return jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'deudas_activas_calle', v_deudas_activas_calle,
        'efectividad_delivery_porcentaje', v_efectividad_delivery_porcentaje,
        'clientes_activos', v_clientes_activos,
        'pedidos_delivery', v_pedidos_delivery,
        'productos_vendidos', v_productos_vendidos,
        'ventas_por_categoria', v_ventas_por_categoria,
        'tendencia_ventas', v_tendencia_ventas
    );
end;
$$ language plpgsql;
