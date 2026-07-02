from fastapi import APIRouter, Depends, status, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.utils.zona_horaria import ahora_bolivia
from app.schemas.modelos import DashboardMetricas, MovimientoKardex
from app.services.reportes import ReporteService
from app.services.dependencias import verificar_roles
from postgrest.exceptions import APIError

router = APIRouter(prefix="/reportes", tags=["Reportes"])

@router.get("/dashboard", response_model=dict)
@router.get("/dashboard/", include_in_schema=False)
async def obtener_dashboard(
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio para el análisis del dashboard (YYYY-MM-DD)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin para el análisis del dashboard (YYYY-MM-DD)"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Retorna métricas clave consolidadas para el Dashboard administrativo.
    Acceso limitado exclusivamente al rol 'Administrador'.
    """
    resultado = ReporteService.obtener_metricas_dashboard(fecha_inicio, fecha_fin)
    # Formatear contra el esquema de validación
    metricas = DashboardMetricas.model_validate(resultado)
    return {"ok": True, "data": metricas}

@router.get("/kardex", response_model=dict)
async def obtener_kardex(
    producto_id: Optional[UUID] = Query(None, description="Filtrar por producto específico"),
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio del rango (YYYY-MM-DD)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin del rango (YYYY-MM-DD)"),
    tipo_movimiento: Optional[str] = Query(None, description="Venta, Compra, Ajuste, etc."),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
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
@router.get("/cierre-pdf/", include_in_schema=False)
async def descargar_cierre_caja(
    fecha: date = Query(..., description="Fecha del cierre de caja a exportar (YYYY-MM-DD)"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
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

@router.get("/pdf/ventas")
@router.get("/pdf/ventas/", include_in_schema=False)
async def descargar_pdf_ventas(
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio (YYYY-MM-DD)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin (YYYY-MM-DD)"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Genera y descarga en tiempo real el PDF del Reporte de Ventas.
    """
    try:
        pdf_buffer = ReporteService.generar_pdf_ventas(fecha_inicio, fecha_fin)
        nombre = f"reporte_ventas_{ahora_bolivia().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"}
        )
    except APIError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte de ventas: {str(ex)}"
        )

@router.get("/pdf/productos")
@router.get("/pdf/productos/", include_in_schema=False)
async def descargar_pdf_productos(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Genera y descarga en tiempo real el PDF del Reporte de Inventario y Stock Crítico.
    """
    try:
        pdf_buffer = ReporteService.generar_pdf_productos()
        nombre = f"reporte_inventario_{ahora_bolivia().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"}
        )
    except APIError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte de inventario: {str(ex)}"
        )

@router.get("/pdf/categorias")
@router.get("/pdf/categorias/", include_in_schema=False)
async def descargar_pdf_categorias(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Genera y descarga en tiempo real el PDF del Reporte de Categorías.
    """
    try:
        pdf_buffer = ReporteService.generar_pdf_categorias()
        nombre = f"reporte_categorias_{ahora_bolivia().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"}
        )
    except APIError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte de categorías: {str(ex)}"
        )

@router.get("/pdf/clientes")
@router.get("/pdf/clientes/", include_in_schema=False)
async def descargar_pdf_clientes(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Genera y descarga en tiempo real el PDF del Reporte de Clientes y Créditos.
    """
    try:
        pdf_buffer = ReporteService.generar_pdf_clientes()
        nombre = f"reporte_clientes_{ahora_bolivia().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"}
        )
    except APIError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte de clientes: {str(ex)}"
        )

@router.get("/pdf/envios")
@router.get("/pdf/envios/", include_in_schema=False)
async def descargar_pdf_envios(
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio (YYYY-MM-DD)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin (YYYY-MM-DD)"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Genera y descarga en tiempo real el PDF del Reporte de Envíos y Logística.
    """
    try:
        pdf_buffer = ReporteService.generar_pdf_envios(fecha_inicio, fecha_fin)
        nombre = f"reporte_envios_{ahora_bolivia().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"}
        )
    except APIError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte de envíos: {str(ex)}"
        )

