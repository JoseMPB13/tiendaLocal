import clienteApi from './api';

export const deliveryService = {
  /**
   * Obtiene la lista completa de envíos registrados en el sistema.
   * El cliente Axios inyecta automáticamente el X-User-Rol y token.
   */
  obtenerEnvios: async () => {
    const respuesta = await clienteApi.get('/delivery/envios');
    return respuesta.data;
  },

  /**
   * Obtiene la lista de envíos activos asignados al repartidor autenticado.
   */
  obtenerMisEnviosActivos: async () => {
    const respuesta = await clienteApi.get('/delivery/mis-envios-activos');
    return respuesta.data;
  },

  /**
   * Actualiza los datos o el estado de un envío (despachado, entregado, cancelado).
   */
  actualizarEstadoEnvio: async (envioId, datosActualizar) => {
    const respuesta = await clienteApi.put(`/delivery/envios/${envioId}`, datosActualizar);
    return respuesta.data;
  },

  crearEnvio: async (datosEnvio) => {
    const respuesta = await clienteApi.post('/delivery/envios', datosEnvio);
    return respuesta.data;
  },

  /**
   * Obtiene el listado de repartidores registrados.
   */
  obtenerRepartidores: async () => {
    const respuesta = await clienteApi.get('/delivery/repartidores');
    return respuesta.data;
  }
};

export default deliveryService;
