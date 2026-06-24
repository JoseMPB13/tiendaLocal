import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Obtaining a test client...")
    res_client = supabase.table("clientes").select("id, nombre").limit(1).execute()
    if not res_client.data:
        print("No clients found!")
        exit()
    client_id = res_client.data[0]["id"]
    print("Client:", res_client.data[0])

    print("Obtaining a test user...")
    res_user = supabase.table("usuarios").select("id, nombre_completo").limit(1).execute()
    if not res_user.data:
        print("No users found!")
        exit()
    user_id = res_user.data[0]["id"]
    print("User:", res_user.data[0])

    print("Obtaining a test product...")
    res_prod = supabase.table("productos").select("id, nombre, precio_venta").eq("estado", "Activo").limit(1).execute()
    if not res_prod.data:
        print("No products found!")
        exit()
    prod = res_prod.data[0]
    print("Product:", prod)

    # Prepare sale items
    items = [{
        "producto_id": prod["id"],
        "cantidad": 1,
        "precio_unitario": float(prod["precio_venta"])
    }]
    
    print("\nAttempting RPC call to registrar_venta_contado...")
    res = supabase.rpc("registrar_venta_contado", {
        "p_cliente_id": client_id,
        "p_usuario_id": user_id,
        "p_codigo_factura": None, # Should trigger automatic code generation
        "p_total": float(prod["precio_venta"]),
        "p_tipo_pago": "Efectivo",
        "p_items": items,
        "p_para_delivery": False,
        "p_direccion_despacho": None,
        "p_costo_envio": 0.0
    }).execute()
    
    print("Success! Venta ID returned:", res.data)
    
except Exception as e:
    print("Error:", e)
