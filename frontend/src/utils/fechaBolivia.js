// =============================================================================
// UTILIDAD: fechaBolivia.js
// Propósito: Helpers de fecha/hora en zona horaria oficial de Bolivia (America/La_Paz).
//            Evita el desfase de un día causado por toISOString() (UTC) en el cliente.
// Módulo: Utilidades compartidas del frontend
// Idioma: Español
// =============================================================================

/** Identificador IANA de la zona horaria de Bolivia */
export const ZONA_HORARIA_BOLIVIA = 'America/La_Paz';

/**
 * Obtiene la fecha local de Bolivia en formato YYYY-MM-DD (ideal para inputs type="date").
 * @returns {string} Fecha actual en Bolivia, ej: "2026-07-01"
 */
export const obtenerFechaBoliviaHoy = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_BOLIVIA }).format(new Date());
};

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
