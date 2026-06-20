import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida';
import LayoutEscritorio from './components/LayoutEscritorio';
import LayoutDelivery from './components/LayoutDelivery';
import { PaginaPrueba } from './components/PaginaPrueba';
import Login from './views/Login';
import PuntoVenta from './views/PuntoVenta';

export const RutasApp = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* RUTA PUBLICA: LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* RUTAS PROTEGIDAS PARA ADMINISTRACIÓN Y CAJA */}
        <Route element={<RutaProtegida rolesPermitidos={['Administrador', 'Cajero']} />}>
          <Route element={<LayoutEscritorio />}>
            <Route path="/escritorio" element={<PaginaPrueba modulo="Dashboard / Metricas" />} />
            <Route path="/punto-venta" element={<PuntoVenta />} />
            <Route path="/productos" element={<PaginaPrueba modulo="Catalogo de Productos" />} />
            <Route path="/categorias" element={<PaginaPrueba modulo="Categorias de Inventario" />} />
            <Route path="/clientes" element={<PaginaPrueba modulo="Clientes y Creditos" />} />
            <Route path="/envios" element={<PaginaPrueba modulo="Monitoreo de Envios" />} />
          </Route>
        </Route>

        {/* RUTAS PROTEGIDAS PARA REPARTIDORES / DELIVERY (VISTA CELULAR) */}
        <Route element={<RutaProtegida rolesPermitidos={['Repartidor']} />}>
          <Route element={<LayoutDelivery />}>
            <Route path="/delivery" element={<PaginaPrueba modulo="Mis Rutas Activas" />} />
            <Route path="/delivery/historial" element={<PaginaPrueba modulo="Historial de Repartos" />} />
          </Route>
        </Route>

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RutasApp;


export default RutasApp;
