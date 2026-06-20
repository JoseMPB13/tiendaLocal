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
    fecha_registro timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table bitacora is 'Registro de auditoría automática para cambios de datos críticos en el sistema.';
create index if not exists idx_bitacora_tabla on bitacora(tabla_afectada);
create index if not exists idx_bitacora_fecha on bitacora(fecha_registro);

-- -----------------------------------------------------------------------------
-- 2. CONTROL ESTRUCTURADO Y TRIGGER DE STOCK (BEFORE INSERT en detalles_ventas)
-- -----------------------------------------------------------------------------
create or replace function fn_controlar_stock_venta()
returns trigger as $$
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
$$ language plpgsql;

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
    p_items jsonb -- Formato: [{"producto_id": "...", "cantidad": 2, "precio_unitario": 10.00}]
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

    -- 3. Iterar sobre los productos e insertarlos en el detalle
    for v_item in select * from jsonb_array_elements(p_items) loop
        v_subtotal := (v_item->>'cantidad')::integer * (v_item->>'precio_unitario')::numeric(12, 2);
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            (v_item->>'producto_id')::uuid, 
            (v_item->>'cantidad')::integer, 
            (v_item->>'precio_unitario')::numeric(12, 2),
            v_subtotal
        );
    end loop;

    -- 4. Actualizar el saldo deudor del cliente
    update clientes
    set saldo_deudor = saldo_deudor + p_total
    where id = p_cliente_id;

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
    p_items jsonb -- Formato: [{"producto_id": "...", "cantidad": 2, "precio_unitario": 10.00}]
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
    for v_item in select * from jsonb_array_elements(p_items) loop
        v_subtotal := (v_item->>'cantidad')::integer * (v_item->>'precio_unitario')::numeric(12, 2);
        
        insert into detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (
            v_venta_id, 
            (v_item->>'producto_id')::uuid, 
            (v_item->>'cantidad')::integer, 
            (v_item->>'precio_unitario')::numeric(12, 2),
            v_subtotal
        );
    end loop;

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
begin
    if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
        v_datos_anteriores := to_jsonb(old);
        v_registro_id := old.id;
    end if;
    
    if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
        v_datos_nuevos := to_jsonb(new);
        v_registro_id := new.id;
    end if;

    insert into bitacora (tabla_afectada, operacion, registro_id, datos_anteriores, datos_nuevos)
    values (tg_table_name, tg_op, v_registro_id, v_datos_anteriores, v_datos_nuevos);

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
