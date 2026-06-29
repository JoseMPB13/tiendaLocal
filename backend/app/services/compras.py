# =============================================================================
# SERVICIO DE NEGOCIO: compras.py
# Propósito: Capa de servicio para la gestión de compras y reabastecimiento.
# Dependencias: Supabase client, modelos schemas, postgrest exceptions.
# Idioma: Español
# =============================================================================

from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase
from app.schemas.modelos import CompraCrear

class CompraService:
    @staticmethod
    def registrar_reabastecimiento(compra: CompraCrear, usuario_id: UUID) -> dict:
        """
        Registra una compra/reabastecimiento.
        Las validaciones de existencia de productos, estado activo y control de costos
        son delegadas directamente a la base de datos (DB-First) mediante excepciones SQLSTATE.
        """
        # 1. Validar existencia del usuario/operador
        usr_check = supabase.table("usuarios").select("id").eq("id", str(usuario_id)).execute()
        if not usr_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El operador/usuario autenticado no existe."
            )

        # 2. Sanitización JSON Crítica de UUIDs y construcción del listado de detalles
        items_json = [
            {
                "producto_id": str(item.producto_id),
                "cantidad": int(item.cantidad),
                "costo_unitario": float(item.costo_unitario)
            }
            for item in compra.detalles
        ]

        # Calcular total acumulado de la compra
        total_compra = sum(float(item.cantidad) * float(item.costo_unitario) for item in compra.detalles)

        # 3. Invocar RPC para registrar el reabastecimiento de forma transaccional
        try:
            sp_result = supabase.rpc("registrar_reabastecimiento", {
                "p_usuario_id": str(usuario_id),
                "p_proveedor_nombre": compra.proveedor_nombre,
                "p_codigo_referencia": compra.codigo_referencia,
                "p_total": total_compra,
                "p_items": items_json
            }).execute()

            if not sp_result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="La base de datos no retornó el identificador de la compra."
                )

            # Retornar cabecera de la compra registrada
            return CompraService.obtener_por_id(UUID(sp_result.data))

        except APIError as ex:
            if ex.code == "P0004":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ex.message
                )
            elif ex.code == "P0009":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ex.message
                )
            elif ex.code == "P0005":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=ex.message
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error transaccional en la BD (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            if isinstance(ex, HTTPException):
                raise ex
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al registrar el reabastecimiento: {str(ex)}"
            )

    @staticmethod
    def listar_compras(estado_compra: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[dict]:
        """
        Lista todas las compras, con soporte de filtrado por estado y paginación.
        """
        query = supabase.table("compras").select("*")
        if estado_compra:
            query = query.eq("estado_compra", estado_compra)

        start = skip
        end = skip + limit - 1
        resultado = query.order("fecha_compra", desc=True).range(start, end).execute()
        return resultado.data or []

    @staticmethod
    def obtener_por_id(compra_id: UUID) -> dict:
        """
        Busca una compra básica por su UUID (solo cabecera).
        """
        resultado = supabase.table("compras").select("*").eq("id", str(compra_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compra no encontrada."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_completa_por_id(compra_id: UUID) -> dict:
        """
        Busca una compra y retorna toda su información incluyendo detalles enriquecidos.
        """
        compra = CompraService.obtener_por_id(compra_id)
        detalles = CompraService.obtener_detalles(compra_id)
        compra["detalles"] = detalles
        return compra

    @staticmethod
    def obtener_detalles(compra_id: UUID) -> List[dict]:
        """
        Retorna la lista de artículos asociados a una compra, enriquecidos con el nombre del producto.
        """
        resultado = supabase.table("detalles_compras").select("*, productos(nombre)").eq("compra_id", str(compra_id)).execute()
        detalles = []
        for d in (resultado.data or []):
            prod_data = d.pop("productos", {})
            d["producto_nombre"] = prod_data.get("nombre") if prod_data else None
            detalles.append(d)
        return detalles

    @staticmethod
    def cancelar_compra(compra_id: UUID) -> UUID:
        """
        Realiza la baja lógica de la compra, revirtiendo el stock de forma segura.
        """
        try:
            res = supabase.rpc("cancelar_compra", {"p_compra_id": str(compra_id)}).execute()
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="La base de datos no retornó el identificador de la compra cancelada."
                )
            return UUID(res.data)
        except APIError as ex:
            if ex.code == "P0005":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="La compra especificada no existe."
                )
            elif ex.code == "P0006":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La compra ya se encuentra cancelada."
                )
            elif ex.code == "P0007":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ex.message
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en BD al cancelar compra (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            if isinstance(ex, HTTPException):
                raise ex
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al cancelar la compra: {str(ex)}"
            )
