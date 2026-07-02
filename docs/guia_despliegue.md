# Guía de Despliegue - TiendaLocal

Este documento detalla los pasos, configuraciones de producción, variables de entorno y comandos necesarios para desplegar la aplicación **TiendaLocal** (Backend en FastAPI y Frontend en React/Vite/Tailwind CSS) en la plataforma **Render**.

---

## 1. Requisitos Previos
* Cuenta activa en [Render](https://render.com).
* Repositorio de código sincronizado en GitHub: `https://github.com/JoseMPB13/tiendaLocal.git`.
* Acceso a una base de datos activa en **Supabase** con el esquema maestro ya importado:

```
1. schema.sql
2. delivery_schema.sql
3. programmability.sql
4. scratch/setup_timezone.sql   (recomendado)
5. scratch/seed_data.sql        (opcional)
```

Ver `scratch/README.md` para detalles.

---

## 2. Despliegue del Backend (FastAPI Web Service)

El backend actúa como una pasarela segura y se desplegará en Render bajo la modalidad de **Web Service**.

### Pasos de Configuración en Render:
1. Inicia sesión en Render y haz clic en **New +** > **Web Service**.
2. Conecta tu repositorio de GitHub `tiendaLocal`.
3. Configura los siguientes parámetros básicos en el formulario de creación:
   * **Name:** `tiendalocal-api` (o el nombre de tu preferencia).
   * **Region:** Selecciona la más cercana a tu base de datos de Supabase para minimizar latencia.
   * **Runtime:** `Python`
   * **Build Command:** `pip install -r requirements.txt` (Asegúrate de apuntar a la subcarpeta `/backend` si es necesario, o definir el **Root Directory** como `backend` en la sección de configuración avanzada).
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (Render inyecta dinámicamente el puerto en la variable `$PORT`).

### Variables de Entorno del Backend:
En la pestaña **Environment** del servicio en Render, añade las siguientes variables obligatorias:

| Variable | Descripción | Valor de Ejemplo |
| :--- | :--- | :--- |
| `SUPABASE_URL` | URL de la API REST del proyecto en Supabase | `https://xxxxxx.supabase.co` |
| `SUPABASE_KEY` | Clave API anónima o clave de servicio de Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `ORIGENES_PERMITIDOS` | Lista de URLs autorizadas para CORS (separadas por comas) | `https://tiendalocal.onrender.com` (URL del frontend en producción) |

---

## 3. Despliegue del Frontend (React + Vite Static Site)

El frontend de React compilado con Vite se desplegará en Render bajo la modalidad de **Static Site**.

### Pasos de Configuración en Render:
1. Haz clic en **New +** > **Static Site**.
2. Conecta tu repositorio de GitHub `tiendaLocal`.
3. Configura los siguientes parámetros en el formulario:
   * **Name:** `tiendalocal` (o el nombre de tu preferencia).
   * **Root Directory:** `frontend` (Muy importante: la carpeta raíz del frontend en el repositorio).
   * **Build Command:** `npm run build`
   * **Publish Directory:** `dist` (Directorio de salida generado por la compilación de Vite).

### Variables de Entorno del Frontend:
En la pestaña **Environment** de este Static Site, añade la variable de conexión con la API:

| Variable | Descripción | Valor de Ejemplo |
| :--- | :--- | :--- |
| `VITE_API_URL` | URL pública donde está corriendo el Web Service del Backend | `https://tiendalocal-api.onrender.com` |

Vite compilará estáticamente este valor en el paquete final durante el proceso de build.

---

## 4. Verificación de Salud del Entorno (Health Check)

FastAPI expone el endpoint `GET /health` que realiza una consulta ultra liviana de verificación a Supabase para cerciorarse de que el canal de datos esté operando correctamente.

### Verificación de salud

FastAPI expone `GET /health` y `GET /` para comprobar conectividad con Supabase.

---

## 5. Seguridad y Preparación Local

Para salvaguardar la integridad de las credenciales de conexión del sistema y evitar la filtración accidental de llaves secretas al control de versiones de GitHub:

1. **Ignorados de Git (`.gitignore`):**
   * Tanto la carpeta de `/backend` como la de `/frontend` cuentan con sus respectivos archivos `.gitignore` configurados de forma dedicada.
   * Se excluyen del seguimiento todos los archivos `.env`, directorios de dependencias de Node (`node_modules/`), carpetas de entornos virtuales de Python (`.venv/`), binarios compilados de compilación (`dist/`, `build/`) y cachés generadas en caliente (`__pycache__/`, `*.pyc`).

2. **Uso de Plantillas (`.env.example`):**
   * Al clonar este repositorio desde cero, los archivos `.env` no estarán incluidos debido a las políticas de seguridad de Git.
   * En su lugar, el desarrollador deberá duplicar y renombrar los archivos plantilla provistos:
     * **En el Backend:** Copiar [backend/.env.example](file:///C:/Users/josem/Desktop/tienda/backend/.env.example) a `/backend/.env` e introducir las claves reales de la base de datos Supabase.
     * **En el Frontend:** Copiar [frontend/.env.example](file:///C:/Users/josem/Desktop/tienda/frontend/.env.example) a `/frontend/.env` y definir la URL de la API de FastAPI a consumir.

