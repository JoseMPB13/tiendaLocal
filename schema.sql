-- =============================================================================
-- SCRIPT MAESTRO DDL: TIENDALOCAL (schema.sql)
-- Orden de despliegue: schema.sql → delivery_schema.sql → programmability.sql
-- Datos de prueba opcionales: scratch/seed_data.sql
-- Zona horaria Bolivia (por entorno): scratch/setup_timezone.sql
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
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null
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
    imagen_url text default null,
    estado varchar(20) default 'Activo' not null check (estado in ('Activo', 'Inactivo')),
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null,
    constraint check_precios check (precio_venta >= precio_compra)
);

comment on table productos is 'Catálogo de productos de la tienda con control de stock e imágenes.';
create index if not exists idx_productos_codigo_barras on productos(codigo_barras);
create index if not exists idx_productos_nombre on productos(nombre);

-- -----------------------------------------------------------------------------
-- SECUENCIA Y TRIGGER PARA AUTOGENERACIÓN DE CÓDIGO DE BARRAS (KIO-XXXXX)
-- -----------------------------------------------------------------------------
create sequence if not exists seq_codigo_barras_producto;

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

create or replace function fn_autogenerar_codigo_barras_prod()
returns trigger as $$
begin
    if new.codigo_barras is null or new.codigo_barras = '' then
        new.codigo_barras := 'KIO-' || lpad(nextval('seq_codigo_barras_producto')::text, 5, '0');
    end if;
    return new;
end;
$$ language plpgsql;

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
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null
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
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null
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
    fecha_venta timestamp with time zone default now() not null
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
-- 7. TABLA: historial_stock (Kardex)
-- -----------------------------------------------------------------------------
create table if not exists historial_stock (
    id uuid default uuid_generate_v4() primary key,
    producto_id uuid references productos(id) on delete cascade not null,
    cantidad_cambio integer not null,
    tipo_movimiento varchar(50) not null check (tipo_movimiento in ('Venta', 'Ajuste', 'Cancelacion Venta')),
    referencia_id uuid,
    motivo text,
    fecha_movimiento timestamp with time zone default now() not null
);

comment on table historial_stock is 'Kardex/Historial detallado del flujo y movimiento del stock de los productos.';
create index if not exists idx_historial_producto on historial_stock(producto_id);

-- -----------------------------------------------------------------------------
-- 8. TABLA: facturas
-- -----------------------------------------------------------------------------
create table if not exists facturas (
    id uuid default uuid_generate_v4() primary key,
    venta_id uuid references ventas(id) on delete restrict unique,
    codigo_factura varchar(50) unique not null,
    total numeric(12, 2) not null check (total >= 0),
    fecha_emision timestamp with time zone default now() not null,
    estado varchar(20) default 'Emitida' not null check (estado in ('Emitida', 'Anulada'))
);

alter table facturas disable row level security;

comment on table facturas is 'Facturas automáticas generadas a partir de ventas completadas.';
create index if not exists idx_facturas_venta_id on facturas(venta_id);
create index if not exists idx_facturas_codigo on facturas(codigo_factura);

-- -----------------------------------------------------------------------------
-- 9. TABLA: bitacora_usuarios (auditoría de acciones vía FastAPI)
-- -----------------------------------------------------------------------------
create table if not exists bitacora_usuarios (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete set null,
    accion varchar(50) not null,
    tabla_afectada varchar(100) not null,
    registro_id uuid not null,
    detalles text,
    fecha timestamp with time zone default now() not null,
    datos_anteriores jsonb default null,
    datos_nuevos jsonb default null,
    operacion varchar(10) default null
);

comment on table bitacora_usuarios is 'Auditoría de acciones críticas de usuarios registradas por el backend.';
create index if not exists idx_bitacora_usuarios_tabla on bitacora_usuarios(tabla_afectada);
create index if not exists idx_bitacora_usuarios_fecha on bitacora_usuarios(fecha);
create index if not exists idx_bitacora_usuarios_operacion on bitacora_usuarios(operacion);

-- -----------------------------------------------------------------------------
-- 10. TRIGGERS ESTRUCTURALES (fechas de actualización)
-- -----------------------------------------------------------------------------
create or replace function update_fecha_actualizacion()
returns trigger as $$
begin
    new.fecha_actualizacion = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_categorias_update before update on categorias
    for each row execute function update_fecha_actualizacion();

create trigger trg_productos_update before update on productos
    for each row execute function update_fecha_actualizacion();

create trigger trg_usuarios_update before update on usuarios
    for each row execute function update_fecha_actualizacion();

create trigger trg_clientes_update before update on clientes
    for each row execute function update_fecha_actualizacion();

-- -----------------------------------------------------------------------------
-- NOTA: Funciones de negocio, RPCs y triggers operativos en programmability.sql
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 11. POLÍTICAS DE SEGURIDAD (RLS)
-- -----------------------------------------------------------------------------
alter table historial_stock enable row level security;

drop policy if exists "Permitir select de historial_stock a todos" on historial_stock;
create policy "Permitir select de historial_stock a todos"
on historial_stock for select to anon, authenticated using (true);

drop policy if exists "Permitir insert de historial_stock a autenticados" on historial_stock;
create policy "Permitir insert de historial_stock a autenticados"
on historial_stock for insert to anon, authenticated with check (true);

alter table bitacora_usuarios enable row level security;

drop policy if exists "Permitir select de bitacora_usuarios a todos" on bitacora_usuarios;
create policy "Permitir select de bitacora_usuarios a todos"
on bitacora_usuarios for select to anon, authenticated using (true);

drop policy if exists "Permitir insert de bitacora_usuarios a todos" on bitacora_usuarios;
create policy "Permitir insert de bitacora_usuarios a todos"
on bitacora_usuarios for insert to anon, authenticated with check (true);

grant select, insert on bitacora_usuarios to anon, authenticated;
grant select, insert on historial_stock to anon, authenticated;
