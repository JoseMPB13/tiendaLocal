
-- =============================================================================
-- SCRIPT DE POBLACIÓN DE DATOS DE PRUEBA: TIENDALOCAL (seed_data.sql)
-- Idioma: Español
-- =============================================================================

begin;

-- 1. LIMPIEZA DE DATOS PREVIOS (Opcional, en orden inverso de dependencias)
truncate table detalles_ventas cascade;
truncate table ventas cascade;
truncate table historial_stock cascade;
truncate table repartidores cascade;
truncate table productos cascade;
truncate table categorias cascade;
truncate table clientes cascade;
truncate table usuarios cascade;

-- 2. POBLACIÓN DE LA TABLA: usuarios
-- Contraseña para todos los usuarios: 123456
-- Hash Bcrypt: $2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/OBXWE5kJ7ixm7IkzY7kv6K6axK
insert into usuarios (id, email, password_hash, nombre_completo, rol, estado) values
('d3b07384-d113-49c3-a3d1-ae40cfdc6f1d', 'admin@tiendalocal.com', '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/OBXWE5kJ7ixm7IkzY7kv6K6axK', 'Administrador Principal', 'Administrador', 'Activo'),
('c5e317c8-0d04-4b53-9d41-38cce8ee18b9', 'cajero@tiendalocal.com', '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/OBXWE5kJ7ixm7IkzY7kv6K6axK', 'Cajero de Turno', 'Cajero', 'Activo'),
('7f6b95d9-4ee7-4a0b-8d77-9df03bf577b2', 'repartidor@tiendalocal.com', '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/OBXWE5kJ7ixm7IkzY7kv6K6axK', 'Repartidor Veloz', 'Repartidor', 'Activo');

-- 3. POBLACIÓN DE LA TABLA: repartidores (Extensión de usuarios)
insert into repartidores (id, usuario_id, vehiculo, placa, estado_repartidor) values
('f22cf34d-1763-4424-9b22-8353cdcd3cbb', '7f6b95d9-4ee7-4a0b-8d77-9df03bf577b2', 'Motocicleta Honda Cargo 150', 'MOTO-9876', 'Disponible');

-- 4. POBLACIÓN DE LA TABLA: categorias
insert into categorias (id, nombre, descripcion, estado) values
('e2298e82-e02c-473d-9d7a-1ee824c9c1b8', 'Bebidas', 'Bebidas carbonatadas, jugos, aguas y bebidas energéticas', 'Activo'),
('3f2bc901-4432-475b-9d4e-128a1c8f18c2', 'Snacks', 'Papas fritas, galletas, chocolates y dulces de todo tipo', 'Activo'),
('8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', 'Abarrotes', 'Productos de primera necesidad alimenticia (arroz, aceite, fideos)', 'Activo'),
('6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', 'Limpieza', 'Artículos para el aseo del hogar y personal', 'Activo');

-- 5. POBLACIÓN DE LA TABLA: productos (Inventario Inicial)
-- Algunos con código de barras comercial y otros vacíos/nulos para disparar el trigger de KIO-%
insert into productos (id, categoria_id, codigo_barras, nombre, descripcion, precio_compra, precio_venta, stock_actual, stock_minimo, estado) values
('a2c3d4e5-f6a7-4b8c-9d0e-111111111111', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '750100000011', 'Coca Cola 2.5L Retornable', 'Refresco de cola de la familia Coca Cola', 1.80, 2.50, 60, 10, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-222222222222', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', '750100000022', 'Agua Mineral 1.5L', 'Agua de manantial purificada sin gas', 0.80, 1.20, 45, 5, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-333333333333', 'e2298e82-e02c-473d-9d7a-1ee824c9c1b8', null, 'Jugo de Naranja Natural 1L', 'Jugo natural pasteurizado rico en vitamina C', 1.10, 1.70, 30, 8, 'Activo'),

('a2c3d4e5-f6a7-4b8c-9d0e-444444444444', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '750100000044', 'Papas Fritas Saladas 150g', 'Papas fritas crujientes con sal marina', 1.00, 1.50, 80, 15, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-555555555555', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', '750100000055', 'Chocolates Rellenos 50g', 'Barra de chocolate de leche con relleno cremoso', 0.60, 1.00, 100, 10, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-666666666666', '3f2bc901-4432-475b-9d4e-128a1c8f18c2', null, 'Galletas de Avena con Pasas', 'Paquete de galletas saludables horneadas', 0.90, 1.40, 50, 10, 'Activo'),

('a2c3d4e5-f6a7-4b8c-9d0e-777777777777', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '750100000077', 'Arroz Extra Seleccionado 1kg', 'Arroz blanco de grano largo premium', 1.20, 1.80, 90, 20, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-888888888888', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', '750100000088', 'Aceite Vegetal de Girasol 1L', 'Aceite ideal para cocinar saludable', 2.20, 3.20, 40, 12, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-999999999999', '8d1e2e34-5567-4a92-9e2c-234b8c9f08d1', null, 'Fideos Spaghetti 500g', 'Fideos de sémola de trigo duro de cocción rápida', 0.50, 0.80, 100, 15, 'Activo'),

('a2c3d4e5-f6a7-4b8c-9d0e-aaaaaaaaaaaa', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '750100000100', 'Detergente en Polvo Multiusos 1kg', 'Fórmula biodegradable quitamanchas', 1.50, 2.30, 50, 10, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-bbbbbbbbbbbb', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', '750100000200', 'Jabón Líquido Antibacterial 500ml', 'Para cuidado e higiene de manos con aroma suave', 1.10, 1.85, 35, 8, 'Activo'),
('a2c3d4e5-f6a7-4b8c-9d0e-cccccccccccc', '6b2f3e45-7789-4a9f-a2e3-345c9d0f1a2b', null, 'Esponja de Cocina Doble Cara', 'Paquete de 3 esponjas de alta resistencia abrasiva', 0.40, 0.70, 120, 10, 'Activo');

-- 6. POBLACIÓN DE LA TABLA: clientes
insert into clientes (id, dni_ruc, nombre, telefono, direccion, saldo_deudor, limite_credito, estado) values
('23e6cf56-823a-4424-aa11-897bdc07c2a1', '10457891234', 'Juan Carlos Mendoza', '+51 987654321', 'Av. Larco 745, Miraflores', 0.00, 500.00, 'Activo'),
('34d7ef67-934b-4535-bb22-908ced08d3b2', '20556677889', 'Distribuidora Alianza S.A.C.', '+51 912345678', 'Calle Las Gemas 451, San Isidro', 0.00, 500.00, 'Activo'),
('45e8fa78-045c-4646-cc33-019dfee9e4c3', '40556677', 'María Elena Rostworowski', '+51 945612378', 'Jr. Junín 325, Centro Histórico', 0.00, 0.00, 'Activo');

commit;
