-- =============================================================================
-- MIGRACIÓN: Corrección de defaults timestamptz y almacenamiento de ventas
-- Propósito: Los defaults timezone('America/La_Paz', now()) en columnas
--            timestamptz provocan horas incorrectas cuando la sesión DB está
--            en UTC (caso Supabase). La regla correcta es:
--              - GUARDAR con now() (instante absoluto UTC)
--              - MOSTRAR/FILTRAR con (col at time zone 'America/La_Paz')
-- Idioma: Español
-- =============================================================================

ALTER DATABASE postgres SET timezone TO 'America/La_Paz';

-- Defaults de columnas timestamptz → now()
ALTER TABLE usuarios ALTER COLUMN fecha_creacion SET DEFAULT now();
ALTER TABLE usuarios ALTER COLUMN fecha_actualizacion SET DEFAULT now();
ALTER TABLE categorias ALTER COLUMN fecha_creacion SET DEFAULT now();
ALTER TABLE categorias ALTER COLUMN fecha_actualizacion SET DEFAULT now();
ALTER TABLE productos ALTER COLUMN fecha_creacion SET DEFAULT now();
ALTER TABLE productos ALTER COLUMN fecha_actualizacion SET DEFAULT now();
ALTER TABLE clientes ALTER COLUMN fecha_creacion SET DEFAULT now();
ALTER TABLE clientes ALTER COLUMN fecha_actualizacion SET DEFAULT now();
ALTER TABLE ventas ALTER COLUMN fecha_venta SET DEFAULT now();
ALTER TABLE historial_stock ALTER COLUMN fecha_movimiento SET DEFAULT now();
ALTER TABLE facturas ALTER COLUMN fecha_emision SET DEFAULT now();
ALTER TABLE bitacora_usuarios ALTER COLUMN fecha SET DEFAULT now();

-- Corregir función de código de factura (fecha calendario boliviana)
CREATE OR REPLACE FUNCTION generar_codigo_factura()
RETURNS varchar AS $$
DECLARE
    v_fecha text;
    v_ultimo int;
    v_codigo varchar(50);
BEGIN
    v_fecha := to_char(now() AT TIME ZONE 'America/La_Paz', 'YYYYMMDD');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(codigo_factura FROM 'FAC-' || v_fecha || '-(\d+)') AS int)
    ), 0)
    INTO v_ultimo
    FROM ventas
    WHERE codigo_factura LIKE 'FAC-' || v_fecha || '-%';

    v_codigo := 'FAC-' || v_fecha || '-' || LPAD((v_ultimo + 1)::text, 5, '0');
    RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;
