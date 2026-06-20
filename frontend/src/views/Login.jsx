import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Lock, Mail, AlertTriangle } from 'lucide-react';
import authService from '../services/authService';

/**
 * Pantalla de inicio de sesión minimalista y responsiva conectada al backend y Zustand.
 */
export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolSimulado, setRolSimulado] = useState('Cajero'); // Emulación de roles para backend
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  
  const iniciarSesionStore = useAuthStore(state => state.iniciarSesion);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      // Iniciar sesión invocando el servicio API conectado
      const respuesta = await authService.iniciarSesion(email, password, rolSimulado);

      iniciarSesionStore(respuesta.usuario, respuesta.token, respuesta.rol);

      // Redirigir al módulo según el rol asignado
      if (rolSimulado === 'Repartidor') {
        navigate('/delivery');
      } else {
        navigate('/escritorio');
      }

    } catch (ex) {
      setError('Credenciales inválidas o error de conexión al servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-premium-light flex items-center justify-center p-4">
      {/* CONTENEDOR CENTRAL */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-8">
        
        {/* Cabecera / Marca */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-premium-dark tracking-tight">TIENDALOCAL</h2>
          <p className="text-sm text-gray-500 mt-2">Punto de venta e inventario optimizado</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded flex items-start">
            <AlertTriangle className="text-red-500 mr-2 flex-shrink-0" size={20} />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo Electrónico</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@tienda.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Selector de Rol Simulado (Requisito temporal de emulacion de backend) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Rol Operador (Simulación)</label>
            <select
              value={rolSimulado}
              onChange={(e) => setRolSimulado(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none text-sm bg-white"
            >
              <option value="Administrador">Administrador</option>
              <option value="Cajero">Cajero</option>
              <option value="Repartidor">Repartidor (Delivery)</option>
            </select>
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 bg-premium-primary hover:bg-blue-700 text-white rounded font-semibold text-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-premium-primary outline-none disabled:opacity-50"
          >
            {cargando ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
