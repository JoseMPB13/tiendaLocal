import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

/**
 * Componente contenedor para proteger rutas que requieren autenticacion
 * y roles especificos, validando activamente la expiracion del token.
 */
export const RutaProtegida = ({ rolesPermitidos }) => {
  const { autenticado, rol, esTokenValido, cerrarSesion } = useAuthStore();

  const tokenValido = esTokenValido();

  useEffect(() => {
    if (autenticado && !tokenValido) {
      toast.error("Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente.");
      cerrarSesion();
    }
  }, [autenticado, tokenValido, cerrarSesion]);

  if (!autenticado || !tokenValido) {
    // Si no está logueado o expiró, redirigir al login
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
