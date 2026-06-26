from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import ProductoCrear, ProductoActualizar, ProductoRespuesta, ProductoReabastecer
from app.services.productos import ProductoService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService

router = APIRouter(prefix="/productos", tags=["Productos"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_producto(
    producto: ProductoCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Registra un nuevo producto en el catálogo. Requiere rol 'Administrador'.
    """
    resultado = ProductoService.crear_producto(producto)
    BitacoraService.asociar_usuario_a_ultimo_cambio(resultado["id"], usuario_actual.get("id"))
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_productos(
    incluir_inactivos: bool = False,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Retorna la lista de productos registrados. Accesible por cualquier rol.
    """
    lista = ProductoService.obtener_todos(incluir_inactivos=incluir_inactivos)
    respuestas = [ProductoRespuesta.model_validate(p) for p in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{producto_id}", response_model=dict)
async def obtener_producto(
    producto_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero", "Repartidor"]))
):
    """
    Busca un producto específico por ID.
    """
    resultado = ProductoService.obtener_por_id(producto_id)
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{producto_id}", response_model=dict)
async def actualizar_producto(
    producto_id: UUID,
    producto: ProductoActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Actualiza la información de un producto. Requiere rol 'Administrador'.
    """
    resultado = ProductoService.actualizar_producto(producto_id, producto)
    BitacoraService.asociar_usuario_a_ultimo_cambio(producto_id, usuario_actual.get("id"))
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{producto_id}", response_model=dict)
async def eliminar_producto(
    producto_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Inactiva un producto (Baja lógica). Requiere rol 'Administrador'.
    """
    resultado = ProductoService.eliminar_producto(producto_id)
    BitacoraService.asociar_usuario_a_ultimo_cambio(producto_id, usuario_actual.get("id"))
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.post("/reabastecer", response_model=dict)
async def reabastecer_producto(
    payload: ProductoReabastecer,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra el reabastecimiento de stock de un producto atómicamente y actualiza su costo.
    Requiere rol 'Administrador' o 'Cajero'.
    """
    resultado = ProductoService.reabastecer_producto(payload, usuario_actual["id"])
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
