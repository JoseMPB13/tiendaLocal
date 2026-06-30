-- =============================================================================
-- SCRIPT DE PROGRAMABILIDAD: TIENDALOCAL (programmability.sql)
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA ADICIONAL: bitacora (Requerida para la auditoría automática)
-- -----------------------------------------------------------------------------
create table if not exists bitacora (
    id uuid default uuid_generate_v4() primary key,
    tabla_afectada varchar(100) not null,
    operacion varchar(20) not null, -- 'INSERT', 'UPDATE', 'DELETE'
    registro_id uuid not null,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    usuario_db varchar(100) default current_user,
    fecha_registro timestamp with time zone default timezone('utc'::text, now()) not null,
    usuario_id uuid -- Guardará el ID de usuario real de la aplicación
);

comment on table bitacora is 'Registro de auditoría automática para cambios de datos críticos en el sistema.';
create index if not exists idx_bitacora_tabla on bitacora(tabla_afectada);
create index if not exists idx_bitacora_fecha on bitacora(fecha_registro);

-- -----------------------------------------------------------------------------
-- 2. CONTROL ESTRUCTURADO Y TRIGGER DE STOCK (BEFORE INSERT en detalles_ventas)
-- -----------------------------------------------------------------------------
create or replace function fn_controlar_stock_venta()
returns trigger
language plpgsql
security definer
as $$
declare
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
begin
    -- Obtener información actual del producto con bloqueo para evitar condiciones de carrera (Race Conditions)
    select stock_actual, stock_minimo, nombre 
    into v_stock_actual, v_stock_minimo, v_nombre_prod
    from productos 
    where id = new.producto_id
    for update;

    -- Validar disponibilidad de stock
    if v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente para el producto "%". Stock disponible: %, solicitado: %', 
            v_nombre_prod, v_stock_actual, new.cantidad
            using errcode = 'P0001'; -- Código de error personalizado para inventario insuficiente
    end if;

    -- Descontar el stock del producto
    update productos 
    set stock_actual = stock_actual - new.cantidad
    where id = new.producto_id;

    -- Registrar movimiento en el historial de stock
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
    select new.producto_id, -new.cantidad, 'Venta', new.venta_id, coalesce('Venta fac: ' || codigo_factura, 'Venta registrada')
    from ventas where id = new.venta_id;

    return new;
end;
$$;

create trigger trg_detalles_ventas_before_insert
before insert on detalles_ventas
for each row execute function fn_controlar_stock_venta();

-- -----------------------------------------------------------------------------
-- 3. PROCEDIMIENTO ALMACENADO: registrar_venta_credito
--    Registra la cabecera y el detalle de una venta a crédito validando el límite.
-- -----------------------------------------------------------------------------
create or replace function registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Validar límite de crédito del cliente
    select saldo_deudor, limite_credito, nombre
    into v_saldo_deudor, v_limite_credito, v_nombre_cliente
    from clientes
    where id = p_cliente_id
    for update;

    if (v_saldo_deudor + p_total) > v_limite_credito then
        raise exception 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
            v_nombre_cliente, v_saldo_deudor, p_total, v_limite_credito
            using errcode = 'P0002'; -- Código de error personalizado para límite de crédito
    end if;

    -- 2. Insertar cabecera de la venta con tipo de pago 'Credito'
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, 'Credito', 'Completada')
    returning id into v_venta_id;

    -- 3. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    -- 4. Actualizar el saldo deudor del cliente
    update clientes
    set saldo_deudor = saldo_deudor + p_total
    where id = p_cliente_id;

    -- 5. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar');
    end if;

    return v_venta_id;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- 3.5 PROCEDIMIENTO ALMACENADO: registrar_venta_contado
--     Registra la cabecera y el detalle de una venta al contado de forma atómica.
-- -----------------------------------------------------------------------------
create or replace function registrar_venta_contado(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Insertar cabecera de la venta al contado
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, p_tipo_pago, 'Completada')
    returning id into v_venta_id;

    -- 2. Iterar sobre los productos e insertarlos en el detalle
    -- Esto disparará automáticamente el trigger trg_detalles_ventas_before_insert que verifica stock con FOR UPDATE
    -- Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    -- 3. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar');
    end if;

    return v_venta_id;
