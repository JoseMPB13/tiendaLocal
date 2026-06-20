import React, { useState, useEffect } from 'react';
import reportesService from '../services/reportesService';
import toast, { Toaster } from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, Users, Truck, Calendar, Printer, DollarSign 
} from 'lucide-react';

export const DashboardAdmin = () => {
  const [metricas, setMetricas] = useState({
    total_ventas: 0.00,
    cantidad_transacciones: 0,
    deudas_activas_calle: 0.00,
    efectividad_delivery_porcentaje: 0.00
  });
  
  const [fechaCierre, setFechaCierre] = useState(new Date().toISOString().split('T')[0]);
  const [cargando, setCargando] = useState(true);

  // Datos simulados para los gráficos de Recharts representativos
  const datosVentasCategoria = [
    { name: 'Bebidas', valor: 45300.00 },
    { name: 'Snacks', valor: 28400.00 },
    { name: 'Dulces', valor: 15400.00 },
    { name: 'Abarrotes', valor: 36330.50 }
  ];

  const COLORES_PASTEL = ['#2B6CB0', '#2F855A', '#C05621', '#9B2C2C'];

  const cargarMetricas = async () => {
    try {
      setCargando(true);
      const res = await reportesService.obtenerDashboard();
      if (res.ok) {
        setMetricas(res.data);
      }
    } catch (ex) {
      toast.error("Error al conectar con la API de reportes.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMetricas();
  }, []);

  /**
   * EXPORTAR CIERRE DE CAJA EN PDF:
   * Abre una nueva pestaña en el navegador apuntando directamente a la URL
   * de streaming del backend para aprovechar el visor de PDF nativo.
   */
  const handleExportarCierrePdfClick = () => {
    if (!fechaCierre) {
      toast.error("Seleccione una fecha de cierre válida.");
      return;
    }

    const url = reportesService.obtenerUrlCierrePdf(fechaCierre);
    // Inyectar de forma segura en una nueva pestaña
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CONTROLES CABECERA: EXPORTAR CIERRE DE CAJA */}
      <div className="bg-white rounded-lg p-4 shadow border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Resumen Ejecutivo & Reportes</h3>
          <p className="text-xs text-gray-500 mt-0.5">Control financiero y logística en tiempo real.</p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
              <Calendar size={14} />
            </span>
            <input
              type="date"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>
          <button
            onClick={handleExportarCierrePdfClick}
            className="flex items-center justify-center py-1.5 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors w-full sm:w-auto whitespace-nowrap"
          >
            <Printer size={14} className="mr-1.5" />
            Imprimir Cierre Diario
          </button>
        </div>
      </div>

      {/* CARDS DE IMPACTO ESTADÍSTICO */}
      {cargando ? (
        <div className="text-center py-12 text-gray-500 font-semibold bg-white rounded-lg border border-gray-200 shadow-sm">
          Cargando indicadores de negocio...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ventas Totales */}
          <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center">
            <div className="p-3 rounded bg-blue-100 text-premium-primary">
              <TrendingUp size={24} />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Ventas Totales</p>
              <h4 className="text-xl font-extrabold text-gray-800 mt-1">${metricas.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">{metricas.cantidad_transacciones} transacciones</p>
            </div>
          </div>

          {/* Card 2: Deudas Activas en Calle */}
          <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center">
            <div className="p-3 rounded bg-red-100 text-premium-danger">
              <DollarSign size={24} />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Deudas en la Calle</p>
              <h4 className="text-xl font-extrabold text-gray-800 mt-1">${metricas.deudas_activas_calle.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</h4>
              <p className="text-[10px] text-orange-600 mt-0.5 font-semibold">Cuentas corrientes fiadas</p>
            </div>
          </div>

          {/* Card 3: Efectividad Logística */}
          <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center">
            <div className="p-3 rounded bg-green-100 text-premium-success">
              <Truck size={24} />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Efectividad Delivery</p>
              <h4 className="text-xl font-extrabold text-gray-800 mt-1">{metricas.efectividad_delivery_porcentaje.toFixed(1)}%</h4>
              <p className="text-[10px] text-green-600 mt-0.5 font-semibold">Despachos completados</p>
            </div>
          </div>

          {/* Card 4: Clientes Fieles */}
          <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center">
            <div className="p-3 rounded bg-gray-100 text-gray-600">
              <Users size={24} />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Clientes Activos</p>
              <h4 className="text-xl font-extrabold text-gray-800 mt-1">24</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Registrados en la tienda</p>
            </div>
          </div>
        </div>
      )}

      {/* GRÁFICOS ANALÍTICOS DE RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Ventas por Categoría (BarChart) */}
        <div className="bg-white rounded-lg p-6 shadow border border-gray-200 flex flex-col justify-between">
          <div className="mb-4">
            <h4 className="font-bold text-gray-800 text-sm">Distribución de Ventas ($)</h4>
            <p className="text-xs text-gray-400">Total recaudado por categoría de inventario.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosVentasCategoria}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Bar dataKey="valor" fill="#2B6CB0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Participación de Ventas (PieChart) */}
        <div className="bg-white rounded-lg p-6 shadow border border-gray-200 flex flex-col justify-between">
          <div className="mb-4">
            <h4 className="font-bold text-gray-800 text-sm">Participación de Mercado</h4>
            <p className="text-xs text-gray-400">Porcentaje de ventas según el tipo de producto.</p>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosVentasCategoria}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="valor"
                >
                  {datosVentasCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES_PASTEL[index % COLORES_PASTEL.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardAdmin;
