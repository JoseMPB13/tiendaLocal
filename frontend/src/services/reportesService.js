import clienteApi from './api';

export const reportesService = {
  /**
   * Obtiene los indicadores agregados del negocio para el Dashboard.
   */
  obtenerDashboard: async (fechaInicio = null, fechaFin = null) => {
    const params = {};
    if (fechaInicio) {
      params.fecha_inicio = fechaInicio;
    }
    if (fechaFin) {
      params.fecha_fin = fechaFin;
    }
    const respuesta = await clienteApi.get('/reportes/dashboard', { params });
    return respuesta.data;
  },

  /**
   * Obtiene la bitácora/historial detallado de movimientos de kárdex filtrado.
   */
  obtenerKardex: async (params = {}) => {
    const respuesta = await clienteApi.get('/reportes/kardex', { params });
    return respuesta.data;
  },

  /**
   * Obtiene la ruta HTTP absoluta para la descarga en streaming del PDF.
   */
  obtenerUrlCierrePdf: (fecha) => {
    const baseURL = clienteApi.defaults.baseURL;
    return `${baseURL}/reportes/cierre-pdf?fecha=${fecha}`;
  },

  /**
   * Obtiene el PDF de cierre diario como un Blob de forma autenticada.
   */
  obtenerCierrePdfBlob: async (fecha) => {
    const respuesta = await clienteApi.get(`/reportes/cierre-pdf?fecha=${fecha}`, {
      responseType: 'blob'
    });
    return respuesta.data;
  }
};

export default reportesService;