end;
$$ language plpgsql;


-- -----------------------------------------------------------------------------
-- 4. TRIGGER DE AUDITORÍA AUTOMÁTICA (Bitácora)
-- -----------------------------------------------------------------------------
create or replace function fn_auditar_cambios()
returns trigger as $$
declare
    v_datos_anteriores jsonb := null;
    v_datos_nuevos jsonb := null;
    v_registro_id uuid;
    v_usuario_id uuid := null;
begin
    if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
        v_datos_anteriores := to_jsonb(old);
        v_registro_id := old.id;
    end if;
    
    if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
        v_datos_nuevos := to_jsonb(new);
        v_registro_id := new.id;
    end if;

    -- Capturar el ID de usuario real de la aplicación
    -- 1. Intentar leer la variable de sesión 'app.current_user_id'
    begin
        v_usuario_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
    exception when others then
        v_usuario_id := null;
    end;

    -- 2. Fallback: intentar leer el usuario de Supabase Auth
    if v_usuario_id is null then
        begin
            v_usuario_id := auth.uid();
        exception when others then
            v_usuario_id := null;
        end;
    end if;

    insert into bitacora (tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id)
    values (tg_table_name, tg_op, v_registro_id, v_datos_anteriores, v_datos_nuevos, v_usuario_id);

    return new;
end;
$$ language plpgsql;

-- Asignación de triggers de auditoría a las tablas principales
create trigger trg_auditar_productos
after insert or update or delete on productos
for each row execute function fn_auditar_cambios();

create trigger trg_auditar_ventas
after insert or update or delete on ventas
for each row execute function fn_auditar_cambios();

create trigger trg_auditar_clientes
after insert or update or delete on clientes
for each row execute function fn_auditar_cambios();

-- -----------------------------------------------------------------------------
-- 5. TRIGGERS Y FUNCIONES ADICIONALES PARA INVENTARIO Y REVERSIONES
-- -----------------------------------------------------------------------------




-- =============================================================================
-- FUNCIÓN: fn_revertir_venta_cancelada
-- DESCRIPCIÓN: Revierte de forma atómica el stock de los productos vendidos y el
--              saldo deudor de un cliente cuando una venta cambia a 'Cancelada'.
-- PARÁMETROS: Disparado por trigger AFTER UPDATE en ventas (OLD y NEW disponibles).
-- RETORNO: trigger (NEW)
-- =============================================================================
create or replace function fn_revertir_venta_cancelada()
returns trigger
language plpgsql
security definer
as $$
declare
    v_item record;
begin
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    if old.estado_venta <> 'Cancelada' and new.estado_venta = 'Cancelada' then
        
        -- 1. Iterar sobre todos los productos que forman parte de la venta ordenados por producto_id para prevenir deadlocks
        for v_item in 
            select producto_id, cantidad 
            from detalles_ventas 
            where venta_id = new.id
            order by producto_id asc
        loop
            -- Bloquear el producto antes de modificar su stock para evitar race conditions
            perform id from productos where id = v_item.producto_id for update;

            -- Devolver (sumar) las cantidades vendidas al stock_actual
            update productos 
            set stock_actual = stock_actual + v_item.cantidad
            where id = v_item.producto_id;

            -- Registrar el movimiento de reversión en historial_stock como 'Cancelacion Venta'
            insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
            select v_item.producto_id, v_item.cantidad, 'Cancelacion Venta', new.id, coalesce('Cancelación: ' || e.motivo_cancelacion, 'Venta Cancelada / Anulada')
            from ventas v
            left join envios e on e.venta_id = v.id
            where v.id = new.id
            limit 1;
        end loop;

        -- 2. Si la venta original fue bajo modalidad de 'Credito', ajustar la deuda del cliente
        if new.tipo_pago = 'Credito' then
            -- Bloquear la fila del cliente para garantizar la consistencia en el saldo
            perform id from clientes where id = new.cliente_id for update;

            -- Restar el total de la venta del saldo deudor, asegurando que no descienda de 0
            update clientes 
            set saldo_deudor = greatest(0.00, saldo_deudor - new.total)
            where id = new.cliente_id;
        end if;

        -- 3. Asegurar anulación de factura relacionada
        update facturas
        set estado = 'Anulada'
        where venta_id = new.id;

    end if;

    return new;
