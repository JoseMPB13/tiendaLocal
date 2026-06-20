import clienteApi from './api';

export const authService = {
  /**
   * Conecta con el endpoint real del backend para validar credenciales de operador.
   * Retorna el token JWT y los datos del usuario mapeados.
   */
  iniciarSesion: async (email, password) => {
    // Enviamos el correo o identificador en el campo 'username' esperado por el backend flexible
    const respuesta = await clienteApi.post('/auth/login', { username: email, password });
    // El backend responde bajo el formato global: {"ok": true, "data": {"token": "...", "usuario": {...}, "rol": "..."}}
    return respuesta.data.data;
  }

};


export default authService;
