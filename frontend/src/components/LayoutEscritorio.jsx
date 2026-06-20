import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { 
  LayoutDashboard, Package, Users, Tag, 
  ShoppingCart, Truck, LogOut, Menu, ChevronLeft 
} from 'lucide-react';

/**
 * Layout principal con Sidebar lateral colapsable para Cajeros y Administradores.
 */
export const LayoutEscritorio = () => {
  const [colapsado, setColapsado] = useState(false);
  const { usuario, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    cerrarSesion();
    navigate('/login');
  };

  // Listado de enlaces de navegación con sus correspondientes iconos
  const enlaces = [
    { ruta: '/escritorio', etiqueta: 'Dashboard', icono: <LayoutDashboard size={20} /> },
    { ruta: '/punto-venta', etiqueta: 'Punto de Venta', icono: <ShoppingCart size={20} /> },
    { ruta: '/productos', etiqueta: 'Productos', icono: <Package size={20} /> },
    { ruta: '/categorias', etiqueta: 'Categorías', icono: <Tag size={20} /> },
    { ruta: '/clientes', etiqueta: 'Clientes', icono: <Users size={20} /> },
    { ruta: '/envios', etiqueta: 'Envíos & Reparto', icono: <Truck size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-premium-light overflow-hidden">
      {/* SIDEBAR LATERAL */}
      <aside 
        className={`bg-premium-dark text-white flex flex-col justify-between transition-all duration-300 ${
          colapsado ? 'w-16' : 'w-64'
        }`}
      >
        <div>
          {/* Cabecera del Sidebar */}
          <div className="flex items-center justify-between p-4 border-b border-blue-900">
            {!colapsado && <span className="font-bold text-lg tracking-wider">TIENDALOCAL</span>}
            <button 
              onClick={() => setColapsado(!colapsado)} 
              className="p-1 hover:bg-blue-900 rounded transition-colors"
            >
              {colapsado ? <Menu size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Menú de Opciones */}
          <nav className="mt-6 px-2 space-y-1">
            {enlaces.map((enlace) => {
              const activo = location.pathname === enlace.ruta;
              return (
                <Link
                  key={enlace.ruta}
                  to={enlace.ruta}
                  className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                    activo 
                      ? 'bg-premium-primary text-white font-semibold' 
                      : 'text-gray-300 hover:bg-blue-900 hover:text-white'
                  }`}
                >
                  <span className="flex-shrink-0">{enlace.icono}</span>
                  {!colapsado && <span className="ml-3 text-sm">{enlace.etiqueta}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sección inferior de Usuario y Logout */}
        <div className="p-4 border-t border-blue-900">
          {!colapsado && (
            <div className="mb-4">
              <p className="text-xs text-gray-400">Operador</p>
              <p className="text-sm font-semibold truncate">{usuario?.nombre_completo || 'Usuario'}</p>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-2 px-3 bg-red-800 hover:bg-red-700 text-white rounded transition-colors"
          >
            <LogOut size={18} />
            {!colapsado && <span className="ml-2 text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            {enlaces.find(e => e.ruta === location.pathname)?.etiqueta || 'Módulo'}
          </h2>
          <div className="text-sm text-gray-500">
            Rol: <span className="font-bold text-premium-primary">{usuario?.rol || 'Invitado'}</span>
          </div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default LayoutEscritorio;
