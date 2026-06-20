-- =============================================================================
-- EXTENSIÓN DE BASE DE DATOS: ENVÍOS Y DELIVERY (delivery_schema.sql)
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA: repartidores
-- -----------------------------------------------------------------------------
create table if not exists repartidores (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete restrict unique, -- Enlace 1:1 con el usuario de rol Repartidor
    vehiculo varchar(100),
    placa varchar(20),
    estado_repartidor varchar(30) default 'Disponible' not null check (estado_repartidor in ('Disponible', 'En Ruta', 'Inactivo')),
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table repartidores is 'Perfil adicional para los usuarios que actúan como repartidores en ruta.';

-- -----------------------------------------------------------------------------
-- 2. TABLA: envios
-- -----------------------------------------------------------------------------
create table if not exists envios (
    id uuid default uuid_generate_v4() primary key,
    venta_id uuid references ventas(id) on delete cascade not null unique,
    repartidor_id uuid references repartidores(id) on delete restrict,
    direccion_despacho text not null,
    costo_envio numeric(12, 2) default 0.00 not null check (costo_envio >= 0),
    estado_envio varchar(30) default 'Pendiente' not null check (estado_envio in ('Pendiente', 'En Camino', 'Entregado', 'Cancelado')),
    fecha_despacho timestamp with time zone,
    fecha_entrega timestamp with time zone,
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table envios is 'Información detallada para el reparto a domicilio de las ventas.';
create index if not exists idx_envios_estado on envios(estado_envio);
create index if not exists idx_envios_repartidor on envios(repartidor_id);

-- -----------------------------------------------------------------------------
-- TRIGGERS DE ACTUALIZACIÓN DE FECHA
-- -----------------------------------------------------------------------------
create trigger trg_repartidores_update before update on repartidores
    for each row execute function update_fecha_actualizacion();

create trigger trg_envios_update before update on envios
    for each row execute function update_fecha_actualizacion();

-- Trigger de auditoría para repartidores y envíos
create trigger trg_auditar_repartidores
after insert or update or delete on repartidores
for each row execute function fn_auditar_changes(); -- Usa la función fn_auditar_cambios pero con tolerancia

create or replace trigger trg_auditar_envios
after insert or update or delete on envios
for each row execute function fn_auditar_cambios();
