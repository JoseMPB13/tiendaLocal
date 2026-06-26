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
   * Obtiene el listado completo de auditoría de acciones de usuarios.
   * @param {number} skip - Registros a saltar.
   * @param {number} limit - Límite de registros a retornar.
   */
  obtenerAuditoriaUsuarios: async (skip = 0, limit = 50) => {
    const respuesta = await clienteApi.get('/bitacora/usuarios', {
      params: { skip, limit }
    });
    return respuesta.data;
  }
};

export default bitacoraService;
