# =============================================================================
# UTILIDAD: zona_horaria.py
# Propósito: Helpers centralizados para fechas y rangos en America/La_Paz (Bolivia).
# Módulo: Utilidades del backend FastAPI
# Idioma: Español
# =============================================================================

from datetime import date, datetime, time
import re
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


def parsear_fecha_api(iso_str: str) -> datetime:
    """
    Parsea timestamps de PostgreSQL/Supabase asumiendo UTC si no traen offset.
    """
    texto = str(iso_str).strip().replace("Z", "+00:00")
    # PostgreSQL a veces devuelve "YYYY-MM-DD HH:MM:SS"
    if " " in texto and "T" not in texto:
        texto = texto.replace(" ", "T", 1)
    # Offset corto (+00) sin minutos → normalizar a +00:00
    if re.search(r'[+-]\d{2}$', texto) and not re.search(r'[+-]\d{2}:\d{2}$', texto):
        texto = f"{texto}:00"
    dt = datetime.fromisoformat(texto)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt


def iso_utc_desde_valor(valor) -> str:
    """Normaliza cualquier timestamp de la API a ISO-8601 UTC con sufijo Z."""
    if isinstance(valor, datetime):
        dt = valor if valor.tzinfo else valor.replace(tzinfo=ZoneInfo("UTC"))
    else:
        dt = parsear_fecha_api(str(valor))
    return dt.astimezone(ZoneInfo("UTC")).isoformat().replace("+00:00", "Z")


def formatear_fecha_hora_bolivia(iso_str: str, formato: str = "%d/%m/%Y %H:%M") -> str:
    """
    Convierte un timestamp ISO almacenado (UTC o con offset) a texto en hora boliviana.
    """
    return parsear_fecha_api(iso_str).astimezone(ZONA_HORARIA_BOLIVIA).strftime(formato)
