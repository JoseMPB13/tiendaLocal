# =============================================================================
# ROUTER DE API: compras.py
# Propósito: Definir los endpoints de la API REST para el módulo de compras y reabastecimiento.
# Dependencias: FastAPI, CompraService, schemas, dependencias de seguridad.
# Idioma: Español
# =============================================================================

from fastapi import APIRouter, Depends, status
from typing import List, Optional
from uuid import UUID
from app.schemas.modelos import CompraCrear, CompraRespuesta, CompraConDetallesRespuesta
from app.services.compras import CompraService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/compras", tags=["Compras"])

@router.get("/", response_model=dict)
async def listar_compras(
    estado_compra: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Lista el historial de compras registradas en el sistema.
    Soporta filtros opcionales por estado_compra (Completada, Cancelada) y paginación (skip, limit).
    """
    compras_data = CompraService.listar_compras(estado_compra, skip, limit)
    respuesta = [CompraRespuesta.model_validate(c) for c in compras_data]
    return {"ok": True, "data": respuesta}

@router.get("/{compra_id}", response_model=dict)
async def obtener_compra(
    compra_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Busca una compra específica por su UUID y retorna sus datos de cabecera junto con sus artículos asociados.
    """
    resultado = CompraService.obtener_completa_por_id(compra_id)
    respuesta = CompraConDetallesRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def registrar_reabastecimiento(
    compra: CompraCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Registra un nuevo reabastecimiento (compra a proveedores) en la base de datos de manera atómica.
    El ID del administrador que registra la compra se inyecta de forma segura a partir del JWT.
    """
    usuario_id = usuario_actual["id"]
    resultado = CompraService.registrar_reabastecimiento(compra, usuario_id)
    respuesta = CompraRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{compra_id}/cancelar", response_model=dict)
async def cancelar_compra(
    compra_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Realiza la baja lógica de una compra (cambiando su estado a 'Cancelada').
    Dispara la reversión automática de stock e inventario en la base de datos de manera atómica,
    previniendo que el stock de los productos involucrados caiga por debajo de cero.
    """
    resultado_id = CompraService.cancelar_compra(compra_id)
    return {"ok": True, "data": {"id": resultado_id, "estado_compra": "Cancelada"}}
