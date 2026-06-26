# =============================================================================
# ROUTER: bitacora.py
# Propósito: Controladores y endpoints de la API de Bitácora.
#            Provee acceso seguro e histórico de movimientos y auditoría.
# Idioma: Español
# =============================================================================

from fastapi import APIRouter, Depends, status, Query
from typing import List, Literal
from app.schemas import MovimientoStockAgrupadoRespuesta, BitacoraUsuarioRespuesta
from app.services.bitacora import BitacoraService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/bitacora", tags=["Bitácora"])

@router.get("/productos", response_model=dict)
async def obtener_movimientos_productos(
    periodo: Literal["dia", "semana", "mes"] = Query("dia", description="Período de agrupación: 'dia', 'semana' o 'mes'"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna los movimientos de stock del inventario agrupados por periodo de tiempo.
    Acceso limitado exclusivamente al rol 'Administrador'.
    """
    resultado = BitacoraService.obtener_movimientos_productos(periodo)
    respuestas = [MovimientoStockAgrupadoRespuesta.model_validate(r) for r in resultado]
    return {"ok": True, "data": respuestas}

@router.get("/usuarios", response_model=dict)
async def listar_bitacora_usuarios(
    skip: int = Query(0, ge=0, description="Número de registros a omitir para paginación"),
    limit: int = Query(50, ge=1, le=100, description="Límite máximo de registros a retornar"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna el historial completo de acciones de usuarios con paginación y orden descendente.
    Acceso limitado exclusivamente al rol 'Administrador'.
    """
    resultado = BitacoraService.listar_bitacora_usuarios(skip=skip, limit=limit)
    respuestas = [BitacoraUsuarioRespuesta.model_validate(r) for r in resultado]
    return {"ok": True, "data": respuestas}
