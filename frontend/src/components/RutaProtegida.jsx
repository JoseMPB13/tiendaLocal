import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * Componente contenedor para proteger rutas que requieren autenticacion
 * y roles especificos.
 */
export const RutaProtegida = ({ rolesPermitidos }) => {
  const { autenticado, rol } = useAuthStore();

  if (!autenticado) {
    // Si no está logueado, redirigir al login
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    // Si el rol no tiene permisos, redirigir a una pagina por defecto basada en su rol
    if (rol === 'Repartidor') {
      return <Navigate to="/delivery" replace />;
    }
    return <Navigate to="/escritorio" replace />;
  }

  // Renderizar las rutas hijas de forma nativa
  return <Outlet />;
};

export default RutaProtegida;
