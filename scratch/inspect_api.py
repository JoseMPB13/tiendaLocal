import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def inspect():
    url = f"{SUPABASE_URL}/rest/v1/"
    print("Fetching OpenAPI spec from:", url)
    response = httpx.get(url, headers=headers)
    if response.status_code != 200:
        print("Failed to fetch. Status code:", response.status_code)
        print(response.text)
        return
    
    spec = response.json()
    paths = spec.get("paths", {})
    
    # Buscamos rutas de RPC
    for path, methods in paths.items():
        if "registrar_venta_contado" in path or "registrar_venta_credito" in path:
            print("====================================")
            print("Path:", path)
            for method, details in methods.items():
                print("Method:", method)
                print("Parameters:")
                for param in details.get("parameters", []):
                    # Ver el nombre, tipo, descripción
                    name = param.get("name")
                    schema = param.get("schema", {})
                    p_type = schema.get("type")
                    p_format = schema.get("format")
                    required = param.get("required", False)
                    print(f"  - {name}: type={p_type}, format={p_format}, required={required}")
                
                # Ver el body parameter si es POST
                if method.lower() == "post":
                    post_body = details.get("requestBody", {})
                    content = post_body.get("content", {})
                    json_content = content.get("application/json", {})
                    body_schema = json_content.get("schema", {})
                    properties = body_schema.get("properties", {})
                    required_props = body_schema.get("required", [])
                    print("Body properties:")
                    for prop_name, prop_details in properties.items():
                        req = prop_name in required_props
                        p_type = prop_details.get("type")
                        p_format = prop_details.get("format")
                        print(f"  - {prop_name}: type={p_type}, format={p_format}, required={req}")

if __name__ == "__main__":
    inspect()
