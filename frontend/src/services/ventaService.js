import clienteApi from './api';

export const ventaService = {
  /**
   * Envía el payload de la venta (cabecera + detalles) al backend FastAPI.
   */
  registrarVenta: async (datosVenta) => {
    const respuesta = await clienteApi.post('/ventas/', datosVenta);
    return respuesta.data;
  },

  /**
   * Obtiene la lista de productos activos desde el backend.
   */
  obtenerProductos: async (options = {}) => {
    const respuesta = await clienteApi.get('/productos/', options);
    return respuesta.data;
  },

  /**
   * Obtiene la lista de clientes activos desde el backend.
   */
  obtenerClientes: async (options = {}) => {
    const respuesta = await clienteApi.get('/clientes/', options);
    return respuesta.data;
  },

  /**
   * Obtiene las categorías de inventario activas desde el backend.
   */
  obtenerCategorias: async (options = {}) => {
    const respuesta = await clienteApi.get('/categorias/', options);
    return respuesta.data;
  }
};

export default ventaService;
