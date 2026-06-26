from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import ClienteCrear, ClienteActualizar, ClienteRespuesta
from app.services.clientes import ClienteService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService

router = APIRouter(prefix="/clientes", tags=["Clientes"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    cliente: ClienteCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un nuevo cliente. Accesible por Administrador y Cajero.
    """
    resultado = ClienteService.crear_cliente(cliente)
    # Registrar en bitácora de forma atómica con el usuario_id real del JWT
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CREAR",
        tabla_afectada="clientes",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Cliente registrado: '{resultado.get('nombre')}' (DNI/RUC: {resultado.get('dni_ruc')})",
        datos_nuevos={"nombre": resultado.get("nombre"), "telefono": resultado.get("telefono"), "estado": resultado.get("estado")}
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_clientes(
    incluir_inactivos: bool = False,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Lista todos los clientes. Accesible por todos los roles autorizados.
    """
    lista = ClienteService.obtener_todos(incluir_inactivos=incluir_inactivos)
    respuestas = [ClienteRespuesta.model_validate(c) for c in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{cliente_id}", response_model=dict)
async def obtener_cliente(
    cliente_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Busca un cliente por su ID.
    """
    resultado = ClienteService.obtener_por_id(cliente_id)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{cliente_id}", response_model=dict)
async def actualizar_cliente(
    cliente_id: UUID,
    cliente: ClienteActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza la información de un cliente. Accesible por Administrador y Cajero.
    """
    # Capturar estado previo del cliente antes de la modificación
    cli_antes = ClienteService.obtener_por_id(cliente_id)
    resultado = ClienteService.actualizar_cliente(cliente_id, cliente)
    # Registrar modificación con snapshot diferencial (antes/después)
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="clientes",
        registro_id=cliente_id,
        operacion="UPDATE",
        detalles=f"Cliente actualizado: '{resultado.get('nombre')}'",
        datos_anteriores={k: cli_antes.get(k) for k in cliente.model_dump(exclude_unset=True)},
        datos_nuevos=cliente.model_dump(exclude_unset=True)
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{cliente_id}", response_model=dict)
async def eliminar_cliente(
    cliente_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Inactiva un cliente (Baja lógica). Requiere rol 'Administrador'.
    """
    resultado = ClienteService.eliminar_cliente(cliente_id)
    # Registrar baja lógica de cliente en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="DESACTIVAR",
        tabla_afectada="clientes",
        registro_id=cliente_id,
        operacion="UPDATE",
        detalles=f"Cliente desactivado: '{resultado.get('nombre')}'",
        datos_anteriores={"estado": "Activo"},
        datos_nuevos={"estado": "Inactivo"}
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
