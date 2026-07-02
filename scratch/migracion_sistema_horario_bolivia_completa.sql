-- =============================================================================
-- MIGRACIÓN: Unificación completa del sistema a zona horaria America/La_Paz
-- Propósito: Aplicar en la base de datos activa los cambios de horario boliviano
--            en funciones RPC críticas del dashboard, bitácora de inventario y
--            validaciones de anulación de ventas del mismo día.
-- Idioma: Español
-- =============================================================================

-- 1. Zona horaria por defecto de la base de datos
ALTER DATABASE postgres SET timezone TO 'America/La_Paz';

-- 2. Movimientos de stock agrupados (bitácora inventario) en hora Bolivia
create or replace function obtener_movimientos_stock_agrupados(p_periodo text)
returns table (
    periodo_fecha timestamp with time zone,
    producto_id uuid,
    producto_nombre varchar(150),
    tipo_movimiento varchar(50),
    total_entradas numeric,
    total_salidas numeric,
    balance_neto numeric,
    cantidad_movimientos bigint
)
language plpgsql
security definer
as $$
declare
    v_trunc_period   text;
    v_inicio_periodo timestamptz;
    v_fin_periodo    timestamptz;
begin
    if p_periodo = 'dia' then
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
        v_fin_periodo    := v_inicio_periodo + interval '1 day';
    elsif p_periodo = 'semana' then
        v_trunc_period   := 'week';
        v_inicio_periodo := date_trunc('week', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
        v_fin_periodo    := v_inicio_periodo + interval '1 week';
    elsif p_periodo = 'mes' then
        v_trunc_period   := 'month';
        v_inicio_periodo := date_trunc('month', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
        v_fin_periodo    := v_inicio_periodo + interval '1 month';
    else
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
        v_fin_periodo    := v_inicio_periodo + interval '1 day';
    end if;

    return query
    select
        date_trunc(v_trunc_period, hs.fecha_movimiento)::timestamp with time zone as periodo_fecha,
        hs.producto_id,
        p.nombre as producto_nombre,
        hs.tipo_movimiento,
        coalesce(sum(case when hs.cantidad_cambio > 0 then hs.cantidad_cambio else 0 end), 0)::numeric as total_entradas,
        coalesce(sum(case when hs.cantidad_cambio < 0 then hs.cantidad_cambio else 0 end), 0)::numeric as total_salidas,
        coalesce(sum(hs.cantidad_cambio), 0)::numeric as balance_neto,
        count(*)::bigint as cantidad_movimientos
    from historial_stock hs
    join productos p on p.id = hs.producto_id
    where hs.fecha_movimiento >= v_inicio_periodo
      and hs.fecha_movimiento <  v_fin_periodo
    group by 1, hs.producto_id, p.nombre, hs.tipo_movimiento
    order by 1 desc, p.nombre asc;
end;
$$;

-- 3. Dashboard con filtros de fecha en hora Bolivia
-- (Ejecutar también scratch/migracion_dashboard_fecha_bolivia.sql si aún no se aplicó)
