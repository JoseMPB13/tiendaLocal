# Scripts auxiliares (scratch/)

Los archivos DDL maestros para despliegue desde cero están en la raíz del repositorio:

1. `schema.sql` — Tablas core, RLS, triggers estructurales
2. `delivery_schema.sql` — Delivery, configuración del kiosco, GPS repartidores
3. `programmability.sql` — Funciones RPC, triggers de stock/facturación, dashboard
4. `scratch/setup_timezone.sql` — Zona horaria `America/La_Paz` (opcional por entorno)
5. `scratch/limpiar_base_datos.sql` — Vacía todas las tablas y restaura config por defecto
6. `scratch/seed_data.sql` — Datos de demostración (3 usuarios, 5 categorías, 30 productos, 10 clientes)

## Migración de datos históricos (solo BDs existentes)

- `migracion_paso3_corregir_fechas_historicas.sql` — Corrige timestamps mal almacenados (ejecutar **una sola vez** si aplica).

## Reset y datos de prueba

```text
limpiar_base_datos.sql  →  seed_data.sql
```

Credenciales seed (contraseña `123456` para todos):

| Rol            | Email                      |
|----------------|----------------------------|
| Administrador  | admin@tiendalocal.com      |
| Cajero         | cajero@tiendalocal.com     |
| Repartidor     | repartidor@tiendalocal.com |

## Utilidades de desarrollo
- `test_bitacora.py`, `test_kardex.py`, `test_sale.py` — Pruebas manuales contra la API/BD
