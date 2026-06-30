-- =============================================================================
-- SCRIPT DE MIGRACIÓN INICIAL: TIENDALOCAL (schema.sql)
-- Idioma: Español
-- =============================================================================

-- Habilitar extensión para UUIDs si no está activa
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLA: categorias
-- -----------------------------------------------------------------------------
create table if not exists categorias (
    id uuid default uuid_generate_v4() primary key,
    nombre varchar(100) not null unique,
    descripcion text,
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table categorias is 'Módulo de categorías de productos para el inventario.';
create index if not exists idx_categorias_nombre on categorias(nombre);

-- -----------------------------------------------------------------------------
-- 2. TABLA: productos
-- -----------------------------------------------------------------------------
create table if not exists productos (
    id uuid default uuid_generate_v4() primary key,
    categoria_id uuid references categorias(id) on delete restrict,
    codigo_barras varchar(50) unique,
    nombre varchar(150) not null,
    descripcion text,
    precio_compra numeric(12, 2) not null check (precio_compra >= 0),
    precio_venta numeric(12, 2) not null check (precio_venta >= 0),
    stock_actual integer default 0 not null check (stock_actual >= 0),
    stock_minimo integer default 5 not null check (stock_minimo >= 0),
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint check_precios check (precio_venta >= precio_compra)
);

comment on table productos is 'Catálogo de productos de la tienda con control de stock.';
create index if not exists idx_productos_codigo_barras on productos(codigo_barras);
create index if not exists idx_productos_nombre on productos(nombre);

-- -----------------------------------------------------------------------------
-- SECUENCIA Y TRIGGER PARA AUTOGENERACIÓN DE CÓDIGO DE BARRAS (KIO-XXXXX)
-- -----------------------------------------------------------------------------
-- Crear secuencia de códigos de barras
create sequence if not exists seq_codigo_barras_producto;

-- Inicializar la secuencia basándose en el máximo correlativo actual para evitar colisiones
do $$
declare
    v_max_id integer := 0;
begin
    select coalesce(max(nullif(regexp_replace(codigo_barras, '^KIO-', ''), '')::integer), 0)
    into v_max_id
    from productos
    where codigo_barras like 'KIO-%';
    
    perform setval('seq_codigo_barras_producto', coalesce(nullif(v_max_id, 0), 1), false);
end $$;

-- Función del trigger para autogeneración del código de barras
create or replace function fn_autogenerar_codigo_barras_prod()
returns trigger as $$
begin
    if new.codigo_barras is null or new.codigo_barras = '' then
        new.codigo_barras := 'KIO-' || lpad(nextval('seq_codigo_barras_producto')::text, 5, '0');
    end if;
    return new;
end;
$$ language plpgsql;

-- Trigger BEFORE INSERT en productos
create or replace trigger trg_productos_before_insert
before insert on productos
for each row
execute function fn_autogenerar_codigo_barras_prod();


-- -----------------------------------------------------------------------------
-- 3. TABLA: usuarios
-- -----------------------------------------------------------------------------
create table if not exists usuarios (
    id uuid default uuid_generate_v4() primary key,
    email varchar(150) not null unique,
    password_hash varchar(255) not null,
    nombre_completo varchar(150) not null,
    rol varchar(30) default 'Cajero' not null check (rol in ('Administrador', 'Cajero', 'Repartidor')),
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table usuarios is 'Usuarios del sistema backend (administradores, cajeros y repartidores).';
create index if not exists idx_usuarios_email on usuarios(email);

-- -----------------------------------------------------------------------------
-- 4. TABLA: clientes
-- -----------------------------------------------------------------------------
create table if not exists clientes (
    id uuid default uuid_generate_v4() primary key,
    dni_ruc varchar(20) unique,
    nombre varchar(150) not null,
    telefono varchar(20),
    direccion text,
    enlace_ubicacion text,
    latitud numeric(10, 8) default null check (latitud is null or (latitud >= -90.00000000 and latitud <= 90.00000000)),
    longitud numeric(11, 8) default null check (longitud is null or (longitud >= -180.00000000 and longitud <= 180.00000000)),
    enlace_mapa text default null,
    saldo_deudor numeric(12, 2) default 0.00 not null check (saldo_deudor >= 0),
    limite_credito numeric(12, 2) default 0.00 not null check (limite_credito >= 0),
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table clientes is 'Clientes registrados en la tienda con soporte para saldo deudor y ubicación geográfica.';
create index if not exists idx_clientes_dni_ruc on clientes(dni_ruc);
create index if not exists idx_clientes_nombre on clientes(nombre);
create index if not exists idx_clientes_coordenadas on clientes(latitud, longitud);

-- -----------------------------------------------------------------------------
-- 5. TABLA: ventas
-- -----------------------------------------------------------------------------
create table if not exists ventas (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references clientes(id) on delete restrict,
    usuario_id uuid references usuarios(id) on delete restrict,
    codigo_factura varchar(50) unique not null,
    total numeric(12, 2) default 0.00 not null check (total >= 0),
    tipo_pago varchar(30) not null check (tipo_pago in ('Efectivo', 'Tarjeta', 'Credito', 'Transferencia', 'QR')),
    estado_venta varchar(30) default 'Completada' not null check (estado_venta in ('Completada', 'Cancelada', 'Pendiente')),
    fecha_venta timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table ventas is 'Cabecera de transacciones de venta.';
create index if not exists idx_ventas_codigo_factura on ventas(codigo_factura);
create index if not exists idx_ventas_fecha on ventas(fecha_venta);
create index if not exists idx_ventas_cliente_id on ventas(cliente_id);
create index if not exists idx_ventas_usuario_id on ventas(usuario_id);

-- -----------------------------------------------------------------------------
-- 6. TABLA: detalles_ventas
-- -----------------------------------------------------------------------------
create table if not exists detalles_ventas (
    id uuid default uuid_generate_v4() primary key,
    venta_id uuid references ventas(id) on delete cascade not null,
    producto_id uuid references productos(id) on delete restrict not null,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0)
);

comment on table detalles_ventas is 'Detalle individual de productos en cada venta.';
create index if not exists idx_detalles_ventas_venta_id on detalles_ventas(venta_id);
create index if not exists idx_detalles_ventas_producto_id on detalles_ventas(producto_id);



-- -----------------------------------------------------------------------------
-- 9. TABLA: historial_stock
-- -----------------------------------------------------------------------------
create table if not exists historial_stock (
    id uuid default uuid_generate_v4() primary key,
    producto_id uuid references productos(id) on delete cascade not null,
    cantidad_cambio integer not null,
    tipo_movimiento varchar(50) not null check (tipo_movimiento in ('Venta', 'Ajuste', 'Cancelacion Venta')),
    referencia_id uuid, -- ID de la Venta o Compra que generó el movimiento
    motivo text, -- Justificación o comentario del movimiento
    fecha_movimiento timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table historial_stock is 'Kardex/Historial detallado del flujo y movimiento del stock de los productos.';
create index if not exists idx_historial_producto on historial_stock(producto_id);

-- -----------------------------------------------------------------------------
-- 9.5. TABLA: facturas
-- -----------------------------------------------------------------------------
create table if not exists facturas (
    id uuid default uuid_generate_v4() primary key,
    venta_id uuid references ventas(id) on delete restrict unique,
    codigo_factura varchar(50) unique not null,
    total numeric(12, 2) not null check (total >= 0),
    fecha_emision timestamp with time zone default timezone('utc'::text, now()) not null,
    estado varchar(20) default 'Emitida' not null check (estado in ('Emitida', 'Anulada'))
);

-- Asegurar que RLS esté desactivado para la tabla facturas
alter table facturas disable row level security;

comment on table facturas is 'Facturas automáticas generadas a partir de ventas completadas.';
create index if not exists idx_facturas_venta_id on facturas(venta_id);
create index if not exists idx_facturas_codigo on facturas(codigo_factura);

-- -----------------------------------------------------------------------------
-- TRIGGERS / PROCEDIMIENTOS ALMACENADOS PARA EL HISTORIAL Y CONTROL DE STOCK
-- -----------------------------------------------------------------------------

-- Función para actualizar la fecha de modificación automáticamente
create or replace function update_fecha_actualizacion()
returns trigger as $$
begin
    new.fecha_actualizacion = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Asignación de triggers de actualización a tablas maestras
create trigger trg_categorias_update before update on categorias
    for each row execute function update_fecha_actualizacion();

create trigger trg_productos_update before update on productos
    for each row execute function update_fecha_actualizacion();

create trigger trg_usuarios_update before update on usuarios
    for each row execute function update_fecha_actualizacion();

create trigger trg_clientes_update before update on clientes
    for each row execute function update_fecha_actualizacion();

-- -----------------------------------------------------------------------------
-- 10. TRIGGERS Y FUNCIONES ADICIONALES PARA INVENTARIO Y REVERSIONES
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
-- 10.5 PROCEDIMIENTOS ALMACENADOS DE VENTAS
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
        END if;

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

        insert into envios (venta_id, direccion_despacho, costo_envio, estado_envio, latitud, longitud)
        values (v_venta_id, p_direccion_despacho, p_costo_envio, 'Por Despachar', p_latitud, p_longitud);
    end if;

    return v_venta_id;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- 10.6 FUNCIÓN ALMACENADA: fn_ajustar_stock
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
-- 10.6.5 FUNCIÓN ALMACENADA: obtener_metricas_categorias
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
-- 10.7 SECUENCIA Y TRIGGER PARA AUTOGENERACIÓN DE CÓDIGO DE FACTURA (FAC-YYYYMMDD-XXXXX)
-- -----------------------------------------------------------------------------
create sequence if not exists seq_codigo_factura;

create or replace function fn_autogenerar_codigo_factura()
returns trigger as $$
declare
    v_fecha varchar(8);
begin
    if new.codigo_factura is null or new.codigo_factura = '' or new.codigo_factura = 'Autogenerado' then
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
    from seq_codigo_factura;
    
    v_fecha := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
    return 'FAC-' || v_fecha || '-' || lpad(v_next_val::text, 5, '0');
exception when others then
    return 'FAC-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-00001';
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
begin
    -- Validar existencia
    if not exists (select 1 from ventas where id = p_venta_id) then
        raise exception 'La venta especificada no existe.'
            using errcode = 'P0005';
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

comment on function cancelar_venta is 'Realiza la baja lógica de una venta y actualiza su factura asociada.';

-- -----------------------------------------------------------------------------
-- 11. POLÍTICAS DE SEGURIDAD (RLS)
-- -----------------------------------------------------------------------------
alter table historial_stock enable row level security;

create policy "Permitir select de historial_stock a todos"
on historial_stock for select to anon, authenticated using (true);


-- -----------------------------------------------------------------------------
-- 12. TABLA Y POLÍTICAS: bitacora_usuarios (Paso 9)
-- -----------------------------------------------------------------------------
create table if not exists bitacora_usuarios (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete set null,
    accion varchar(50) not null,
    tabla_afectada varchar(100) not null,
    registro_id uuid not null,
    detalles text,
    fecha timestamp with time zone default timezone('utc'::text, now()) not null,
    datos_anteriores jsonb default null,
    datos_nuevos jsonb default null,
    operacion varchar(10) default null
);

comment on table bitacora_usuarios is 'Tabla unificada para auditoría de acciones críticas de usuarios en el sistema.';
create index if not exists idx_bitacora_usuarios_tabla on bitacora_usuarios(tabla_afectada);
create index if not exists idx_bitacora_usuarios_fecha on bitacora_usuarios(fecha);
create index if not exists idx_bitacora_usuarios_operacion on bitacora_usuarios(operacion);

alter table bitacora_usuarios enable row level security;

drop policy if exists "Permitir select de bitacora_usuarios a todos" on bitacora_usuarios;
create policy "Permitir select de bitacora_usuarios a todos"
on bitacora_usuarios for select to anon, authenticated using (true);

drop policy if exists "Permitir insert de bitacora_usuarios a todos" on bitacora_usuarios;
create policy "Permitir insert de bitacora_usuarios a todos"
on bitacora_usuarios for insert to anon, authenticated with check (true);




