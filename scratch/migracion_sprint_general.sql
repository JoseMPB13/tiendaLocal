-- =============================================================================
-- PARCHE DE MIGRACIÓN: SPRINT GENERAL (migracion_sprint_general.sql)
-- Lógica: Supabase / PostgreSQL
-- Idioma: Español
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. SOLUCIÓN AL BUG CRÍTICO 22P02: Eliminar funciones sobrecargadas conflictivas
--    Esto elimina las firmas antiguas (5 y 6 parámetros) y evita la ambigüedad en PostgREST.
-- -----------------------------------------------------------------------------
drop function if exists registrar_venta_contado(uuid, uuid, varchar, numeric, varchar, jsonb);
drop function if exists registrar_venta_credito(uuid, uuid, varchar, numeric, jsonb);

-- -----------------------------------------------------------------------------
-- 2. AUTOMATIZACIÓN DE CÓDIGO DE FACTURA
--    Crea la secuencia y el disparador BEFORE INSERT en la tabla ventas.
-- -----------------------------------------------------------------------------
create sequence if not exists seq_codigo_factura;

create or replace function fn_autogenerar_codigo_factura()
returns trigger as $$
declare
    v_fecha varchar(8);
begin
    if new.codigo_factura is null or new.codigo_factura = '' or new.codigo_factura = 'Autogenerado' then
        -- Formato: FAC-YYYYMMDD-XXXXX
        v_fecha := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
        new.codigo_factura := 'FAC-' || v_fecha || '-' || lpad(nextval('seq_codigo_factura')::text, 5, '0');
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_ventas_before_insert
before insert on ventas
for each row
execute function fn_autogenerar_codigo_factura();

-- -----------------------------------------------------------------------------
-- 3. AUDITORÍA DEL DASHBOARD (Tendencias de Venta Dinámicas)
--    Redefine la función para comparar los últimos 30 días con los 30 días previos.
-- -----------------------------------------------------------------------------
create or replace function obtener_metricas_dashboard()
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
begin
    -- 1. Suma total vendida y conteo (solo ventas Completadas e históricas)
    select coalesce(sum(total), 0.00), count(*)
    into v_total_ventas, v_cantidad_transacciones
    from ventas
    where estado_venta = 'Completada';

    -- 2. Deudas activas en la calle (suma de saldo deudor de clientes)
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
        group by c.nombre
    ) t;

    -- 6. Ventas del período actual (últimos 30 días)
    select coalesce(sum(total), 0.00)
    into v_total_actual
    from ventas
    where estado_venta = 'Completada'
      and fecha_venta >= timezone('utc'::text, now()) - interval '30 days';

    -- 7. Ventas del período anterior (días 31 al 60 hacia atrás)
    select coalesce(sum(total), 0.00)
    into v_total_anterior
    from ventas
    where estado_venta = 'Completada'
      and fecha_venta >= timezone('utc'::text, now()) - interval '60 days'
      and fecha_venta < timezone('utc'::text, now()) - interval '30 days';

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

    -- Retornar el objeto JSON consolidado con tendencia
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

-- -----------------------------------------------------------------------------
-- 4. POBLACIÓN DE PRUEBA PARA EL KÁRDEX (historial_stock)
--    Inserta movimientos de auditoría iniciales simulados si el kárdex está vacío.
-- -----------------------------------------------------------------------------
do $$
declare
    v_prod_count integer;
    v_hist_count integer;
    v_prod_id uuid;
begin
    select count(*) into v_prod_count from productos;
    select count(*) into v_hist_count from historial_stock;
    
    if v_prod_count > 0 and v_hist_count = 0 then
        -- Insertar compras iniciales para simular reabastecimiento en el historial
        for v_prod_id in select id from productos limit 5 loop
            insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, motivo, fecha_movimiento)
            values (
                v_prod_id,
                50,
                'Compra',
                'Ingreso de inventario inicial para pruebas',
                timezone('utc'::text, now()) - interval '2 days'
            );
            
            -- Insertar una venta simulada para cada uno de esos productos
            insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, motivo, fecha_movimiento)
            values (
                v_prod_id,
                -3,
                'Venta',
                'Venta POS (Simulación)',
                timezone('utc'::text, now()) - interval '1 day'
            );
        end loop;
    end if;
end $$;

commit;
