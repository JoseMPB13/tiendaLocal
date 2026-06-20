import json
from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import VentaCrear

class VentaService:
    @staticmethod
    def registrar_venta(venta: VentaCrear) -> dict:
        """
        Registra una venta. Bifurca la lógica si es de tipo Crédito ejecutando el SP en Supabase.
        En caso contrario, realiza el flujo directo delegando el control de stock al trigger BEFORE INSERT.
        """
        # 1. Validar existencia del usuario/operador
        usr_check = supabase.table("usuarios").select("id").eq("id", str(venta.usuario_id)).execute()
        if not usr_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El operador/usuario especificado no existe."
            )

        # 2. Validar existencia del cliente
        cli_check = supabase.table("clientes").select("id").eq("id", str(venta.cliente_id)).execute()
        if not cli_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cliente especificado no existe."
            )

        # Calcular el monto total acumulado del listado de ítems
        total_calculado = 0.00
        for item in venta.detalles:
            total_calculado += item.cantidad * item.precio_unitario

        # BIFURCACIÓN DE LÓGICA DE REGISTRO
        # Preparar listado estructurado de ítems para el JSON del SP/RPC
        items_json = [
            {
                "producto_id": str(i.producto_id),
                "cantidad": i.cantidad,
                "precio_unitario": i.precio_unitario
            } for i in venta.detalles
        ]

        if venta.tipo_pago == "Credito":
            try:
                # La función rpc de supabase ejecuta el SP
                sp_result = supabase.rpc("registrar_venta_credito", {
                    "p_cliente_id": str(venta.cliente_id),
                    "p_usuario_id": str(venta.usuario_id),
                    "p_codigo_factura": venta.codigo_factura,
                    "p_total": total_calculado,
                    "p_items": items_json
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
                # Capturar excepciones generadas por RAISE EXCEPTION en PostgreSQL (Stock o Límite de Crédito)
                error_msg = str(ex)
                if "Límite de crédito excedido" in error_msg:
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
            # Ventas al contado (Efectivo, Tarjeta, Transferencia)
            # Invocamos el nuevo RPC registrar_venta_contado de forma atómica
            try:
                sp_result = supabase.rpc("registrar_venta_contado", {
                    "p_cliente_id": str(venta.cliente_id),
                    "p_usuario_id": str(venta.usuario_id),
                    "p_codigo_factura": venta.codigo_factura,
                    "p_total": total_calculado,
                    "p_tipo_pago": venta.tipo_pago,
                    "p_items": items_json
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
                if "Stock insuficiente" in error_msg:
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
