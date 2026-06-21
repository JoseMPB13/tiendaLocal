from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.database import supabase
from app.services.seguridad import verificar_password, crear_token_acceso

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Esquema de solicitud para inicio de sesión flexible
class LoginRequest(BaseModel):
    username: str  # Campo universal donde el usuario puede ingresar su email o username
    password: str

@router.post("/login", response_model=dict)
async def iniciar_sesion(solicitud: LoginRequest):
    """
    Endpoint de inicio de sesión real y flexible.
    Verifica las credenciales del operador contra Supabase, permitiendo el ingreso tanto por correo electrónico (email) 
    como por nombre de usuario. Valida el hash de contraseña y emite el token JWT.
    """
    try:
        # 1. Buscar usuario por correo electrónico (email)
        # Nota: La base de datos guarda el correo en la columna 'email'. Si se usa una lógica flexible,
        # consultamos las coincidencias exactas en la columna email.
        res = supabase.table("usuarios").select("*").eq("email", solicitud.username).execute()

        
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nombre de usuario, correo electrónico o contraseña incorrectos."
            )
        
        usuario = res.data[0]

        # 2. Validar que el usuario esté activo en el sistema
        if usuario.get("estado") != "Activo":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cuenta de usuario se encuentra inactiva."
            )

        # 3. Verificar contraseña cifrada
        if not verificar_password(solicitud.password, usuario.get("password_hash")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nombre de usuario, correo electrónico o contraseña incorrectos."
            )

        # 4. Generar el payload y firmar el token JWT
        payload_token = {
            "id": usuario.get("id"),
            "username": usuario.get("email"),
            "rol": usuario.get("rol")
        }
        token_jwt = crear_token_acceso(payload_token)

        # Retornar estructura global y de sesión requerida
        return {
            "ok": True,
            "data": {
                "token": token_jwt,
                "usuario": {
                    "id": usuario.get("id"),
                    "email": usuario.get("email"),
                    "nombre_completo": usuario.get("nombre_completo"),
                    "rol": usuario.get("rol")
                },
                "rol": usuario.get("rol")
            }
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el servidor de autenticación: {str(ex)}"
        )
