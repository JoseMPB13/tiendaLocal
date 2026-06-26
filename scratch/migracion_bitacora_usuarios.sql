-- MIGRACIÓN: Agregar columnas de captura diferencial a bitacora_usuarios
ALTER TABLE bitacora_usuarios
  ADD COLUMN IF NOT EXISTS datos_anteriores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS datos_nuevos     JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS operacion        VARCHAR(10) DEFAULT NULL;

-- Índice adicional para filtro por operación en la bitácora
CREATE INDEX IF NOT EXISTS idx_bitacora_usuarios_operacion 
  ON bitacora_usuarios(operacion);

-- ELIMINAR TRIGGERS OBSOLETOS DE BASE DE DATOS
-- Razón: La auditoría ahora se gestiona directamente desde FastAPI (síncrona y atómica)
--        usando el usuario_id real del JWT. Estos triggers causarían duplicación.
DROP TRIGGER IF EXISTS trg_auditar_clientes ON clientes;
DROP TRIGGER IF EXISTS trg_auditar_productos ON productos;
DROP TRIGGER IF EXISTS trg_auditar_ventas ON ventas;
DROP TRIGGER IF EXISTS trg_auditar_compras ON compras;
DROP TRIGGER IF EXISTS trg_auditar_repartidores ON repartidores;
DROP TRIGGER IF EXISTS trg_auditar_envios ON envios;
