# =============================================================================
# SERVICIO: bitacora.py
# Propósito: Lógica de negocio y persistencia para la Bitácora del sistema.
#            Gestiona el control de movimientos de stock y auditoría de usuarios.
# Idioma: Español
# =============================================================================

from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase

class BitacoraService:
    @staticmethod
    def obtener_movimientos_productos(periodo: str) -> List[dict]:
        """
        Consume la función almacenada 'obtener_movimientos_stock_agrupados'
        de Supabase para obtener el reporte de stock consolidado por el período indicado.
        
        Parámetros:
            periodo (str): dia, semana o mes.
            
        Retorna:
            List[dict]: Movimientos agrupados del inventario.
        """
        if periodo not in ("dia", "semana", "mes"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período de agrupación inválido. Debe ser 'dia', 'semana' o 'mes'."
            )
            
        try:
            resultado = supabase.rpc("obtener_movimientos_stock_agrupados", {
                "p_periodo": periodo
            }).execute()
            
            return resultado.data or []
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al obtener movimientos de stock agrupados (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al consultar movimientos de stock: {str(ex)}"
            )

    @staticmethod
    def listar_bitacora_usuarios(skip: int = 0, limit: int = 50) -> List[dict]:
        """
        Retorna el historial completo de auditoría de usuarios, ordenado por fecha
        descendente y con paginación aplicada. Realiza un join con la tabla 'usuarios'
        para traer nombre y email.
        
        Parámetros:
            skip (int): Registros a omitir.
            limit (int): Límite de registros a retornar.
            
        Retorna:
            List[dict]: Historial de auditoría.
        """
        try:
            # Join con usuarios para obtener datos del operador
            resultado = supabase.table("bitacora_usuarios")\
                .select("*, usuarios(nombre_completo, email)")\
                .order("fecha", desc=True)\
                .range(skip, skip + limit - 1)\
                .execute()
                
            return resultado.data or []
        except APIError as ex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al consultar la bitácora de usuarios (SQLSTATE {ex.code}): {ex.message}"
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al consultar la bitácora de usuarios: {str(ex)}"
            )

    @staticmethod
    def asociar_usuario_a_ultimo_cambio(registro_id: str, usuario_id: str):
        """
        Asocia un usuario autenticado a la última acción de auditoría registrada
        en la tabla 'bitacora_usuarios' para un 'registro_id' específico donde el 'usuario_id' es null.
        Útil en flujos REST sin estado persistido a nivel de sesión en base de datos.
        """
        try:
            # Buscar la bitácora más reciente asociada al registro que tenga usuario_id nulo
            # y actualizarla con el usuario real de la petición del endpoint
            supabase.table("bitacora_usuarios")\
                .update({"usuario_id": str(usuario_id)})\
                .eq("registro_id", str(registro_id))\
                .is_("usuario_id", "null")\
                .execute()
        except Exception as ex:
            # Loguear advertencia para no irrumpir en el flujo principal del endpoint
            print(f"Advertencia al asociar auditoría a registro {registro_id}: {str(ex)}")
