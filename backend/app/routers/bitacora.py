# =============================================================================
# ROUTER: bitacora.py
# Propósito: Controladores y endpoints de la API de Bitácora.
#            Provee acceso seguro e histórico de movimientos y auditoría.
# Idioma: Español
# =============================================================================

from fastapi import APIRouter, Depends, status, Query
from typing import List, Literal, Optional
from datetime import date
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
    limit: int = Query(50, ge=1, le=200, description="Límite máximo de registros a retornar"),
    # Filtros avanzados delegados al motor de base de datos (no en memoria)
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio del rango (YYYY-MM-DD, inclusiva)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin del rango (YYYY-MM-DD, inclusiva hasta las 23:59:59)"),
    tabla_afectada: Optional[str] = Query(None, description="Tabla SQL afectada: ventas, productos, clientes, envios, compras"),
    operacion: Optional[str] = Query(None, description="Tipo de operación DML: INSERT, UPDATE, DELETE"),
    accion: Optional[str] = Query(None, description="Acción semántica: CREAR, MODIFICAR, DESACTIVAR, ANULAR, CANCELAR"),
    nombre_usuario: Optional[str] = Query(None, description="Búsqueda parcial por nombre completo del operador"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna el historial de auditoría de acciones de usuarios con soporte de filtros
    avanzados delegados a la base de datos. Acceso limitado al rol 'Administrador'.

    Filtros disponibles (todos opcionales):
        - fecha_inicio / fecha_fin: Rango de fechas (ISO 8601).
        - tabla_afectada: ventas, productos, clientes, envios, compras.
        - operacion: INSERT, UPDATE, DELETE.
        - accion: CREAR, MODIFICAR, DESACTIVAR, ANULAR, CANCELAR.
        - nombre_usuario: Búsqueda parcial por nombre del operador (filtro en memoria).
    """
    resultado = BitacoraService.listar_bitacora_usuarios(
        skip=skip,
        limit=limit,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tabla_afectada=tabla_afectada,
        operacion=operacion,
        accion=accion,
        nombre_usuario=nombre_usuario
    )
    respuestas = [BitacoraUsuarioRespuesta.model_validate(r) for r in resultado]
    return {"ok": True, "data": respuestas}


