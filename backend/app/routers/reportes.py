from fastapi import APIRouter, Depends, status, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.schemas.modelos import DashboardMetricas, MovimientoKardex
from app.services.reportes import ReporteService
from app.services.dependencias import verificar_roles

router = APIRouter(prefix="/reportes", tags=["Reportes"])

@router.get("/dashboard", response_model=dict)
async def obtener_dashboard(
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna métricas clave consolidadas para el Dashboard administrativo.
    Acceso limitado exclusivamente al rol 'Administrador'.
    """
    resultado = ReporteService.obtener_metricas_dashboard()
    # Formatear contra el esquema de validación
    metricas = DashboardMetricas.model_validate(resultado)
    return {"ok": True, "data": metricas}

@router.get("/kardex", response_model=dict)
async def obtener_kardex(
    producto_id: Optional[UUID] = Query(None, description="Filtrar por producto específico"),
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio del rango (YYYY-MM-DD)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin del rango (YYYY-MM-DD)"),
    tipo_movimiento: Optional[str] = Query(None, description="Venta, Compra, Ajuste, etc."),
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna el kárdex/historial de stock de inventario filtrado.
    Acceso limitado al rol 'Administrador'.
    """
    resultado = ReporteService.obtener_historial_kardex(
        producto_id=producto_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tipo_movimiento=tipo_movimiento
    )
    respuestas = [MovimientoKardex.model_validate(m) for m in resultado]
    return {"ok": True, "data": respuestas}

@router.get("/cierre-pdf")
async def descargar_cierre_caja(
    fecha: date = Query(..., description="Fecha del cierre de caja a exportar (YYYY-MM-DD)"),
    rol_operador: str = Depends(verificar_roles(["Administrador"]))
):
    """
    Genera y descarga en tiempo real el PDF del Cierre de Caja Diario.
    Acceso limitado al rol 'Administrador'.
    """
    pdf_buffer = ReporteService.generar_pdf_cierre_caja(fecha)
    nombre_archivo = f"cierre_caja_{fecha.isoformat()}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={nombre_archivo}"
        }
    )