end;
$$;

-- Trigger para ejecutar fn_revertir_venta_cancelada AFTER UPDATE en ventas
create or replace trigger tg_revertir_venta_cancelada
after update on ventas
for each row
execute function fn_revertir_venta_cancelada();

-- =============================================================================
drop function if exists obtener_metricas_dashboard(date);
drop function if exists obtener_metricas_dashboard();
drop function if exists obtener_metricas_dashboard(date, date);
-- FUNCIÓN: obtener_metricas_dashboard
-- DESCRIPCIÓN: Consolida en una única consulta de base de datos las métricas
--              financieras, recuentos de ventas, saldos deudores, efectividad
--              del delivery, distribución de ingresos por categoría del negocio
--              y el porcentaje de crecimiento (tendencia) de ventas.
-- PARÁMETROS: p_fecha_inicio (fecha inicio rango opcional), p_fecha_fin (fecha fin rango opcional).
-- RETORNO: jsonb
-- =============================================================================
create or replace function obtener_metricas_dashboard(p_fecha_inicio date default null, p_fecha_fin date default null)
returns jsonb as $$
declare
    v_total_ventas numeric(12, 2);
    v_cantidad_transacciones bigint;
    v_deudas_activas_calle numeric(12, 2);
    v_efectividad_delivery_porcentaje numeric(5, 2);
    v_clientes_activos bigint;
    v_ventas_por_categoria jsonb;
    
    -- Nuevas variables para los indicadores solicitados
    v_pedidos_delivery bigint;
    v_productos_vendidos bigint;
    
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

    -- 3b. Pedidos Delivery: Número absoluto de pedidos que fueron solicitados mediante delivery
    select count(*)
    into v_pedidos_delivery
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

    -- 4b. Productos Vendidos: Cantidad total de unidades o productos que se han vendido
    select coalesce(sum(dv.cantidad), 0)
    into v_productos_vendidos
    from detalles_ventas dv
    join ventas v on v.id = dv.venta_id
    where v.estado_venta = 'Completada'
      and (
        (p_fecha_inicio is null and p_fecha_fin is null) or
        (p_fecha_inicio is not null and p_fecha_fin is null and v.fecha_venta::date = p_fecha_inicio) or
        (p_fecha_inicio is null and p_fecha_fin is not null and v.fecha_venta::date = p_fecha_fin) or
        (p_fecha_inicio is not null and p_fecha_fin is not null and v.fecha_venta::date between p_fecha_inicio and p_fecha_fin)
      );

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

    -- Retornar el objeto JSON consolidado con los campos nuevos y viejos (para compatibilidad)
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

-- -----------------------------------------------------------------------------
-- 6. FUNCIÓN ALMACENADA: fn_ajustar_stock
-- -----------------------------------------------------------------------------
create or replace function fn_ajustar_stock(
    p_producto_id uuid,
    p_cantidad_cambio integer,
    p_motivo text,
    p_usuario_id uuid
)
returns jsonb as $$
declare
    v_stock_actual integer;
    v_stock_nuevo integer;
    v_nombre_prod varchar(150);
begin
    -- Bloquear y verificar el producto para evitar race conditions
    select nombre, stock_actual into v_nombre_prod, v_stock_actual
    from productos
    where id = p_producto_id
    for update;

    if not found then
        raise exception 'El producto especificado no existe.'
            using errcode = 'P0005';
    end if;

    -- Calcular el nuevo stock y validar que no sea negativo
    v_stock_nuevo := v_stock_actual + p_cantidad_cambio;
    if v_stock_nuevo < 0 then
        raise exception 'No se puede realizar el ajuste. El stock resultante (%) no puede ser menor a cero.', v_stock_nuevo
            using errcode = 'P0007';
    end if;

    -- Actualizar el stock actual del producto
    update productos
    set stock_actual = v_stock_nuevo
    where id = p_producto_id;

    -- Registrar en el historial de stock
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
    values (p_producto_id, p_cantidad_cambio, 'Ajuste', p_usuario_id, p_motivo);

    -- Retornar el producto actualizado como JSONB
    return (
        select jsonb_build_object(
            'id', id,
            'nombre', nombre,
            'stock_actual', stock_actual,
            'precio_venta', precio_venta,
            'precio_compra', precio_compra,
            'categoria_id', categoria_id,
            'estado', estado
        )
        from productos
        where id = p_producto_id
    );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 6.5. FUNCIÓN ALMACENADA: obtener_metricas_categorias
