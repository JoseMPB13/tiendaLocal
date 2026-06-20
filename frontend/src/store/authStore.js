import { create } from 'zustand';

/**
 * Store centralizado para la gestion del estado de autenticacion.
 * Almacena la informacion del usuario activo, su rol y su token.
 * Persiste los datos en localStorage para evitar perdidas al refrescar la pantalla.
 */
export const useAuthStore = create((set) => ({
  // Carga inicial del estado desde localStorage para persistencia básica
  usuario: JSON.parse(localStorage.getItem('tienda_usuario')) || null,
  token: localStorage.getItem('tienda_token') || null,
  rol: localStorage.getItem('tienda_rol') || null,
  autenticado: !!localStorage.getItem('tienda_token'),

  /**
   * Registra la sesion activa en el store y localStorage.
   */
  iniciarSesion: (datosUsuario, token, rol) => {
    localStorage.setItem('tienda_usuario', JSON.stringify(datosUsuario));
    localStorage.setItem('tienda_token', token);
    localStorage.setItem('tienda_rol', rol);

    set({
      usuario: datosUsuario,
      token: token,
      rol: rol,
      autenticado: true
    });
  },

  /**
   * Cierra la sesion activa limpiando el store y localStorage.
   */
  cerrarSesion: () => {
    localStorage.removeItem('tienda_usuario');
    localStorage.removeItem('tienda_token');
    localStorage.removeItem('tienda_rol');

    set({
      usuario: null,
      token: null,
      rol: null,
      autenticado: false
    });
  }
}));
export default useAuthStore;
