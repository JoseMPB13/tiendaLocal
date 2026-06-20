import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext

# Configuración del motor de hashing bcrypt para contraseñas seguras
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configuración de JWT
SECRET_KEY = os.getenv("JWT_SECRET", "clave-secreta-desarrollo-tiendalocal-987654321")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

def obtener_password_hash(password: str) -> str:
    """
    Recibe una contraseña en texto plano y genera su hash seguro con bcrypt.
    """
    return pwd_context.hash(password)

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con el hash almacenado.
    """
    return pwd_context.verify(plain_password, hashed_password)

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

