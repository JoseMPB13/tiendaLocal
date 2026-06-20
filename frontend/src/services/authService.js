import clienteApi from './api';

export const authService = {
  /**
   * Conecta con el endpoint del backend para validar credenciales.
   * Simulamos la llamada HTTP y mapeamos para persistir el rol correspondiente.
   */
  iniciarSesion: async (email, password, rolSimulado) => {
    // En una API real llamaríamos:
    // const respuesta = await clienteApi.post('/auth/login', { email, password });
    // return respuesta.data;
    
    // Simulación de delay y respuesta exitosa mapeada al backend modular:
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      usuario: {
        id: "a933f2bd-1fb7-4e78-becc-82f5d918b958",
        email: email,
        nombre_completo: email.split('@')[0].toUpperCase(),
        rol: rolSimulado
      },
      token: "token-jwt-simulado-tienda-local-123456",
      rol: rolSimulado
    };
  }
};

export default authService;
