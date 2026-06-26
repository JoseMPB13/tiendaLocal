import clienteApi from './api';

export const usuarioService = {
  obtenerTodos: async () => {
    const respuesta = await clienteApi.get('/usuarios/');
    return respuesta.data;
  },
  crear: async (datos) => {
    const respuesta = await clienteApi.post('/usuarios/', datos);
    return respuesta.data;
  },
  actualizar: async (id, datos) => {
    const respuesta = await clienteApi.put(`/usuarios/${id}`, datos);
    return respuesta.data;
  },
  obtenerRendimiento: async () => {
    const respuesta = await clienteApi.get('/usuarios/rendimiento');
    return respuesta.data;
  }
};
export default usuarioService;
