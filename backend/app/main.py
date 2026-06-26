import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import usuarios, categorias, productos, clientes, ventas, delivery, reportes, auth, compras
from app.routers import bitacora
from app.database import supabase

# Cargar la configuración de modo depuración
debug_mode = os.getenv("DEBUG", "true").lower() == "true"

app = FastAPI(
    title="Tienda Margarita API",
    description="Backend API en FastAPI para el sistema de ventas e inventario Tienda Margarita.",
    version="1.0.0",
    docs_url="/docs" if debug_mode else None,
    redoc_url="/redoc" if debug_mode else None,
    openapi_url="/openapi.json" if debug_mode else None
)


# Configuración de Orígenes Permitidos para CORS dinámico desde variable de entorno
origenes_permitidos_env = os.getenv("ORIGENES_PERMITIDOS", "")
if origenes_permitidos_env:
    origins = [o.strip() for o in origenes_permitidos_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:5173", # Puerto por defecto de desarrollo para React + Vite
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión de Routers
app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(clientes.router)
app.include_router(ventas.router)
app.include_router(delivery.router)
app.include_router(reportes.router)
app.include_router(compras.router)
app.include_router(bitacora.router)


@app.get("/")
async def root():
    """
    Ruta raíz de la API para verificar si el servidor está en línea.
    """
    return {
        "ok": True,
        "data": {
            "aplicacion": "Tienda Margarita API",
            "estado": "En línea",
            "descripcion": "Pasarela segura de conexión entre el frontend y la base de datos de Supabase."
        }
    }

@app.get("/health")
async def health_check():
    """
    Endpoint de verificación de salud (health check).
    Realiza una consulta rápida a la base de datos Supabase para asegurar la conectividad.
    """
    try:
        # Hacemos una consulta super ligera a la tabla categorias (limitada a 1 registro)
        res = supabase.table("categorias").select("id").limit(1).execute()
        return {"ok": True, "estado": "saludable", "detalles": "Conexión a base de datos establecida correctamente."}
    except Exception as ex:
        return {"ok": False, "estado": "no saludable", "detalles": str(ex)}





