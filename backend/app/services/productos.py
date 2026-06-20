from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import ProductoCrear, ProductoActualizar

class ProductoService:
    @staticmethod
    def _autogenerar_codigo_barras() -> str:
        """
        Genera un código de barras secuencial único con el formato KIO-XXXXX.
        Consulando el último código de barras existente que comience con KIO-.
        """
        resultado = (
            supabase.table("productos")
            .select("codigo_barras")
            .like("codigo_barras", "KIO-%")
            .order("codigo_barras", desc=True)
            .limit(1)
            .execute()
        )
        
        if not resultado.data:
            return "KIO-00001"
            
        ultimo_codigo = resultado.data[0]["codigo_barras"]
        try:
            # Extraer el número correlativo tras el guion
            numero_secuencia = int(ultimo_codigo.split("-")[1])
            nuevo_numero = numero_secuencia + 1
            return f"KIO-{nuevo_numero:05d}"
        except Exception:
            return "KIO-00001"

    @staticmethod
    def crear_producto(producto: ProductoCrear) -> dict:
        """
        Crea un nuevo producto en el catálogo. Genera el código de barras si no se ingresa.
        """
        # Validar existencia de categoría asociada
        cat_check = supabase.table("categorias").select("id").eq("id", str(producto.categoria_id)).execute()
        if not cat_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría especificada no existe."
            )

        codigo = producto.codigo_barras
        if not codigo:
            codigo = ProductoService._autogenerar_codigo_barras()
        else:
            # Si el usuario ingresa un código manualmente, validar que sea único
            codigo_check = supabase.table("productos").select("id").eq("codigo_barras", codigo).execute()
            if codigo_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El código de barras '{codigo}' ya se encuentra asignado a otro producto."
                )

        # Validar consistencia de precios
        if producto.precio_venta < producto.precio_compra:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio de venta no puede ser menor al precio de compra."
            )

        nuevo_prod = {
            "categoria_id": str(producto.categoria_id),
            "codigo_barras": codigo,
            "nombre": producto.nombre,
            "descripcion": producto.descripcion,
            "precio_compra": producto.precio_compra,
            "precio_venta": producto.precio_venta,
            "stock_actual": producto.stock_actual,
            "stock_minimo": producto.stock_minimo,
            "estado": "Activo"
        }

        resultado = supabase.table("productos").insert(nuevo_prod).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el producto en la base de datos."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todos(incluir_inactivos: bool = False) -> List[dict]:
        """
        Retorna la lista de todos los productos.
        """
        query = supabase.table("productos").select("*")
        if not incluir_inactivos:
            query = query.eq("estado", "Activo")
        
        resultado = query.execute()
        return resultado.data or []

    @staticmethod
    def obtener_por_id(producto_id: UUID) -> dict:
        """
        Busca un producto por su UUID.
        """
        resultado = supabase.table("productos").select("*").eq("id", str(producto_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_producto(producto_id: UUID, producto: ProductoActualizar) -> dict:
        """
        Actualiza la información de un producto. Valida la consistencia de precios.
        """
        prod_actual = ProductoService.obtener_por_id(producto_id)
        datos_actualizar = producto.model_dump(exclude_unset=True)

        # Validaciones de consistencia de precios si se actualizan
        p_compra = datos_actualizar.get("precio_compra", prod_actual["precio_compra"])
        p_venta = datos_actualizar.get("precio_venta", prod_actual["precio_venta"])
        
        if p_venta < p_compra:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio de venta no puede ser menor al precio de compra tras la actualización."
            )

        # Validar categoría si se actualiza
        if "categoria_id" in datos_actualizar:
            cat_check = supabase.table("categorias").select("id").eq("id", str(datos_actualizar["categoria_id"])).execute()
            if not cat_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La categoría especificada no existe."
                )

        resultado = supabase.table("productos").update(datos_actualizar).eq("id", str(producto_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar el producto."
            )
        return resultado.data[0]

    @staticmethod
    def eliminar_producto(producto_id: UUID) -> dict:
        """
        Baja lógica del producto (estado = 'Inactivo').
        """
        ProductoService.obtener_por_id(producto_id)
        resultado = supabase.table("productos").update({"estado": "Inactivo"}).eq("id", str(producto_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo desactivar el producto."
            )
        return resultado.data[0]
