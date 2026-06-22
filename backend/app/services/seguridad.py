import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
import bcrypt

from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración de JWT
debug_mode = os.getenv("DEBUG", "").lower() == "true"
jwt_secret = os.getenv("JWT_SECRET", "")

if not jwt_secret:
    if debug_mode:
        jwt_secret = "clave-secreta-desarrollo-tiendalocal-987654321"
    else:
        raise RuntimeError("ERROR CRÍTICO DE INFRAESTRUCTURA: La variable JWT_SECRET no está configurada. El servidor no puede iniciar de forma segura.")

SECRET_KEY = jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

def obtener_password_hash(password: str) -> str:
    """
    Recibe una contraseña en texto plano y genera su hash seguro de manera nativa con bcrypt.
    """
    salt = bcrypt.gensalt(rounds=12)
    password_bytes = password.encode('utf-8')
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con el hash almacenado de manera nativa con bcrypt.
    """
    try:
        password_bytes = plain_password.encode('utf-8')
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False


def crear_token_acceso(datos: dict, expiracion_delta: Optional[timedelta] = None) -> str:
    """
    Genera y firma un token JWT utilizando el algoritmo HS256 y una expiración por defecto de 12 horas.
    """
    datos_copiar = datos.copy()
    if expiracion_delta:
        expiracion = datetime.utcnow() + expiracion_delta
    else:
        expiracion = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    datos_copiar.update({"exp": expiracion})
    token_firmado = jwt.encode(datos_copiar, SECRET_KEY, algorithm=ALGORITHM)
    return token_firmado

