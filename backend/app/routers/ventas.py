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

def convertir_uuid_a_str(obj):
    """
    Función recursiva para convertir cualquier objeto UUID a su representación
    en cadena de texto (str) dentro de estructuras de datos (diccionarios y listas).
    Evita fallos de serialización JSON con Supabase y Pydantic.
    Idioma: Español
    """
    if isinstance(obj, dict):
        return {k: convertir_uuid_a_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convertir_uuid_a_str(x) for x in obj]
    elif isinstance(obj, UUID):
        return str(obj)
    return obj

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def listar_ventas(
    estado_venta: Optional[str] = None,
    fecha_especifica: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Lista todas las ventas registradas en el sistema.
    Soporta filtros opcionales por estado_venta (Completada, Cancelada, Pendiente), 
    fecha_especifica (YYYY-MM-DD) y paginación (skip, limit).
    """
    ventas_data = VentaService.listar_ventas(estado_venta, fecha_especifica, skip, limit)
    # Convertir explícitamente cualquier UUID nativo de Supabase a cadena de texto
    datos_limpios = convertir_uuid_a_str(ventas_data)
    respuesta = [VentaRespuesta.model_validate(v) for v in datos_limpios]
    # Serializar los esquemas y asegurar conversión a str de cualquier UUID residual
    respuesta_dict = [r.model_dump() for r in respuesta]
    respuesta_final = convertir_uuid_a_str(respuesta_dict)
    return {"ok": True, "data": respuesta_final}

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
    # Registrar en bitácora de forma atómica con el usuario_id real del JWT
    BitacoraService.registrar_accion(
        usuario_id=usuario_id,
        accion="CREAR",
        tabla_afectada="ventas",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Venta registrada: Factura {resultado.get('codigo_factura')} por Bs. {resultado.get('total')}",
        datos_nuevos={
            "codigo_factura": resultado.get("codigo_factura"),
            "total": float(resultado.get("total")) if resultado.get("total") is not None else 0.0,
            "estado_venta": resultado.get("estado_venta"),
            "tipo_pago": resultado.get("tipo_pago")
        }
    )
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
    # Intentar obtener la factura antes de cancelar para los detalles de la bitácora
    try:
        venta_obj = VentaService.obtener_completa_por_id(venta_id)
        cod_fac = venta_obj.get("codigo_factura", "Desconocida")
    except Exception:
        cod_fac = "Desconocida"

    resultado_id = VentaService.cancelar_venta(venta_id)

    # Registrar anulación en bitácora de forma atómica
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="ANULAR",
        tabla_afectada="ventas",
        registro_id=venta_id,
        operacion="UPDATE",
        detalles=f"Venta anulada: Factura {cod_fac}",
        datos_anteriores={"estado_venta": "Completada"},
        datos_nuevos={"estado_venta": "Cancelada"}
    )
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
    # Capturar el estado previo de la venta antes de actualizar
    try:
        venta_antes = VentaService.obtener_completa_por_id(venta_id)
        datos_previos = {
            "total": float(venta_antes.get("total")) if venta_antes.get("total") is not None else 0.0,
            "tipo_pago": venta_antes.get("tipo_pago"),
            "detalles": [
                {"producto_id": str(d.get("producto_id")), "cantidad": d.get("cantidad"), "precio_unitario": float(d.get("precio_unitario"))}
                for d in venta_antes.get("detalles", [])
            ]
        }
    except Exception:
        datos_previos = None

    resultado = VentaService.actualizar_venta(venta_id, venta)

    # Registrar modificación en bitácora con snapshot diferencial (antes/después)
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="ventas",
        registro_id=venta_id,
        operacion="UPDATE",
        detalles=f"Venta modificada: Factura {resultado.get('codigo_factura')}",
        datos_anteriores=datos_previos,
        datos_nuevos={
            "total": float(resultado.get("total")) if resultado.get("total") is not None else 0.0,
            "tipo_pago": resultado.get("tipo_pago"),
            "detalles": [d.model_dump() for d in venta.detalles]
        }
    )
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
