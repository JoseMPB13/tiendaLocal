-- =============================================================================
-- MIGRACIÓN: Configuración de zona horaria Bolivia (America/La_Paz)
-- Propósito: Unificar la zona horaria por defecto de la base de datos PostgreSQL
--            al huso horario oficial de Bolivia para reportes y timestamps.
-- Aplicar en: Base de datos activa de Supabase/PostgreSQL
-- Idioma: Español
-- =============================================================================

ALTER DATABASE postgres SET timezone TO 'America/La_Paz';
