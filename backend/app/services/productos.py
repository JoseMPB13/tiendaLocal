from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase
from app.schemas.modelos import ProductoCrear, ProductoActualizar, ProductoAjustarStock

class ProductoService:
    @staticmethod
    def crear_producto(producto: ProductoCrear) -> dict:
        """
        Crea un nuevo producto en el catálogo.
        Si no se provee un código de barras, se autogenera nativamente en base de datos.
        """
        # Validar existencia de categoría asociada
        try:
            cat_check = supabase.table("categorias").select("id").eq("id", str(producto.categoria_id)).execute()
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al comprobar categoría (SQLSTATE {ex.code}): {ex.message}"
            )
        if not cat_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría especificada no existe."
            )

        # Si el usuario ingresa un código manualmente, validar que sea único
        if producto.codigo_barras:
            try:
                codigo_check = supabase.table("productos").select("id").eq("codigo_barras", producto.codigo_barras).execute()
            except APIError as ex:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error en BD al comprobar código de barras (SQLSTATE {ex.code}): {ex.message}"
                )
            if codigo_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El código de barras '{producto.codigo_barras}' ya se encuentra asignado a otro producto."
                )

        # Validar consistencia de precios
        if producto.precio_venta < producto.precio_compra:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio de venta no puede ser menor al precio de compra."
            )

        nuevo_prod = {
            "categoria_id": str(producto.categoria_id),
            "nombre": producto.nombre,
            "descripcion": producto.descripcion,
            "precio_compra": producto.precio_compra,
            "precio_venta": producto.precio_venta,
            "stock_actual": producto.stock_actual,
            "stock_minimo": producto.stock_minimo,
            "imagen_url": producto.imagen_url,
            "estado": "Activo"
        }

        # Solo enviar el código de barras si fue especificado explícitamente, de lo contrario lo autogenera el trigger BEFORE INSERT
        if producto.codigo_barras:
            nuevo_prod["codigo_barras"] = producto.codigo_barras

        try:
            resultado = supabase.table("productos").insert(nuevo_prod).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo registrar el producto en la base de datos."
                )
            return resultado.data[0]
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al registrar producto (SQLSTATE {ex.code}): {ex.message}"
            )


    @staticmethod
    def obtener_todos(incluir_inactivos: bool = False) -> List[dict]:
        """
        Retorna la lista de todos los productos, incluyendo el nombre de categoría
        mediante un join con la tabla categorias (útil para el filtro del POS).
        """
        # Join con categorias para incluir el nombre de la categoría en la respuesta
        query = supabase.table("productos").select("*, categorias(nombre)")
        if not incluir_inactivos:
            query = query.eq("estado", "Activo")

        resultado = query.execute()
        productos = resultado.data or []

        # Aplanar el campo anidado 'categorias' para extraer el nombre directamente
        for prod in productos:
            cat = prod.pop("categorias", None)
            prod["categoria_nombre"] = cat["nombre"] if cat and isinstance(cat, dict) else None

        return productos

    @staticmethod
    def obtener_por_id(producto_id: UUID) -> dict:
        """
        Busca un producto por su UUID.
        """
        try:
            resultado = supabase.table("productos").select("*").eq("id", str(producto_id)).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Producto no encontrado."
                )
            return resultado.data[0]
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al buscar producto (SQLSTATE {ex.code}): {ex.message}"
            )

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
            datos_actualizar["categoria_id"] = str(datos_actualizar["categoria_id"])
            try:
                cat_check = supabase.table("categorias").select("id").eq("id", datos_actualizar["categoria_id"]).execute()
            except APIError as ex:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error en BD al comprobar categoría (SQLSTATE {ex.code}): {ex.message}"
                )
            if not cat_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La categoría especificada no existe."
                )

        try:
            resultado = supabase.table("productos").update(datos_actualizar).eq("id", str(producto_id)).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo actualizar el producto."
                )
            return resultado.data[0]
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al actualizar producto (SQLSTATE {ex.code}): {ex.message}"
            )

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

    @staticmethod
    def ajustar_stock(producto_id: UUID, payload: ProductoAjustarStock, usuario_id: str) -> dict:
        """
        Realiza un ajuste de stock manual para un producto de manera atómica llamando al SP fn_ajustar_stock.
        Valida que el stock final no resulte menor a cero.
        """
        try:
            resultado = supabase.rpc("fn_ajustar_stock", {
                "p_producto_id": str(producto_id),
                "p_cantidad_cambio": int(payload.cantidad),
                "p_motivo": str(payload.justificacion),
                "p_usuario_id": str(usuario_id)
            }).execute()

            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo registrar el ajuste de stock en la base de datos."
                )
            
            # Retornar el producto actualizado
            return ProductoService.obtener_por_id(producto_id)
            
        except APIError as ex:
            if ex.code == "P0007":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se puede realizar el ajuste. El stock resultante no puede ser menor a cero."
                )
            elif ex.code == "P0005":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="El producto especificado no existe."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error transaccional en la BD (SQLSTATE {ex.code}): {ex.message}"
            )
        except HTTPException:
            raise
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error transaccional al ajustar stock: {str(ex)}"
            )
