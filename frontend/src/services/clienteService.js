import clienteApi from './api';

export const clienteService = {
  obtenerTodos: async (incluirInactivos = true) => {
    const respuesta = await clienteApi.get(`/clientes/?incluir_inactivos=${incluirInactivos}`);
    return respuesta.data;
  },
  crear: async (datos) => {
    const respuesta = await clienteApi.post('/clientes/', datos);
    return respuesta.data;
  },
  actualizar: async (id, datos) => {
    const respuesta = await clienteApi.put(`/clientes/${id}`, datos);
    return respuesta.data;
  },
  eliminar: async (id) => {
    const respuesta = await clienteApi.delete(`/clientes/${id}`);
    return respuesta.data;
  }
};
export default clienteService;
