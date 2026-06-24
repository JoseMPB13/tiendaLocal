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
  },

  /**
   * Obtiene la lista de todas las ventas registradas con filtros y paginación.
   */
  obtenerVentas: async (params = {}) => {
    const respuesta = await clienteApi.get('/ventas/', { params });
    return respuesta.data;
  },

  /**
   * Obtiene de manera anticipada el siguiente número de factura correlativo a emitir.
   */
  obtenerProximoNumeroFactura: async () => {
    const respuesta = await clienteApi.get('/ventas/proximo-numero-factura');
    return respuesta.data;
  },

  /**
   * Obtiene la cabecera e ítems detallados de una venta específica por su UUID.
   */
  obtenerVentaDetalle: async (ventaId) => {
    const respuesta = await clienteApi.get(`/ventas/${ventaId}`);
    return respuesta.data;
  },

  /**
   * Ejecuta la cancelación o baja lógica de una venta específica.
   */
  cancelarVenta: async (ventaId) => {
    const respuesta = await clienteApi.put(`/ventas/${ventaId}/cancelar`);
    return respuesta.data;
  }
};

export default ventaService;
