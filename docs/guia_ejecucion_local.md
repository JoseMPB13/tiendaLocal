# Guía de Ejecución Local con Supabase - TiendaLocal

Esta guía detalla el proceso completo paso a paso para clonar, configurar, inicializar y ejecutar de manera local el sistema **TiendaLocal** (FastAPI en el Backend, React + Vite en el Frontend, y Supabase / PostgreSQL como motor de base de datos).

---

## 1. Prerrequisitos del Sistema

Antes de iniciar, asegúrate de tener instaladas las siguientes herramientas en tu entorno de desarrollo local:

- **Python (Versión 3.10 o superior):** Lenguaje principal para el servidor backend.
- **Node.js (Versión 18 o superior):** Entorno de ejecución para compilar y servir la aplicación frontend.
- **Gestor de Paquetes npm:** (Incluido por defecto con Node.js) para administrar las dependencias del frontend.
- **Gestor de Paquetes pip:** Herramienta para instalar paquetes y dependencias en Python.
- **Git:** Para control de versiones y descarga del código base.

---

## 2. Configuración de la Base de Datos (Supabase)

El motor transaccional y relacional del proyecto reside en Supabase. Sigue estos pasos para configurarlo:

### Creación del Proyecto en Supabase:

1. Inicia sesión en el panel oficial de [Supabase](https://supabase.com).
2. Haz clic en **New Project** y selecciona tu organización.
3. Rellena los datos básicos del proyecto:
   - **Name:** `TiendaLocal`
   - **Database Password:** Elige una contraseña segura y guárdala.
   - **Region:** Elige la más cercana a tu ubicación geográfica.
4. Espera a que el aprovisionamiento de la base de datos finalice (suele tardar un par de minutos).

### Ejecución Cronológica de Scripts SQL:

Para evitar fallos por dependencias de llaves foráneas o funciones inexistentes, ve a la sección **SQL Editor** de tu proyecto en Supabase, haz clic en **New query** y ejecuta exactamente en este orden el código de los siguientes archivos:

1. **`schema.sql` (1º - Estructura Base):**
   - Copia e importa el contenido íntegro de [schema.sql](file:///C:/Users/josem/Desktop/tienda/schema.sql) y haz clic en **Run**. Este script creará la base de tablas maestras, índices y relaciones primarias (categorías, productos, usuarios, clientes, ventas y detalles).
2. **`programmability.sql` (2º - Lógica Transaccional):**
   - Copia e importa el contenido íntegro de [programmability.sql](file:///C:/Users/josem/Desktop/tienda/programmability.sql) y presiona **Run**. Esto creará la tabla bitácora, triggers de auditoría, disparadores de control concurrente de stock e inventario, y las funciones de base de datos (`registrar_venta_credito` y `registrar_venta_contado`).
3. **`delivery_schema.sql` (3º - Extensiones de Logística):**
   - Copia e importa el contenido íntegro de [delivery_schema.sql](file:///C:/Users/josem/Desktop/tienda/delivery_schema.sql) y presiona **Run**. Este script creará las tablas de repartidores, despachos físicos y sus correspondientes triggers corregidos de auditoría.

---

## 3. Configuración y Arranque del Backend (FastAPI)

Una vez lista la base de datos, procedemos a configurar la API que funcionará como pasarela segura:

1. **Acceder a la Carpeta:**
   Abre una terminal y colócate en el directorio del backend:

   ```bash
   cd backend
   ```

2. **Crear y Activar el Entorno Virtual:**
   - En **Windows (PowerShell/CMD):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - En **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Instalación de Dependencias:**
   Ejecuta el siguiente comando para instalar todos los paquetes requeridos por el backend:

   ```bash
   pip install -r requirements.txt
   ```

4. **Variables de Entorno del Servidor (`.env`):**
   - Duplica el archivo `/.env.example` en la raíz de `/backend` y renombralo a `.env`.
   - Abre el archivo `.env` y rellena las siguientes claves utilizando los parámetros de configuración de tu proyecto en Supabase (ubicados en **Project Settings** > **API**):
     ```env
     SUPABASE_URL=https://tu-proyecto.supabase.co
     SUPABASE_KEY=tu-anon-public-key
     JWT_SECRET=tu-llave-criptografica-super-secreta-de-128bits
     ORIGENES_PERMITIDOS=http://localhost:5173,http://127.0.0.1:5173
     DEBUG=true
     ```

5. **Lanzar el Servidor en Desarrollo:**
   Arranca el servidor en modo autorecarga local mediante Uvicorn:
   ```bash
   uvicorn app.main:app --reload
   ```
   La API estará en línea respondiendo en `http://localhost:8000`.

---

## 4. Configuración y Arranque del Frontend (React + Vite)

Sigue estos pasos para levantar la interfaz visual del cajero y repartidor:

1. **Acceder a la Carpeta:**
   Abre una nueva pestaña de terminal y entra al directorio:

   ```bash
   cd frontend
   ```

2. **Instalar Dependencias de Node:**
   Descarga y compila localmente los paquetes definidos en `package.json`:

   ```bash
   npm install
   ```

3. **Configurar Entorno Local (`.env.local`):**
   - Duplica el archivo `/.env.example` en la raíz de `/frontend` y renombralo como `.env.local`.
   - Modifica el archivo para que apunte directamente al puerto local de tu backend de FastAPI:
     ```env
     VITE_API_URL=http://localhost:8000
     ```

4. **Ejecutar el Servidor de Desarrollo:**
   Inicia el compilador rápido en caliente de Vite:
   ```bash
   npm run dev
   ```
   El servidor web levantará localmente en `http://localhost:5173` (o en el puerto inmediato disponible).

---

## 5. Flujo de Prueba Inicial (Sanity Check Local)

Una vez que ambos servidores estén encendidos y conectados, puedes verificar la integridad de la instalación ejecutando esta prueba rápida de 3 pasos:

1. **Paso 1: Acceso al Sistema**
   - Abre tu navegador de preferencia y dirígete a `http://localhost:5173`. Deberías visualizar de forma inmediata la interfaz del formulario de Login con los estilos Premium aplicados.
2. **Paso 2: Inicio de Sesión (Login)**
   - Ingresa las credenciales de correo y contraseña de un operador previamente insertado en la base de datos de Supabase.
   - Al hacer clic en **Ingresar al Sistema**, el cliente enviará una petición real a la API y Zustand almacenará el token JWT y el rol devuelto, redirigiéndote automáticamente.
3. **Paso 3: Punto de Venta (POS) Activo**
   - Navega a la sección del Punto de Venta (`/punto-venta`). El POS debe comunicarse con el catálogo real del backend y renderizar de forma interactiva las rejillas de productos disponibles para la venta. Puedes probar el buscador introduciendo palabras clave o códigos de barra de prueba.
