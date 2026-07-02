# =============================================================================
# SERVICIO DE NEGOCIO: ventas.py
# Propósito: Capa de servicio para la gestión de ventas, facturas y control de stock.
# Dependencias: Supabase client, modelos schemas, postgrest exceptions.
# Idioma: Español
# =============================================================================

import json
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.utils.zona_horaria import inicio_dia_bolivia_iso_desde_str, fin_dia_bolivia_iso_desde_str
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
                    "p_total": total_recalculado,
                    "p_items": items_json,
                    "p_para_delivery": venta.para_delivery,
                    "p_direccion_despacho": venta.direccion_despacho,
                    "p_costo_envio": float(venta.costo_envio) if venta.costo_envio is not None else 0.0,
                    "p_latitud": float(venta.latitud) if venta.latitud is not None else None,
                    "p_longitud": float(venta.longitud) if venta.longitud is not None else None
                }).execute()
                
                if not sp_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="La base de datos no retornó el identificador de venta."
                    )
                
                # Obtener la cabecera creada para responder
                venta_creada = supabase.table("ventas").select("*").eq("id", sp_result.data).execute()
                return venta_creada.data[0]
                
            except APIError as ex:
                # Mapeo de errores utilizando SQLSTATE nativos
                if ex.code == "P0003":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La dirección de despacho es obligatoria para pedidos con delivery."
                    )
                elif ex.code == "P0002":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ex.message
                    )
                elif ex.code == "P0001":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ex.message
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error transaccional en la BD (SQLSTATE {ex.code}): {ex.message}"
                )
            except Exception as ex:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error inesperado al registrar venta a crédito: {str(ex)}"
                )

        else:
            # Ventas al contado (Efectivo, Tarjeta, Transferencia, QR)
            # Invocamos el nuevo RPC registrar_venta_contado de forma atómica
            try:
                sp_result = supabase.rpc("registrar_venta_contado", {
                    "p_cliente_id": str(venta.cliente_id),
                    "p_usuario_id": str(usuario_id),
                    "p_total": total_recalculado,
                    "p_tipo_pago": venta.tipo_pago,
                    "p_items": items_json,
                    "p_para_delivery": venta.para_delivery,
                    "p_direccion_despacho": venta.direccion_despacho,
                    "p_costo_envio": float(venta.costo_envio) if venta.costo_envio is not None else 0.0,
                    "p_latitud": float(venta.latitud) if venta.latitud is not None else None,
                    "p_longitud": float(venta.longitud) if venta.longitud is not None else None
                }).execute()
                
                if not sp_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="La base de datos no retornó el identificador de la venta al contado."
                    )
                
                # Obtener la cabecera de la venta al contado para retornar
                venta_creada = supabase.table("ventas").select("*").eq("id", sp_result.data).execute()
                return venta_creada.data[0]
                
            except APIError as ex:
                # Mapeo de errores utilizando SQLSTATE nativos
                if ex.code == "P0003":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La dirección de despacho es obligatoria para pedidos con delivery."
                    )
                elif ex.code == "P0001":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ex.message
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error transaccional en la BD (SQLSTATE {ex.code}): {ex.message}"
                )
            except Exception as ex:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error inesperado al registrar venta al contado: {str(ex)}"
                )

    @staticmethod
    def listar_ventas(
        estado_venta: Optional[str] = None,
        fecha_especifica: Optional[str] = None,
        fecha_inicio: Optional[str] = None,
        fecha_fin: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[dict]:
        """
        Lista todas las ventas del sistema, con soporte de filtrado por estado, fecha específica, rango de fechas y paginación.
        Idioma: Español
        """
        try:
            query = supabase.table("ventas").select("*")
            if estado_venta:
                query = query.eq("estado_venta", estado_venta)
            if fecha_inicio:
                query = query.gte("fecha_venta", fecha_inicio)
            if fecha_fin:
                query = query.lte("fecha_venta", fecha_fin)
            elif fecha_especifica:
                # Filtrado por día calendario en zona horaria de Bolivia
                query = query.gte("fecha_venta", inicio_dia_bolivia_iso_desde_str(fecha_especifica)).lte(
                    "fecha_venta", fin_dia_bolivia_iso_desde_str(fecha_especifica)
                )
            
            start = skip
            end = skip + limit - 1
            resultado = query.order("fecha_venta", desc=True).range(start, end).execute()
            return resultado.data or []
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al listar ventas (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al listar ventas: {str(ex)}"
            )

    @staticmethod
    def obtener_por_id(venta_id: UUID) -> dict:
        """
        Busca una venta básica por su UUID (solo cabecera).
        """
        resultado = supabase.table("ventas").select("*").eq("id", str(venta_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_completa_por_id(venta_id: UUID) -> dict:
        """
        Busca una venta y retorna toda su información incluyendo detalles de artículos.
        """
        venta = VentaService.obtener_por_id(venta_id)
        detalles = VentaService.obtener_detalles(venta_id)
        venta["detalles"] = detalles
        return venta

    @staticmethod
    def obtener_detalles(venta_id: UUID) -> List[dict]:
        """
        Retorna la lista de productos asociados a una venta.
        """
        resultado = supabase.table("detalles_ventas").select("*").eq("venta_id", str(venta_id)).execute()
        return resultado.data or []

    @staticmethod
    def obtener_proximo_numero_factura() -> str:
        """
        Calcula de manera anticipada el siguiente correlativo de factura a emitir.
        """
        try:
            res = supabase.rpc("obtener_proximo_codigo_factura", {}).execute()
            if res.data:
                return res.data
            return "FAC-00000000-00001"
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al calcular correlativo (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al obtener próximo código de factura: {str(ex)}"
            )

    @staticmethod
    def cancelar_venta(venta_id: UUID) -> UUID:
        """
        Realiza la baja lógica de la venta actualizando su estado a 'Cancelada'.
        Esto revierte de forma automática el stock y deudas asociadas.
        """
        try:
            res = supabase.rpc("cancelar_venta", {"p_venta_id": str(venta_id)}).execute()
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="La base de datos no retornó el identificador de la venta cancelada."
                )
            return UUID(res.data)
        except APIError as ex:
            if ex.code == "P0005":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="La venta especificada no existe."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al cancelar venta (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al cancelar la venta: {str(ex)}"
            )

    @staticmethod
    def actualizar_venta(venta_id: UUID, venta: VentaCrear) -> dict:
        """
        Actualiza una venta existente (cabecera y detalles) de forma atómica en la BD mediante RPC.
        """
        # 1. Validar existencia del cliente
        cli_check = supabase.table("clientes").select("id").eq("id", str(venta.cliente_id)).execute()
        if not cli_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cliente especificado no existe."
            )

        # 2. Validar productos: existencia, estado activo y precios oficiales
        prod_ids = [str(item.producto_id) for item in venta.detalles]
        res_prods = supabase.table("productos").select("id, nombre, precio_venta, estado").in_("id", prod_ids).execute()
        prods_dict = {p["id"]: p for p in res_prods.data} if res_prods.data else {}

        items_json = []

        for item in venta.detalles:
            prod_id_str = str(item.producto_id)
            if prod_id_str not in prods_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El producto con ID {prod_id_str} no existe en el catálogo."
                )
            
            db_prod = prods_dict[prod_id_str]
            if db_prod["estado"] != "Activo":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El producto '{db_prod['nombre']}' no está activo."
                )

            precio_oficial = float(db_prod["precio_venta"])
            precio_enviado = float(item.precio_unitario)
            if abs(precio_enviado - precio_oficial) > 0.001:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El precio enviado para '{db_prod['nombre']}' no coincide con el oficial de inventario."
                )

            items_json.append({
                "producto_id": prod_id_str,
                "cantidad": item.cantidad,
                "precio_unitario": precio_oficial
            })

        # 3. Invocar RPC para actualizar
        try:
            sp_result = supabase.rpc("actualizar_venta", {
                "p_venta_id": str(venta_id),
                "p_cliente_id": str(venta.cliente_id),
                "p_tipo_pago": venta.tipo_pago,
                "p_items": items_json,
                "p_para_delivery": venta.para_delivery,
                "p_direccion_despacho": venta.direccion_despacho,
                "p_costo_envio": float(venta.costo_envio) if venta.costo_envio is not None else 0.0,
                "p_latitud": float(venta.latitud) if venta.latitud is not None else None,
                "p_longitud": float(venta.longitud) if venta.longitud is not None else None
            }).execute()

            if not sp_result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="La base de datos no retornó el identificador de la venta modificada."
                )

            # Obtener cabecera actualizada para retornar
            venta_modificada = supabase.table("ventas").select("*").eq("id", sp_result.data).execute()
            return venta_modificada.data[0]

        except APIError as ex:
            if ex.code == "P0003":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La dirección de despacho es obligatoria para pedidos con delivery."
                )
            elif ex.code == "P0002":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ex.message
                )
            elif ex.code == "P0001":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ex.message
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error transaccional en la BD (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al actualizar venta: {str(ex)}"
            )

