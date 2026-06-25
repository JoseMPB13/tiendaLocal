-- =============================================================================
-- SCRIPT DE MIGRACIÓN: INTEGRACIÓN DE UBICACIÓN GEOGRÁFICA DE CLIENTES
-- Guardado en: scratch/migracion_ubicacion_clientes.sql
-- Idioma: Español
-- =============================================================================

-- 1. Agregar columnas a la tabla clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 8) DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS longitud NUMERIC(11, 8) DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS enlace_mapa TEXT DEFAULT NULL;

-- 2. Agregar restricciones CHECK para validar coordenadas
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_latitud_rango;
ALTER TABLE clientes ADD CONSTRAINT chk_clientes_latitud_rango 
    CHECK (latitud IS NULL OR (latitud >= -90.00000000 AND latitud <= 90.00000000));

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_longitud_rango;
ALTER TABLE clientes ADD CONSTRAINT chk_clientes_longitud_rango 
    CHECK (longitud IS NULL OR (longitud >= -180.00000000 AND longitud <= 180.00000000));

-- 3. Crear índice para optimizar búsquedas espaciales/geográficas básicas
CREATE INDEX IF NOT EXISTS idx_clientes_coordenadas ON clientes(latitud, longitud);

COMMENT ON COLUMN clientes.latitud IS 'Coordenada geográfica de latitud (-90 a 90).';
COMMENT ON COLUMN clientes.longitud IS 'Coordenada geográfica de longitud (-180 a 180).';
COMMENT ON COLUMN clientes.enlace_mapa IS 'Enlace directo a Google Maps u OpenStreetMap.';
