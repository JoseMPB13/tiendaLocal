import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Consultamos pg_proc para obtener detalles de las funciones en el esquema public
query = """
select 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    t.typname as return_type
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
join pg_type t on p.prorettype = t.oid
where n.nspname = 'public' 
  and p.proname in ('registrar_venta_contado', 'registrar_venta_credito');
"""

try:
    # Usamos una consulta RPC genérica o ejecutamos SQL si es posible.
    # Como no tenemos una función SQL directa expuesta en RPC usualmente,
    # podemos intentar hacer una consulta por la API o simplemente 
    # usar supabase.table().select() de forma indirecta.
    # Espera, en Supabase no se puede ejecutar SQL arbitrario vía cliente común REST a menos que
    # haya una función RPC que lo haga.
    # Veamos si podemos consultar la bitácora o algo para saber si hubo errores.
    # Pero también podemos escribir un script que use psycopg2 o similar si está instalado,
    # o simplemente inspeccionar los scripts de migración.
    print("Supabase URL:", SUPABASE_URL)
except Exception as e:
    print("Error:", e)