-- -----------------------------------------------------------------------------
create or replace function obtener_metricas_categorias()
returns jsonb as $$
declare
    v_total_activas bigint;
    v_dominante_nombre varchar(150);
    v_dominante_stock bigint;
    v_valorizacion_total numeric(12, 2);
begin
    -- Conteo total de categorías activas
    select count(*) into v_total_activas
    from categorias
    where estado = 'Activo';

    -- Categoría dominante en inventario (mayor stock acumulado)
    select c.nombre, coalesce(sum(p.stock_actual), 0)
    into v_dominante_nombre, v_dominante_stock
    from categorias c
    left join productos p on p.categoria_id = c.id
    where c.estado = 'Activo' and p.estado = 'Activo'
    group by c.id, c.nombre
    order by sum(p.stock_actual) desc, c.nombre asc
    limit 1;

    -- Si no hay productos, establecer valores por defecto
    if v_dominante_nombre is null then
        v_dominante_nombre := 'Ninguna';
        v_dominante_stock := 0;
    end if;

    -- Valorización económica total (suma de precio_venta * stock_actual de productos activos de categorías activas)
    select coalesce(sum(p.precio_venta * p.stock_actual), 0.00)
    into v_valorizacion_total
    from productos p
    join categorias c on c.id = p.categoria_id
    where c.estado = 'Activo' and p.estado = 'Activo';

    return jsonb_build_object(
        'total_categorias_activas', v_total_activas,
        'categoria_dominante', jsonb_build_object(
            'nombre', v_dominante_nombre,
            'total_stock', v_dominante_stock
        ),
        'valorizacion_total', v_valorizacion_total
    );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 7. SECUENCIA Y FUNCIÓN PARA GENERACIÓN DE CÓDIGO DE FACTURA (F-YYYYMMDD-XXXXX)
-- -----------------------------------------------------------------------------
create sequence if not exists seq_codigo_factura_f;

create or replace function generar_codigo_factura()
returns varchar as $$
declare
    v_fecha varchar(8);
    v_next_val bigint;
begin
    v_fecha := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
    v_next_val := nextval('seq_codigo_factura_f');
    return 'F-' || v_fecha || '-' || lpad(v_next_val::text, 5, '0');
end;
$$ language plpgsql;

create or replace function fn_autogenerar_codigo_factura()
returns trigger as $$
begin
    if new.codigo_factura is null or new.codigo_factura = '' or new.codigo_factura = 'Autogenerado' then
        new.codigo_factura := generar_codigo_factura();
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_ventas_before_insert
before insert on ventas
for each row
execute function fn_autogenerar_codigo_factura();

-- -----------------------------------------------------------------------------
-- FUNCIÓN: obtener_proximo_codigo_factura
-- -----------------------------------------------------------------------------
create or replace function obtener_proximo_codigo_factura()
returns varchar as $$
declare
    v_fecha varchar(8);
    v_next_val bigint;
begin
    -- Obtenemos el próximo valor de la secuencia global sin consumirlo
    select coalesce(last_value, 1) + case when is_called then 1 else 0 end
    into v_next_val
    from seq_codigo_factura_f;
    
    v_fecha := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
    return 'F-' || v_fecha || '-' || lpad(v_next_val::text, 5, '0');
exception when others then
    return 'F-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-00001';
end;
$$ language plpgsql;

comment on function obtener_proximo_codigo_factura is 'Calcula y retorna el número correlativo de factura que corresponderá a la siguiente venta.';

