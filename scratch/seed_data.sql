-- =============================================================================
-- SCRIPT DE POBLACIÓN DE DATOS DE DEMOSTRACIÓN: TIENDALOCAL (seed_data.sql)
--
-- Contenido:
--   - 3 usuarios (Administrador, Cajero, Repartidor) — contraseña: 123456
--   - 5 categorías
--   - 30 productos (6 por categoría)
--   - 10 clientes (La Paz / Santa Cruz, algunos con coordenadas GPS)
--
-- Requisito previo: esquema maestro desplegado (schema + delivery + programmability).
-- Ejecutar antes scratch/limpiar_base_datos.sql si la BD ya tiene datos.
--
-- Idioma: Español
-- =============================================================================

begin;

-- Contraseña para todos los usuarios: 123456
-- Hash Bcrypt (12 rondas), verificado con backend/app/services/seguridad.py
-- $2b$12$5aboQ2OT9TyX3gO910OSBuw8pviyf66KzSFLFf6mMfO3gUiGY0HhS

-- -----------------------------------------------------------------------------
-- 1. USUARIOS (3 roles distintos)
-- -----------------------------------------------------------------------------
insert into usuarios (id, email, password_hash, nombre_completo, rol, estado) values
('d3b07384-d113-49c3-a3d1-ae40cfdc6f1d', 'admin@tiendalocal.com',    '$2b$12$5aboQ2OT9TyX3gO910OSBuw8pviyf66KzSFLFf6mMfO3gUiGY0HhS', 'María Fernández Ríos',   'Administrador', 'Activo'),
('c5e317c8-0d04-4b53-9d41-38cce8ee18b9', 'cajero@tiendalocal.com',     '$2b$12$5aboQ2OT9TyX3gO910OSBuw8pviyf66KzSFLFf6mMfO3gUiGY0HhS', 'Carlos Mendoza Quispe',  'Cajero',        'Activo'),
('7f6b95d9-4ee7-4a0b-8d77-9df03bf577b2', 'repartidor@tiendalocal.com', '$2b$12$5aboQ2OT9TyX3gO910OSBuw8pviyf66KzSFLFf6mMfO3gUiGY0HhS', 'Jorge Mamani Condori',   'Repartidor',    'Activo');

-- -----------------------------------------------------------------------------
-- 2. REPARTIDOR (perfil vinculado al usuario Repartidor)
-- -----------------------------------------------------------------------------
insert into repartidores (id, usuario_id, vehiculo, placa, estado_repartidor, latitud_actual, longitud_actual) values
('f22cf34d-1763-4424-9b22-8353cdcd3cbb', '7f6b95d9-4ee7-4a0b-8d77-9df03bf577b2', 'Motocicleta Bajaj Boxer 150', '4521-ABC', 'Disponible', -17.78330000, -63.16670000);

-- -----------------------------------------------------------------------------
-- 3. CATEGORÍAS (5)
-- -----------------------------------------------------------------------------
insert into categorias (id, nombre, descripcion, estado) values
('e2298e82-e02c-473d-9d7a-1ee824c9c1b8', 'Bebidas',        'Refrescos, jugos, aguas y bebidas energéticas',                    'Activo'),
('3f2bc901-4432-475b-9d4e-128a1c8f18c2', 'Snacks',         'Papas fritas, galletas, chocolates y golosinas',                 'Activo'),
('8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', 'Abarrotes',      'Arroz, aceite, fideos y productos de despensa',                   'Activo'),
('6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', 'Limpieza',       'Detergentes, jabones y artículos de aseo del hogar',               'Activo'),
('1a2b3c4d-5e6f-7890-abcd-ef1234567890', 'Lácteos',        'Leche, yogur, quesos y derivados lácteos refrigerados',          'Activo');

