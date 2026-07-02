# Scripts auxiliares (scratch/)

Los archivos DDL maestros para despliegue desde cero están en la raíz del repositorio:

1. `schema.sql` — Tablas core, RLS, triggers estructurales
2. `delivery_schema.sql` — Delivery, configuración del kiosco, GPS repartidores
3. `programmability.sql` — Funciones RPC, triggers de stock/facturación, dashboard
4. `scratch/setup_timezone.sql` — Zona horaria `America/La_Paz` (opcional por entorno)
5. `scratch/seed_data.sql` — Datos de demostración (opcional)

## Migración de datos históricos (solo BDs existentes)

- `migracion_paso3_corregir_fechas_historicas.sql` — Corrige timestamps mal almacenados (ejecutar **una sola vez** si aplica).

## Utilidades de desarrollo

- `seed_data.sql` — Usuarios y catálogo de prueba
- `test_bitacora.py`, `test_kardex.py`, `test_sale.py` — Pruebas manuales contra la API/BD
