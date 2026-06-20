from fastapi import Header, HTTPException, status
from typing import List

# =============================================================================
-- REGLA INTERACTIVA / RESPUESTAS: dependencia Depends
# Para simplificar la validación en esta etapa, utilizaremos una dependencia
# simulada que intercepta el encabezado 'X-User-Rol' enviado en la petición HTTP.
# Esto nos permite aislar el frontend y validar roles en el backend como pasarela.
# =============================================================================

def verificar_roles(roles_permitidos: List[str]):
    """
    Función de dependencia para interceptar y verificar si el rol del usuario 
    se encuentra en la lista de roles autorizados para el endpoint.
    """
    def dependencia(x_user_rol: str = Header(..., alias="X-User-Rol", description="Rol del usuario que realiza la peticion")):
        if x_user_rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los siguientes roles: {', '.join(roles_permitidos)}."
            )
        return x_user_rol
    return dependencia
