-- =============================================================================
-- SCRIPT DE MIGRACIÓN: CRUD DE VENTAS Y FACTURACIÓN AUTOMÁTICA
-- Propósito: Implementar la persistencia de facturas, numeración correlativa y baja lógica
-- Dependencias: schema.sql y programmability.sql (requiere seq_codigo_factura y tablas maestras)
-- Idioma: Español
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA: facturas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    venta_id uuid REFERENCES ventas(id) ON DELETE RESTRICT UNIQUE,
    codigo_factura varchar(50) UNIQUE NOT NULL,
    total numeric(12, 2) NOT NULL CHECK (total >= 0),
    fecha_emision timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    estado varchar(20) DEFAULT 'Emitida' NOT NULL CHECK (estado IN ('Emitida', 'Anulada'))
);

-- Asegurar que RLS esté desactivado para la tabla facturas
ALTER TABLE facturas DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE facturas IS 'Facturas automáticas generadas a partir de ventas completadas.';
CREATE INDEX IF NOT EXISTS idx_facturas_venta_id ON facturas(venta_id);
CREATE INDEX IF NOT EXISTS idx_facturas_codigo ON facturas(codigo_factura);

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN: obtener_proximo_codigo_factura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_proximo_codigo_factura()
RETURNS varchar AS $$
DECLARE
    v_fecha varchar(8);
    v_next_val bigint;
BEGIN
    -- Obtenemos el próximo valor de la secuencia global sin consumirlo
    SELECT COALESCE(last_value, 1) + CASE WHEN is_called THEN 1 ELSE 0 END
    INTO v_next_val
    FROM seq_codigo_factura;
    
    v_fecha := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
    RETURN 'FAC-' || v_fecha || '-' || lpad(v_next_val::text, 5, '0');
EXCEPTION WHEN OTHERS THEN
    -- Fallback en caso de cualquier error
    RETURN 'FAC-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-00001';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_proximo_codigo_factura IS 'Calcula y retorna el número correlativo de factura que corresponderá a la siguiente venta.';

-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN Y TRIGGER: Facturación Automática
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_facturar_venta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insertar automáticamente en facturas si la venta se crea como 'Completada' o transiciona a ese estado
    IF (TG_OP = 'INSERT' AND NEW.estado_venta = 'Completada') OR 
       (TG_OP = 'UPDATE' AND OLD.estado_venta <> 'Completada' AND NEW.estado_venta = 'Completada') THEN
        
        INSERT INTO facturas (venta_id, codigo_factura, total, fecha_emision, estado)
        VALUES (NEW.id, NEW.codigo_factura, NEW.total, timezone('utc'::text, now()), 'Emitida')
        ON CONFLICT (venta_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_facturar_venta IS 'Disparador que crea el registro de facturación de forma automática al completarse una venta.';

CREATE OR REPLACE TRIGGER trg_ventas_facturacion_automatica
AFTER INSERT OR UPDATE ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_facturar_venta();

-- -----------------------------------------------------------------------------
-- 4. FUNCIÓN ALMACENADA: cancelar_venta
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_venta(p_venta_id uuid)
RETURNS uuid AS $$
BEGIN
    -- Validar existencia
    IF NOT EXISTS (SELECT 1 FROM ventas WHERE id = p_venta_id) THEN
        RAISE EXCEPTION 'La venta especificada no existe.'
            USING ERRCODE = 'P0005';
    END IF;

    -- Actualizar estado. Esto disparará automáticamente trg_revertir_venta_cancelada
    UPDATE ventas
    SET estado_venta = 'Cancelada'
    WHERE id = p_venta_id AND estado_venta <> 'Cancelada';

    -- Cambiar estado de factura si existe
    UPDATE facturas
    SET estado = 'Anulada'
    WHERE venta_id = p_venta_id;

    RETURN p_venta_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancelar_venta IS 'Realiza la baja lógica de una venta y actualiza su factura asociada.';

-- -----------------------------------------------------------------------------
-- 5. ACTUALIZACIÓN DE LA FUNCIÓN DE REVERSIÓN DE STOCK Y DEUDA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revertir_venta_cancelada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
BEGIN
    -- Evaluar únicamente si el estado de la venta cambia a 'Cancelada'
    IF old.estado_venta <> 'Cancelada' AND new.estado_venta = 'Cancelada' THEN
        
        -- 1. Iterar sobre todos los productos que forman parte de la venta ordenados por producto_id para prevenir deadlocks
        FOR v_item IN 
            SELECT producto_id, cantidad 
            FROM detalles_ventas 
            WHERE venta_id = new.id
            ORDER BY producto_id ASC
        LOOP
            -- Bloquear el producto antes de modificar su stock para evitar race conditions
            PERFORM id FROM productos WHERE id = v_item.producto_id FOR UPDATE;

            -- Devolver (sumar) las cantidades vendidas al stock_actual
            UPDATE productos 
            SET stock_actual = stock_actual + v_item.cantidad
            WHERE id = v_item.producto_id;

            -- Registrar el movimiento de reversión en historial_stock como 'Cancelacion Venta'
            INSERT INTO historial_stock (producto_id, cantidad_cambio, tipo_movimiento, referencia_id, motivo)
            SELECT v_item.producto_id, v_item.cantidad, 'Cancelacion Venta', new.id, COALESCE('Cancelación: ' || e.motivo_cancelacion, 'Venta Cancelada / Anulada')
            FROM ventas v
            LEFT JOIN envios e ON e.venta_id = v.id
            WHERE v.id = new.id
            LIMIT 1;
        END LOOP;

        -- 2. Si la venta original fue bajo modalidad de 'Credito', ajustar la deuda del cliente
        IF new.tipo_pago = 'Credito' THEN
            -- Bloquear la fila del cliente para garantizar la consistencia en el saldo
            PERFORM id FROM clientes WHERE id = new.cliente_id FOR UPDATE;

            -- Restar el total de la venta del saldo deudor, asegurando que no descienda de 0
            UPDATE clientes 
            SET saldo_deudor = GREATEST(0.00, saldo_deudor - new.total)
            WHERE id = new.cliente_id;
        END IF;

        -- 3. Asegurar anulación de factura relacionada
        UPDATE facturas
        SET estado = 'Anulada'
        WHERE venta_id = new.id;

    END IF;

    RETURN new;
END;
$$;
