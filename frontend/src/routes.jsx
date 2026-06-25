import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida';
import LayoutEscritorio from './components/LayoutEscritorio';
import LayoutDelivery from './components/LayoutDelivery';
import { PaginaPrueba } from './components/PaginaPrueba';
import Login from './views/Login';
import PuntoVenta from './views/PuntoVenta';
import DeliveryReparto from './views/DeliveryReparto';
import DashboardAdmin from './views/DashboardAdmin';
import KardexInventario from './views/KardexInventario';
import GestionCategorias from './views/GestionCategorias';
import GestionProductos from './views/GestionProductos';
import GestionClientes from './views/GestionClientes';
import GestionUsuarios from './views/GestionUsuarios';
import GestionEnvios from './views/GestionEnvios';
import GestionCompras from './views/GestionCompras';

export const RutasApp = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* RUTA PUBLICA: LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* RUTAS PROTEGIDAS PARA ADMINISTRACIÓN Y CAJA */}
        <Route element={<RutaProtegida rolesPermitidos={['Administrador', 'Cajero']} />}>
          <Route element={<LayoutEscritorio />}>
            <Route path="/escritorio" element={<DashboardAdmin />} />
            <Route path="/punto-venta" element={<PuntoVenta />} />
            <Route path="/productos" element={<GestionProductos />} />
            <Route path="/categorias" element={<GestionCategorias />} />
            <Route path="/clientes" element={<GestionClientes />} />
            <Route path="/envios" element={<GestionEnvios />} />
            <Route path="/compras" element={<GestionCompras />} />
          </Route>
        </Route>

        {/* RUTA DE ADMINISTRADOR EXCLUSIVA PARA USUARIOS Y KARDEX */}
        <Route element={<RutaProtegida rolesPermitidos={['Administrador']} />}>
          <Route element={<LayoutEscritorio />}>
            <Route path="/kardex" element={<KardexInventario />} />
            <Route path="/usuarios" element={<GestionUsuarios />} />
          </Route>
        </Route>

        {/* RUTAS PROTEGIDAS PARA REPARTIDORES / DELIVERY (VISTA CELULAR) */}
        <Route element={<RutaProtegida rolesPermitidos={['Repartidor']} />}>
          <Route element={<LayoutDelivery />}>
            <Route path="/delivery" element={<DeliveryReparto />} />
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



