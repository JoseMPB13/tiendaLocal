from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import ClienteCrear, ClienteActualizar, ClienteRespuesta
from app.services.clientes import ClienteService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/clientes", tags=["Clientes"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    cliente: ClienteCrear,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un nuevo cliente. Accesible por Administrador y Cajero.
    """
    resultado = ClienteService.crear_cliente(cliente)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_clientes(
    incluir_inactivos: bool = False,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Lista todos los clientes. Accesible por todos los roles autorizados.
    """
    lista = ClienteService.obtener_todos(incluir_inactivos=incluir_inactivos)
    respuestas = [ClienteRespuesta.model_validate(c) for c in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{cliente_id}", response_model=dict)
async def obtener_cliente(
    cliente_id: UUID,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Busca un cliente por su ID.
    """
    resultado = ClienteService.obtener_por_id(cliente_id)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{cliente_id}", response_model=dict)
async def actualizar_cliente(
    cliente_id: UUID,
    cliente: ClienteActualizar,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza la información de un cliente. Accesible por Administrador y Cajero.
    """
    resultado = ClienteService.actualizar_cliente(cliente_id, cliente)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{cliente_id}", response_model=dict)
async def eliminar_cliente(
    cliente_id: UUID,
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Inactiva un cliente (Baja lógica). Requiere rol 'Administrador'.
    """
    resultado = ClienteService.eliminar_cliente(cliente_id)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
