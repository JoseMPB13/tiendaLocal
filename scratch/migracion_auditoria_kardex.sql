-- =============================================================================
-- SCRIPT DE PARCHE: Columna Motivo en historial_stock (migracion_auditoria_kardex.sql)
-- Idioma: Español
-- =============================================================================

ALTER TABLE historial_stock ADD COLUMN IF NOT EXISTS motivo text;
