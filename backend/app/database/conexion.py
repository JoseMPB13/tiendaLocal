import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno desde el archivo .env si existe
load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    # No se levanta excepción aquí para permitir que FastAPI inicie en entornos donde 
    # se configuran las variables de entorno de otra forma antes de hacer llamadas.
    print("Advertencia: SUPABASE_URL o SUPABASE_KEY no están definidas en las variables de entorno.")

# Inicialización del cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
