import json
from uuid import UUID
from app.services.ventas import VentaService
from app.schemas.modelos import VentaCrear

# Crear payload simulado
payload_dict = {
    "cliente_id": "b1bcf4d1-c24a-464a-9351-4096bead19e1",
    "codigo_factura": "Autogenerado",
    "tipo_pago": "Efectivo",
    "para_delivery": False,
    "costo_envio": 0.0,
    "detalles": [
        {
            "producto_id": "c86a60db-bcf5-48fa-bb4e-7b7ab9344445",
            "cantidad": 1,
            "precio_unitario": 3.50
        }
    ]
}

try:
    # 1. Obtener un usuario de prueba para el operador
    from app.database import supabase
    usr_res = supabase.table("usuarios").select("id").limit(1).execute()
    if not usr_res.data:
        print("No hay usuarios en la base de datos para la prueba.")
        exit(1)
    usuario_id = usr_res.data[0]["id"]
    print("Usando usuario de prueba:", usuario_id)

    # 2. Obtener un cliente de prueba
    cli_res = supabase.table("clientes").select("id").limit(1).execute()
    if cli_res.data:
        payload_dict["cliente_id"] = cli_res.data[0]["id"]
    print("Usando cliente de prueba:", payload_dict["cliente_id"])

    # 3. Obtener un producto de prueba
    prod_res = supabase.table("productos").select("id, precio_venta").eq("estado", "Activo").limit(1).execute()
    if prod_res.data:
        payload_dict["detalles"][0]["producto_id"] = prod_res.data[0]["id"]
        payload_dict["detalles"][0]["precio_unitario"] = float(prod_res.data[0]["precio_venta"])
    print("Usando producto de prueba:", payload_dict["detalles"][0]["producto_id"])

    venta_obj = VentaCrear(**payload_dict)
    resultado = VentaService.registrar_venta(venta_obj, UUID(usuario_id))
    print("Registro exitoso! Resultado:", resultado)

except Exception as ex:
    print("Error detectado:")
    import traceback
    traceback.print_exc()
