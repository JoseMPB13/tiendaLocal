import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List
from app.services.seguridad import SECRET_KEY, ALGORITHM

# Esquema de autenticación OAuth2 que lee el encabezado "Authorization: Bearer <TOKEN>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def obtener_usuario_actual(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependencia para decodificar, validar y verificar el token JWT recibido.
    Retorna el payload del usuario (id, username, rol) si es válido.
    Lanza una excepción 401 en caso de token inválido o expirado.
    """
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de acceso inválidas, inexistentes o expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario_id: str = payload.get("id")
        username: str = payload.get("username")
        rol: str = payload.get("rol")
        if usuario_id is None or username is None or rol is None:
            raise credenciales_exception
        return {
            "id": usuario_id,
            "username": username,
            "rol": rol
        }
    except jwt.PyJWTError:
        raise credenciales_exception

def verificar_roles(roles_permitidos: List[str]):
    """
    Función de dependencia para validar que el rol del usuario autenticado
    se encuentre entre los roles permitidos para acceder al endpoint.
    """
    def dependencia(usuario_actual: dict = Depends(obtener_usuario_actual)):
        rol_usuario = usuario_actual.get("rol")
        if rol_usuario not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los siguientes roles: {', '.join(roles_permitidos)}."
            )
        return usuario_actual
    return dependencia

