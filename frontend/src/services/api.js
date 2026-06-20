import axios from 'axios';
import useAuthStore from '../store/authStore';

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
 * Adjunta dinámicamente el token Bearer y la cabecera 'X-User-Rol' requerida 
 * por el backend como pasarela de autenticación a partir de Zustand.
 */
clienteApi.interceptors.request.use(
  (config) => {
    const { token, rol } = useAuthStore.getState();
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (rol) {
      config.headers['X-User-Rol'] = rol;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default clienteApi;
