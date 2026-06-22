from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import VentaCrear, VentaRespuesta
from app.services.ventas import VentaService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/ventas", tags=["Ventas"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def registrar_venta(
    venta: VentaCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra una nueva transacción de venta (al contado o a crédito).
    Accesible por Administrador y Cajero. El ID del operador se extrae de manera segura del JWT.
    """
    # Inyectar el ID del cajero extraído de forma segura desde el JWT
    usuario_id = usuario_actual["id"]
    resultado = VentaService.registrar_venta(venta, usuario_id)
    respuesta = VentaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/{venta_id}", response_model=dict)
async def obtener_venta(
    venta_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Busca los datos de cabecera de una venta.
    """
    resultado = VentaService.obtener_por_id(venta_id)
    respuesta = VentaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/{venta_id}/detalles", response_model=dict)
async def obtener_detalles_venta(
    venta_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Retorna la lista de ítems detallados asociados a una venta.
    """
    detalles = VentaService.obtener_detalles(venta_id)
    return {"ok": True, "data": detalles}
