from app.database import supabase
try:
    res = supabase.table("facturas").select("*").limit(1).execute()
    print("Conexión exitosa. La tabla 'facturas' existe. Datos:", res.data)
except Exception as ex:
    print("Error al consultar la tabla 'facturas':", str(ex))
