# =============================================================================
# PRUEBA DE INTEGRACIÓN: test_bitacora.py
# Propósito: Validar el funcionamiento del servicio BitacoraService directamente.
# Idioma: Español
# =============================================================================

import sys
import os

# Agregar la ruta de la aplicación al path de python
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.bitacora import BitacoraService

def probar_servicios_bitacora():
    print("=== INICIANDO PRUEBAS DE BITÁCORA ===")
    
    # 1. Probar obtener movimientos de stock agrupados (RPC)
    print("\n1. Probando obtener_movimientos_productos para periodo 'dia':")
    try:
        movimientos = BitacoraService.obtener_movimientos_productos("dia")
        print(f"Éxito! Movimientos obtenidos: {len(movimientos)}")
        if movimientos:
            print("Primer registro:", movimientos[0])
    except Exception as ex:
        print("Error al obtener movimientos de productos:", str(ex))

    # 2. Probar listar bitácora de usuarios (select + join)
    print("\n2. Probando listar_bitacora_usuarios:")
    try:
        registros = BitacoraService.listar_bitacora_usuarios(skip=0, limit=5)
        print(f"Éxito! Registros de auditoría obtenidos: {len(registros)}")
        if registros:
            print("Primer registro:", registros[0])
    except Exception as ex:
        print("Error al listar bitácora de usuarios:", str(ex))

if __name__ == "__main__":
    probar_servicios_bitacora()
