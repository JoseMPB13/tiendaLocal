-- =============================================================================
-- SCRIPT DE PARCHE: Soporte para Pago QR (migracion_soporte_pago_qr.sql)
-- Idioma: Español
-- =============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar cualquier restricción CHECK existente en la columna tipo_pago de la tabla ventas
    FOR r IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'ventas' AND ccu.column_name = 'tipo_pago' AND tc.constraint_type = 'CHECK'
    LOOP
        EXECUTE 'ALTER TABLE ventas DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Agregar la nueva restricción CHECK con soporte para el método 'QR'
ALTER TABLE ventas ADD CONSTRAINT chk_ventas_tipo_pago CHECK (tipo_pago IN ('Efectivo', 'Tarjeta', 'Credito', 'Transferencia', 'QR'));
