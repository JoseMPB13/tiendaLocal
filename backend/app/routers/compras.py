# =============================================================================
# ROUTER DE API: compras.py (DESHABILITADO)
# Propósito: Módulo de compras deshabilitado y desmantelado.
# Reemplazado por: Ajustes de Inventario Manuales.
# Idioma: Español
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/compras", tags=["Compras"])

@router.api_route("", methods=["GET", "POST", "PUT", "DELETE"])
@router.api_route("/", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
async def modulo_deshabilitado(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Este módulo ha sido desmantelado y reemplazado por la funcionalidad de Ajustes de Inventario.
    Retorna un error 410 Gone de forma permanente.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="El módulo de compras físicas ha sido desmantelado y reemplazado por Ajustes de Inventario Manuales."
    )
