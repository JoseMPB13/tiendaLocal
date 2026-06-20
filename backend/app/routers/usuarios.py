from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import UsuarioCrear, UsuarioActualizar, UsuarioRespuesta
from app.services.usuarios import UsuarioService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

# Envoltura de respuesta global de éxito obligatoria: {"ok": true, "data": ...}

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    usuario: UsuarioCrear,
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Crea un nuevo usuario en el sistema. Limitado únicamente al rol 'Administrador'.
    """
    resultado = UsuarioService.crear_usuario(usuario)
    # Convertir a esquema de respuesta para filtrar campos sensibles (hashing)
    respuesta = UsuarioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_usuarios(
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Retorna todos los usuarios registrados. Accesible por Administradores y Cajeros.
    """
    lista = UsuarioService.obtener_todos()
    respuestas = [UsuarioRespuesta.model_validate(u) for u in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{usuario_id}", response_model=dict)
async def obtener_usuario(
    usuario_id: UUID,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Obtiene los datos de un usuario por su ID.
    """
    resultado = UsuarioService.obtener_por_id(usuario_id)
    respuesta = UsuarioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{usuario_id}", response_model=dict)
async def actualizar_usuario(
    usuario_id: UUID,
    usuario: UsuarioActualizar,
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Actualiza la información de un usuario. Restringido a 'Administrador'.
    """
    resultado = UsuarioService.actualizar_usuario(usuario_id, usuario)
    respuesta = UsuarioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
