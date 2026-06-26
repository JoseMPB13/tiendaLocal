-- =============================================================================
-- MIGRACIÓN DE BASE DE DATOS: migracion_bitacora_sistema.sql
-- Propósito: Implementar la tabla de bitácora de auditoría y la función para
--            obtener movimientos de inventario agrupados por períodos de tiempo.
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREACIÓN DE LA TABLA: bitacora_usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_usuarios (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references usuarios(id) on delete set null,
    accion varchar(50) not null,
    tabla_afectada varchar(100) not null,
    registro_id uuid not null,
    detalles text,
    fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE bitacora_usuarios IS 'Tabla unificada para auditoría de acciones críticas de usuarios en el sistema.';

-- Índices optimizados para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_bitacora_usuarios_tabla ON bitacora_usuarios(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuarios_fecha ON bitacora_usuarios(fecha);

-- RLS y Políticas de Seguridad
ALTER TABLE bitacora_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir select de bitacora_usuarios a todos"
ON bitacora_usuarios FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir insert de bitacora_usuarios a todos"
ON bitacora_usuarios FOR INSERT TO anon, authenticated WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN DE AGREGACIÓN DE INVENTARIO: obtener_movimientos_stock_agrupados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_movimientos_stock_agrupados(p_periodo text)
RETURNS TABLE (
    periodo_fecha timestamp with time zone,
    producto_id uuid,
    producto_nombre varchar(150),
    tipo_movimiento varchar(50),
    total_entradas numeric,
    total_salidas numeric,
    balance_neto numeric,
    cantidad_movimientos bigint
) AS $$
DECLARE
    v_trunc_period text;
BEGIN
    IF p_periodo = 'dia' THEN
        v_trunc_period := 'day';
    ELSIF p_periodo = 'semana' THEN
        v_trunc_period := 'week';
    ELSIF p_periodo = 'mes' THEN
        v_trunc_period := 'month';
    ELSE
        v_trunc_period := 'day';
    END IF;

    RETURN QUERY
    SELECT 
        date_trunc(v_trunc_period, hs.fecha_movimiento)::timestamp with time zone AS periodo_fecha,
        hs.producto_id,
        p.nombre AS producto_nombre,
        hs.tipo_movimiento,
        coalesce(SUM(CASE WHEN hs.cantidad_cambio > 0 THEN hs.cantidad_cambio ELSE 0 END), 0)::numeric AS total_entradas,
        coalesce(SUM(CASE WHEN hs.cantidad_cambio < 0 THEN hs.cantidad_cambio ELSE 0 END), 0)::numeric AS total_salidas,
        coalesce(SUM(hs.cantidad_cambio), 0)::numeric AS balance_neto,
        COUNT(*)::bigint AS cantidad_movimientos
    FROM historial_stock hs
    JOIN productos p ON p.id = hs.producto_id
    GROUP BY 1, hs.producto_id, p.nombre, hs.tipo_movimiento
    ORDER BY 1 DESC, p.nombre ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_movimientos_stock_agrupados(text) IS 'Retorna movimientos de stock agrupados y consolidados por día, semana o mes.';


-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN TRIGGER PARA AUDITORÍA AUTOMÁTICA DE ACCIONES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auditar_acciones_usuario()
RETURNS trigger AS $$
DECLARE
    v_usuario_id uuid := null;
    v_accion varchar(50);
    v_detalles text;
    v_registro_id uuid;
    v_old_json jsonb := null;
    v_new_json jsonb := null;
BEGIN
    -- Convertir registros a JSONB para evitar errores de acceso a campos dinámicos
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        v_old_json := to_jsonb(OLD);
        v_registro_id := OLD.id;
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_new_json := to_jsonb(NEW);
        v_registro_id := NEW.id;
    END IF;

    -- 1. Intentar recuperar el ID del usuario desde la sesión de PostgreSQL configurada por el backend
    BEGIN
        v_usuario_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_usuario_id := null;
    END;

    -- 2. Si es nulo y estamos en ventas o compras, intentar recuperar de las columnas correspondientes
    IF v_usuario_id IS NULL THEN
        IF TG_TABLE_NAME = 'ventas' OR TG_TABLE_NAME = 'compras' THEN
            v_usuario_id := (v_new_json->>'usuario_id')::uuid;
        END IF;
    END IF;

    -- 3. Discriminar la operación y la acción de auditoría
    IF TG_OP = 'INSERT' THEN
        v_accion := 'CREAR';
        v_detalles := 'Creación inicial del registro.';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Verificar si es una baja lógica (inactivar o cancelar)
        IF TG_TABLE_NAME = 'productos' AND (v_old_json->>'estado') <> (v_new_json->>'estado') AND (v_new_json->>'estado') = 'Inactivo' THEN
            v_accion := 'DESACTIVAR';
            v_detalles := 'Inactivación del producto (baja lógica).';
        ELSIF TG_TABLE_NAME = 'clientes' AND (v_old_json->>'estado') <> (v_new_json->>'estado') AND (v_new_json->>'estado') = 'Inactivo' THEN
            v_accion := 'DESACTIVAR';
            v_detalles := 'Inactivación del cliente (baja lógica).';
        ELSIF TG_TABLE_NAME = 'ventas' AND (v_old_json->>'estado_venta') <> (v_new_json->>'estado_venta') AND (v_new_json->>'estado_venta') = 'Cancelada' THEN
            v_accion := 'ANULAR';
            v_detalles := 'Anulación física/lógica de la venta.';
        ELSIF TG_TABLE_NAME = 'compras' AND (v_old_json->>'estado_compra') <> (v_new_json->>'estado_compra') AND (v_new_json->>'estado_compra') = 'Cancelada' THEN
            v_accion := 'ANULAR';
            v_detalles := 'Anulación de compra de reabastecimiento.';
        ELSE
            v_accion := 'MODIFICAR';
            v_detalles := 'Actualización general de campos del registro.';
        END IF;
    ELSE
        -- DELETE
        v_accion := 'ELIMINAR';
        v_detalles := 'Eliminación física del registro de la base de datos.';
    END IF;

    -- 4. Insertar la auditoría en la tabla de bitácora
    INSERT INTO bitacora_usuarios (usuario_id, accion, tabla_afectada, registro_id, detalles, fecha)
    VALUES (v_usuario_id, v_accion, TG_TABLE_NAME, v_registro_id, v_detalles, timezone('utc'::text, now()));

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_auditar_acciones_usuario() IS 'Trigger automatizado para registrar la auditoría de inserción, actualización o baja en bitacora_usuarios.';


-- -----------------------------------------------------------------------------
-- 4. ASIGNACIÓN DE DISPARADORES (TRIGGERS) A TABLAS PRINCIPALES
-- -----------------------------------------------------------------------------

-- Trigger para clientes
CREATE OR REPLACE TRIGGER trg_auditar_clientes
AFTER INSERT OR UPDATE OR DELETE ON clientes
FOR EACH ROW EXECUTE FUNCTION fn_auditar_acciones_usuario();

-- Trigger para productos
CREATE OR REPLACE TRIGGER trg_auditar_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION fn_auditar_acciones_usuario();

-- Trigger para ventas
CREATE OR REPLACE TRIGGER trg_auditar_ventas
AFTER INSERT OR UPDATE OR DELETE ON ventas
FOR EACH ROW EXECUTE FUNCTION fn_auditar_acciones_usuario();

-- Trigger para compras
CREATE OR REPLACE TRIGGER trg_auditar_compras
AFTER INSERT OR UPDATE OR DELETE ON compras
FOR EACH ROW EXECUTE FUNCTION fn_auditar_acciones_usuario();
