import { create } from 'zustand';

/**
 * Función utilitaria nativa y ligera para decodificar el payload de un token JWT
 * sin utilizar dependencias externas pesadas.
 */
const decodificarJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

// Carga inicial y validación de expiración preventiva
const tokenInicial = localStorage.getItem('tienda_token');
let tokenValido = false;

if (tokenInicial) {
  const payload = decodificarJWT(tokenInicial);
  if (payload && payload.exp) {
    const ahora = Math.floor(Date.now() / 1000);
    tokenValido = ahora < payload.exp;
  }
}

// Limpieza proactiva del localStorage si el token guardado ya caducó
if (tokenInicial && !tokenValido) {
  localStorage.removeItem('tienda_usuario');
  localStorage.removeItem('tienda_token');
  localStorage.removeItem('tienda_rol');
}

/**
 * Store centralizado para la gestión del estado de autenticación.
 * Valida la expiración criptográfica del JWT en tiempo real.
 */
export const useAuthStore = create((set, get) => ({
  usuario: tokenValido ? JSON.parse(localStorage.getItem('tienda_usuario')) : null,
  token: tokenValido ? tokenInicial : null,
  rol: tokenValido ? localStorage.getItem('tienda_rol') : null,
  autenticado: tokenValido,

  /**
   * Registra la sesión activa en el store y localStorage.
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
   * Cierra la sesión activa limpiando el store y localStorage.
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
  },

  /**
   * Verifica proactivamente si el token actual sigue vigente.
   */
  esTokenValido: () => {
    const { token } = get();
    if (!token) return false;
    const payload = decodificarJWT(token);
    if (!payload || !payload.exp) return false;
    const ahora = Math.floor(Date.now() / 1000);
    return ahora < payload.exp;
  }
}));

export default useAuthStore;
