import sys
import os

# Anadir el path de backend para que python pueda resolver los modulos correctamente
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    print("Verificando importaciones y sintaxis del backend...")
    from app.services.delivery import DeliveryService
    from app.routers.delivery import router as delivery_router
    from app.routers.clientes import router as clientes_router
    print("¡Exito! Todas las importaciones y sintaxis son correctas y validas.")
except Exception as e:
    print(f"Error detectado durante la verificacion: {e}")
    sys.exit(1)
