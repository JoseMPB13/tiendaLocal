/**
 * Componente: LayoutEscritorio.jsx
 * Layout principal con Sidebar lateral colapsable para Cajeros y Administradores.
 * Diseño premium con paleta de violeta profundo, animaciones suaves y badge de rol.
 */

import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import {
  LayoutDashboard, Package, Users, Tag,
  ShoppingCart, Truck, LogOut, ChevronLeft, Database,
  UserCog, ChevronRight,
} from 'lucide-react';

export const LayoutEscritorio = () => {
  const [colapsado, setColapsado] = useState(false);
  const { usuario, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    cerrarSesion();
    navigate('/login');
  };

  // Listado de enlaces de navegación con sus correspondientes iconos y colores de acento
  const enlaces = [
    { ruta: '/escritorio',   etiqueta: 'Dashboard',       icono: <LayoutDashboard size={19} />, color: '#a78bfa' },
    { ruta: '/punto-venta',  etiqueta: 'Punto de Venta',  icono: <ShoppingCart size={19} />,    color: '#34d399' },
    { ruta: '/productos',    etiqueta: 'Productos',        icono: <Package size={19} />,         color: '#60a5fa' },
    { ruta: '/categorias',   etiqueta: 'Categorías',       icono: <Tag size={19} />,             color: '#f59e0b' },
    { ruta: '/clientes',     etiqueta: 'Clientes',         icono: <Users size={19} />,           color: '#f472b6' },
    { ruta: '/envios',       etiqueta: 'Envíos & Reparto', icono: <Truck size={19} />,           color: '#2dd4bf' },
    ...(usuario?.rol === 'Administrador'
      ? [
          { ruta: '/bitacora',     etiqueta: 'Bitácora',  icono: <Database size={19} />,        color: '#fb923c' },
          { ruta: '/usuarios',   etiqueta: 'Personal',         icono: <UserCog size={19} />,         color: '#c084fc' }
        ]
      : []
    ),
  ];

  // Colores de fondo para el badge de rol
  const rolBadgeStyle = {
    Administrador: { background: '#4c1d95', color: '#e9d5ff' },
    Cajero:        { background: '#1e3a5f', color: '#bfdbfe' },
    Repartidor:    { background: '#14532d', color: '#bbf7d0' },
  };
  const badgeStyle = rolBadgeStyle[usuario?.rol] || { background: '#374151', color: '#d1d5db' };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-bg)', overflow: 'hidden' }}>

      {/* ──────────── SIDEBAR LATERAL ──────────── */}
      <aside
        style={{
          background: 'var(--color-sidebar-bg)',
          width: colapsado ? '64px' : '240px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '4px 0 20px rgba(30,27,75,.4)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Degradado superior decorativo */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '80px',
          background: 'linear-gradient(180deg, rgba(109,40,217,.25) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* --- Cabecera del Sidebar --- */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: colapsado ? 'center' : 'space-between',
            padding: '20px 14px 16px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
          }}>
            {!colapsado && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div style={{
                  width: '30px', height: '30px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(109,40,217,.5)',
                }}>
                  <span style={{ color: 'white', fontFamily: 'Outfit', fontWeight: 900, fontSize: '14px' }}>M</span>
                </div>
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  color: 'white',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}>
                  MARGARITA
                </span>
              </div>
            )}
            <button
              onClick={() => setColapsado(!colapsado)}
              title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              style={{
                background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: '#c4b5fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
            >
              {colapsado ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* --- Menú de Navegación --- */}
          <nav style={{ marginTop: '12px', padding: '0 8px' }}>
            {enlaces.map((enlace) => {
              const activo = location.pathname === enlace.ruta;
              return (
                <Link
                  key={enlace.ruta}
                  to={enlace.ruta}
                  title={colapsado ? enlace.etiqueta : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: colapsado ? '10px 0' : '10px 12px',
                    justifyContent: colapsado ? 'center' : 'flex-start',
                    borderRadius: '10px',
                    marginBottom: '3px',
                    textDecoration: 'none',
                    background: activo
                      ? 'rgba(109,40,217,.3)'
                      : 'transparent',
                    border: activo
                      ? '1px solid rgba(196,181,253,.2)'
                      : '1px solid transparent',
                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!activo) e.currentTarget.style.background = 'rgba(255,255,255,.06)';
                  }}
                  onMouseLeave={e => {
                    if (!activo) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Indicador activo */}
                  {activo && (
                    <div style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: '3px', borderRadius: '0 3px 3px 0',
                      background: enlace.color,
                      boxShadow: `0 0 8px ${enlace.color}`,
                    }} />
                  )}
                  <span style={{ color: activo ? enlace.color : '#c4b5fd', flexShrink: 0 }}>
                    {enlace.icono}
                  </span>
                  {!colapsado && (
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: activo ? 700 : 500,
                      color: activo ? 'white' : '#a5b4fc',
                      whiteSpace: 'nowrap',
                    }}>
                      {enlace.etiqueta}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* --- Sección inferior: Usuario y Logout --- */}
        <div style={{
          padding: '12px 10px 16px',
          borderTop: '1px solid rgba(255,255,255,.06)',
        }}>
          {!colapsado && (
            <div style={{
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '10px',
            }}>
              <p style={{ fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>
                Operador activo
              </p>
              <p style={{
                fontSize: '0.78rem', color: 'white', fontWeight: 600,
                marginTop: '3px', marginBottom: '7px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {usuario?.nombre_completo || 'Usuario'}
              </p>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '9999px',
                ...badgeStyle,
              }}>
                {usuario?.rol || 'Invitado'}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Cerrar Sesión"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: colapsado ? 'center' : 'flex-start',
              gap: '8px',
              padding: colapsado ? '9px 0' : '9px 12px',
              background: 'rgba(220,38,38,.12)',
              border: '1px solid rgba(220,38,38,.2)',
              borderRadius: '10px',
              color: '#fca5a5',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,.22)'; e.currentTarget.style.color = '#fde8e8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,.12)'; e.currentTarget.style.color = '#fca5a5'; }}
          >
            <LogOut size={16} />
            {!colapsado && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* ──────────── CONTENIDO PRINCIPAL ──────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Barra superior */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 1px 6px rgba(109,40,217,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 500 }}>Tienda Margarita</span>
            <ChevronRight size={12} style={{ color: '#d1d5db' }} />
            <h2 style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}>
              {enlaces.find(e => e.ruta === location.pathname)?.etiqueta || 'Módulo'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Indicador de rol */}
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '4px 10px', borderRadius: '9999px',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-border-strong)',
            }}>
              {usuario?.rol || 'Invitado'}
            </span>
          </div>
        </header>

        {/* Área de contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default LayoutEscritorio;
