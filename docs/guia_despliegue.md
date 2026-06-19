# Guía de Despliegue - TiendaLocal

Este documento contiene los pasos y comandos necesarios para preparar y levantar el entorno de desarrollo local, las variables de entorno requeridas y los pasos para el pase a producción.

## 1. Requisitos Previos
- Python 3.10+
- Node.js 18+
- Acceso a un proyecto de Supabase (URL y claves API).

## 2. Preparación del Backend
1. Ir a la carpeta `/backend`.
2. Crear el entorno virtual: `python -m venv .venv`
3. Activar el entorno virtual:
   - Windows: `.venv\Scripts\activate`
   - Linux/macOS: `source .venv/bin/activate`
4. Instalar dependencias: `pip install -r requirements.txt`
