import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Truck, ClipboardList, LogOut } from 'lucide-react';

/**
 * Layout responsivo con barra de navegación inferior (Tab Bar) para Repartidores en móviles.
 */
export const LayoutDelivery = () => {
  const { usuario, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-premium-light overflow-hidden">
      {/* Cabecera superior móvil */}
      <header className="bg-premium-dark text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-base font-bold m-0 tracking-wide text-white">Delivery Local</h1>
          <p className="text-xs text-gray-300 truncate w-40">{usuario?.nombre_completo}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-300 hover:text-white transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Contenido dinámico */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR (Tab Bar Fijo) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around shadow-lg z-50">
        <NavLink 
          to="/delivery" 
          end
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full text-xs font-semibold ${
              isActive ? 'text-premium-primary border-t-2 border-premium-primary' : 'text-gray-500'
            }`
          }
        >
          <Truck size={20} />
          <span className="mt-1">Mis Rutas</span>
        </NavLink>

        <NavLink 
          to="/delivery/historial" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full text-xs font-semibold ${
              isActive ? 'text-premium-primary border-t-2 border-premium-primary' : 'text-gray-500'
            }`
          }
        >
          <ClipboardList size={20} />
          <span className="mt-1">Historial</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default LayoutDelivery;