-- -----------------------------------------------------------------------------
-- 4. PRODUCTOS (30 — 6 por categoría)
-- Algunos con codigo_barras comercial; otros null disparan autogeneración KIO-
-- -----------------------------------------------------------------------------
insert into productos (id, categoria_id, codigo_barras, nombre, descripcion, precio_compra, precio_venta, stock_actual, stock_minimo, estado) values
-- Bebidas (6)
('b0010001-0000-4000-8000-000000000001', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '7840001001001', 'Coca Cola 2L Retornable',       'Refresco de cola familiar 2 litros',              8.50,  12.00, 48, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000002', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '7840001001002', 'Pepsi 2L',                      'Refresco de cola 2 litros',                       8.00,  11.50, 40, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000003', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '7840001001003', 'Agua Vital 2L',                 'Agua purificada sin gas',                         3.50,   5.00, 60, 15, 'Activo'),
('b0010001-0000-4000-8000-000000000004', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', null,            'Jugo Del Valle Naranja 1L',     'Jugo de naranja pasteurizado',                    6.00,   8.50, 35,  8, 'Activo'),
('b0010001-0000-4000-8000-000000000005', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '7840001001005', 'Speed Max 473ml',               'Bebida energética',                               5.50,   8.00, 72, 12, 'Activo'),
('b0010001-0000-4000-8000-000000000006', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', null,            'Té Lipton Durazno 500ml',       'Té frío sabor durazno',                           4.00,   6.00, 45, 10, 'Activo'),
-- Snacks (6)
('b0010001-0000-4000-8000-000000000007', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '7840002001001', 'Papas Lays Clásicas 140g',      'Papas fritas saladas',                            7.00,  10.00, 55, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000008', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '7840002001002', 'Doritos Nacho 150g',            'Totopos sabor queso nacho',                       7.50,  10.50, 50, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000009', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '7840002001003', 'Chocolate Sublime 25g',         'Barra de chocolate con maní',                     2.50,   4.00, 80, 15, 'Activo'),
('b0010001-0000-4000-8000-000000000010', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', null,            'Galletas Oreo 108g',            'Galletas rellenas de crema',                      5.00,   7.50, 42, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000011', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '7840002001005', 'Mani Salado Don Kilo 200g',     'Maní tostado y salado',                           4.50,   6.50, 38,  8, 'Activo'),
('b0010001-0000-4000-8000-000000000012', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', null,            'Chizitos Picante 85g',          'Snack de maíz picante',                           3.00,   4.50, 65, 10, 'Activo'),
-- Abarrotes (6)
('b0010001-0000-4000-8000-000000000013', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '7840003001001', 'Arroz Grano de Oro 1kg',        'Arroz extra grano largo',                         9.00,  12.50, 90, 20, 'Activo'),
('b0010001-0000-4000-8000-000000000014', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '7840003001002', 'Aceite IDEAL 900ml',            'Aceite vegetal de girasol',                      14.00,  18.50, 45, 12, 'Activo'),
('b0010001-0000-4000-8000-000000000015', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '7840003001003', 'Fideos Don Vittorio 500g',      'Spaghetti de sémola de trigo',                    4.50,   6.50, 70, 15, 'Activo'),
('b0010001-0000-4000-8000-000000000016', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', null,            'Azúcar Blanca 1kg',             'Azúcar refinada para consumo diario',             6.50,   9.00, 55, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000017', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '7840003001005', 'Sal Yura 1kg',                  'Sal de mesa yodada',                              2.00,   3.50, 100, 15, 'Activo'),
('b0010001-0000-4000-8000-000000000018', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', null,            'Harina Blanca Flor 1kg',        'Harina de trigo todo uso',                        7.00,   9.50, 40, 10, 'Activo'),
-- Limpieza (6)
('b0010001-0000-4000-8000-000000000019', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '7840004001001', 'Detergente OMO 1kg',            'Detergente en polvo multiusos',                  18.00,  24.00, 35,  8, 'Activo'),
('b0010001-0000-4000-8000-000000000020', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '7840004001002', 'Jabón Protex 110g',             'Jabón antibacterial',                             4.00,   6.00, 60, 12, 'Activo'),
('b0010001-0000-4000-8000-000000000021', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '7840004001003', 'Lavandina Patito 1L',           'Blanqueador y desinfectante',                     5.50,   8.00, 28,  6, 'Activo'),
('b0010001-0000-4000-8000-000000000022', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', null,            'Esponja Scotch-Brite x3',       'Esponjas abrasivas para cocina',                  6.00,   9.00, 45, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000023', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '7840004001005', 'Papel Higiénico Elite 4 rollos','Papel higiénico doble hoja',                      8.00,  11.00, 50, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000024', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', null,            'Bolsa de Basura 50x70 cm x10',  'Bolsas negras resistentes',                       7.50,  10.00, 30,  8, 'Activo'),
-- Lácteos (6)
('b0010001-0000-4000-8000-000000000025', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', '7840005001001', 'Leche PIL Andina 1L',           'Leche entera UHT',                                6.50,   9.00, 40, 10, 'Activo'),
('b0010001-0000-4000-8000-000000000026', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', '7840005001002', 'Yogur Kumis Fresa 1L',          'Yogur bebible sabor fresa',                       8.00,  11.00, 32,  8, 'Activo'),
('b0010001-0000-4000-8000-000000000027', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', '7840005001003', 'Queso Menonita 500g',           'Queso semiduro para sandwich',                   22.00,  28.00, 18,  5, 'Activo'),
('b0010001-0000-4000-8000-000000000028', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', null,            'Mantequilla Soprole 200g',      'Mantequilla con sal',                            12.00,  16.00, 25,  6, 'Activo'),
('b0010001-0000-4000-8000-000000000029', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', '7840005001005', 'Leche Condensada Nestlé 397g',  'Leche condensada azucarada',                      9.50,  13.00, 30,  8, 'Activo'),
('b0010001-0000-4000-8000-000000000030', '1a2b3c4d-5e6f-7890-abcd-ef1234567890', null,            'Crema de Leche 200ml',          'Crema para café y repostería',                    7.00,  10.00, 22,  5, 'Activo');

-- Sincronizar secuencia KIO- con productos ya insertados (por si hubo autogenerados)
select setval(
    'seq_codigo_barras_producto',
    coalesce((
        select max(nullif(regexp_replace(codigo_barras, '^KIO-', ''), '')::integer)
        from productos
        where codigo_barras like 'KIO-%'
    ), 0) + 1,
    false
);

-- -----------------------------------------------------------------------------
-- 5. CLIENTES (10 — mix contado y crédito, con coordenadas para delivery)
-- -----------------------------------------------------------------------------
insert into clientes (id, dni_ruc, nombre, telefono, direccion, latitud, longitud, saldo_deudor, limite_credito, estado) values
('c1000001-0000-4000-8000-000000000001', '4853621',  'Roberto Quispe Mamani',      '+591 70123456', 'Av. Costanera 120, Zona Sur, La Paz',           -16.52000000, -68.15000000,  0.00, 500.00, 'Activo'),
('c1000001-0000-4000-8000-000000000002', '7894521',  'Ana Laura Vargas Roca',      '+591 71234567', 'Calle Potosí 456, Centro, La Paz',              -16.50000000, -68.13000000,  0.00, 300.00, 'Activo'),
('c1000001-0000-4000-8000-000000000003', '1023456789','Distribuidora El Trigal S.R.L.', '+591 72345678', 'Av. Beni 890, 2do anillo, Santa Cruz',     -17.78330000, -63.16670000,  0.00, 2000.00, 'Activo'),
('c1000001-0000-4000-8000-000000000004', '6543210',  'Pedro Gutiérrez Soliz',      '+591 73456789', 'Calle Junín 234, Centro Histórico, La Paz',     -16.49500000, -68.13700000,  0.00,   0.00, 'Activo'),
('c1000001-0000-4000-8000-000000000005', '8765432',  'Lucía Fernández Choque',     '+591 74567890', 'Zona Villa Fátima, Calle 3 #45, La Paz',        -16.53000000, -68.12000000,  0.00, 400.00, 'Activo'),
('c1000001-0000-4000-8000-000000000006', '3456789012','Minimarket Los Pinos',      '+591 75678901', 'Av. San Aurelio 567, Zona Sur, La Paz',         -16.54500000, -68.10500000,  0.00, 800.00, 'Activo'),
('c1000001-0000-4000-8000-000000000007', '5678901',  'Marcos Condori Apaza',       '+591 76789012', 'Barrio Hamacas, Calle 12, Santa Cruz',          -17.79000000, -63.18000000,  0.00,   0.00, 'Activo'),
('c1000001-0000-4000-8000-000000000008', '9012345',  'Elena Rojas Miranda',        '+591 77890123', 'Av. Arce 1500, Sopocachi, La Paz',              -16.51000000, -68.12500000,  0.00, 250.00, 'Activo'),
('c1000001-0000-4000-8000-000000000009', '2345678',  'Fernando Aguilar Vega',      '+591 78901234', 'Zona Miraflores, Calle 21 #78, La Paz',         -16.50500000, -68.11900000,  0.00,   0.00, 'Activo'),
('c1000001-0000-4000-8000-000000000010', '4567890123','Comercial Andina S.A.',     '+591 79012345', 'Av. Cristo Redentor 3200, Plan 3000, SCZ',      -17.80000000, -63.20000000,  0.00, 1500.00, 'Activo');

commit;

-- Resumen de carga
select 'seed_completado' as estado,
       (select count(*) from usuarios)    as usuarios,
       (select count(*) from categorias)  as categorias,
       (select count(*) from productos)   as productos,
       (select count(*) from clientes)    as clientes;
