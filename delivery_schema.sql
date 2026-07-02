-- =============================================================================
-- SCRIPT MAESTRO DDL: DELIVERY Y CONFIGURACIÓN (delivery_schema.sql)
-- Requiere schema.sql ejecutado previamente.
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA: repartidores
-- -----------------------------------------------------------------------------
create table if not exists repartidores (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete restrict unique,
    vehiculo varchar(100),
    placa varchar(20),
    estado_repartidor varchar(30) default 'Disponible' not null check (estado_repartidor in ('Disponible', 'En Ruta', 'Inactivo')),
    latitud_actual numeric(10, 8) default null,
    longitud_actual numeric(11, 8) default null,
    ultima_actualizacion_gps timestamptz default null,
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null,
    constraint chk_repartidores_latitud_rango check (latitud_actual is null or (latitud_actual >= -90.00000000 and latitud_actual <= 90.00000000)),
    constraint chk_repartidores_longitud_rango check (longitud_actual is null or (longitud_actual >= -180.00000000 and longitud_actual <= 180.00000000))
);

comment on table repartidores is 'Perfil adicional para usuarios repartidores con seguimiento GPS en tiempo real.';
comment on column repartidores.latitud_actual is 'Latitud GPS en tiempo real del repartidor.';
comment on column repartidores.longitud_actual is 'Longitud GPS en tiempo real del repartidor.';
comment on column repartidores.ultima_actualizacion_gps is 'Última señal GPS recibida del dispositivo móvil.';

create index if not exists idx_repartidores_ubicacion_gps
    on repartidores (id, latitud_actual, longitud_actual)
    where latitud_actual is not null and longitud_actual is not null;

-- -----------------------------------------------------------------------------
-- 2. TABLA: envios
-- -----------------------------------------------------------------------------
create table if not exists envios (
    id uuid default uuid_generate_v4() primary key,
    venta_id uuid references ventas(id) on delete cascade not null unique,
    repartidor_id uuid references repartidores(id) on delete restrict,
    direccion_despacho text not null,
    costo_envio numeric(12, 2) default 0.00 not null check (costo_envio >= 0),
    estado_envio varchar(30) default 'Pendiente' not null check (estado_envio in ('Por Despachar', 'Pendiente', 'En Camino', 'Entregado', 'Cancelado')),
    latitud numeric(10, 8) default null check (latitud is null or (latitud >= -90.00000000 and latitud <= 90.00000000)),
    longitud numeric(11, 8) default null check (longitud is null or (longitud >= -180.00000000 and longitud <= 180.00000000)),
    fecha_despacho timestamp with time zone,
    fecha_entrega timestamp with time zone,
    motivo_cancelacion text,
    fecha_creacion timestamp with time zone default now() not null,
    fecha_actualizacion timestamp with time zone default now() not null
);

comment on table envios is 'Información detallada para el reparto a domicilio de las ventas.';
create index if not exists idx_envios_estado on envios(estado_envio);
create index if not exists idx_envios_repartidor on envios(repartidor_id);
create index if not exists idx_envios_repartidor_estado on envios(repartidor_id, estado_envio);
create index if not exists idx_envios_coordenadas on envios(latitud, longitud);
create index if not exists idx_envios_pendientes_libres on envios(id) where estado_envio = 'Pendiente' and repartidor_id is null;

-- -----------------------------------------------------------------------------
-- 3. TABLA: configuracion_sistema
-- -----------------------------------------------------------------------------
create table if not exists configuracion_sistema (
    id uuid primary key default gen_random_uuid(),
    clave varchar(100) not null unique,
    valor text
);

comment on table configuracion_sistema is 'Configuración global del sistema en pares clave-valor.';
comment on column configuracion_sistema.clave is 'Identificador único (ej: kiosco_latitud, logo_url).';
comment on column configuracion_sistema.valor is 'Valor en texto; se castea en el cliente según necesidad.';

create index if not exists idx_configuracion_sistema_clave on configuracion_sistema (clave);

alter table configuracion_sistema enable row level security;

drop policy if exists "permitir_lectura_configuracion_todos" on configuracion_sistema;
create policy "permitir_lectura_configuracion_todos"
    on configuracion_sistema for select using (true);

drop policy if exists "permitir_escritura_configuracion_service_role" on configuracion_sistema;
create policy "permitir_escritura_configuracion_service_role"
    on configuracion_sistema for all using (true) with check (true);

-- Valores por defecto del kiosco (Bolivia)
insert into configuracion_sistema (clave, valor)
values
    ('kiosco_latitud', '-17.7833'),
    ('kiosco_longitud', '-63.1667'),
    ('kiosco_nombre', 'Tienda Margarita'),
    ('qr_pago_imagen', ''),
    ('logo_url', '')
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS DE ACTUALIZACIÓN DE FECHA
-- -----------------------------------------------------------------------------
create trigger trg_repartidores_update before update on repartidores
    for each row execute function update_fecha_actualizacion();

create trigger trg_envios_update before update on envios
    for each row execute function update_fecha_actualizacion();

-- Auditoría de repartidores/envíos gestionada por FastAPI (bitacora_usuarios)
