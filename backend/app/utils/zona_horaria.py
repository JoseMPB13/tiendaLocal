# =============================================================================
# UTILIDAD: zona_horaria.py
# Propósito: Helpers centralizados para fechas y rangos en America/La_Paz (Bolivia).
# Módulo: Utilidades del backend FastAPI
# Idioma: Español
# =============================================================================

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

# Zona horaria oficial IANA de Bolivia
ZONA_HORARIA_BOLIVIA = ZoneInfo("America/La_Paz")


def ahora_bolivia() -> datetime:
    """Retorna la fecha y hora actual con zona horaria de Bolivia."""
    return datetime.now(ZONA_HORARIA_BOLIVIA)


def fecha_bolivia_hoy() -> date:
    """Retorna la fecha calendario actual en Bolivia."""
    return ahora_bolivia().date()


def inicio_dia_bolivia_iso(fecha: date) -> str:
    """
    Inicio del día calendario en Bolivia como ISO-8601 con offset -04:00.
    Útil para filtros .gte() en columnas timestamptz de Supabase.
    """
    return datetime.combine(fecha, time.min, tzinfo=ZONA_HORARIA_BOLIVIA).isoformat()


def fin_dia_bolivia_iso(fecha: date) -> str:
    """
    Fin del día calendario en Bolivia como ISO-8601 con offset -04:00.
    Útil para filtros .lte() en columnas timestamptz de Supabase.
    """
    return datetime.combine(fecha, time(23, 59, 59, 999999), tzinfo=ZONA_HORARIA_BOLIVIA).isoformat()


def inicio_dia_bolivia_iso_desde_str(fecha_str: str) -> str:
    """Convierte 'YYYY-MM-DD' al inicio del día en Bolivia."""
    return inicio_dia_bolivia_iso(date.fromisoformat(fecha_str))


def fin_dia_bolivia_iso_desde_str(fecha_str: str) -> str:
    """Convierte 'YYYY-MM-DD' al fin del día en Bolivia."""
    return fin_dia_bolivia_iso(date.fromisoformat(fecha_str))


def formatear_fecha_hora_bolivia(iso_str: str, formato: str = "%d/%m/%Y %H:%M") -> str:
    """
    Convierte un timestamp ISO almacenado (UTC o con offset) a texto en hora boliviana.
    """
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(ZONA_HORARIA_BOLIVIA).strftime(formato)
