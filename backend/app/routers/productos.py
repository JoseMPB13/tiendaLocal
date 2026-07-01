from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from app.schemas.modelos import ProductoCrear, ProductoActualizar, ProductoRespuesta, ProductoAjustarStock
from app.services.productos import ProductoService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService

router = APIRouter(prefix="/productos", tags=["Productos"])

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_producto(
    producto: ProductoCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Registra un nuevo producto en el catálogo. Requiere rol 'Administrador'.
    """
    resultado = ProductoService.crear_producto(producto)
    # Registrar en bitácora de forma atómica con el usuario_id real del JWT
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CREAR",
        tabla_afectada="productos",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Producto creado: '{resultado.get('nombre')}' (Cód: {resultado.get('codigo_barras')})",
        datos_nuevos={"nombre": resultado.get("nombre"), "precio_venta": resultado.get("precio_venta"), "stock_actual": resultado.get("stock_actual")}
    )
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
@router.put("/{producto_id}/", response_model=dict)
async def actualizar_producto(
    producto_id: UUID,
    producto: ProductoActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Actualiza la información de un producto. Requiere rol 'Administrador'.
    """
    # Capturar el estado previo del producto antes de actualizar
    prod_antes = ProductoService.obtener_por_id(producto_id)
    resultado = ProductoService.actualizar_producto(producto_id, producto)
    # Registrar en bitácora con snapshot diferencial (antes/después)
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="productos",
        registro_id=producto_id,
        operacion="UPDATE",
        detalles=f"Producto actualizado: '{resultado.get('nombre')}'",
        datos_anteriores={k: prod_antes.get(k) for k in producto.model_dump(exclude_unset=True)},
        datos_nuevos=producto.model_dump(exclude_unset=True)
    )
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{producto_id}", response_model=dict)
@router.delete("/{producto_id}/", response_model=dict)
async def eliminar_producto(
    producto_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Inactiva un producto (Baja lógica). Requiere rol 'Administrador'.
    """
    resultado = ProductoService.eliminar_producto(producto_id)
    # Registrar baja lógica (estado Inactivo) en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="DESACTIVAR",
        tabla_afectada="productos",
        registro_id=producto_id,
        operacion="UPDATE",
        detalles=f"Producto desactivado: '{resultado.get('nombre')}'",
        datos_anteriores={"estado": "Activo"},
        datos_nuevos={"estado": "Inactivo"}
    )
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.post("/{producto_id}/ajustar-stock", response_model=dict)
@router.post("/{producto_id}/ajustar-stock/", include_in_schema=False)
async def ajustar_stock_producto(
    producto_id: UUID,
    payload: ProductoAjustarStock,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un ajuste de stock manual para un producto de manera atómica (positivo para ingresos, negativo para mermas).
    Requiere rol 'Administrador' o 'Cajero'.
    """
    resultado = ProductoService.ajustar_stock(producto_id, payload, usuario_actual["id"])
    respuesta = ProductoRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}
