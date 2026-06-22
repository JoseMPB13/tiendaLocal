from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import CategoriaCrear, CategoriaActualizar, CategoriaRespuesta
from app.services.categorias import CategoriaService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/categorias", tags=["Categorias"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_categoria(
    categoria: CategoriaCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Crea una nueva categoría. Limitado solo a Administradores.
    """
    resultado = CategoriaService.crear_categoria(categoria)
    respuesta = CategoriaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_categorias(
    incluir_inactivas: bool = False,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Lista las categorías del inventario. Por defecto retorna solo las activas.
    Accesible por todos los roles.
    """
    lista = CategoriaService.obtener_todas(incluir_inactivas=incluir_inactivas)
    respuestas = [CategoriaRespuesta.model_validate(c) for c in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{categoria_id}", response_model=dict)
async def obtener_categoria(
    categoria_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Busca una categoría por ID.
    """
    resultado = CategoriaService.obtener_por_id(categoria_id)
    respuesta = CategoriaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{categoria_id}", response_model=dict)
async def actualizar_categoria(
    categoria_id: UUID,
    categoria: CategoriaActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Actualiza una categoría existente. Restringido a Administradores.
    """
    resultado = CategoriaService.actualizar_categoria(categoria_id, categoria)
    respuesta = CategoriaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{categoria_id}", response_model=dict)
async def eliminar_categoria(
    categoria_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Realiza una baja lógica de la categoría seleccionada (cambia estado a Inactivo).
    Restringido a Administradores.
    """
    resultado = CategoriaService.eliminar_categoria(categoria_id)
    respuesta = CategoriaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
