import clienteApi from './api';

export const productoService = {
  obtenerTodos: async (incluirInactivos = true) => {
    const respuesta = await clienteApi.get(`/productos/?incluir_inactivos=${incluirInactivos}`);
    return respuesta.data;
  },
  crear: async (datos) => {
    const respuesta = await clienteApi.post('/productos/', datos);
    return respuesta.data;
  },
  actualizar: async (id, datos) => {
    const respuesta = await clienteApi.put(`/productos/${id}`, datos);
    return respuesta.data;
  },
  eliminar: async (id) => {
    const respuesta = await clienteApi.delete(`/productos/${id}`);
    return respuesta.data;
  },
  ajustarStock: async (id, datos) => {
    const respuesta = await clienteApi.post(`/productos/${id}/ajustar-stock/`, datos);
    return respuesta.data;
  },
  subirImagen: async (formData) => {
    const respuesta = await clienteApi.post('/productos/upload-imagen/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return respuesta.data;
  }
};
export default productoService;
