-- =============================================================================
-- MIGRACIÓN INCREMENTAL: AGREGAR COLUMNA IMAGEN_URL A PRODUCTOS
-- Propósito: Soportar la persistencia de enlaces URL de imágenes para productos
-- en el catálogo de Tienda Margarita.
-- Idioma: Español
-- =============================================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT NULL;