-- -----------------------------------------------------------------------------
-- FUNCIÓN Y TRIGGER: Facturación Automática
-- -----------------------------------------------------------------------------
create or replace function fn_facturar_venta()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Insertar automáticamente en facturas si la venta se crea como 'Completada' o transiciona a ese estado
    if (tg_op = 'INSERT' and new.estado_venta = 'Completada') or 
       (tg_op = 'UPDATE' and old.estado_venta <> 'Completada' and new.estado_venta = 'Completada') then
        
        insert into facturas (venta_id, codigo_factura, total, fecha_emision, estado)
        values (new.id, new.codigo_factura, new.total, timezone('utc'::text, now()), 'Emitida')
        on conflict (venta_id) do nothing;
    end if;
    return new;
end;
$$;

comment on function fn_facturar_venta is 'Disparador que crea el registro de facturación de forma automática al completarse una venta.';

create or replace trigger trg_ventas_facturacion_automatica
after insert or update on ventas
for each row
execute function fn_facturar_venta();

-- -----------------------------------------------------------------------------
-- FUNCIÓN ALMACENADA: cancelar_venta
-- -----------------------------------------------------------------------------
create or replace function cancelar_venta(p_venta_id uuid)
returns uuid as $$
declare
    v_fecha_venta timestamptz;
begin
    -- Validar existencia y extraer la fecha original de la venta
    select fecha_venta into v_fecha_venta from ventas where id = p_venta_id;
    
    if not found then
        raise exception 'La venta especificada no existe.'
            using errcode = 'P0005';
    end if;

    -- Validar que la venta se haya realizado el mismo día actual del servidor
    if v_fecha_venta::date <> current_date then
        raise exception 'Solo se pueden anular ventas realizadas el mismo día.'
            using errcode = 'P0008';
    end if;

    -- Actualizar estado. Esto disparará automáticamente trg_revertir_venta_cancelada
    update ventas
    set estado_venta = 'Cancelada'
    where id = p_venta_id and estado_venta <> 'Cancelada';

    -- Cambiar estado de factura si existe
    update facturas
    set estado = 'Anulada'
    where venta_id = p_venta_id;

    return p_venta_id;
end;
$$ language plpgsql;

comment on function cancelar_venta is 'Realiza la baja lógica de una venta y actualiza su factura asociada, restringido al mismo día.';


-- -----------------------------------------------------------------------------
-- FUNCIÓN: actualizar_venta
-- -----------------------------------------------------------------------------
create or replace function actualizar_venta(
    p_venta_id uuid,
    p_cliente_id uuid,
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean default false,
    p_direccion_despacho text default null,
    p_costo_envio numeric default 0.00,
    p_latitud numeric default null,
    p_longitud numeric default null
)
returns uuid as $$
declare
    v_old_cliente_id uuid;
    v_old_tipo_pago varchar(30);
    v_old_total numeric(12, 2);
    v_old_estado_venta varchar(30);
    v_old_fecha_venta timestamptz;
    v_new_total numeric(12, 2) := 0.00;
    v_item record; 
    v_detail record;
    v_stock_actual integer;
    v_stock_minimo integer;
    v_nombre_prod varchar(150);
    v_precio_oficial numeric(12, 2);
    v_subtotal numeric(12, 2);
