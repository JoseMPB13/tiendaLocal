import json
from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import VentaCrear

class VentaService:
    @staticmethod
    def registrar_venta(venta: VentaCrear, usuario_id: UUID) -> dict:
        """
        Registra una venta. Bifurca la lógica si es de tipo Crédito ejecutando el SP en Supabase.
        En caso contrario, realiza el flujo directo delegando el control de stock al trigger BEFORE INSERT.
        El usuario_id proviene directamente de la sesión segura (JWT).
        """
        # 1. Validar existencia del usuario/operador proveniente del JWT
        usr_check = supabase.table("usuarios").select("id").eq("id", str(usuario_id)).execute()
        if not usr_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El operador/usuario autenticado no existe."
            )

        # 2. Validar existencia del cliente
        cli_check = supabase.table("clientes").select("id").eq("id", str(venta.cliente_id)).execute()
        if not cli_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cliente especificado no existe."
            )

        # 3. Validar productos: existencia, estado activo y precios oficiales
        prod_ids = [str(item.producto_id) for item in venta.detalles]
        res_prods = supabase.table("productos").select("id, nombre, precio_venta, estado").in_("id", prod_ids).execute()
        prods_dict = {p["id"]: p for p in res_prods.data} if res_prods.data else {}

        total_recalculado = 0.00
        items_json = []

        for item in venta.detalles:
            prod_id_str = str(item.producto_id)
            
            # Verificar existencia del producto en catálogo
            if prod_id_str not in prods_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El producto con ID {prod_id_str} no existe en el catálogo."
                )
            
            db_prod = prods_dict[prod_id_str]
            
            # Verificar que el producto esté activo
            if db_prod["estado"] != "Activo":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El producto '{db_prod['nombre']}' no está activo para la venta."
                )

            # Validar que el precio coincida exactamente con el oficial del inventario
            precio_oficial = float(db_prod["precio_venta"])
            precio_enviado = float(item.precio_unitario)
            if abs(precio_enviado - precio_oficial) > 0.001:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El precio unitario enviado para '{db_prod['nombre']}' (Bs. {precio_enviado:.2f}) no coincide con el oficial de inventario (Bs. {precio_oficial:.2f})."
                )

            total_recalculado += item.cantidad * precio_oficial

            # Estructurar ítem para el JSON del SP/RPC
            items_json.append({
                "producto_id": prod_id_str,
                "cantidad": item.cantidad,
                "precio_unitario": precio_oficial
            })

        # BIFURCACIÓN DE LÓGICA DE REGISTRO
        if venta.tipo_pago == "Credito":
            try:
                # La función rpc de supabase ejecuta el SP
                sp_result = supabase.rpc("registrar_venta_credito", {
                    "p_cliente_id": str(venta.cliente_id),
                    "p_usuario_id": str(usuario_id),
                    "p_codigo_factura": venta.codigo_factura,
                    "p_total": total_recalculado,
                    "p_items": items_json,
                    "p_para_delivery": venta.para_delivery,
                    "p_direccion_despacho": venta.direccion_despacho,
                    "p_costo_envio": float(venta.costo_envio) if venta.costo_envio is not None else 0.0
                }).execute()
                
                if not sp_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="La base de datos no retornó el identificador de venta."
                    )
                
                # Obtener la cabecera creada para responder
                venta_creada = supabase.table("ventas").select("*").eq("id", sp_result.data).execute()
                return venta_creada.data[0]
                
            except Exception as ex:
                # Capturar excepciones generadas por RAISE EXCEPTION en PostgreSQL (Stock, Límite de Crédito o Delivery)
                error_msg = str(ex)
                if "P0003" in error_msg or "dirección de despacho es obligatoria" in error_msg:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La dirección de despacho es obligatoria para pedidos con delivery."
                    )
                elif "Límite de crédito excedido" in error_msg:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_msg
                    )
                elif "Stock insuficiente" in error_msg:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_msg
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error transaccional en la BD: {error_msg}"
                )

        else:
            # Ventas al contado (Efectivo, Tarjeta, Transferencia, QR)
            # Invocamos el nuevo RPC registrar_venta_contado de forma atómica
            try:
                sp_result = supabase.rpc("registrar_venta_contado", {
                    "p_cliente_id": str(venta.cliente_id),
                    "p_usuario_id": str(usuario_id),
                    "p_codigo_factura": venta.codigo_factura,
                    "p_total": total_recalculado,
                    "p_tipo_pago": venta.tipo_pago,
                    "p_items": items_json,
                    "p_para_delivery": venta.para_delivery,
                    "p_direccion_despacho": venta.direccion_despacho,
                    "p_costo_envio": float(venta.costo_envio) if venta.costo_envio is not None else 0.0
                }).execute()
                
                if not sp_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="La base de datos no retornó el identificador de la venta al contado."
                    )
                
                # Obtener la cabecera de la venta al contado para retornar
                venta_creada = supabase.table("ventas").select("*").eq("id", sp_result.data).execute()
                return venta_creada.data[0]
                
            except Exception as ex:
                error_msg = str(ex)
                if "P0003" in error_msg or "dirección de despacho es obligatoria" in error_msg:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La dirección de despacho es obligatoria para pedidos con delivery."
                    )
                elif "Stock insuficiente" in error_msg:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_msg
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error transaccional al procesar venta al contado: {error_msg}"
                )

    @staticmethod
    def obtener_por_id(venta_id: UUID) -> dict:
        """
        Busca una venta por su UUID.
        """
        resultado = supabase.table("ventas").select("*").eq("id", str(venta_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_detalles(venta_id: UUID) -> List[dict]:
        """
        Retorna la lista de productos asociados a una venta.
        """
        resultado = supabase.table("detalles_ventas").select("*").eq("venta_id", str(venta_id)).execute()
        return resultado.data or []
