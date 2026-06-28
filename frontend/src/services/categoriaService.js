import clienteApi from './api';

export const categoriaService = {
  obtenerTodas: async (incluirInactivas = true) => {
    const respuesta = await clienteApi.get(`/categorias/?incluir_inactivas=${incluirInactivas}`);
    return respuesta.data;
  },
  crear: async (datos) => {
    const respuesta = await clienteApi.post('/categorias/', datos);
    return respuesta.data;
  },
  actualizar: async (id, datos) => {
    const respuesta = await clienteApi.put(`/categorias/${id}`, datos);
    return respuesta.data;
  },
  eliminar: async (id) => {
    const respuesta = await clienteApi.delete(`/categorias/${id}`);
    return respuesta.data;
  },
  obtenerMetricas: async () => {
    const respuesta = await clienteApi.get('/categorias/metricas/');
    return respuesta.data;
  }
};
export default categoriaService;
