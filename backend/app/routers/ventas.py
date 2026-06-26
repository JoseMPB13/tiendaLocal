# =============================================================================
# ROUTER DE API: ventas.py
# Propósito: Definir los endpoints de la API REST para el módulo de ventas y facturación.
# Dependencias: FastAPI, VentaService, schemas, dependencias de seguridad.
# Idioma: Español
# =============================================================================

from fastapi import APIRouter, Depends, status
from typing import List, Optional
from uuid import UUID
from app.schemas.modelos import VentaCrear, VentaRespuesta, VentaConDetallesRespuesta
from app.services.ventas import VentaService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService

router = APIRouter(prefix="/ventas", tags=["Ventas"])

@router.get("/", response_model=dict)
async def listar_ventas(
    estado_venta: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Lista todas las ventas registradas en el sistema.
    Soporta filtros opcionales por estado_venta (Completada, Cancelada, Pendiente) y paginación (skip, limit).
    """
    ventas_data = VentaService.listar_ventas(estado_venta, skip, limit)
    respuesta = [VentaRespuesta.model_validate(v) for v in ventas_data]
    return {"ok": True, "data": respuesta}

@router.get("/proximo-numero-factura", response_model=dict)
async def obtener_proximo_numero_factura(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Calcula y retorna el número correlativo de factura que corresponderá a la siguiente venta.
    Útil para mostrar el comprobante en tiempo real en la pantalla del POS.
    """
    codigo = VentaService.obtener_proximo_numero_factura()
    return {"ok": True, "data": codigo}

@router.get("/{venta_id}", response_model=dict)
async def obtener_venta(
    venta_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Busca una venta específica por su UUID y retorna sus datos de cabecera junto con sus artículos asociados.
    """
    resultado = VentaService.obtener_completa_por_id(venta_id)
    respuesta = VentaConDetallesRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def registrar_venta(
    venta: VentaCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra una nueva transacción de venta (al contado o a crédito) en la base de datos.
    El ID del operador/cajero se inyecta de forma segura a partir del JWT.
    """
    usuario_id = usuario_actual["id"]
    resultado = VentaService.registrar_venta(venta, usuario_id)
    respuesta = VentaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{venta_id}/cancelar", response_model=dict)
async def cancelar_venta(
    venta_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Realiza la baja lógica de una venta (cambiando su estado a 'Cancelada').
    Dispara la reversión automática de stock e inventario en la base de datos de manera atómica.
    """
    resultado_id = VentaService.cancelar_venta(venta_id)
    BitacoraService.asociar_usuario_a_ultimo_cambio(venta_id, usuario_actual.get("id"))
    return {"ok": True, "data": {"id": resultado_id, "estado_venta": "Cancelada"}}

@router.put("/{venta_id}", response_model=dict)
async def actualizar_venta(
    venta_id: UUID,
    venta: VentaCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza una venta existente (cabecera, artículos y delivery) de forma atómica.
    Realiza validaciones de stock y reajustes del balance del cliente.
    """
    resultado = VentaService.actualizar_venta(venta_id, venta)
    BitacoraService.asociar_usuario_a_ultimo_cambio(venta_id, usuario_actual.get("id"))
    respuesta = VentaRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/{venta_id}/detalles", response_model=dict)
async def obtener_detalles_venta(
    venta_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Retorna la lista de ítems detallados asociados a una venta (mantenido por retrocompatibilidad).
    """
    detalles = VentaService.obtener_detalles(venta_id)
    return {"ok": True, "data": detalles}
