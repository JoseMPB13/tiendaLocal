// =============================================================================
// COMPONENTE VISTA: BitacoraSistema.jsx
// Propósito: Interfaz unificada de Bitácora del Sistema (Pestañas Duales).
//            Sección 1: Movimiento de productos agrupado por rango de tiempo (dia, semana, mes).
//            Sección 2: Auditoría detallada de acciones de usuarios con línea de tiempo.
// Idioma: Español
// =============================================================================

import { useState, useEffect, useCallback, Fragment } from 'react';
import bitacoraService from '../services/bitacoraService';
import toast, { Toaster } from 'react-hot-toast';
import PaginadorTablas from '../components/PaginadorTablas';
import {
  Search, ArrowUpRight, ArrowDownRight, RefreshCw,
  Database, AlertTriangle, Activity, Users
} from 'lucide-react';

export const BitacoraSistema = () => {
  const [activeTab, setActiveTab] = useState('inventario'); // 'inventario' o 'auditoria'
  const [cargando, setCargando] = useState(true);

  // --- Estados de Pestaña 1: Movimientos de Inventario ---
  const [movimientos, setMovimientos] = useState([]);
  const [periodo, setPeriodo] = useState('dia'); // 'dia', 'semana', 'mes'
  const [filtroProducto, setFiltroProducto] = useState('');
  const [paginaInventario, setPaginaInventario] = useState(1);
  const itemsPorPaginaInventario = 8;

  // --- Estados de Pestaña 2: Auditoría de Usuarios ---
  const [auditorias, setAuditorias] = useState([]);
  const [paginaAuditoria, setPaginaAuditoria] = useState(1);
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroOperacion, setFiltroOperacion] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroBuscarOperador, setFiltroBuscarOperador] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filaExpandida, setFilaExpandida] = useState(null);
  const itemsPorPaginaAuditoria = 10;

  // --- Carga de Datos ---
  const cargarMovimientos = useCallback(async () => {
    try {
      setCargando(true);
      const res = await bitacoraService.obtenerMovimientosProductos(periodo);
      if (res.ok) {
        setMovimientos(res.data || []);
      }
    } catch {
      toast.error("Error al cargar los movimientos de inventario.");
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  const cargarAuditorias = useCallback(async () => {
    try {
      setCargando(true);
      const filtros = {};
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;
      if (filtroModulo) filtros.tabla_afectada = filtroModulo;
      if (filtroOperacion) filtros.operacion = filtroOperacion;
      if (filtroAccion) filtros.accion = filtroAccion;
      if (filtroBuscarOperador) filtros.nombre_usuario = filtroBuscarOperador;

      // Traer una cantidad razonable filtrada desde la base de datos
      const res = await bitacoraService.obtenerAuditoriaUsuarios(0, 200, filtros);
      if (res.ok) {
        setAuditorias(res.data || []);
        setPaginaAuditoria(1); // Reiniciar a la primera página tras una nueva búsqueda
        setFilaExpandida(null); // Colapsar filas expandidas
      }
    } catch {
      toast.error("Error al cargar el registro de auditoría de usuarios.");
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin, filtroModulo, filtroOperacion, filtroAccion, filtroBuscarOperador]);

  useEffect(() => {
    let activo = true;
    
    // Deferimos la ejecución usando una microtarea para evitar setState síncrono dentro del effect
    Promise.resolve().then(() => {
      if (!activo) return;
      if (activeTab === 'inventario') {
        cargarMovimientos();
      } else {
        cargarAuditorias();
      }
    });

    return () => {
      activo = false;
    };
  }, [activeTab, cargarMovimientos, cargarAuditorias]);



  // --- Métodos de Limpieza ---
  const handleLimpiarFiltrosInventario = () => {
    setFiltroProducto('');
    setPeriodo('dia');
    setPaginaInventario(1);
    toast.success("Filtros restablecidos");
  };

  const handleLimpiarFiltrosAuditoria = async () => {
    setFiltroModulo('');
    setFiltroOperacion('');
    setFiltroAccion('');
    setFiltroBuscarOperador('');
    setFechaInicio('');
    setFechaFin('');
    setPaginaAuditoria(1);
    setFilaExpandida(null);
    try {
      setCargando(true);
      const res = await bitacoraService.obtenerAuditoriaUsuarios(0, 200);
      if (res.ok) {
        setAuditorias(res.data || []);
      }
    } catch {
      toast.error("Error al restablecer los datos de auditoría.");
    } finally {
      setCargando(false);
    }
    toast.success("Filtros restablecidos");
  };

  // --- Renderizador de JSON Premium con resaltado sintáctico y Diff Visual ---

  // Formatea un valor JSON individual con colores por tipo
  const renderValorJson = (val) => {
    if (val === 'null') return <span className="text-zinc-400 italic">null</span>;
    if (val === 'true')  return <span className="text-amber-600 font-bold">true</span>;
    if (val === 'false') return <span className="text-amber-600 font-bold">false</span>;
    if (val !== '' && !isNaN(Number(val))) return <span className="text-blue-600 font-semibold">{val}</span>;
    if (val.startsWith('"')) return <span className="text-emerald-600">{val}</span>;
    return <span className="text-zinc-600">{val}</span>;
  };

  // Renderiza un objeto JSON con resaltado sintáctico + indicador de diff por clave
  // diffMap: objeto { clave: 'changed' | 'added' | 'removed' } — si null, no aplica diff
  const renderJsonColoreado = (data, diffMap = null) => {
    if (!data) return null;
    const lines = JSON.stringify(data, null, 2).split('\n');
    return (
      <div className="font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          const keyMatch = line.match(/^(\s*)("[^"]+")(: ?)(.*)$/);
          if (keyMatch) {
            const [, indent, key, colon, rest] = keyMatch;
            const rawKey = key.replace(/"/g, '');
            const val = rest.trim().replace(/,$/, '');
            const trailingComma = rest.trim().endsWith(',');

            // Determinar clase de fondo según el diff
            let rowBg = '';
            if (diffMap) {
              if (diffMap[rawKey] === 'changed') rowBg = 'bg-amber-50 rounded';
              else if (diffMap[rawKey] === 'added')   rowBg = 'bg-emerald-50 rounded';
              else if (diffMap[rawKey] === 'removed')  rowBg = 'bg-rose-50 rounded';
            }

            return (
              <div key={i} className={`px-0.5 ${rowBg}`}>
                <span className="text-zinc-400">{indent}</span>
                <span className={`font-semibold ${diffMap && diffMap[rawKey] ? 'text-indigo-700' : 'text-indigo-600'}`}>{key}</span>
                <span className="text-zinc-500">{colon}</span>
                {renderValorJson(val)}
                {trailingComma ? <span className="text-zinc-400">,</span> : null}
                {diffMap && diffMap[rawKey] === 'changed' && (
                  <span className="ml-2 text-[9px] font-bold bg-amber-200 text-amber-800 px-1 rounded-sm">modificado</span>
                )}
                {diffMap && diffMap[rawKey] === 'added' && (
                  <span className="ml-2 text-[9px] font-bold bg-emerald-200 text-emerald-800 px-1 rounded-sm">nuevo</span>
                )}
              </div>
            );
          }
          return <div key={i} className="text-zinc-500">{line}</div>;
        })}
      </div>
    );
  };

  // Calcula el mapa de diferencias entre datos_anteriores y datos_nuevos
  const calcularDiffMap = (anterior, nuevo) => {
    if (!anterior || !nuevo) return null;
    const diffMap = {};
    const todasLasClaves = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);
    todasLasClaves.forEach(clave => {
      const valAnterior = anterior[clave];
      const valNuevo   = nuevo[clave];
      if (!(clave in anterior)) {
        diffMap[clave] = 'added';
      } else if (!(clave in nuevo)) {
        diffMap[clave] = 'removed';
      } else if (JSON.stringify(valAnterior) !== JSON.stringify(valNuevo)) {
        diffMap[clave] = 'changed';
      }
    });
    return Object.keys(diffMap).length > 0 ? diffMap : null;
  };

  // Leyenda visual de colores del diff
  const LeyendaDiff = () => (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold pb-2 border-b border-zinc-100 mb-2">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block"></span><span className="text-zinc-500">Modificado</span></span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block"></span><span className="text-zinc-500">Nuevo</span></span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300 inline-block"></span><span className="text-zinc-500">Eliminado</span></span>
    </div>
  );


  // --- Filtrado y Procesamiento en Memoria (Pestaña 1) ---
  const movimientosFiltrados = movimientos
    .filter(item =>
      (item.producto_nombre || '').toLowerCase().includes(filtroProducto.toLowerCase())
    );

  const totalMovimientos = movimientosFiltrados.reduce((acc, item) => acc + Number(item.cantidad_movimientos || 0), 0);
  const totalEntradas = movimientosFiltrados.reduce((acc, item) => acc + Number(item.total_entradas || 0), 0);
  const totalSalidas = movimientosFiltrados.reduce((acc, item) => acc + Math.abs(Number(item.total_salidas || 0)), 0);
  const balanceNeto = movimientosFiltrados.reduce((acc, item) => acc + Number(item.balance_neto || 0), 0);

  const indexInicioInv = (paginaInventario - 1) * itemsPorPaginaInventario;
  const movimientosPaginados = movimientosFiltrados.slice(indexInicioInv, indexInicioInv + itemsPorPaginaInventario);

  // --- Filtrado y Procesamiento (Pestaña 2) ---
  const auditoriasFiltradas = auditorias; // Ya están filtrados por el backend

  const indexInicioAud = (paginaAuditoria - 1) * itemsPorPaginaAuditoria;
  const auditoriasPaginadas = auditoriasFiltradas.slice(indexInicioAud, indexInicioAud + itemsPorPaginaAuditoria);

  // --- Formateadores y Renderizado de Badges ---
  const renderBadgeMovimiento = (tipo) => {
    switch (tipo) {
      case 'Compra':
      case 'Cancelacion Venta':
        return (
          <span className="px-2.5 py-1 rounded-full font-bold text-xs uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/50">
            {tipo === 'Cancelacion Venta' ? 'Canc. Venta' : tipo}
          </span>
        );
      case 'Venta':
      case 'Cancelacion Compra':
        return (
          <span className="px-2.5 py-1 rounded-full font-bold text-xs uppercase bg-rose-50 text-rose-700 border border-rose-200/50">
            {tipo === 'Cancelacion Compra' ? 'Canc. Compra' : tipo}
          </span>
        );
      case 'Ajuste':
        return (
          <span className="px-2.5 py-1 rounded-full font-bold text-xs uppercase bg-amber-50 text-amber-700 border border-amber-200/50">
            Ajuste
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full font-bold text-xs uppercase bg-zinc-100 text-zinc-700 border border-zinc-200/50">
            {tipo}
          </span>
        );
    }
  };

  const renderBadgeAccion = (accion) => {
    switch (accion) {
      case 'CREAR':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50">
            CREAR
          </span>
        );
      case 'MODIFICAR':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200/50">
            EDITAR
          </span>
        );
      case 'DESACTIVAR':
      case 'ANULAR':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50">
            {accion}
          </span>
        );
      case 'ELIMINAR':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200/50">
            ELIMINAR
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-zinc-50 text-zinc-700 border border-zinc-200/50">
            {accion}
          </span>
        );
    }
  };

  const renderModuloName = (tabla) => {
    switch (tabla) {
      case 'clientes':
        return 'Clientes';
      case 'productos':
        return 'Productos';
      case 'ventas':
        return 'Ventas';
      case 'compras':
        return 'Compras';
      default:
        return tabla;
    }
  };

  const formatFechaPeriodo = (fechaStr, per) => {
    const f = new Date(fechaStr);
    if (per === 'mes') {
      return f.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (per === 'semana') {
      // Retornar rango de días
      const inicioSemana = new Date(f);
      const finSemana = new Date(f);
      finSemana.setDate(finSemana.getDate() + 6);
      return `Semana del ${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} al ${finSemana.getDate()}/${finSemana.getMonth() + 1}`;
    }
    return f.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getInitials = (nombre) => {
    if (!nombre) return 'US';
    return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-950 tracking-tight">Bitácora del Sistema</h2>
          <p className="text-sm text-zinc-500 font-medium">Control de movimientos de stock de inventario y auditoría global de acciones de usuarios.</p>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex border-b border-zinc-200 bg-white rounded-2xl p-1.5 border shadow-sm">
        <button
          onClick={() => { setActiveTab('inventario'); setCargando(true); }}
          className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'inventario'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Activity size={18} className="mr-2" />
          Movimientos de Inventario
        </button>
        <button
          onClick={() => { setActiveTab('auditoria'); setCargando(true); }}
          className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'auditoria'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Users size={18} className="mr-2" />
          Auditoría de Usuarios
        </button>
      </div>

      {/* =========================================================================
          CONTENIDO: PESTAÑA 1 - MOVIMIENTOS DE INVENTARIO
          ========================================================================= */}
      {activeTab === 'inventario' && (
        <div className="space-y-6">
          {/* TARJETAS DE MÉTRICAS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
              <div className="p-2.5 bg-zinc-50 text-zinc-900 rounded-xl border border-zinc-100">
                <Database size={20} />
              </div>
              <div className="ml-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transacciones</p>
                <h4 className="text-2xl font-black text-zinc-950 mt-0.5">{cargando ? '...' : totalMovimientos}</h4>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <ArrowUpRight size={20} />
              </div>
              <div className="ml-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total Ingresos</p>
                <h4 className="text-2xl font-black text-emerald-600 mt-0.5">{cargando ? '...' : `+${totalEntradas}`}</h4>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <ArrowDownRight size={20} />
              </div>
              <div className="ml-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total Salidas</p>
                <h4 className="text-2xl font-black text-rose-600 mt-0.5">{cargando ? '...' : `-${totalSalidas}`}</h4>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
              <div className={`p-2.5 rounded-xl border ${balanceNeto >= 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                <AlertTriangle size={20} />
              </div>
              <div className="ml-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Balance Neto</p>
                <h4 className={`text-2xl font-black mt-0.5 ${balanceNeto >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                  {cargando ? '...' : (balanceNeto >= 0 ? `+${balanceNeto}` : balanceNeto)}
                </h4>
              </div>
            </div>
          </div>

          {/* FILTROS E INTERVALO TEMPORAL */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">Reporte de Inventario por Período</h3>
                <p className="text-sm text-zinc-500 mt-0.5">Filtra y agrupa las variaciones de stock de forma acumulativa.</p>
              </div>

              {/* SELECTOR DE PERÍODO PREMIUM */}
              <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/50 self-start md:self-auto">
                <button
                  onClick={() => { setPeriodo('dia'); setPaginaInventario(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    periodo === 'dia' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Diario
                </button>
                <button
                  onClick={() => { setPeriodo('semana'); setPaginaInventario(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    periodo === 'semana' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => { setPeriodo('mes'); setPaginaInventario(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    periodo === 'mes' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Mensual
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtrar por Producto</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={filtroProducto}
                    onChange={(e) => { setFiltroProducto(e.target.value); setPaginaInventario(1); }}
                    placeholder="Ej: Harina, Leche..."
                    className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none bg-white font-medium text-zinc-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <button
                onClick={handleLimpiarFiltrosInventario}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Limpiar Filtros
              </button>
              <button
                onClick={cargarMovimientos}
                className="flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Actualizar
              </button>
            </div>
          </div>

          {/* TABLA DE REPORTES / TARJETAS EN CELULAR */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {cargando ? (
              <div className="text-center py-12 text-zinc-500 font-medium bg-white">
                Cargando movimientos de inventario...
              </div>
            ) : movimientosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 bg-white">
                No se encontraron movimientos registrados en el periodo seleccionado.
              </div>
            ) : (
              <>
                {/* Vista Escritorio (Tabla) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                        <th className="py-3.5 px-6 font-semibold">Fecha / Período</th>
                        <th className="py-3.5 px-6 font-semibold">Producto</th>
                        <th className="py-3.5 px-6 font-semibold">Tipo Movimiento</th>
                        <th className="py-3.5 px-6 font-semibold text-right">Ingresos</th>
                        <th className="py-3.5 px-6 font-semibold text-right">Salidas</th>
                        <th className="py-3.5 px-6 font-semibold text-right">Balance Neto</th>
                        <th className="py-3.5 px-6 font-semibold text-center">Operaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700 bg-white">
                      {movimientosPaginados.map((item, index) => (
                        <tr key={index} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-4 px-6 font-semibold text-zinc-800 text-xs">
                            {formatFechaPeriodo(item.periodo_fecha, periodo)}
                          </td>
                          <td className="py-4 px-6 font-bold text-zinc-950">
                            {item.producto_nombre}
                          </td>
                          <td className="py-4 px-6">
                            {renderBadgeMovimiento(item.tipo_movimiento)}
                          </td>
                          <td className="py-4 px-6 text-right font-semibold text-emerald-600">
                            {Number(item.total_entradas) > 0 ? `+${item.total_entradas}` : '0'}
                          </td>
                          <td className="py-4 px-6 text-right font-semibold text-rose-600">
                            {Number(item.total_salidas) < 0 ? item.total_salidas : '0'}
                          </td>
                          <td className={`py-4 px-6 text-right font-bold ${Number(item.balance_neto) >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                            {Number(item.balance_neto) >= 0 ? `+${item.balance_neto}` : item.balance_neto}
                          </td>
                          <td className="py-4 px-6 text-center text-zinc-500 font-bold text-xs">
                            {item.cantidad_movimientos} ops
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Móvil (Tarjetas Adaptables) */}
                <div className="block md:hidden divide-y divide-zinc-100 bg-white">
                  {movimientosPaginados.map((item, index) => (
                    <div key={index} className="p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                            {formatFechaPeriodo(item.periodo_fecha, periodo)}
                          </p>
                          <h4 className="text-base font-bold text-zinc-950 mt-0.5">{item.producto_nombre}</h4>
                        </div>
                        <div>
                          {renderBadgeMovimiento(item.tipo_movimiento)}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 text-center text-xs">
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase">Ingresos</p>
                          <p className="font-bold text-emerald-600 mt-0.5">+{item.total_entradas}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase">Salidas</p>
                          <p className="font-bold text-rose-600 mt-0.5">{item.total_salidas}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase">Balance</p>
                          <p className={`font-bold mt-0.5 ${Number(item.balance_neto) >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                            {Number(item.balance_neto) >= 0 ? `+${item.balance_neto}` : item.balance_neto}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-zinc-500 pt-1">
                        <span>Cant. Operaciones:</span>
                        <span className="font-bold text-zinc-800">{item.cantidad_movimientos} transacciones</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <PaginadorTablas
              totalItems={movimientosFiltrados.length}
              itemsPorPagina={itemsPorPaginaInventario}
              paginaActual={paginaInventario}
              alCambiarPagina={setPaginaInventario}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTENIDO: PESTAÑA 2 - AUDITORÍA DE ACCIONES DE USUARIOS
          ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="space-y-6">
          {/* EXPLICACIÓN Y FILTROS */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-zinc-900 text-lg">Registro de Auditoría de Usuarios</h3>
              <p className="text-sm text-zinc-500 mt-0.5">Control histórico de las acciones realizadas por los operadores en los módulos principales.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Módulo Afectado</label>
                <select
                  value={filtroModulo}
                  onChange={(e) => { setFiltroModulo(e.target.value); setPaginaAuditoria(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700 cursor-pointer"
                >
                  <option value="">Todos los módulos</option>
                  <option value="clientes">Clientes</option>
                  <option value="productos">Productos</option>
                  <option value="ventas">Ventas</option>
                  <option value="compras">Compras</option>
                  <option value="envios">Envíos (Delivery)</option>
                  <option value="repartidores">Repartidores</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Operación (DML)</label>
                <select
                  value={filtroOperacion}
                  onChange={(e) => { setFiltroOperacion(e.target.value); setPaginaAuditoria(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700 cursor-pointer"
                >
                  <option value="">Todas las operaciones</option>
                  <option value="INSERT">INSERT (Crear)</option>
                  <option value="UPDATE">UPDATE (Modificar / Desactivar)</option>
                  <option value="DELETE">DELETE (Eliminar)</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Acción Semántica</label>
                <select
                  value={filtroAccion}
                  onChange={(e) => { setFiltroAccion(e.target.value); setPaginaAuditoria(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700 cursor-pointer"
                >
                  <option value="">Todas las acciones</option>
                  <option value="CREAR">CREAR</option>
                  <option value="MODIFICAR">MODIFICAR</option>
                  <option value="DESACTIVAR">DESACTIVAR</option>
                  <option value="ANULAR">ANULAR</option>
                  <option value="CANCELAR">CANCELAR</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Buscar Operador</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    value={filtroBuscarOperador}
                    onChange={(e) => { setFiltroBuscarOperador(e.target.value); setPaginaAuditoria(1); }}
                    placeholder="Nombre del operador..."
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fecha Inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => { setFechaInicio(e.target.value); setPaginaAuditoria(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fecha Fin</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => { setFechaFin(e.target.value); setPaginaAuditoria(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-medium text-zinc-700"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <button
                onClick={handleLimpiarFiltrosAuditoria}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Limpiar Filtros
              </button>
              <button
                onClick={cargarAuditorias}
                className="flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Actualizar
              </button>
            </div>
          </div>

          {/* TABLA DE AUDITORÍA (TIMELINE EN MÓVIL) */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {cargando ? (
              <div className="text-center py-12 text-zinc-500 font-medium bg-white">
                Cargando registros de auditoría de usuarios...
              </div>
            ) : auditoriasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 bg-white">
                No se encontraron registros de auditoría para los filtros seleccionados.
              </div>
            ) : (
              <>
                {/* Vista Escritorio (Tabla Detallada con Iconos y Diffs JSON) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                        <th className="py-3.5 px-6 font-semibold">Fecha / Hora</th>
                        <th className="py-3.5 px-6 font-semibold">Operador</th>
                        <th className="py-3.5 px-6 font-semibold">Acción</th>
                        <th className="py-3.5 px-6 font-semibold">Módulo</th>
                        <th className="py-3.5 px-6 font-semibold">Detalles</th>
                        <th className="py-3.5 px-6 font-semibold text-center">Cambios</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700 bg-white">
                      {auditoriasPaginadas.map((item) => (
                        <Fragment key={item.id}>
                          <tr className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-4 px-6 font-mono text-zinc-500 text-xs">
                              {new Date(item.fecha).toLocaleString('es-ES')}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-zinc-950 text-white font-bold text-xs flex items-center justify-center border border-zinc-800 shadow-sm">
                                  {getInitials(item.usuarios?.nombre_completo)}
                                </div>
                                <div className="ml-3">
                                  <p className="font-bold text-zinc-950 text-xs leading-none">
                                    {item.usuarios?.nombre_completo || 'Sistema / Desconocido'}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">
                                    {item.usuarios?.email || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              {renderBadgeAccion(item.accion)}
                            </td>
                            <td className="py-4 px-6 font-semibold text-zinc-900 text-xs">
                              {renderModuloName(item.tabla_afectada)}
                            </td>
                            <td className="py-4 px-6 text-xs text-zinc-500 font-medium max-w-[280px] truncate" title={item.detalles}>
                              {item.detalles || 'Sin detalles'}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <button
                                onClick={() => setFilaExpandida(filaExpandida === item.id ? null : item.id)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-600 transition-all cursor-pointer flex items-center justify-center space-x-1 mx-auto"
                              >
                                <span>{filaExpandida === item.id ? 'Ocultar' : 'Ver JSON'}</span>
                              </button>
                            </td>
                          </tr>
                          {filaExpandida === item.id && (
                            <tr className="bg-zinc-50/50">
                              <td colSpan={6} className="p-6">
                                {/* Leyenda y paneles de diff */}
                                {(item.datos_anteriores && item.datos_nuevos) && (
                                  <div className="mb-4">
                                    <LeyendaDiff />
                                  </div>
                                )}
                                {(() => {
                                  const diffMap = calcularDiffMap(item.datos_anteriores, item.datos_nuevos);
                                  return (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                                      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                                        <p className="font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                                          <span className="h-2 w-2 rounded-full bg-rose-500 mr-2"></span>
                                          Estado Anterior (Antes de la modificación)
                                        </p>
                                        {item.datos_anteriores ? (
                                          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 overflow-auto max-h-56 leading-relaxed">
                                            {renderJsonColoreado(item.datos_anteriores, diffMap)}
                                          </div>
                                        ) : (
                                          <p className="text-zinc-400 italic bg-zinc-50/50 p-4 rounded-xl border border-dashed border-zinc-200">
                                            No hay datos anteriores (Operación de creación / registro inicial)
                                          </p>
                                        )}
                                      </div>
                                      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                                        <p className="font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                                          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                                          Estado Nuevo (Después de la modificación)
                                        </p>
                                        {item.datos_nuevos ? (
                                          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 overflow-auto max-h-56 leading-relaxed">
                                            {renderJsonColoreado(item.datos_nuevos, diffMap)}
                                          </div>
                                        ) : (
                                          <p className="text-zinc-400 italic bg-zinc-50/50 p-4 rounded-xl border border-dashed border-zinc-200">
                                            No hay datos nuevos (Operación de anulación o eliminación física)
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Celulares (Línea de tiempo / Timeline estético con Diffs JSON) */}
                <div className="block md:hidden p-6 bg-white">
                  <div className="relative border-l border-zinc-200 ml-4 space-y-8">
                    {auditoriasPaginadas.map((item) => (
                      <div key={item.id} className="relative pl-6">
                        {/* Círculo indicador */}
                        <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-zinc-950 flex items-center justify-center shadow-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                        </div>

                        {/* Contenedor de Tarjeta */}
                        <div className="space-y-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/50 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-[10px] text-zinc-400 font-semibold">
                              {new Date(item.fecha).toLocaleString('es-ES')}
                            </span>
                            {renderBadgeAccion(item.accion)}
                          </div>

                          <div className="flex items-center space-x-2.5">
                            <div className="h-7 w-7 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center">
                              {getInitials(item.usuarios?.nombre_completo)}
                            </div>
                            <div className="leading-tight">
                              <p className="font-bold text-zinc-950 text-xs">
                                {item.usuarios?.nombre_completo || 'Sistema / Desconocido'}
                              </p>
                              <p className="text-[9px] text-zinc-400 font-semibold">
                                Módulo: {renderModuloName(item.tabla_afectada)}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-500 font-medium border-t border-zinc-100 pt-2 mt-2 leading-relaxed">
                            {item.detalles}
                          </p>

                          <div className="pt-2 border-t border-zinc-100 flex justify-end">
                            <button
                              onClick={() => setFilaExpandida(filaExpandida === item.id ? null : item.id)}
                              className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 bg-white rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                            >
                              {filaExpandida === item.id ? 'Ocultar JSON' : 'Ver Cambios JSON'}
                            </button>
                          </div>

                          {filaExpandida === item.id && (() => {
                            const diffMap = calcularDiffMap(item.datos_anteriores, item.datos_nuevos);
                            return (
                              <div className="space-y-3 pt-3 border-t border-zinc-200/60 mt-3 text-[10px] font-mono leading-normal bg-white p-3 rounded-xl border border-zinc-150">
                                {diffMap && <LeyendaDiff />}
                                <div>
                                  <p className="font-bold text-rose-600 mb-1">ANTES:</p>
                                  {item.datos_anteriores ? (
                                    <div className="overflow-auto max-h-36 bg-zinc-50 p-2 rounded border border-zinc-100 max-w-full">
                                      {renderJsonColoreado(item.datos_anteriores, diffMap)}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-400 italic">Sin datos previos</span>
                                  )}
                                </div>
                                <div className="border-t border-zinc-100 pt-2 mt-2">
                                  <p className="font-bold text-emerald-600 mb-1">DESPUÉS:</p>
                                  {item.datos_nuevos ? (
                                    <div className="overflow-auto max-h-36 bg-zinc-50 p-2 rounded border border-zinc-100 max-w-full">
                                      {renderJsonColoreado(item.datos_nuevos, diffMap)}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-400 italic">Sin datos nuevos</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <PaginadorTablas
              totalItems={auditoriasFiltradas.length}
              itemsPorPagina={itemsPorPaginaAuditoria}
              paginaActual={paginaAuditoria}
              alCambiarPagina={setPaginaAuditoria}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BitacoraSistema;
