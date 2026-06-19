# Esquema de Base de Datos - TiendaLocal

Este documento describe el diccionario de datos, la estructura de las tablas, relaciones, índices, triggers y funciones SQL del sistema.

## 1. Reglas Generales de la Base de Datos
- **Bajas Lógicas:** Queda terminantemente prohibido el borrado físico (`DELETE`) en las tablas principales. Se utiliza un campo `estado` (ej. 'Activo', 'Inactivo', 'Cancelado').
- **Cómputos e Integridad:** Los cálculos críticos como el stock disponible y los saldos deudores se ejecutan en la propia base de datos mediante triggers y procedimientos almacenados en **PL/pgSQL**.

## 2. Definición del Esquema (schema.sql)
El script de migración inicial define las tablas principales del sistema de ventas e inventario, organizadas por el módulo de Categorías.
