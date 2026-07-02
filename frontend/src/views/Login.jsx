/**
 * Vista: Login.jsx
 * Pantalla de inicio de sesión con diseño premium para Tienda Margarita.
 * Incluye gradiente animado de fondo, glassmorphism y micro-animaciones.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import clienteApi from '../services/api';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import authService from '../services/authService';

/** Resuelve la URL completa del logotipo almacenado en el servidor backend. */
const obtenerUrlImagenCompleta = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseURL = clienteApi.defaults.baseURL || 'http://localhost:8000';
  return `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const iniciarSesionStore = useAuthStore(state => state.iniciarSesion);
  const logoUrl = useAuthStore(state => state.logoUrl);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      // Iniciar sesión invocando el servicio API conectado real
      const respuesta = await authService.iniciarSesion(email, password);

      // Guardar sesión real en Zustand
      iniciarSesionStore(respuesta.usuario, respuesta.token, respuesta.rol);

      // Redirigir al módulo según el rol real devuelto por la base de datos
      if (respuesta.rol === 'Repartidor') {
        navigate('/delivery');
      } else {
        navigate('/escritorio');
      }

    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Credenciales incorrectas o error de conexión al servidor.';
      setError(errorMsg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 35%, #4c1d95 65%, #1e1b4b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Orbes decorativos de fondo */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '320px', height: '320px',
        background: 'radial-gradient(circle, rgba(139,92,246,.35) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-60px',
        width: '260px', height: '260px',
        background: 'radial-gradient(circle, rgba(99,102,241,.3) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* TARJETA CENTRAL */}
      <div
        className="animate-fade-in-up"
        style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(30,27,75,.5)',
          border: '1px solid rgba(196,181,253,.3)',
          width: '100%',
          maxWidth: '420px',
          overflow: 'hidden',
        }}
      >
        {/* Franja de color superior */}
        <div style={{
          height: '5px',
          background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #4338ca)',
        }} />

        <div style={{ padding: '36px 36px 40px' }}>
          {/* Cabecera / Logotipo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            {logoUrl ? (
              <img
                src={obtenerUrlImagenCompleta(logoUrl)}
                alt="Logotipo Tienda Margarita"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'contain',
                  margin: '0 auto 16px',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: '60px', height: '60px',
                background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
                borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(109,40,217,.4)',
              }}>
                <span style={{ color: 'white', fontSize: '24px', fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}>
                  M
                </span>
              </div>
            )}
            <h1 style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#1e1b4b',
              margin: 0,
              letterSpacing: '-0.03em',
            }}>
              Tienda Margarita
            </h1>
            <p style={{
              fontSize: '0.78rem',
              color: '#9ca3af',
              marginTop: '6px',
              fontWeight: 500,
            }}>
              Sistema de Ventas e Inventario
            </p>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div
              className="animate-fade-in-up"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 500, margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label className="form-label">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#9ca3af', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@tiendamargarita.com"
                  className="form-input form-input-icon"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#9ca3af', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input form-input-icon"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {/* Botón Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={cargando}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '0.875rem',
                marginTop: '4px',
                justifyContent: 'center',
              }}
            >
              {cargando ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Verificando acceso...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Pie de tarjeta */}
          <p style={{
            textAlign: 'center',
            fontSize: '0.6875rem',
            color: '#d1d5db',
            marginTop: '24px',
            fontWeight: 500,
          }}>
            © {new Date().getFullYear()} Tienda Margarita — Acceso Privado
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
