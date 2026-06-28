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
    <div className="flex flex-col h-screen bg-[#fafafa] overflow-hidden">
      {/* Cabecera superior móvil */}
      <header className="bg-zinc-950 text-white px-4 py-4 flex items-center justify-between border-b border-zinc-900 shadow-sm">
        <div>
          <h1 className="text-base font-bold m-0 tracking-wide text-white">Delivery Local</h1>
          <p className="text-xs text-zinc-400 truncate w-40 mt-0.5">{usuario?.nombre_completo}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-all"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Contenido dinámico */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR (Tab Bar Fijo) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-zinc-200/80 flex items-center justify-around shadow-sm z-50">
        <NavLink 
          to="/delivery" 
          end
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full text-xs transition-all ${
              isActive ? 'text-zinc-950 font-bold border-t-2 border-zinc-950' : 'text-zinc-400 hover:text-zinc-600 font-medium'
            }`
          }
        >
          <Truck size={20} />
          <span className="mt-1">Mis Rutas</span>
        </NavLink>

        <NavLink 
          to="/delivery/historial" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full text-xs transition-all ${
              isActive ? 'text-zinc-950 font-bold border-t-2 border-zinc-950' : 'text-zinc-400 hover:text-zinc-600 font-medium'
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
