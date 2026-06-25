/**
 * Vista: GestionCompras.jsx
 * Módulo de gestión de compras y reabastecimiento de productos de Tienda Margarita.
 * Permite registrar nuevas adquisiciones a proveedores con validación de costo unitario,
 * ver historial de transacciones con visualización móvil en tarjetas y anulación lógica (reversión de stock).
 * Idioma: Español
 */

import { useState, useEffect } from 'react';
import compraService from '../services/compraService';
import productoService from '../services/productoService';
import useAuthStore from '../store/authStore';
import PaginadorTablas from '../components/PaginadorTablas';
import toast from 'react-hot-toast';
import {
  ClipboardList, Plus, Trash2, X, AlertTriangle,
  Eye, RotateCcw, Calendar, User, FileText,
  Search, CheckCircle2, History, PlusCircle, AlertCircle
} from 'lucide-react';

export const GestionCompras = () => {
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'Administrador';

  // Control de pestañas: 'historial' o 'nueva'
  const [pestanaActiva, setPestanaActiva] = useState('historial');

  // Estados del Historial de Compras
  const [compras, setCompras] = useState([]);
  const [cargandoCompras, setCargandoCompras] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState(''); // '' para todos, 'Completada', 'Cancelada'
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 8;

  // Estados del Formulario de Nueva Compra
  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [codigoReferencia, setCodigoReferencia] = useState('');
  
  // Selección del producto en formulario
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('');
  const [cantidadItem, setCantidadItem] = useState('');
  const [costoUnitarioItem, setCostoUnitarioItem] = useState('');
  
  // Carrito local de la compra actual
  const [carrito, setCarrito] = useState([]);

  // Estados para modal de detalle y anulación
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [mostrarModalDetalle, setMostrarModalDetalle] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [compraAnularId, setCompraAnularId] = useState(null);
  const [procesandoAnular, setProcesandoAnular] = useState(false);

  // Cargar historial de compras desde el backend
  const cargarHistorial = async () => {
    try {
      setCargandoCompras(true);
      const res = await compraService.obtenerCompras(filtroEstado || null);
      if (res.ok) {
        setCompras(res.data);
      }
    } catch (ex) {
      toast.error('Error al cargar el historial de compras.');
      console.error(ex);
    } finally {
      setCargandoCompras(false);
    }
  };

  // Cargar productos activos del catálogo para el selector de compras
  const cargarProductosActivos = async () => {
    try {
      setCargandoProductos(true);
      const res = await productoService.obtenerTodos(false); // false = excluir inactivos
      if (res.ok) {
        setProductos(res.data);
      }
    } catch (ex) {
      toast.error('Error al cargar productos del catálogo.');
      console.error(ex);
    } finally {
      setCargandoProductos(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, [filtroEstado]);

  useEffect(() => {
    if (pestanaActiva === 'nueva') {
      cargarProductosActivos();
    }
  }, [pestanaActiva]);

  // Filtrado reactivo local por proveedor o código de referencia
  const comprasFiltradas = compras.filter((c) => {
    const prov = (c.proveedor_nombre || '').toLowerCase();
    const ref = (c.codigo_referencia || '').toLowerCase();
    const query = busqueda.toLowerCase();
    return prov.includes(query) || ref.includes(query);
  });

  // Paginación local del historial
  const indexInicio = (pagina - 1) * itemsPorPagina;
  const comprasPaginadas = comprasFiltradas.slice(indexInicio, indexInicio + itemsPorPagina);

  // Producto seleccionado actualmente para el formulario
  const productoSeleccionado = productos.find((p) => p.id === productoSeleccionadoId);

  // Validación: ¿El costo ingresado supera el precio de venta?
  const costoExcedePrecioVenta =
    productoSeleccionado &&
    costoUnitarioItem &&
    parseFloat(costoUnitarioItem) > parseFloat(productoSeleccionado.precio_venta);

  // Agregar un producto al carrito local de compra
  const handleAgregarAlCarrito = (e) => {
    e.preventDefault();
    if (!productoSeleccionadoId) {
      toast.error('Seleccione un producto.');
      return;
    }
    if (!cantidadItem || parseInt(cantidadItem) <= 0) {
      toast.error('Ingrese una cantidad válida mayor a cero.');
      return;
    }
    if (!costoUnitarioItem || parseFloat(costoUnitarioItem) < 0) {
      toast.error('Ingrese un costo unitario válido.');
      return;
    }

    const cantidad = parseInt(cantidadItem);
    const costo_unitario = parseFloat(costoUnitarioItem);

    // Verificar si el producto ya existe en el carrito
    const existeIndice = carrito.findIndex((item) => item.producto_id === productoSeleccionadoId);

    if (existeIndice !== -1) {
      const nuevoCarrito = [...carrito];
      nuevoCarrito[existeIndice].cantidad += cantidad;
      // Actualizar el costo al último costo ingresado
      nuevoCarrito[existeIndice].costo_unitario = costo_unitario;
      setCarrito(nuevoCarrito);
    } else {
      setCarrito([
        ...carrito,
        {
          producto_id: productoSeleccionadoId,
          nombre: productoSeleccionado.nombre,
          cantidad,
          costo_unitario,
          precio_venta: productoSeleccionado.precio_venta
        }
      ]);
    }

    // Resetear inputs de selección de producto
    setProductoSeleccionadoId('');
    setCantidadItem('');
    setCostoUnitarioItem('');
    toast.success('Producto agregado a la lista de compra.');
  };

  // Quitar un ítem del carrito local
  const handleEliminarDelCarrito = (index) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito.splice(index, 1);
    setCarrito(nuevoCarrito);
    toast.success('Ítem removido de la lista.');
  };

  // Calcular el total general del carrito actual
  const calcularTotalCarrito = () => {
    return carrito.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0);
  };

  // Enviar el reabastecimiento al backend
  const handleRegistrarCompra = async () => {
    if (!esAdmin) {
      toast.error('Solo los administradores pueden registrar compras.');
      return;
    }
    if (!proveedorNombre.trim()) {
      toast.error('Debe ingresar el nombre del proveedor.');
      return;
    }
    if (carrito.length === 0) {
      toast.error('El carrito de compras está vacío.');
      return;
    }

    const payload = {
      proveedor_nombre: proveedorNombre.trim(),
      codigo_referencia: codigoReferencia.trim() || null,
      detalles: carrito.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario
      }))
    };

    try {
      const res = await compraService.registrarCompra(payload);
      if (res.ok) {
        toast.success('¡Reabastecimiento registrado y stock actualizado con éxito!');
        // Resetear campos y volver al historial
        setProveedorNombre('');
        setCodigoReferencia('');
        setCarrito([]);
        setPestanaActiva('historial');
        cargarHistorial();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al registrar el reabastecimiento.';
      toast.error(errorMsg);
      console.error(ex);
    }
  };

  // Ver los detalles enriquecidos de una compra específica en un modal
  const handleVerDetalles = async (compraId) => {
    try {
      setCargandoDetalle(true);
      setMostrarModalDetalle(true);
      const res = await compraService.obtenerCompraDetalle(compraId);
      if (res.ok) {
        setCompraSeleccionada(res.data);
      }
    } catch (ex) {
      toast.error('No se pudo cargar el detalle de la compra.');
      setMostrarModalDetalle(false);
      console.error(ex);
    } finally {
      setCargandoDetalle(false);
    }
  };

  // Abrir modal de confirmación de anulación
  const handleAbrirAnular = (compraId) => {
    setCompraAnularId(compraId);
    setMostrarModalAnular(true);
  };

  // Confirmar la anulación de la compra
  const handleConfirmarAnular = async () => {
    if (!esAdmin) {
      toast.error('Solo los administradores pueden anular compras.');
      return;
    }
    try {
      setProcesandoAnular(true);
      const res = await compraService.cancelarCompra(compraAnularId);
      if (res.ok) {
        toast.success('Compra anulada con éxito. El stock ha sido revertido.');
        setMostrarModalAnular(false);
        setCompraAnularId(null);
        cargarHistorial();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al anular la compra. Valide que el stock actual no quede negativo.';
      toast.error(errorMsg);
      console.error(ex);
    } finally {
      setProcesandoAnular(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/30 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-900/40 text-purple-400 rounded-xl border border-purple-800/40 shadow-lg">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Reabastecimiento de Productos</h1>
            <p className="text-xs md:text-sm text-gray-400">Registra y controla compras de inventario a proveedores</p>
          </div>
        </div>
        
        {/* Selector de Pestañas de Estilo Premium */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800/50 shadow-inner">
          <button
            onClick={() => { setPestanaActiva('historial'); setPagina(1); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 ${
              pestanaActiva === 'historial'
                ? 'bg-purple-900/60 text-purple-200 shadow border border-purple-800/50'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History size={16} />
            <span>Historial</span>
          </button>
          
          <button
            onClick={() => setPestanaActiva('nueva')}
            className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 ${
              pestanaActiva === 'nueva'
                ? 'bg-purple-900/60 text-purple-200 shadow border border-purple-800/50'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <PlusCircle size={16} />
            <span>Nueva Compra</span>
          </button>
        </div>
      </div>

      {/* ────────────────── PESTAÑA: HISTORIAL ────────────────── */}
      {pestanaActiva === 'historial' && (
        <div className="space-y-4">
          {/* Controles de Filtros y Búsqueda */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900/65">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                placeholder="Buscar por proveedor o referencia..."
                className="w-full bg-slate-900/60 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 placeholder-gray-500 transition-all"
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex gap-2 self-start md:self-auto">
              <button
                onClick={() => { setFiltroEstado(''); setPagina(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstado === ''
                    ? 'bg-purple-950/50 text-purple-200 border-purple-800/60'
                    : 'bg-transparent text-gray-400 border-slate-800 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => { setFiltroEstado('Completada'); setPagina(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstado === 'Completada'
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                    : 'bg-transparent text-gray-400 border-slate-800 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                Completadas
              </button>
              <button
                onClick={() => { setFiltroEstado('Cancelada'); setPagina(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstado === 'Cancelada'
                    ? 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                    : 'bg-transparent text-gray-400 border-slate-800 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                Canceladas
              </button>
            </div>
          </div>

          {/* Tabla e Historial (Adaptación Desktop vs Mobile) */}
          {cargandoCompras ? (
            <div className="text-center py-16 text-gray-400 font-medium">
              Cargando historial de compras...
            </div>
          ) : comprasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/20 border border-slate-900 rounded-2xl text-gray-400">
              No se encontraron registros de reabastecimiento.
            </div>
          ) : (
            <>
              {/* Tabla de Escritorio */}
              <div className="hidden md:block overflow-hidden bg-slate-950/30 border border-slate-900 rounded-xl">
                <table className="min-w-full text-sm text-left text-gray-300">
                  <thead className="bg-slate-950/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-slate-900">
                    <tr>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Proveedor</th>
                      <th className="px-6 py-4">Código Referencia</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {comprasPaginadas.map((compra) => (
                      <tr key={compra.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          {new Date(compra.fecha_compra).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {compra.proveedor_nombre || 'Proveedor Genérico'}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-400 text-xs">
                          {compra.codigo_referencia || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white">
                          Bs. {parseFloat(compra.total).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                            compra.estado_compra === 'Completada'
                              ? 'bg-emerald-950/45 text-emerald-300 border-emerald-800/40'
                              : 'bg-rose-950/45 text-rose-300 border-rose-800/40'
                          }`}>
                            {compra.estado_compra}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleVerDetalles(compra.id)}
                              className="p-1.5 hover:bg-slate-800 text-purple-400 hover:text-purple-300 rounded-lg transition-colors"
                              title="Ver Detalles"
                            >
                              <Eye size={17} />
                            </button>
                            {compra.estado_compra === 'Completada' && esAdmin && (
                              <button
                                onClick={() => handleAbrirAnular(compra.id)}
                                className="p-1.5 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-lg transition-colors"
                                title="Anular Compra"
                              >
                                <RotateCcw size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas Móviles (Responsive Grid) */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {comprasPaginadas.map((compra) => (
                  <div
                    key={compra.id}
                    className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-base">
                          {compra.proveedor_nombre || 'Proveedor Genérico'}
                        </h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          Ref: {compra.codigo_referencia || '—'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        compra.estado_compra === 'Completada'
                          ? 'bg-emerald-950/45 text-emerald-300 border-emerald-800/40'
                          : 'bg-rose-950/45 text-rose-300 border-rose-800/40'
                      }`}>
                        {compra.estado_compra}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-900 pt-3">
                      <div>
                        <span className="text-gray-500">Fecha:</span>
                        <p className="text-gray-300 font-medium mt-0.5">
                          {new Date(compra.fecha_compra).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500">Total Compra:</span>
                        <p className="text-white font-bold text-sm mt-0.5">
                          Bs. {parseFloat(compra.total).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => handleVerDetalles(compra.id)}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 text-purple-400 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Eye size={15} />
                        <span>Ver Detalles</span>
                      </button>
                      {compra.estado_compra === 'Completada' && esAdmin && (
                        <button
                          onClick={() => handleAbrirAnular(compra.id)}
                          className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors"
                        >
                          <RotateCcw size={15} />
                          <span>Anular Compra</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginador */}
              <PaginadorTablas
                totalItems={comprasFiltradas.length}
                itemsPorPagina={itemsPorPagina}
                paginaActual={pagina}
                alCambiarPagina={setPagina}
              />
            </>
          )}
        </div>
      )}

      {/* ────────────────── PESTAÑA: NUEVA COMPRA ────────────────── */}
      {pestanaActiva === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario e Inserción de Ítems */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
                <FileText size={18} className="text-purple-400" />
                <span>Datos del Reabastecimiento</span>
              </h2>

              {/* Advertencia Cajero */}
              {!esAdmin && (
                <div className="bg-rose-900/30 border border-rose-800/50 rounded-xl p-3 text-rose-200 text-xs flex gap-2">
                  <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p>Solo usuarios con el rol **Administrador** pueden registrar o validar compras. Su rol actual es restringido.</p>
                </div>
              )}

              {/* Nombre Proveedor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Proveedor *
                </label>
                <input
                  type="text"
                  required
                  disabled={!esAdmin}
                  value={proveedorNombre}
                  onChange={(e) => setProveedorNombre(e.target.value)}
                  placeholder="Ej. Distribuidora del Oriente"
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-600 disabled:opacity-50"
                />
              </div>

              {/* Referencia */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Código de Referencia / Nro. Nota
                </label>
                <input
                  type="text"
                  disabled={!esAdmin}
                  value={codigoReferencia}
                  onChange={(e) => setCodigoReferencia(e.target.value)}
                  placeholder="Ej. FAC-12345 (Opcional)"
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Inserción al Carrito */}
            <form onSubmit={handleAgregarAlCarrito} className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
                <Plus size={18} className="text-purple-400" />
                <span>Agregar Producto</span>
              </h2>

              {/* Selector de Producto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Producto *
                </label>
                {cargandoProductos ? (
                  <div className="text-xs text-gray-500">Cargando productos...</div>
                ) : (
                  <select
                    required
                    disabled={!esAdmin}
                    value={productoSeleccionadoId}
                    onChange={(e) => setProductoSeleccionadoId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  >
                    <option value="">-- Seleccione un Producto --</option>
                    {productos.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nombre} (Venta: Bs. {parseFloat(prod.precio_venta).toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Cantidad y Costo Unitario */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={!esAdmin}
                    value={cantidadItem}
                    onChange={(e) => setCantidadItem(e.target.value)}
                    placeholder="Ej. 10"
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-600 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Costo Unit. (Bs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    disabled={!esAdmin}
                    value={costoUnitarioItem}
                    onChange={(e) => setCostoUnitarioItem(e.target.value)}
                    placeholder="Ej. 15.50"
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-600 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Advertencia de Costo vs Venta (Control de Costos) */}
              {costoExcedePrecioVenta && (
                <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-3 text-amber-200 text-xs flex gap-2">
                  <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">¡Advertencia de Costo!</p>
                    <p className="mt-0.5">El costo de compra (Bs. {parseFloat(costoUnitarioItem).toFixed(2)}) supera el precio de venta de catálogo (Bs. {parseFloat(productoSeleccionado.precio_venta).toFixed(2)}). La base de datos rechazará este movimiento para evitar pérdidas.</p>
                  </div>
                </div>
              )}

              {/* Botón Agregar */}
              <button
                type="submit"
                disabled={!esAdmin}
                className="w-full bg-purple-900 text-purple-200 border border-purple-800 hover:bg-purple-850 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Agregar al Carrito
              </button>
            </form>
          </div>

          {/* Desglose / Carrito de la Compra */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl space-y-4 flex flex-col justify-between min-h-[420px]">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-slate-900 pb-3">
                  <span>Productos en la Compra</span>
                  <span className="text-xs text-gray-500 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    {carrito.length} ítems
                  </span>
                </h2>

                {carrito.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    No se han agregado productos a la lista de compra actual.
                  </div>
                ) : (
                  <div className="overflow-x-auto mt-4">
                    <table className="min-w-full text-sm text-left text-gray-300">
                      <thead className="bg-slate-950/40 text-gray-500 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-4 py-2">Producto</th>
                          <th className="px-4 py-2 text-center">Cantidad</th>
                          <th className="px-4 py-2 text-right">Costo Unit.</th>
                          <th className="px-4 py-2 text-right">Subtotal</th>
                          <th className="px-4 py-2 text-center">Remover</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {carrito.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-900/10">
                            <td className="px-4 py-3 font-medium text-white">{item.nombre}</td>
                            <td className="px-4 py-3 text-center">{item.cantidad} uds</td>
                            <td className="px-4 py-3 text-right">Bs. {item.costo_unitario.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-white">
                              Bs. {(item.cantidad * item.costo_unitario).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleEliminarDelCarrito(index)}
                                className="text-rose-400 hover:text-rose-350 p-1 hover:bg-slate-900 rounded"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Resumen Final de Registro */}
              {carrito.length > 0 && (
                <div className="border-t border-slate-900 pt-4 space-y-4">
                  <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-semibold">Total a Registrar:</span>
                      <p className="text-xs text-purple-400 font-mono mt-0.5">
                        Proveedor: {proveedorNombre || 'No definido'}
                      </p>
                    </div>
                    <span className="text-2xl font-black text-white">
                      Bs. {calcularTotalCarrito().toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleRegistrarCompra}
                    disabled={!esAdmin || !proveedorNombre.trim()}
                    className="w-full bg-emerald-700 text-white hover:bg-emerald-650 py-3 rounded-lg text-sm font-bold tracking-wide transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
                  >
                    <CheckCircle2 size={18} />
                    <span>Registrar Reabastecimiento</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: VER DETALLES DE COMPRA ────────────────── */}
      {mostrarModalDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Franja de Color Superior */}
            <div className="h-1 bg-gradient-to-r from-purple-800 to-indigo-800" />

            <div className="p-6 space-y-6">
              {/* Header Modal */}
              <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Detalle de Reabastecimiento</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    ID Compra: {compraSeleccionada?.id || 'Cargando...'}
                  </p>
                </div>
                <button
                  onClick={() => { setMostrarModalDetalle(false); setCompraSeleccionada(null); }}
                  className="text-gray-500 hover:text-white p-1 hover:bg-slate-900 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {cargandoDetalle || !compraSeleccionada ? (
                <div className="text-center py-12 text-gray-400">
                  Cargando desglose de la compra...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Ficha Informativa Cabecera */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Proveedor</span>
                      <p className="text-white font-semibold mt-0.5">
                        {compraSeleccionada.proveedor_nombre || 'Proveedor Genérico'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Referencia</span>
                      <p className="text-gray-300 font-mono text-xs mt-0.5">
                        {compraSeleccionada.codigo_referencia || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Estado</span>
                      <div className="mt-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          compraSeleccionada.estado_compra === 'Completada'
                            ? 'bg-emerald-950/45 text-emerald-300 border-emerald-800/40'
                            : 'bg-rose-950/45 text-rose-300 border-rose-800/40'
                        }`}>
                          {compraSeleccionada.estado_compra}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Fecha de Emisión</span>
                      <p className="text-gray-300 text-xs mt-0.5">
                        {new Date(compraSeleccionada.fecha_compra).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Registrado por</span>
                      <p className="text-gray-300 text-xs mt-0.5 truncate" title={compraSeleccionada.usuario_id}>
                        {compraSeleccionada.usuario_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Importe Neto</span>
                      <p className="text-purple-400 font-black text-sm mt-0.5">
                        Bs. {parseFloat(compraSeleccionada.total).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Tabla de Artículos */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Desglose de Artículos
                    </h4>
                    <div className="overflow-hidden border border-slate-900 rounded-xl bg-slate-950">
                      <table className="min-w-full text-xs text-left text-gray-300">
                        <thead className="bg-slate-900/60 text-gray-500 uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Producto</th>
                            <th className="px-4 py-2.5 text-center">Cantidad</th>
                            <th className="px-4 py-2.5 text-right">Costo Unit.</th>
                            <th className="px-4 py-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {compraSeleccionada.detalles?.map((det) => (
                            <tr key={det.id} className="hover:bg-slate-900/10">
                              <td className="px-4 py-3 font-semibold text-white">
                                {det.producto_nombre || 'Producto No Identificado'}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-400">{det.cantidad} uds</td>
                              <td className="px-4 py-3 text-right text-gray-400">Bs. {parseFloat(det.costo_unitario).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-bold text-white">
                                Bs. {parseFloat(det.subtotal).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Modal */}
              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4">
                {compraSeleccionada?.estado_compra === 'Completada' && esAdmin && (
                  <button
                    onClick={() => {
                      setMostrarModalDetalle(false);
                      handleAbrirAnular(compraSeleccionada.id);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-rose-950/20 border border-rose-900/30 text-rose-450 rounded-xl hover:bg-rose-950/40 transition-colors"
                  >
                    Anular Compra
                  </button>
                )}
                <button
                  onClick={() => { setMostrarModalDetalle(false); setCompraSeleccionada(null); }}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 border border-slate-800 text-gray-400 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: CONFIRMACIÓN ANULACIÓN ────────────────── */}
      {mostrarModalAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-900 pb-3">
                <div className="p-2 bg-rose-950/60 text-rose-400 border border-rose-900/40 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Anular Reabastecimiento</h3>
              </div>

              <div className="space-y-3 text-sm text-gray-300">
                <p>¿Está seguro de que desea anular esta compra de inventario? Esta acción es **irreversible**.</p>
                <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3.5 text-xs text-rose-205 space-y-1">
                  <p className="font-bold">Efectos Transaccionales:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>El estado de la compra cambiará a `'Cancelada'`.</li>
                    <li>Se restarán automáticamente del stock del catálogo las cantidades adquiridas.</li>
                    <li>**Validación Crítica:** Si el stock actual es inferior a las unidades de la compra original, la operación fallará con error para prevenir stock negativo.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4">
                <button
                  onClick={() => { setMostrarModalAnular(false); setCompraAnularId(null); }}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 text-gray-400 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarAnular}
                  disabled={procesandoAnular}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-550 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {procesandoAnular ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionCompras;
