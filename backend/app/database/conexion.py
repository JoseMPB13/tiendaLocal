import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno desde el archivo .env si existe
load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL:
    raise RuntimeError("ERROR CRÍTICO DE INFRAESTRUCTURA: La variable SUPABASE_URL no está configurada. El servidor no puede iniciar de forma segura.")

if not SUPABASE_KEY:
    raise RuntimeError("ERROR CRÍTICO DE INFRAESTRUCTURA: La variable SUPABASE_KEY no está configurada. El servidor no puede iniciar de forma segura.")

# Inicialización del cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
