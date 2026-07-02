// =============================================================================
// UTILIDAD: fechaBolivia.js
// Propósito: Helpers centralizados de fecha/hora en America/La_Paz (Bolivia).
//            - Almacenamiento en BD: instante UTC (timestamptz con now()).
//            - Visualización/filtros: siempre convertir a hora boliviana aquí.
// Módulo: Utilidades compartidas del frontend
// Idioma: Español
// =============================================================================

/** Identificador IANA de la zona horaria de Bolivia */
export const ZONA_HORARIA_BOLIVIA = 'America/La_Paz';

/** Offset fijo de Bolivia (sin horario de verano) */
const OFFSET_BOLIVIA = '-04:00';

/**
 * Parsea timestamps devueltos por la API (PostgreSQL/Supabase).
 * Si el string no trae zona horaria, se asume UTC (convención timestamptz).
 * @param {string|Date} valor - Timestamp desde la API.
 * @returns {Date|null}
 */
export const parsearFechaApi = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;

  let texto = String(valor).trim();
  if (!texto) return null;

  // PostgreSQL/Supabase a veces usa espacio en lugar de "T"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(texto)) {
    texto = texto.replace(' ', 'T');
  }

  // Offset corto (+00) sin minutos → normalizar a +00:00
  if (/[+-]\d{2}$/.test(texto) && !/[+-]\d{2}:\d{2}$/.test(texto)) {
    texto = `${texto}:00`;
  }

  // Ya incluye zona horaria explícita (Z o ±HH:MM)
  if (/[zZ]$/.test(texto) || /[+-]\d{2}:\d{2}$/.test(texto)) {
    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  // Solo fecha calendario
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const fecha = new Date(`${texto}T00:00:00Z`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  // Timestamp sin zona desde PostgreSQL/FastAPI → interpretar como UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto)) {
    const fecha = new Date(`${texto}Z`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Obtiene la fecha local de Bolivia en formato YYYY-MM-DD (ideal para inputs type="date").
 */
export const obtenerFechaBoliviaHoy = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_BOLIVIA }).format(new Date());
};

/** Inicio del día calendario en Bolivia como ISO-8601 con offset -04:00. */
export const obtenerInicioDiaBoliviaISO = (fechaYYYYMMDD) =>
  `${fechaYYYYMMDD}T00:00:00${OFFSET_BOLIVIA}`;

/** Fin del día calendario en Bolivia como ISO-8601 con offset -04:00. */
export const obtenerFinDiaBoliviaISO = (fechaYYYYMMDD) =>
  `${fechaYYYYMMDD}T23:59:59.999${OFFSET_BOLIVIA}`;

/** Formatea una fecha a DD/MM/YYYY en hora boliviana. */
export const formatearFechaBolivia = (fecha = new Date()) => {
  const ref = fecha instanceof Date ? fecha : parsearFechaApi(fecha);
  if (!ref) return '';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(ref);
};

/** Formatea una hora a HH:MM:SS en hora boliviana. */
export const formatearHoraBolivia = (fecha = new Date()) => {
  const ref = fecha instanceof Date ? fecha : parsearFechaApi(fecha);
  if (!ref) return '';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(ref);
};

/**
 * Formatea un timestamp de la API para visualización en hora boliviana.
 * Usar en facturas, historial, envíos, bitácora, etc.
 */
export const formatearFechaHoraBolivia = (fechaStr, opciones = {}) => {
  const fecha = parsearFechaApi(fechaStr);
  if (!fecha) return fechaStr ? String(fechaStr) : '';

  const { dateStyle = 'short', timeStyle = 'short' } = opciones;
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    dateStyle,
    timeStyle,
  }).format(fecha);
};

/** Verifica si un timestamp corresponde al día calendario actual en Bolivia. */
export const esMismoDiaBolivia = (fechaStr) => {
  const fecha = parsearFechaApi(fechaStr);
  if (!fecha) return false;
  const fechaBolivia = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_BOLIVIA,
  }).format(fecha);
  return fechaBolivia === obtenerFechaBoliviaHoy();
};

/** Obtiene componentes de fecha (día, mes, año) en zona horaria Bolivia. */
export const obtenerPartesFechaBolivia = (fecha = new Date()) => {
  const ref = fecha instanceof Date ? fecha : parsearFechaApi(fecha);
  if (!ref) return { anio: 0, mes: 0, dia: 0 };

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ref);

  return {
    anio: Number(partes.find((p) => p.type === 'year')?.value),
    mes: Number(partes.find((p) => p.type === 'month')?.value) - 1,
    dia: Number(partes.find((p) => p.type === 'day')?.value),
  };
};

/** Fecha y hora actual en Bolivia listas para ticket/factura. */
export const obtenerFechaHoraBoliviaAhora = () => formatearFechaHoraBolivia(new Date().toISOString(), {
  dateStyle: 'short',
  timeStyle: 'medium',
});
