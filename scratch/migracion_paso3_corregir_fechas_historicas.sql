-- =============================================================================
-- MIGRACIÓN PASO 3: Corregir fechas históricas mal almacenadas
-- Propósito: Reinterpretar timestamps guardados como "hora boliviana etiquetada
--            como UTC" (bug del default timezone('America/La_Paz', now()) en Supabase).
--
-- CUÁNDO EJECUTAR: Si en la bitácora/ventas la hora aparece ~4 horas ATRÁS
--                  de la hora real en Bolivia (ej. muestra 17:00 cuando fue 21:00).
--
-- IMPORTANTE: Haz backup antes. Ejecutar UNA sola vez.
-- Idioma: Español
-- =============================================================================

BEGIN;

UPDATE ventas
SET fecha_venta = (fecha_venta AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz';

UPDATE bitacora_usuarios
SET fecha = (fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz';

UPDATE historial_stock
SET fecha_movimiento = (fecha_movimiento AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz';

UPDATE facturas
SET fecha_emision = (fecha_emision AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'envios') THEN
        UPDATE envios
        SET fecha_creacion = (fecha_creacion AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz'
        WHERE fecha_creacion IS NOT NULL;

        UPDATE envios
        SET fecha_actualizacion = (fecha_actualizacion AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz'
        WHERE fecha_actualizacion IS NOT NULL;
    END IF;
END $$;

COMMIT;
