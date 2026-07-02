-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Infraestructura de Seguimiento en Tiempo Real (Bloque 6)
-- Guardado en: scratch/migracion_seguimiento_delivery.sql
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECCIÓN 1: Extensión de la tabla `repartidores`
-- Añade las columnas de posición GPS del repartidor en tiempo real.
-- -----------------------------------------------------------------------------

-- Columna de latitud actual del repartidor (rango válido: -90 a 90)
ALTER TABLE repartidores
  ADD COLUMN IF NOT EXISTS latitud_actual NUMERIC(10, 8) DEFAULT NULL;

-- Columna de longitud actual del repartidor (rango válido: -180 a 180)
ALTER TABLE repartidores
  ADD COLUMN IF NOT EXISTS longitud_actual NUMERIC(11, 8) DEFAULT NULL;

-- Timestamp de la última actualización de posición para diagnóstico de lag
ALTER TABLE repartidores
  ADD COLUMN IF NOT EXISTS ultima_actualizacion_gps TIMESTAMPTZ DEFAULT NULL;

-- Restricciones de rango geográfico para latitud del repartidor
ALTER TABLE repartidores DROP CONSTRAINT IF EXISTS chk_repartidores_latitud_rango;
ALTER TABLE repartidores ADD CONSTRAINT chk_repartidores_latitud_rango
  CHECK (latitud_actual IS NULL OR (latitud_actual >= -90.00000000 AND latitud_actual <= 90.00000000));

-- Restricciones de rango geográfico para longitud del repartidor
ALTER TABLE repartidores DROP CONSTRAINT IF EXISTS chk_repartidores_longitud_rango;
ALTER TABLE repartidores ADD CONSTRAINT chk_repartidores_longitud_rango
  CHECK (longitud_actual IS NULL OR (longitud_actual >= -180.00000000 AND longitud_actual <= 180.00000000));

-- Índice para consultas frecuentes de posición por repartidor
CREATE INDEX IF NOT EXISTS idx_repartidores_ubicacion_gps
  ON repartidores (id, latitud_actual, longitud_actual)
  WHERE latitud_actual IS NOT NULL AND longitud_actual IS NOT NULL;

COMMENT ON COLUMN repartidores.latitud_actual IS
  'Latitud GPS en tiempo real del repartidor. Actualizada por el dispositivo móvil del repartidor cada pocos segundos mientras está En Ruta.';
COMMENT ON COLUMN repartidores.longitud_actual IS
  'Longitud GPS en tiempo real del repartidor. Actualizada por el dispositivo móvil del repartidor cada pocos segundos mientras está En Ruta.';
COMMENT ON COLUMN repartidores.ultima_actualizacion_gps IS
  'Timestamp de la última señal GPS recibida del repartidor. Útil para detectar problemas de conectividad.';


-- -----------------------------------------------------------------------------
-- SECCIÓN 2: Tabla `configuracion_sistema`
-- Almacena pares clave-valor de configuración persistente del sistema,
-- incluyendo las coordenadas fijas del kiosco (punto de origen de las rutas).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave  VARCHAR(100) NOT NULL UNIQUE,
  valor  TEXT
);

COMMENT ON TABLE configuracion_sistema IS
  'Tabla de configuración global del sistema. Almacena pares clave-valor persistentes.';
COMMENT ON COLUMN configuracion_sistema.clave IS
  'Identificador único de la configuración. Ej: kiosco_latitud, kiosco_longitud.';
COMMENT ON COLUMN configuracion_sistema.valor IS
  'Valor de la configuración en formato texto. Se castea al tipo necesario en el cliente.';

-- Índice en clave para consultas O(log n) por nombre de configuración
CREATE INDEX IF NOT EXISTS idx_configuracion_sistema_clave
  ON configuracion_sistema (clave);


-- -----------------------------------------------------------------------------
-- SECCIÓN 3: Políticas de Seguridad (Row Level Security)
-- La configuración del sistema es legible por todos los roles del sistema,
-- pero solo modificable por Administradores (esto se garantiza a nivel de endpoint).
-- -----------------------------------------------------------------------------

ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos los roles autenticados
DROP POLICY IF EXISTS "permitir_lectura_configuracion_todos" ON configuracion_sistema;
CREATE POLICY "permitir_lectura_configuracion_todos"
  ON configuracion_sistema
  FOR SELECT
  USING (true);

-- Permitir escritura irrestricta (la autorización se controla en el backend FastAPI)
DROP POLICY IF EXISTS "permitir_escritura_configuracion_service_role" ON configuracion_sistema;
CREATE POLICY "permitir_escritura_configuracion_service_role"
  ON configuracion_sistema
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- SECCIÓN 4: Datos Semilla (Seed)
-- Inserta la ubicación por defecto del kiosco (Santa Cruz de la Sierra, Bolivia).
-- El Administrador puede modificarla desde la UI de configuración del sistema.
-- -----------------------------------------------------------------------------

INSERT INTO configuracion_sistema (clave, valor)
VALUES
  ('kiosco_latitud',  '-17.7833'),
  ('kiosco_longitud', '-63.1667'),
  ('kiosco_nombre',   'Tienda Margarita'),
  ('qr_pago_imagen',  '')
ON CONFLICT (clave) DO NOTHING;

-- =============================================================================
-- FIN DE LA MIGRACIÓN
-- Instrucciones de ejecución:
--   1. Abrir el SQL Editor de Supabase (https://supabase.com/dashboard)
--   2. Pegar y ejecutar este script completo
--   3. Verificar que no haya errores en los mensajes de respuesta
--   4. Confirmar en la tabla `repartidores` que existen las columnas nuevas
--   5. Confirmar en `configuracion_sistema` que los 3 registros de seed fueron insertados
-- =============================================================================
