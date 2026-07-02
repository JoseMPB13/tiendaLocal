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

from typing import List, Optional, Any, Union
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime, timezone
import logging
from app.utils.zona_horaria import (
    inicio_dia_bolivia_iso,
    fin_dia_bolivia_iso,
    iso_utc_desde_valor,
    formatear_fecha_hora_bolivia,
)
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase

logger = logging.getLogger(__name__)


def _sanitizar_para_jsonb(valor: Any) -> Any:
    """Convierte UUID, Decimal y datetime a tipos serializables en JSONB."""
    if valor is None:
        return None
    if isinstance(valor, dict):
        return {str(k): _sanitizar_para_jsonb(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_sanitizar_para_jsonb(v) for v in valor]
    if isinstance(valor, UUID):
        return str(valor)
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, datetime):
        return valor.isoformat()
    return valor


class BitacoraService:

    # -------------------------------------------------------------------------
    # INSERCIÓN DIRECTA Y ATÓMICA DE AUDITORÍA
    # -------------------------------------------------------------------------
    @staticmethod
    def registrar_accion(
        usuario_id: Union[UUID, str],
        accion: str,
        tabla_afectada: str,
        registro_id: Union[UUID, str],
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
            payload_base = {
                "usuario_id": str(usuario_id),
                "accion": accion,
                "tabla_afectada": tabla_afectada,
                "registro_id": str(registro_id),
                "detalles": detalles,
                "fecha": datetime.now(timezone.utc).isoformat(),
            }
            payload_completo = {
                **payload_base,
                "operacion": operacion,
                "datos_anteriores": _sanitizar_para_jsonb(datos_anteriores),
                "datos_nuevos": _sanitizar_para_jsonb(datos_nuevos),
            }

            try:
                resultado = supabase.table("bitacora_usuarios").insert(payload_completo).execute()
            except Exception as ex_completo:
                # Compatibilidad: BD sin columnas operacion/datos_* o error puntual en JSONB
                logger.warning(
                    "[BITÁCORA] Inserción completa falló (%s). Reintentando payload mínimo.",
                    ex_completo,
                )
                resultado = supabase.table("bitacora_usuarios").insert(payload_base).execute()

            if not resultado.data:
                logger.error(
                    "[BITÁCORA] Insert sin error explícito pero sin datos devueltos: %s/%s",
                    tabla_afectada,
                    registro_id,
                )
        except Exception as ex:
            logger.error(
                "[BITÁCORA] No se pudo registrar la acción '%s' sobre %s/%s: %s",
                accion,
                tabla_afectada,
                registro_id,
                ex,
                exc_info=True,
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

            filas = resultado.data or []
            for fila in filas:
                if fila.get("periodo_fecha"):
                    fila["periodo_fecha"] = iso_utc_desde_valor(fila["periodo_fecha"])
                    fila["periodo_fecha_bolivia"] = formatear_fecha_hora_bolivia(
                        fila["periodo_fecha"], "%d/%m/%Y"
                    )
            return filas
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
                query = query.gte("fecha", inicio_dia_bolivia_iso(fecha_inicio))

            if fecha_fin:
                query = query.lte("fecha", fin_dia_bolivia_iso(fecha_fin))

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

            for registro in datos:
                if registro.get("fecha"):
                    try:
                        iso_utc = iso_utc_desde_valor(registro["fecha"])
                        registro["fecha"] = iso_utc
                        registro["fecha_bolivia"] = formatear_fecha_hora_bolivia(iso_utc)
                    except Exception as ex_fecha:
                        logger.warning(
                            "[BITÁCORA] No se pudo formatear fecha del registro %s: %s",
                            registro.get("id"),
                            ex_fecha,
                        )

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

