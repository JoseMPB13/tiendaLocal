-- =============================================================================
-- SCRIPT DE MIGRACIÓN: Enlace de Ubicación de Clientes (migracion_enlace_ubicacion.sql)
-- Idioma: Español
-- =============================================================================

-- Agregar la columna enlace_ubicacion de forma segura si no existe
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS enlace_ubicacion text;
