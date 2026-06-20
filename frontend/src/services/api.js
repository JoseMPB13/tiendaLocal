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


export default clienteApi;
