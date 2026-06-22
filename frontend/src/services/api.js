import axios from 'axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

// URL base del backend de FastAPI
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const clienteApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * INTERCEPTOR DE PETICIONES (REQUEST)
 * Adjunta dinámicamente el token Bearer JWT requerido para la autenticación
 * a partir de la sesión activa en el authStore de Zustand.
 */
clienteApi.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * INTERCEPTOR DE RESPUESTAS (RESPONSE)
 * Captura automáticamente respuestas con código HTTP 401 (no autorizado),
 * forzando el cierre de sesión reactiva en el cliente y redirigiendo al login.
 */
clienteApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      const { cerrarSesion, autenticado } = useAuthStore.getState();
      if (autenticado) {
        toast.error("Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente.");
        cerrarSesion();
        // Redirigir al operador a la pantalla de login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default clienteApi;
