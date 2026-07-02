// =============================================================================
// UTILIDAD: fechaBolivia.js
// Propósito: Helpers de fecha/hora en zona horaria oficial de Bolivia (America/La_Paz).
//            Evita el desfase de un día causado por toISOString() (UTC) en el cliente.
// Módulo: Utilidades compartidas del frontend
// Idioma: Español
// =============================================================================

/** Identificador IANA de la zona horaria de Bolivia */
export const ZONA_HORARIA_BOLIVIA = 'America/La_Paz';

/** Offset fijo de Bolivia (sin horario de verano) */
const OFFSET_BOLIVIA = '-04:00';

/**
 * Obtiene la fecha local de Bolivia en formato YYYY-MM-DD (ideal para inputs type="date").
 * @returns {string} Fecha actual en Bolivia, ej: "2026-07-01"
 */
export const obtenerFechaBoliviaHoy = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_BOLIVIA }).format(new Date());
};

/**
 * Inicio del día calendario en Bolivia como ISO-8601 con offset -04:00.
 * @param {string} fechaYYYYMMDD - Fecha en formato YYYY-MM-DD.
 */
export const obtenerInicioDiaBoliviaISO = (fechaYYYYMMDD) =>
  `${fechaYYYYMMDD}T00:00:00${OFFSET_BOLIVIA}`;

/**
 * Fin del día calendario en Bolivia como ISO-8601 con offset -04:00.
 * @param {string} fechaYYYYMMDD - Fecha en formato YYYY-MM-DD.
 */
export const obtenerFinDiaBoliviaISO = (fechaYYYYMMDD) =>
  `${fechaYYYYMMDD}T23:59:59.999${OFFSET_BOLIVIA}`;

/**
 * Formatea una fecha/hora a DD/MM/YYYY según el huso horario de Bolivia.
 * @param {Date} [fecha=new Date()] - Instancia de fecha a formatear.
 * @returns {string} Fecha legible, ej: "01/07/2026"
 */
export const formatearFechaBolivia = (fecha = new Date()) => {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
};

/**
 * Formatea una fecha/hora a HH:MM:SS según el huso horario de Bolivia.
 * @param {Date} [fecha=new Date()] - Instancia de fecha a formatear.
 * @returns {string} Hora legible, ej: "14:30:05"
 */
export const formatearHoraBolivia = (fecha = new Date()) => {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(fecha);
};

/**
 * Formatea un timestamp ISO almacenado para visualización en hora boliviana.
 * @param {string} fechaStr - Timestamp ISO desde la API.
 * @param {object} [opciones] - Opciones de Intl (dateStyle, timeStyle).
 */
export const formatearFechaHoraBolivia = (fechaStr, opciones = {}) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return fechaStr;

  const { dateStyle = 'short', timeStyle = 'short' } = opciones;
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    dateStyle,
    timeStyle,
  }).format(fecha);
};

/**
 * Verifica si un timestamp ISO corresponde al día calendario actual en Bolivia.
 * @param {string} fechaStr - Timestamp ISO desde la API.
 */
export const esMismoDiaBolivia = (fechaStr) => {
  if (!fechaStr) return false;
  const fechaBolivia = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_BOLIVIA,
  }).format(new Date(fechaStr));
  return fechaBolivia === obtenerFechaBoliviaHoy();
};

/**
 * Obtiene componentes de fecha (día, mes, año) en zona horaria Bolivia.
 * @param {Date} [fecha=new Date()]
 */
export const obtenerPartesFechaBolivia = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);

  return {
    anio: Number(partes.find((p) => p.type === 'year')?.value),
    mes: Number(partes.find((p) => p.type === 'month')?.value) - 1,
    dia: Number(partes.find((p) => p.type === 'day')?.value),
  };
};
