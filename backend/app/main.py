from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import prueba, usuarios, categorias, productos, clientes, ventas, delivery

app = FastAPI(
    title="TiendaLocal API",
    description="Backend API en FastAPI para el sistema de ventas e inventario TiendaLocal.",
    version="1.0.0"
)

# Configuración de Orígenes Permitidos para CORS
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
app.include_router(prueba.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(clientes.router)
app.include_router(ventas.router)
app.include_router(delivery.router)

@app.get("/")
async def root():
    """
    Ruta raíz de la API para verificar si el servidor está en línea.
    """
    return {
        "ok": True,
        "data": {
            "aplicacion": "TiendaLocal API",
            "estado": "En línea",
            "descripcion": "Pasarela segura de conexión entre el frontend y la base de datos de Supabase."
        }
    }



