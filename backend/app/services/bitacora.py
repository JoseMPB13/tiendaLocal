# =============================================================================
# SERVICIO: bitacora.py
# Propósito: Lógica de negocio y persistencia para la Bitácora del sistema.
#            Gestiona el control de movimientos de stock y auditoría de usuarios.
#
# ARQUITECTURA DE AUDITORÍA (normalizada):
#   Cada servicio crítico (Ventas, Productos, Clientes, Delivery) llama de forma
#   síncrona y directa a BitacoraService.registrar_accion() inmediatamente después
#   de ejecutar su mutación en la DB. El usuario_id proviene exclusivamente del JWT.
#   Se ELIMINÓ el método 'asociar_usuario_a_ultimo_cambio' (parche frágil).
# Idioma: Español
# =============================================================================

from typing import List, Optional, Any
from uuid import UUID
from datetime import date
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase


class BitacoraService:

    # -------------------------------------------------------------------------
    # INSERCIÓN DIRECTA Y ATÓMICA DE AUDITORÍA
    # -------------------------------------------------------------------------
    @staticmethod
    def registrar_accion(
        usuario_id: UUID,
        accion: str,
        tabla_afectada: str,
        registro_id: UUID,
        operacion: Optional[str] = None,
        detalles: Optional[str] = None,
        datos_anteriores: Optional[Any] = None,
        datos_nuevos: Optional[Any] = None
    ) -> None:
        """
        Inserta un registro de auditoría directamente en la tabla bitacora_usuarios
        de forma síncrona. Debe invocarse inmediatamente después de cada mutación
        crítica en los servicios de negocio.

        Parámetros:
            usuario_id       (UUID): ID real del operador extraído del JWT.
            accion           (str): Etiqueta semántica: CREAR, MODIFICAR,
                                    DESACTIVAR, ANULAR, CANCELAR.
            tabla_afectada   (str): Nombre exacto de la tabla SQL afectada.
            registro_id      (UUID): UUID del registro modificado/creado.
            operacion        (str): Tipo DML: INSERT, UPDATE, DELETE.
            detalles         (str): Texto descriptivo legible de la operación.
            datos_anteriores (Any): Snapshot JSON del estado previo (UPDATE/DELETE).
            datos_nuevos     (Any): Snapshot JSON del estado nuevo (INSERT/UPDATE).
        """
        try:
            payload = {
                "usuario_id": str(usuario_id),
                "accion": accion,
                "tabla_afectada": tabla_afectada,
                "registro_id": str(registro_id),
                "operacion": operacion,
                "detalles": detalles,
                # Supabase acepta dicts directamente para columnas JSONB
                "datos_anteriores": datos_anteriores,
                "datos_nuevos": datos_nuevos,
            }
            supabase.table("bitacora_usuarios").insert(payload).execute()
        except Exception as ex:
            # La bitácora es observabilidad: no interrumpe el flujo principal.
            print(
                f"[BITÁCORA] Advertencia: no se pudo registrar la acción '{accion}' "
                f"sobre {tabla_afectada}/{registro_id}: {str(ex)}"
            )

    # -------------------------------------------------------------------------
    # CONSULTA DE MOVIMIENTOS DE INVENTARIO (agrupados por período)
    # -------------------------------------------------------------------------
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

    # -------------------------------------------------------------------------
    # CONSULTA DE BITÁCORA DE USUARIOS CON FILTROS AVANZADOS
    # -------------------------------------------------------------------------
    @staticmethod
    def listar_bitacora_usuarios(
        skip: int = 0,
        limit: int = 50,
        fecha_inicio: Optional[date] = None,
        fecha_fin: Optional[date] = None,
        tabla_afectada: Optional[str] = None,
        operacion: Optional[str] = None,
        accion: Optional[str] = None,
        nombre_usuario: Optional[str] = None
    ) -> List[dict]:
        """
        Retorna el historial de auditoría de usuarios con filtros delegados al motor
        de base de datos (no en memoria). Incluye paginación y join con 'usuarios'.

        Parámetros:
            skip           (int): Registros a omitir para paginación.
            limit          (int): Límite máximo de registros.
            fecha_inicio   (date): Inicio del rango temporal (inclusive).
            fecha_fin      (date): Fin del rango temporal (inclusive, fin del día).
            tabla_afectada (str): Filtra por tabla SQL (ej: 'ventas', 'clientes').
            operacion      (str): Filtra por tipo DML: INSERT, UPDATE, DELETE.
            accion         (str): Filtra por acción semántica: CREAR, MODIFICAR, etc.
            nombre_usuario (str): Búsqueda parcial por nombre del operador (post-query).

        Retorna:
            List[dict]: Historial de auditoría enriquecido con datos del operador.
        """
        try:
            # Construir la query base con join a la tabla de usuarios
            query = supabase.table("bitacora_usuarios")\
                .select("*, usuarios(nombre_completo, email)")\
                .order("fecha", desc=True)

            # Aplicar filtros opcionales delegados a la DB (no en memoria)
            if fecha_inicio:
                # Inicio del día en UTC: 'YYYY-MM-DDT00:00:00+00:00'
                query = query.gte("fecha", f"{fecha_inicio.isoformat()}T00:00:00+00:00")

            if fecha_fin:
                # Fin del día en UTC: 'YYYY-MM-DDT23:59:59+00:00'
                query = query.lte("fecha", f"{fecha_fin.isoformat()}T23:59:59+00:00")

            if tabla_afectada and tabla_afectada.strip():
                query = query.eq("tabla_afectada", tabla_afectada.strip().lower())

            if operacion and operacion.strip():
                query = query.eq("operacion", operacion.strip().upper())

            if accion and accion.strip():
                query = query.eq("accion", accion.strip().upper())

            # Aplicar paginación — recuperamos un bloque generoso para poder filtrar
            # por nombre_usuario en memoria sin perder registros en el slice final
            effective_limit = limit if not nombre_usuario else min(limit * 10, 500)
            resultado = query.range(skip, skip + effective_limit - 1).execute()
            datos = resultado.data or []

            # Filtro post-query en memoria por nombre de operador (no soportado en PostgREST join)
            if nombre_usuario and nombre_usuario.strip():
                termino = nombre_usuario.strip().lower()
                datos = [
                    r for r in datos
                    if r.get("usuarios") and
                    termino in (r["usuarios"].get("nombre_completo") or "").lower()
                ]
                # Reaplicar el limit real tras el filtro en memoria
                datos = datos[:limit]

            return datos
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

