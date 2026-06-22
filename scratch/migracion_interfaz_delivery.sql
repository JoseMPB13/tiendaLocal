-- =============================================================================
-- SCRIPT DE PARCHE: Motivo de Cancelación en Envíos (migracion_interfaz_delivery.sql)
-- Idioma: Español
-- =============================================================================

ALTER TABLE envios ADD COLUMN IF NOT EXISTS motivo_cancelacion text;
