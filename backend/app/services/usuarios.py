from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import UsuarioCrear, UsuarioActualizar
from app.services.seguridad import obtener_password_hash

class UsuarioService:
    @staticmethod
    def crear_usuario(usuario: UsuarioCrear) -> dict:
        """
        Crea un nuevo usuario en la base de datos Supabase, hasheando la contraseña previamente.
        """
        # Verificar si el email ya existe
        email_check = supabase.table("usuarios").select("id").eq("email", usuario.email).execute()
        if email_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ya se encuentra registrado."
            )

        # Hashear la contraseña
        password_hash = obtener_password_hash(usuario.password)

        nuevo_usuario = {
            "email": usuario.email,
            "password_hash": password_hash,
            "nombre_completo": usuario.nombre_completo,
            "rol": usuario.rol,
            "estado": "Activo"
        }

        resultado = supabase.table("usuarios").insert(nuevo_usuario).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el usuario en la base de datos."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todos() -> List[dict]:
        """
        Retorna la lista de todos los usuarios registrados.
        """
        resultado = supabase.table("usuarios").select("*").execute()
        return resultado.data or []

    @staticmethod
    def obtener_por_id(usuario_id: UUID) -> dict:
        """
        Busca y retorna un usuario por su identificador UUID.
        """
        resultado = supabase.table("usuarios").select("*").eq("id", str(usuario_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_usuario(usuario_id: UUID, usuario: UsuarioActualizar) -> dict:
        """
        Actualiza los datos del usuario. Permite actualizar opcionalmente la contraseña hasheándola.
        """
        # Verificar existencia
        UsuarioService.obtener_por_id(usuario_id)

        datos_actualizar = usuario.model_dump(exclude_unset=True)

        # Si se envía contraseña, hashearla y actualizar password_hash en su lugar
        if "password" in datos_actualizar:
            datos_actualizar["password_hash"] = obtener_password_hash(datos_actualizar["password"])
            del datos_actualizar["password"]

        resultado = supabase.table("usuarios").update(datos_actualizar).eq("id", str(usuario_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar el usuario."
            )
        return resultado.data[0]
