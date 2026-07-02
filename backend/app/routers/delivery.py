from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from pydantic import BaseModel
from app.schemas.modelos import (
    RepartidorCrear, RepartidorActualizar, RepartidorRespuesta,
    EnvioCrear, EnvioActualizar, EnvioRespuesta,
    UbicacionActualizar, ConfiguracionSistemaCrear, ConfiguracionSistemaRespuesta
)
from app.services.delivery import DeliveryService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService


router = APIRouter(prefix="/delivery", tags=["Delivery & Reparto"])

# -----------------------------------------------------------------------------
# ENDPOINTS PARA REPARTIDORES
# -----------------------------------------------------------------------------

@router.post("/repartidores", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/repartidores/", response_model=dict, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def registrar_repartidor(
    repartidor: RepartidorCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un perfil de repartidor para un usuario de rol Repartidor.
    Accesible por Administrador y Cajero.
    """
    resultado = DeliveryService.registrar_repartidor(repartidor)
    # Registrar en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CREAR",
        tabla_afectada="repartidores",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Repartidor registrado para usuario ID: {repartidor.usuario_id}",
        datos_nuevos={"usuario_id": str(repartidor.usuario_id), "vehiculo": repartidor.vehiculo, "placa": repartidor.placa}
    )
    respuesta = RepartidorRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/repartidores", response_model=dict)
async def listar_repartidores(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Obtiene la lista de repartidores.
    """
    lista = DeliveryService.obtener_todos_repartidores()
    respuestas = [RepartidorRespuesta.model_validate(r) for r in lista]
    return {"ok": True, "data": respuestas}

@router.put("/repartidores/{repartidor_id}", response_model=dict)
@router.put("/repartidores/{repartidor_id}/", response_model=dict, include_in_schema=False)
async def actualizar_repartidor(
    repartidor_id: UUID,
    datos: RepartidorActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza la información y el estado (Disponible, En Ruta, Inactivo) del repartidor.
    """
    # Obtener el estado previo del repartidor
    try:
        rep_antes = DeliveryService.obtener_repartidor_por_id(repartidor_id)
        datos_previos = {
            "vehiculo": rep_antes.get("vehiculo"),
            "placa": rep_antes.get("placa"),
            "estado_repartidor": rep_antes.get("estado_repartidor")
        }
    except Exception:
        datos_previos = None

    resultado = DeliveryService.actualizar_repartidor(repartidor_id, datos)

    # Registrar en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="repartidores",
        registro_id=repartidor_id,
        operacion="UPDATE",
        detalles=f"Repartidor actualizado. Nuevo estado: {resultado.get('estado_repartidor')}",
        datos_anteriores=datos_previos,
        datos_nuevos=datos.model_dump(exclude_unset=True)
    )
    respuesta = RepartidorRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

# -----------------------------------------------------------------------------
# ENDPOINTS PARA ORDENES DE ENVÍO
# -----------------------------------------------------------------------------

@router.post("/envios", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/envios/", response_model=dict, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def registrar_envio(
    envio: EnvioCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra una orden de delivery para una venta.
    """
    resultado = DeliveryService.registrar_envio(envio)
    # Registrar en bitácora de forma atómica con el usuario_id real del JWT
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CREAR",
        tabla_afectada="envios",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Orden de envío creada para venta ID: {envio.venta_id}",
        datos_nuevos={
            "venta_id": str(envio.venta_id),
            "repartidor_id": str(envio.repartidor_id) if envio.repartidor_id else None,
            "direccion_despacho": envio.direccion_despacho,
            "costo_envio": float(envio.costo_envio) if envio.costo_envio is not None else 0.0,
            "estado_envio": "Pendiente"
        }
    )
    respuesta = EnvioRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/envios", response_model=dict)
async def listar_envios(
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Lista todos los envíos. Accesible por cualquier rol.
    """
    lista = DeliveryService.obtener_todos_envios()
    respuestas = [EnvioRespuesta.model_validate(e) for e in lista]
    return {"ok": True, "data": respuestas}

@router.put("/envios/{envio_id}", response_model=dict)
@router.put("/envios/{envio_id}/", response_model=dict, include_in_schema=False)
async def actualizar_envio(
    envio_id: UUID,
    datos: EnvioActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Actualiza la orden de despacho (dirección, costo, repartidor o estado del flujo logístico).
    Si el estado ya es 'Entregado', bloquea cualquier cambio futuro.
    """
    # Obtener el estado previo del envío
    try:
        envio_antes = DeliveryService.obtener_envio_por_id(envio_id)
        datos_previos = {
            "estado_envio": envio_antes.get("estado_envio"),
            "repartidor_id": str(envio_antes.get("repartidor_id")) if envio_antes.get("repartidor_id") else None,
            "direccion_despacho": envio_antes.get("direccion_despacho"),
            "costo_envio": float(envio_antes.get("costo_envio")) if envio_antes.get("costo_envio") is not None else 0.0
        }
    except Exception:
        datos_previos = None

    resultado = DeliveryService.actualizar_envio(envio_id, datos, usuario_actual)

    # Registrar en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="envios",
        registro_id=envio_id,
        operacion="UPDATE",
        detalles=f"Envío actualizado. Nuevo estado: {resultado.get('estado_envio')}",
        datos_anteriores=datos_previos,
        datos_nuevos=datos.model_dump(exclude_unset=True)
    )
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


# -----------------------------------------------------------------------------
# ENDPOINT DE BAJA LÓGICA (CANCELACIÓN ADMINISTRATIVA) DE ENVÍOS
# -----------------------------------------------------------------------------

class MotivoCancelacion(BaseModel):
    """Cuerpo requerido para la cancelación lógica de un envío."""
    motivo_cancelacion: str

@router.delete("/envios/{envio_id}", response_model=dict)
@router.delete("/envios/{envio_id}/", response_model=dict, include_in_schema=False)
async def cancelar_envio(
    envio_id: UUID,
    datos: MotivoCancelacion,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Baja lógica de un envío: cambia el estado a 'Cancelado'.
    NUNCA elimina el registro físicamente de la base de datos.
    Solo aplica a envíos en estado 'Pendiente'.
    Requiere un motivo de cancelación obligatorio en el cuerpo de la solicitud.
    """
    # Obtener el estado previo del envío antes de cancelar
    try:
        envio_antes = DeliveryService.obtener_envio_por_id(envio_id)
        datos_previos = {"estado_envio": envio_antes.get("estado_envio")}
    except Exception:
        datos_previos = None

    resultado = DeliveryService.cancelar_envio(envio_id, datos.motivo_cancelacion)

    # Registrar en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CANCELAR",
        tabla_afectada="envios",
        registro_id=envio_id,
        operacion="UPDATE",
        detalles=f"Envío cancelado. Motivo: {datos.motivo_cancelacion}",
        datos_anteriores=datos_previos,
        datos_nuevos={
            "estado_envio": "Cancelado",
            "motivo_cancelacion": datos.motivo_cancelacion
        }
    )
    return {"ok": True, "data": resultado}


# -----------------------------------------------------------------------------
# ENDPOINT DE SEGUIMIENTO GPS EN TIEMPO REAL (ALTA FRECUENCIA)
# -----------------------------------------------------------------------------

@router.put("/mi-ubicacion", response_model=dict, summary="Actualizar posición GPS del repartidor autenticado")
@router.put("/mi-ubicacion/", response_model=dict, include_in_schema=False)
async def actualizar_mi_ubicacion(
    ubicacion: UbicacionActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Repartidor"]))
):
    """
    Endpoint de alta frecuencia para transmitir la posición GPS del repartidor.
    Solo accesible por el rol Repartidor. No registra en bitácora para no saturarla
    con miles de actualizaciones de coordenadas por sesión.
    """
    resultado = DeliveryService.actualizar_ubicacion_repartidor(usuario_actual, ubicacion)
    return resultado


@router.get("/repartidores/{repartidor_id}/ubicacion", response_model=dict)
async def obtener_ubicacion_repartidor(
    repartidor_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Obtiene la última posición GPS registrada de un repartidor.
    Utilizado por el componente MapaSeguimiento para renderizar el ícono del repartidor en tiempo real.
    """
    resultado = DeliveryService.obtener_ubicacion_repartidor(repartidor_id)
    return {"ok": True, "data": resultado}


# -----------------------------------------------------------------------------
# ENDPOINTS DE CONFIGURACIÓN DEL SISTEMA
# -----------------------------------------------------------------------------

@router.get("/configuracion/{clave}", response_model=dict)
async def obtener_configuracion(
    clave: str,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Lee el valor de una clave de configuración del sistema.
    Ej: GET /delivery/configuracion/kiosco_latitud
    """
    resultado = DeliveryService.obtener_configuracion(clave)
    return {"ok": True, "data": resultado}


@router.put("/configuracion", response_model=dict, status_code=status.HTTP_200_OK)
@router.put("/configuracion/", response_model=dict, include_in_schema=False)
async def guardar_configuracion(
    datos: ConfiguracionSistemaCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Crea o actualiza (UPSERT) una clave de configuración del sistema.
    Solo accesible por el rol Administrador.
    """
    resultado = DeliveryService.guardar_configuracion(datos)
    return {"ok": True, "data": resultado}
