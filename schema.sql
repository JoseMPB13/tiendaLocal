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
    saldo_deudor numeric(12, 2) default 0.00 not null check (saldo_deudor >= 0),
    limite_credito numeric(12, 2) default 0.00 not null check (limite_credito >= 0),
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table clientes is 'Clientes registrados en la tienda con soporte para saldo deudor.';
create index if not exists idx_clientes_dni_ruc on clientes(dni_ruc);
create index if not exists idx_clientes_nombre on clientes(nombre);

-- -----------------------------------------------------------------------------
-- 5. TABLA: ventas
-- -----------------------------------------------------------------------------
create table if not exists ventas (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references clientes(id) on delete restrict,
    usuario_id uuid references usuarios(id) on delete restrict,
    codigo_factura varchar(50) unique not null,
    total numeric(12, 2) default 0.00 not null check (total >= 0),
    tipo_pago varchar(30) not null check (tipo_pago in ('Efectivo', 'Tarjeta', 'Credito', 'Transferencia')),
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
-- 7. TABLA: compras
-- -----------------------------------------------------------------------------
create table if not exists compras (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete restrict,
    codigo_referencia varchar(100),
    total numeric(12, 2) default 0.00 not null check (total >= 0),
    estado_compra varchar(30) default 'Completada' not null check (estado_compra in ('Completada', 'Cancelada')),
    fecha_compra timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table compras is 'Registro de compras o reabastecimiento de inventario.';
create index if not exists idx_compras_fecha on compras(fecha_compra);
create index if not exists idx_compras_usuario_id on compras(usuario_id);

-- -----------------------------------------------------------------------------
-- 8. TABLA: detalles_compras
-- -----------------------------------------------------------------------------
create table if not exists detalles_compras (
    id uuid default uuid_generate_v4() primary key,
    compra_id uuid references compras(id) on delete cascade not null,
    producto_id uuid references productos(id) on delete restrict not null,
    cantidad integer not null check (cantidad > 0),
    costo_unitario numeric(12, 2) not null check (costo_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0)
);

comment on table detalles_compras is 'Detalle de los productos adquiridos en una compra.';
create index if not exists idx_detalles_compras_compra_id on detalles_compras(compra_id);
create index if not exists idx_detalles_compras_producto_id on detalles_compras(producto_id);

-- -----------------------------------------------------------------------------
-- 9. TABLA: historial_stock
-- -----------------------------------------------------------------------------
create table if not exists historial_stock (
    id uuid default uuid_generate_v4() primary key,
    producto_id uuid references productos(id) on delete cascade not null,
    cantidad_cambio integer not null,
    tipo_movimiento varchar(50) not null check (tipo_movimiento in ('Venta', 'Compra', 'Ajuste', 'Cancelacion Venta', 'Cancelacion Compra')),
    referencia_id uuid, -- ID de la Venta o Compra que generó el movimiento
    fecha_movimiento timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table historial_stock is 'Kardex/Historial detallado del flujo y movimiento del stock de los productos.';
create index if not exists idx_historial_producto on historial_stock(producto_id);

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
-- FUNCIÓN: fn_controlar_stock_compra
-- DESCRIPCIÓN: Incrementa automáticamente el stock de un producto cuando se
--              registra un detalle de compra. Registra la transacción en el historial.
-- PARÁMETROS: Disparado por trigger (NEW contiene el registro de detalles_compras).
-- RETORNO: trigger (NEW)
-- =============================================================================
create or replace function fn_controlar_stock_compra()
returns trigger as $$
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
$$ language plpgsql;

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
returns trigger as $$
declare
    v_item record;
begin
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    if old.estado_venta <> 'Cancelada' and new.estado_venta = 'Cancelada' then
        
        -- 1. Iterar sobre todos los productos que forman parte de la venta
        for v_item in 
            select producto_id, cantidad 
            from detalles_ventas 
            where venta_id = new.id
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
$$ language plpgsql;

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


