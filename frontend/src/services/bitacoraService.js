// =============================================================================
// SERVICIO DE FRONTEND: bitacoraService.js
// Propósito: Conexión con los endpoints de la API del módulo de Bitácora.
// Idioma: Español
// =============================================================================

import clienteApi from './api';

export const bitacoraService = {
  /**
   * Obtiene los movimientos de productos agrupados por periodo (dia, semana, mes).
   * @param {string} periodo - 'dia', 'semana' o 'mes'.
   */
  obtenerMovimientosProductos: async (periodo) => {
    const respuesta = await clienteApi.get('/bitacora/productos', {
      params: { periodo }
    });
    return respuesta.data;
  },

  /**
   * Obtiene el listado de auditoría de acciones de usuarios con filtros opcionales.
   * @param {number} skip - Registros a saltar.
   * @param {number} limit - Límite de registros a retornar.
   * @param {object} filtros - Filtros opcionales: fecha_inicio, fecha_fin, tabla_afectada, operacion.
   */
  obtenerAuditoriaUsuarios: async (skip = 0, limit = 50, filtros = {}) => {
    const respuesta = await clienteApi.get('/bitacora/usuarios', {
      params: { skip, limit, ...filtros }
    });
    return respuesta.data;
  }
};

export default bitacoraService;
