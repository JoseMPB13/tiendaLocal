from fastapi import APIRouter

router = APIRouter(prefix="/prueba", tags=["Prueba"])

@router.get("/")
async def obtener_estado():
    """
    Endpoint de prueba para verificar el correcto funcionamiento del enrutador de FastAPI.
    """
    return {
        "estado": "OK",
        "mensaje": "Servidor backend de Tienda Margarita funcionando correctamente en español."
    }
