import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Querying count of productos...")
    res_prods = supabase.table("productos").select("id, nombre", count="exact").limit(5).execute()
    print("Productos count:", res_prods.count)
    if res_prods.data:
        print("Sample products:", res_prods.data)
    else:
        print("No products found.")
        
    print("\nQuerying count of historial_stock...")
    res_stock = supabase.table("historial_stock").select("id", count="exact").execute()
    print("Historial stock count:", res_stock.count)
    
except Exception as e:
    print("Error during execution:", e)
