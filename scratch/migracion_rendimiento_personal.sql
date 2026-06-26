-- MIGRACIÓN: Indicadores de Rendimiento de Personal (RPC)
-- Idioma: Español

-- Razón: Agrega una función analítica para calcular ventas de cajeros y efectividad de repartidores
CREATE OR REPLACE FUNCTION obtener_rendimiento_personal()
RETURNS JSON AS $$
DECLARE
    v_cajeros JSON;
    v_repartidores JSON;
BEGIN
    -- 1. Agregación de Cajeros (usuarios de rol 'Administrador' o 'Cajero')
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_cajeros
    FROM (
        SELECT 
            u.id AS usuario_id,
            u.nombre_completo,
            u.email,
            COALESCE(COUNT(v.id), 0)::integer AS total_ventas,
            COALESCE(SUM(CASE WHEN v.estado_venta = 'Completada' THEN v.total ELSE 0 END), 0.00)::numeric(12, 2) AS monto_total
        FROM usuarios u
        LEFT JOIN ventas v ON v.usuario_id = u.id AND v.estado_venta = 'Completada'
        WHERE u.rol IN ('Administrador', 'Cajero')
        GROUP BY u.id, u.nombre_completo, u.email
    ) t;

    -- 2. Agregación de Repartidores (usuarios de rol 'Repartidor')
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_repartidores
    FROM (
        SELECT 
            u.id AS usuario_id,
            u.nombre_completo,
            u.email,
            r.id AS repartidor_id,
            r.vehiculo,
            r.placa,
            COALESCE(SUM(CASE WHEN e.estado_envio = 'Entregado' THEN 1 ELSE 0 END), 0)::integer AS envios_entregados,
            COALESCE(SUM(CASE WHEN e.estado_envio = 'Cancelado' THEN 1 ELSE 0 END), 0)::integer AS envios_cancelados,
            COALESCE(COUNT(e.id), 0)::integer AS total_envios,
            CASE 
                WHEN COUNT(e.id) > 0 THEN 
                    ROUND((SUM(CASE WHEN e.estado_envio = 'Entregado' THEN 1 ELSE 0 END)::numeric / COUNT(e.id)::numeric) * 100, 2)::numeric(5, 2)
                ELSE 0.00
            END AS efectividad_entrega
        FROM usuarios u
        JOIN repartidores r ON r.usuario_id = u.id
        LEFT JOIN envios e ON e.repartidor_id = r.id
        GROUP BY u.id, u.nombre_completo, u.email, r.id, r.vehiculo, r.placa
    ) t;

    RETURN json_build_object(
        'cajeros', v_cajeros,
        'repartidores', v_repartidores
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_rendimiento_personal() IS 'Calcula y unifica métricas de ventas para cajeros y efectividad de envíos para repartidores.';