begin
    -- 1. Obtener datos actuales de la venta
    select cliente_id, tipo_pago, total, estado_venta, fecha_venta
    into v_old_cliente_id, v_old_tipo_pago, v_old_total, v_old_estado_venta, v_old_fecha_venta
    from ventas
    where id = p_venta_id
    for update;

    if not found then
        raise exception 'La venta especificada no existe.' using errcode = 'P0005';
    end if;

    -- Validar restricción de edición al mismo día
    if v_old_fecha_venta::date <> current_date then
        raise exception 'Solo se pueden editar ventas realizadas el mismo día.' using errcode = 'P0007';
    end if;

    if v_old_estado_venta = 'Cancelada' then
        raise exception 'No se puede modificar una venta cancelada.' using errcode = 'P0006';
    end if;

    -- 2. Revertir deudas y stock de la venta anterior
    -- Revertir stock
    for v_detail in 
        select producto_id, cantidad 
        from detalles_ventas 
        where venta_id = p_venta_id
    loop
        update productos 
        set stock_actual = stock_actual + v_detail.cantidad
        where id = v_detail.producto_id;

        -- Registrar contra-movimiento de stock temporal (descuento revertido por ajuste)
        insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        values (v_detail.producto_id, v_detail.cantidad, 'Ajuste', p_venta_id, 'Reversión por ajuste de venta');
    end loop;

    -- Revertir deuda del cliente anterior
    if v_old_tipo_pago = 'Credito' then
        update clientes 
        set saldo_deudor = greatest(0.00, saldo_deudor - v_old_total)
        where id = v_old_cliente_id;
    end if;

    -- 3. Calcular el nuevo total y validar stock/precios usando desempaquetamiento explícito
    for v_item in 
        select (x.value->>'producto_id')::uuid as producto_id, 
               (x.value->>'cantidad')::integer as cantidad, 
               (x.value->>'precio_unitario')::numeric as precio_unitario 
        from jsonb_array_elements(p_items) as x(value) 
    loop
        select precio_venta, stock_actual, stock_minimo, nombre
        into v_precio_oficial, v_stock_actual, v_stock_minimo, v_nombre_prod
        from productos
        where id = v_item.producto_id
        for update;

        if not found then
            raise exception 'Producto no existe en catálogo.' using errcode = 'P0001';
        end if;

        -- Validar stock (recordando que acabamos de sumarle la cantidad anterior)
        if v_stock_actual < v_item.cantidad then
            raise exception 'Stock insuficiente para el producto "%". Stock disponible: %, solicitado: %', 
                v_nombre_prod, v_stock_actual, v_item.cantidad
                using errcode = 'P0001';
        end if;

        v_new_total := v_new_total + (v_item.cantidad * v_precio_oficial);
    end loop;

    -- 4. Validar límite de crédito del nuevo cliente si el pago es a crédito
    if p_tipo_pago = 'Credito' then
        declare
            v_saldo_deudor numeric(12, 2);
            v_limite_credito numeric(12, 2);
            v_nombre_cliente varchar(150);
        begin
            select saldo_deudor, limite_credito, nombre
            into v_saldo_deudor, v_limite_credito, v_nombre_cliente
            from clientes
            where id = p_cliente_id
            for update;

            if (v_saldo_deudor + v_new_total) > v_limite_credito then
                raise exception 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
                    v_nombre_cliente, v_saldo_deudor, v_new_total, v_limite_credito
                    using errcode = 'P0002';
            end if;
        end;
    end if;

    -- 5. Eliminar detalles viejos
    delete from detalles_ventas where venta_id = p_venta_id;

    -- 6. Insertar nuevos detalles y descontar stock usando desempaquetamiento explícito
    for v_item in 
        select (x.value->>'producto_id')::uuid as producto_id, 
               (x.value->>'cantidad')::integer as cantidad, 
               (x.value->>'precio_unitario')::numeric as precio_unitario 
        from jsonb_array_elements(p_items) as x(value) 
    loop
        v_subtotal := v_item.cantidad * v_item.precio_unitario;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            p_venta_id, 
            v_item.producto_id, 
            v_item.cantidad, 
            v_item.precio_unitario,
            v_subtotal
        );

        update productos
        set stock_actual = stock_actual - v_item.cantidad
        where id = v_item.producto_id;

        insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
        values (v_item.producto_id, -v_item.cantidad, 'Venta', p_venta_id, 'Ajuste de cantidad en venta');
    end loop;

    -- 7. Actualizar cabecera de la venta
    update ventas
    set cliente_id = p_cliente_id,
        tipo_pago = p_tipo_pago,
        total = v_new_total
    where id = p_venta_id;

    -- 8. Aplicar la deuda al nuevo cliente si es Crédito
    if p_tipo_pago = 'Credito' then
        update clientes
        set saldo_deudor = saldo_deudor + v_new_total
        where id = p_cliente_id;
    end if;

    -- 9. Actualizar factura asociada si existe
    update facturas
    set total = v_new_total
    where venta_id = p_venta_id;

    -- 10. Actualizar envío de delivery si aplica
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;
        
        -- Si ya existe envío, lo actualizamos. Si no, lo insertamos
        if exists (select 1 from envios where venta_id = p_venta_id) then
            update envios 
            set direccion_despacho = p_direccion_despacho,
                costo_envio = p_costo_envio,
                latitud = p_latitud,
                longitud = p_longitud
            where venta_id = p_venta_id;
        else
            insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
            values (p_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
        end if;
    else
        -- Si ya no requiere delivery, eliminamos el registro si estaba en estado Pendiente o Por Despachar
        delete from envios where venta_id = p_venta_id and estado_envio in ('Por Despachar', 'Pendiente');
    end if;

    return p_venta_id;
end;
$$ language plpgsql security definer;

comment on function actualizar_venta is 'Actualiza una venta y sus detalles reajustando stock y deudas (atómico), restringido al mismo día.';





-- -----------------------------------------------------------------------------
-- NOTA DE INTEGRACIÓN GEOGRÁFICA DE CLIENTES
-- Los campos latitud, longitud y enlace_mapa fueron agregados a la tabla clientes.
-- La auditoría automática (fn_auditar_cambios) registra estos campos de forma 
-- nativa al serializar el registro a JSONB en el trigger trg_auditar_clientes.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- FUNCIÓN DE AGREGACIÓN DE INVENTARIO: obtener_movimientos_stock_agrupados (Paso 9)
-- -----------------------------------------------------------------------------
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
    -- Calcular inicio y fin del período activo en UTC
    if p_periodo = 'dia' then
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day',   now() at time zone 'UTC');
        v_fin_periodo    := v_inicio_periodo + interval '1 day';

    elsif p_periodo = 'semana' then
        v_trunc_period   := 'week';
        v_inicio_periodo := date_trunc('week',  now() at time zone 'UTC');
        v_fin_periodo    := v_inicio_periodo + interval '1 week';

    elsif p_periodo = 'mes' then
        v_trunc_period   := 'month';
        v_inicio_periodo := date_trunc('month', now() at time zone 'UTC');
        v_fin_periodo    := v_inicio_periodo + interval '1 month';

    else
        v_trunc_period   := 'day';
        v_inicio_periodo := date_trunc('day',   now() at time zone 'UTC');
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
    where hs.fecha_movimiento >= v_inicio_periodo   -- Solo el período activo
      and hs.fecha_movimiento <  v_fin_periodo       -- Límite superior exclusivo
    group by 1, hs.producto_id, p.nombre, hs.tipo_movimiento
    order by 1 desc, p.nombre asc;
end;
$$ language plpgsql security definer;

comment on function obtener_movimientos_stock_agrupados(text) is 'Retorna movimientos de stock del período activo (dia/semana/mes) desde ahora en UTC. SECURITY DEFINER garantiza bypass de RLS para la consulta.';


-- -----------------------------------------------------------------------------
-- 5. INDICADORES DE RENDIMIENTO DE PERSONAL (RPC Analítico)
-- -----------------------------------------------------------------------------
create or replace function obtener_rendimiento_personal()
returns json as $$
declare
    v_cajeros json;
    v_repartidores json;
begin
    -- 1. Agregación de Cajeros (usuarios de rol 'Administrador' o 'Cajero')
    select coalesce(json_agg(t), '[]'::json) into v_cajeros
    from (
        select 
            u.id as usuario_id,
            u.nombre_completo,
            u.email,
            coalesce(count(v.id), 0)::integer as total_ventas,
            coalesce(sum(case when v.estado_venta = 'Completada' then v.total else 0 end), 0.00)::numeric(12, 2) as monto_total
        from usuarios u
        left join ventas v on v.usuario_id = u.id and v.estado_venta = 'Completada'
        where u.rol in ('Administrador', 'Cajero')
        group by u.id, u.nombre_completo, u.email
    ) t;

    -- 2. Agregación de Repartidores (usuarios de rol 'Repartidor')
    select coalesce(json_agg(t), '[]'::json) into v_repartidores
    from (
        select 
            u.id as usuario_id,
            u.nombre_completo,
            u.email,
            r.id as repartidor_id,
            r.vehiculo,
            r.placa,
            coalesce(sum(case when e.estado_envio = 'Entregado' then 1 else 0 end), 0)::integer as envios_entregados,
            coalesce(sum(case when e.estado_envio = 'Cancelado' then 1 else 0 end), 0)::integer as envios_cancelados,
            coalesce(count(e.id), 0)::integer as total_envios,
            case 
                when count(e.id) > 0 then 
                    round((sum(case when e.estado_envio = 'Entregado' then 1 else 0 end)::numeric / count(e.id)::numeric) * 100, 2)::numeric(5, 2)
                else 0.00
            END as efectividad_entrega
        from usuarios u
        join repartidores r on r.usuario_id = u.id
        left join envios e on e.repartidor_id = r.id
        group by u.id, u.nombre_completo, u.email, r.id, r.vehiculo, r.placa
    ) t;

    return json_build_object(
        'cajeros', v_cajeros,
        'repartidores', v_repartidores
    );
end;
$$ language plpgsql;

comment on function obtener_rendimiento_personal() is 'Calcula y unifica métricas de ventas para cajeros y efectividad de envíos para repartidores.';


-- -----------------------------------------------------------------------------
-- FUNCIÓN: registrar_reabastecimiento
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- PROCEDIMIENTOS ALMACENADOS DE VENTAS
-- -----------------------------------------------------------------------------
create or replace function registrar_venta_credito(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00,
    p_latitud numeric DEFAULT NULL,
    p_longitud numeric DEFAULT NULL
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Validar límite de crédito del cliente
    select saldo_deudor, limite_credito, nombre
    into v_saldo_deudor, v_limite_credito, v_nombre_cliente
    from clientes
    where id = p_cliente_id
    for update;

    if (v_saldo_deudor + p_total) > v_limite_credito then
        raise exception 'Límite de crédito excedido para el cliente %. Saldo actual: %, Venta solicitada: %, Límite máximo: %',
            v_nombre_cliente, v_saldo_deudor, p_total, v_limite_credito
            using errcode = 'P0002';
    end if;

    -- 2. Insertar cabecera de la venta con tipo de pago 'Credito'
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, 'Credito', 'Completada')
    returning id into v_venta_id;

    -- 3. Iterar sobre los productos ordenados por producto_id para prevenir deadlocks
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    -- 4. Actualizar el saldo deudor del cliente
    update clientes
    set saldo_deudor = saldo_deudor + p_total
    where id = p_cliente_id;

    -- 5. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
    end if;

    return v_venta_id;
end;
$$ language plpgsql;

create or replace function registrar_venta_contado(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_total numeric(12, 2),
    p_tipo_pago varchar(30),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00,
    p_latitud numeric DEFAULT NULL,
    p_longitud numeric DEFAULT NULL
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_codigo_factura varchar(50);
    v_item record;
    v_subtotal numeric(12, 2);
begin
    -- Generar el código de factura de forma segura y transaccional
    v_codigo_factura := generar_codigo_factura();

    -- 1. Insertar cabecera de la venta al contado
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, v_codigo_factura, p_total, p_tipo_pago, 'Completada')
    returning id into v_venta_id;

    -- 2. Iterar sobre los productos e insertarlos en el detalle
    for v_item in 
        select (x.value->>'producto_id')::uuid as prod_id,
               (x.value->>'cantidad')::integer as cant,
               (x.value->>'precio_unitario')::numeric(12, 2) as precio
        from jsonb_array_elements(p_items) as x(value)
        order by prod_id asc
    loop
        v_subtotal := v_item.cant * v_item.precio;
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            v_item.prod_id, 
            v_item.cant, 
            v_item.precio,
            v_subtotal
        );
    end loop;

    -- 3. Registrar envío de delivery si se requiere
    if p_para_delivery then
        if p_direccion_despacho is null or p_direccion_despacho = '' then
            raise exception 'La dirección de despacho es obligatoria para pedidos con delivery.'
                using errcode = 'P0003';
        end if;

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
    end if;

    return v_venta_id;
end;
$$ language plpgsql;

