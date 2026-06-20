import React, { useState, useEffect } from 'react';
import reportesService from '../services/reportesService';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Search, Calendar, Filter, ArrowUpRight, ArrowDownRight, RefreshCw 
} from 'lucide-react';

export const KardexInventario = () => {
  const [kardex, setKardex] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado de los filtros
  const [productoFiltro, setProductoFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');

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
        // Filtrado local en el cliente para el autocompletado/nombre de producto
        let datosFiltrados = res.data;
        if (productoFiltro.trim()) {
          datosFiltrados = datosFiltrados.filter(item => 
            item.nombre_producto.toLowerCase().includes(productoFiltro.toLowerCase())
          );
        }
        setKardex(datosFiltrados);
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
    toast.success("Filtros restablecidos");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CABECERA FILTRABLE: BÚSQUEDA Y CALENDARIOS */}
      <div className="bg-white rounded-lg p-5 shadow border border-gray-200 space-y-4">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Auditoría de Kárdex & Stock</h3>
          <p className="text-xs text-gray-500 mt-0.5">Bitácora en tiempo real de variaciones y mermas en el inventario.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Autocompletado/Buscador de producto */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={productoFiltro}
              onChange={(e) => setProductoFiltro(e.target.value)}
              placeholder="Buscar por producto..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>

          {/* Fecha Inicio */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
              <Calendar size={14} />
            </span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>

          {/* Fecha Fin */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
              <Calendar size={14} />
            </span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>

          {/* Selector de Tipo Movimiento */}
          <div className="relative">
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              className="w-full border border-gray-300 rounded text-xs py-1.5 px-2 bg-white"
            >
              <option value="">Todos los movimientos</option>
              <option value="Venta">Ventas</option>
              <option value="Compra">Compras</option>
              <option value="Ajuste">Ajustes / Mermas</option>
              <option value="Cancelacion Venta">Cancelación Venta</option>
            </select>
          </div>

          {/* Botones de acción de filtros */}
          <div className="flex gap-2">
            <button
              onClick={cargarKardex}
              className="flex-1 flex items-center justify-center bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold py-1.5 transition-colors"
            >
              <RefreshCw size={14} className="mr-1" />
              Aplicar
            </button>
            <button
              onClick={handleLimpiarFiltros}
              className="flex-1 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold py-1.5 border transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA DEL KÁRDEX */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-premium-dark text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Fecha Movimiento</th>
                <th className="py-3.5 px-4">Producto</th>
                <th className="py-3.5 px-4">Tipo Movimiento</th>
                <th className="py-3.5 px-4 text-right">Variación Stock</th>
              </tr>
            </thead>
            
            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500 font-semibold">
                    Cargando movimientos de inventario desde la base de datos...
                  </td>
                </tr>
              </tbody>
            ) : kardex.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-400">
                    No se encontraron registros de kárdex con los filtros aplicados.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {kardex.map((item) => {
                  const esEntrada = item.cantidad_cambio > 0;
                  const esAjuste = item.tipo_movimiento === "Ajuste";
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        {new Date(item.fecha_movimiento).toLocaleString('es-ES')}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {item.nombre_producto}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          item.tipo_movimiento === 'Venta' ? 'bg-blue-100 text-blue-700' :
                          item.tipo_movimiento === 'Compra' ? 'bg-green-100 text-green-700' :
                          esAjuste ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item.tipo_movimiento}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold text-right text-sm ${
                        esEntrada ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <span className="inline-flex items-center">
                          {esEntrada ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
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
      </div>

    </div>
  );
};

export default KardexInventario;
