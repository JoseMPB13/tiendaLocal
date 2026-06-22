from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import (
    RepartidorCrear, RepartidorActualizar, RepartidorRespuesta,
    EnvioCrear, EnvioActualizar, EnvioRespuesta
)
from app.services.delivery import DeliveryService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/delivery", tags=["Delivery & Reparto"])

# -----------------------------------------------------------------------------
# ENDPOINTS PARA REPARTIDORES
# -----------------------------------------------------------------------------

@router.post("/repartidores", response_model=dict, status_code=status.HTTP_201_CREATED)
async def registrar_repartidor(
    repartidor: RepartidorCrear,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un perfil de repartidor para un usuario de rol Repartidor.
    Accesible por Administrador y Cajero.
    """
    resultado = DeliveryService.registrar_repartidor(repartidor)
    respuesta = RepartidorRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/repartidores", response_model=dict)
async def listar_repartidores(
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Obtiene la lista de repartidores.
    """
    lista = DeliveryService.obtener_todos_repartidores()
    respuestas = [RepartidorRespuesta.model_validate(r) for r in lista]
    return {"ok": True, "data": respuestas}

@router.put("/repartidores/{repartidor_id}", response_model=dict)
async def actualizar_repartidor(
    repartidor_id: UUID,
    datos: RepartidorActualizar,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza la información y el estado (Disponible, En Ruta, Inactivo) del repartidor.
    """
    resultado = DeliveryService.actualizar_repartidor(repartidor_id, datos)
    respuesta = RepartidorRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

# -----------------------------------------------------------------------------
# ENDPOINTS PARA ORDENES DE ENVÍO
# -----------------------------------------------------------------------------

@router.post("/envios", response_model=dict, status_code=status.HTTP_201_CREATED)
async def registrar_envio(
    envio: EnvioCrear,
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra una orden de delivery para una venta.
    """
    resultado = DeliveryService.registrar_envio(envio)
    respuesta = EnvioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/envios", response_model=dict)
async def listar_envios(
    rol_operador: str = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Lista todos los envíos. Accesible por cualquier rol.
    """
    lista = DeliveryService.obtener_todos_envios()
    respuestas = [EnvioRespuesta.model_validate(e) for e in lista]
    return {"ok": True, "data": respuestas}

@router.put("/envios/{envio_id}", response_model=dict)
async def actualizar_envio(
    envio_id: UUID,
    datos: EnvioActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Actualiza la orden de despacho (dirección, costo, repartidor o estado del flujo logístico).
    Si el estado ya es 'Entregado', bloquea cualquier cambio futuro.
    """
    resultado = DeliveryService.actualizar_envio(envio_id, datos, usuario_actual)
    respuesta = EnvioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/mis-envios-activos", response_model=dict)
async def listar_mis_envios_activos(
    usuario_actual: dict = Depends(verificar_roles(["Repartidor"]))
):
    """
    Obtiene la lista de envíos activos ('En Camino') asignados al repartidor autenticado.
    Excluye cualquier fuga de datos PII ajenos.
    """
    lista = DeliveryService.obtener_envios_activos_repartidor(usuario_actual)
    return {"ok": True, "data": lista}

