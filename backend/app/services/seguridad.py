from passlib.context import CryptContext

# Configuración del motor de hashing bcrypt para contraseñas seguras
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
