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
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
    values (new.producto_id, -new.cantidad, 'Venta', new.venta_id);

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
    p_codigo_factura varchar(50),
    p_total numeric(12, 2),
    p_items jsonb,
    p_para_delivery boolean DEFAULT false,
    p_direccion_despacho text DEFAULT NULL,
    p_costo_envio numeric DEFAULT 0.00
)
returns uuid as $$
declare
    v_venta_id uuid;
    v_saldo_deudor numeric(12, 2);
    v_limite_credito numeric(12, 2);
    v_nombre_cliente varchar(150);
    v_item jsonb;
    v_subtotal numeric(12, 2);
begin
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
    values (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, 'Credito', 'Completada')
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
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
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
    p_codigo_factura varchar(50),
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
    v_item jsonb;
    v_subtotal numeric(12, 2);
begin
    -- 1. Insertar cabecera de la venta al contado
    insert into ventas (cliente_id, usuario_id, codigo_factura, total, tipo_pago, estado_venta)
    values (p_cliente_id, p_usuario_id, p_codigo_factura, p_total, p_tipo_pago, 'Completada')
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
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Pendiente');
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
-- FUNCIÓN: fn_controlar_stock_compra
-- DESCRIPCIÓN: Incrementa automáticamente el stock de un producto cuando se
--              registra un detalle de compra. Registra la transacción en el historial.
-- PARÁMETROS: Disparado por trigger (NEW contiene el registro de detalles_compras).
-- RETORNO: trigger (NEW)
-- =============================================================================
create or replace function fn_controlar_stock_compra()
returns trigger
language plpgsql
security definer
as $$
declare
    v_nombre_prod varchar(150);
begin
    -- Bloquear la fila del producto para evitar condiciones de carrera (Race Conditions)
    -- en actualizaciones concurrentes de stock.
    select nombre 
    into v_nombre_prod
    from productos 
    where id = new.producto_id
    for update;

    -- Incrementar el stock actual del producto con la cantidad comprada
    update productos 
    set stock_actual = stock_actual + new.cantidad
    where id = new.producto_id;

    -- Registrar el movimiento de tipo 'Compra' en el historial de stock
    insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
    values (new.producto_id, new.cantidad, 'Compra', new.compra_id);

    return new;
end;
$$;

-- Trigger para ejecutar fn_controlar_stock_compra BEFORE INSERT en detalles_compras
create or replace trigger tg_controlar_stock_compra
before insert on detalles_compras
for each row
execute function fn_controlar_stock_compra();


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
            insert into historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id)
            values (v_item.producto_id, v_item.cantidad, 'Cancelacion Venta', new.id);
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
    v_clientes_activos bigint;
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

    -- Retornar el objeto JSON consolidado
    return jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'deudas_activas_calle', v_deudas_activas_calle,
        'efectividad_delivery_porcentaje', v_efectividad_delivery_porcentaje,
        'clientes_activos', v_clientes_activos,
        'ventas_por_categoria', v_ventas_por_categoria
    );
end;
$$ language plpgsql;


