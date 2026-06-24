import React, { useState, useEffect } from 'react';
import reportesService from '../services/reportesService';
import toast, { Toaster } from 'react-hot-toast';
import PaginadorTablas from '../components/PaginadorTablas';
import { 
  Search, Calendar, Filter, ArrowUpRight, ArrowDownRight, RefreshCw,
  Database, AlertTriangle 
} from 'lucide-react';

export const KardexInventario = () => {
  const [kardex, setKardex] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado de los filtros
  const [productoFiltro, setProductoFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 8;

  const cargarKardex = async () => {
    try {
      setCargando(true);
      const params = {};
      
      // Adjuntar filtros si están rellenados
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      if (tipoMovimiento) params.tipo_movimiento = tipoMovimiento;

      const res = await reportesService.obtenerKardex(params);
      if (res.ok) {
        setKardex(res.data);
      }
    } catch (ex) {
      toast.error("Error al cargar el kárdex transaccional.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarKardex();
  }, [fechaInicio, fechaFin, tipoMovimiento]); // Recarga automática al cambiar filtros base

  const handleLimpiarFiltros = () => {
    setProductoFiltro('');
    setFechaInicio('');
    setFechaFin('');
    setTipoMovimiento('');
    setPagina(1);
    toast.success("Filtros restablecidos");
  };

  // Filtrado reactivo en memoria para el buscador de productos, ordenando cronológicamente
  const kardexFiltrado = kardex
    .filter(item => 
      (item.nombre_producto || '').toLowerCase().includes(productoFiltro.toLowerCase())
    )
    .sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento));

  // Métricas dinámicas basadas en los resultados del kárdex
  const totalMovimientos = kardexFiltrado.length;
  const totalEntradas = kardexFiltrado
    .filter(item => item.cantidad_cambio > 0)
    .reduce((acc, item) => acc + item.cantidad_cambio, 0);
  const totalSalidas = kardexFiltrado
    .filter(item => item.cantidad_cambio < 0)
    .reduce((acc, item) => acc + Math.abs(item.cantidad_cambio), 0);
  const totalAjustes = kardexFiltrado
    .filter(item => item.tipo_movimiento === 'Ajuste')
    .length;

  // Segmentación para paginación local
  const indexInicio = (pagina - 1) * itemsPorPagina;
  const kardexPaginado = kardexFiltrado.slice(indexInicio, indexInicio + itemsPorPagina);

  // Mapeo inteligente de badges para tipos de movimientos
  const renderBadgeMovimiento = (item) => {
    const tipo = item.tipo_movimiento;
    const cant = item.cantidad_cambio;

    if (tipo === 'Compra' || tipo === 'Cancelacion Venta') {
      return (
        <span className="px-2.5 py-1 rounded-full font-semibold text-xs uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/50">
          {tipo === 'Cancelacion Venta' ? 'Canc. Venta' : tipo}
        </span>
      );
    }

    if (tipo === 'Venta' || tipo === 'Cancelacion Compra') {
      return (
        <span className="px-2.5 py-1 rounded-full font-semibold text-xs uppercase bg-rose-50 text-rose-700 border border-rose-200/50">
          {tipo === 'Cancelacion Compra' ? 'Canc. Compra' : tipo}
        </span>
      );
    }

    if (tipo === 'Ajuste') {
      if (cant > 0) {
        return (
          <span className="px-2.5 py-1 rounded-full font-semibold text-xs uppercase bg-teal-50 text-teal-700 border border-teal-200/50" title="Ajuste positivo de stock">
            Ajuste / Ingreso
          </span>
        );
      } else {
        return (
          <span className="px-2.5 py-1 rounded-full font-semibold text-xs uppercase bg-amber-50 text-amber-700 border border-amber-200/50" title="Ajuste negativo de stock (merma)">
            Ajuste / Merma
          </span>
        );
      }
    }

    return (
      <span className="px-2.5 py-1 rounded-full font-semibold text-xs uppercase bg-zinc-100 text-zinc-700 border border-zinc-200/50">
        {tipo}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* TARJETAS DE MÉTRICAS RÁPIDAS DEL INVENTARIO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-zinc-50 text-zinc-900 rounded-xl border border-zinc-100">
            <Database size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Movimientos</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalMovimientos}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <ArrowUpRight size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Ingresos Stock</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">+{totalEntradas}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <ArrowDownRight size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Salidas Stock</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">-{totalSalidas}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <AlertTriangle size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Ajustes / Mermas</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalAjustes}</h4>
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-zinc-900 text-lg">Buscador & Filtros de Auditoría</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Monitoreo transaccional de fluctuaciones en inventario y justificación de stock.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Buscar por producto */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Buscar Producto</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={productoFiltro}
                onChange={(e) => {
                  setProductoFiltro(e.target.value);
                  setPagina(1);
                }}
                placeholder="Ej: Coca Cola..."
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all bg-white font-medium text-zinc-800"
              />
            </div>
          </div>

          {/* Fecha Inicio */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fecha Inicio</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Calendar size={16} />
              </span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPagina(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all bg-white font-medium text-zinc-800"
              />
            </div>
          </div>

          {/* Fecha Fin */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fecha Fin</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Calendar size={16} />
              </span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setPagina(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all bg-white font-medium text-zinc-800"
              />
            </div>
          </div>

          {/* Tipo de movimiento */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo Movimiento</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Filter size={16} />
              </span>
              <select
                value={tipoMovimiento}
                onChange={(e) => {
                  setTipoMovimiento(e.target.value);
                  setPagina(1);
                }}
                className="w-full pl-9 pr-8 border border-zinc-200 rounded-xl text-sm py-2 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all appearance-none cursor-pointer font-medium text-zinc-700"
              >
                <option value="">Todos los movimientos</option>
                <option value="Venta">Ventas</option>
                <option value="Compra">Compras</option>
                <option value="Ajuste">Ajustes / Mermas</option>
                <option value="Cancelacion Venta">Cancelación Venta</option>
                <option value="Cancelacion Compra">Cancelación Compra</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2 border-t border-zinc-100">
          <button
            onClick={handleLimpiarFiltros}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            Limpiar Filtros
          </button>
          <button
            onClick={cargarKardex}
            className="flex items-center justify-center px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className="mr-1.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA DEL KÁRDEX */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                <th className="py-3.5 px-6 font-semibold">Fecha Movimiento</th>
                <th className="py-3.5 px-6 font-semibold">Producto</th>
                <th className="py-3.5 px-6 font-semibold">Tipo Movimiento</th>
                <th className="py-3.5 px-6 font-semibold">Motivo / Referencia</th>
                <th className="py-3.5 px-6 font-semibold text-right">Variación Stock</th>
              </tr>
            </thead>
            
            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="5" className="text-center py-12 text-zinc-500 font-medium">
                    Cargando movimientos de inventario desde la base de datos...
                  </td>
                </tr>
              </tbody>
            ) : kardexFiltrado.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="5" className="text-center py-12 text-zinc-400">
                    No se encontraron registros de kárdex con los filtros aplicados.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {kardexPaginado.map((item) => {
                  const esEntrada = item.cantidad_cambio > 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-zinc-600 font-medium text-xs">
                        {new Date(item.fecha_movimiento).toLocaleString('es-ES')}
                      </td>
                      <td className="py-4 px-6 font-bold text-zinc-900">
                        {item.nombre_producto}
                      </td>
                      <td className="py-4 px-6">
                        {renderBadgeMovimiento(item)}
                      </td>
                      <td className="py-4 px-6 text-zinc-600 text-xs font-medium">
                        {item.motivo ? (
                          <span className="text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1 inline-block max-w-[200px] truncate" title={item.motivo}>
                            {item.motivo}
                          </span>
                        ) : item.referencia_id ? (
                          <span className="text-zinc-400 font-mono" title={`Referencia ID: ${item.referencia_id}`}>
                            Ref: {item.referencia_id.substring(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-zinc-300 italic">Sin justificación</span>
                        )}
                      </td>
                      <td className={`py-4 px-6 font-semibold text-right text-base ${
                        esEntrada ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        <span className="inline-flex items-center">
                          {esEntrada ? <ArrowUpRight size={16} className="mr-0.5" /> : <ArrowDownRight size={16} className="mr-0.5" />}
                          {esEntrada ? `+${item.cantidad_cambio}` : item.cantidad_cambio}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        <PaginadorTablas
          totalItems={kardexFiltrado.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

    </div>
  );
};

export default KardexInventario;
