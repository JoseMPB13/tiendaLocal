/**
 * Vista: GestionProductos.jsx
 * Módulo de gestión completa del catálogo de productos de Tienda Margarita.
 * Incluye tabla paginada, formulario modal premium y baja lógica con confirmación.
 */

import { useState, useEffect } from 'react';
import productoService from '../services/productoService';
import categoriaService from '../services/categoriaService';
import compraService from '../services/compraService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import useAuthStore from '../store/authStore';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Package, Eye, RotateCcw, Search, AlertTriangle } from 'lucide-react';

/* ── Estilos de modal compartidos ── */
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionProductos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda y categoría
  const [buscarTexto, setBuscarTexto] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('');

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setPagina(1);
  }, [buscarTexto, categoriaSel]);

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [productoEdit, setProductoEdit] = useState(null);

  // Campos del Formulario
  const [categoriaId, setCategoriaId] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [productoEliminarId, setProductoEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  // Modal de Reabastecimiento
  const [mostrarReabastecer, setMostrarReabastecer] = useState(false);
  const [productoReabastecer, setProductoReabastecer] = useState(null);
  const [reabastecerProveedor, setReabastecerProveedor] = useState('');
  const [reabastecerCantidad, setReabastecerCantidad] = useState('');
  const [reabastecerCosto, setReabastecerCosto] = useState('');
  const [reabastecerReferencia, setReabastecerReferencia] = useState('');
  const [procesandoReabastecer, setProcesandoReabastecer] = useState(false);

  // Rol de usuario y estados de la pestaña del historial de compras
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'Administrador';
  const [tabActiva, setTabActiva] = useState('catalogo');
  const [compras, setCompras] = useState([]);
  const [cargandoCompras, setCargandoCompras] = useState(false);
  const [filtroEstadoCompra, setFiltroEstadoCompra] = useState(''); // '', 'Completada', 'Cancelada'
  const [busquedaCompra, setBusquedaCompra] = useState('');
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const itemsPorPaginaHistorial = 8;

  // Modales de detalle y anulación
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [mostrarModalDetalle, setMostrarModalDetalle] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [compraAnularId, setCompraAnularId] = useState(null);
  const [procesandoAnular, setProcesandoAnular] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resProds, resCats] = await Promise.all([
        productoService.obtenerTodos(true),
        categoriaService.obtenerTodas(false)
      ]);
      if (resProds.ok) setProductos(resProds.data);
      if (resCats.ok) setCategorias(resCats.data);
    } catch (ex) {
      console.error(ex);
      toast.error('Error al cargar los productos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarDatos();
    };
    inicializar();
  }, []);

  const abrirCrear = () => {
    setProductoEdit(null);
    setCategoriaId(categorias[0]?.id || '');
    setCodigoBarras('');
    setNombre('');
    setDescripcion('');
    setPrecioCompra('');
    setPrecioVenta('');
    setStockActual(0);
    setStockMinimo(5);
    setMostrarForm(true);
  };

  const abrirEditar = (prod) => {
    setProductoEdit(prod);
    setCategoriaId(prod.categoria_id);
    setCodigoBarras(prod.codigo_barras || '');
    setNombre(prod.nombre);
    setDescripcion(prod.descripcion || '');
    setPrecioCompra(prod.precio_compra);
    setPrecioVenta(prod.precio_venta);
    setStockActual(prod.stock_actual);
    setStockMinimo(prod.stock_minimo);
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setProcesandoForm(true);

    const payload = {
      categoria_id: categoriaId,
      codigo_barras: codigoBarras || null,
      nombre,
      descripcion,
      precio_compra: parseFloat(precioCompra),
      precio_venta: parseFloat(precioVenta),
      stock_actual: parseInt(stockActual),
      stock_minimo: parseInt(stockMinimo)
    };

    try {
      if (productoEdit) {
        const res = await productoService.actualizar(productoEdit.id, payload);
        if (res.ok) {
          toast.success('Producto actualizado correctamente.');
          setMostrarForm(false);
          cargarDatos();
        }
      } else {
        const res = await productoService.crear(payload);
        if (res.ok) {
          toast.success('Producto registrado exitosamente.');
          setMostrarForm(false);
          cargarDatos();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al guardar el producto.';
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setProductoEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      const res = await productoService.eliminar(productoEliminarId);
      if (res.ok) {
        toast.success('Producto inactivado correctamente (baja lógica).');
        setMostrarEliminar(false);
        cargarDatos();
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo inactivar el producto.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  const abrirReabastecer = (prod) => {
    setProductoReabastecer(prod);
    setReabastecerProveedor('');
    setReabastecerCantidad('');
    setReabastecerCosto(prod.precio_compra);
    setReabastecerReferencia('');
    setMostrarReabastecer(true);
  };

  const handleReabastecer = async (e) => {
    e.preventDefault();
    if (!esAdmin) {
      toast.error('Solo los administradores pueden registrar compras.');
      return;
    }
    if (!reabastecerProveedor.trim()) {
      toast.error('Debe ingresar el nombre del proveedor.');
      return;
    }
    const cant = parseInt(reabastecerCantidad);
    const costo = parseFloat(reabastecerCosto);

    if (isNaN(cant) || cant <= 0) {
      toast.error('La cantidad a ingresar debe ser mayor a 0.');
      return;
    }
    if (isNaN(costo) || costo < 0) {
      toast.error('El costo de compra no puede ser negativo.');
      return;
    }
    if (costo > productoReabastecer.precio_venta) {
      toast.error('El costo de compra no puede ser mayor al precio de venta actual.');
      return;
    }

    setProcesandoReabastecer(true);
    try {
      const payload = {
        proveedor_nombre: reabastecerProveedor.trim(),
        codigo_referencia: reabastecerReferencia.trim() || null,
        detalles: [
          {
            producto_id: productoReabastecer.id,
            cantidad: cant,
            costo_unitario: costo
          }
        ]
      };
      const res = await compraService.registrarCompra(payload);
      if (res.ok) {
        toast.success('✓ Reabastecimiento de stock registrado exitosamente.');
        setMostrarReabastecer(false);
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al reabastecer el producto.';
      toast.error(errorMsg);
    } finally {
      setProcesandoReabastecer(false);
    }
  };

  // --- Funciones para el Historial de Compras ---
  const cargarCompras = async () => {
    try {
      setCargandoCompras(true);
      const res = await compraService.obtenerCompras(filtroEstadoCompra || null);
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

  useEffect(() => {
    if (tabActiva === 'historial') {
      cargarCompras();
    }
  }, [tabActiva, filtroEstadoCompra]);

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

  const handleAbrirAnular = (compraId) => {
    setCompraAnularId(compraId);
    setMostrarModalAnular(true);
  };

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
        cargarCompras();
        cargarDatos(); // Recargar también stock de productos
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al anular la compra. Valide que el stock actual no quede negativo.';
      toast.error(errorMsg);
      console.error(ex);
    } finally {
    setProcesandoAnular(false);
    }
  };

  // Filtrar productos por búsqueda y categoría
  const productosFiltrados = productos.filter((prod) => {
    const coincideTexto =
      prod.nombre.toLowerCase().includes(buscarTexto.toLowerCase()) ||
      (prod.codigo_barras && prod.codigo_barras.toLowerCase().includes(buscarTexto.toLowerCase()));
    const coincideCategoria =
      !categoriaSel || prod.categoria_id === categoriaSel;
    return coincideTexto && coincideCategoria;
  });

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const productosPaginados = productosFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  // Cálculos del Mini-Dashboard de Inventario en tiempo real (sobre productos cargados)
  const stockBajoCount = productos.filter(p => p.estado === 'Activo' && p.stock_actual <= p.stock_minimo).length;
  
  const valorTotalInventario = productos
    .filter(p => p.estado === 'Activo')
    .reduce((acc, p) => acc + (p.stock_actual * p.precio_compra), 0);

  const productosMargen = productos.filter(p => p.estado === 'Activo' && p.precio_compra > 0);
  const margenPromedio = productosMargen.length > 0
    ? productosMargen.reduce((acc, p) => acc + (((p.precio_venta - p.precio_compra) / p.precio_compra) * 100), 0) / productosMargen.length
    : 0;

  const variedadCatalogoCount = productos.filter(p => p.estado === 'Activo').length;

  // Filtrado y paginación para el historial de compras
  const comprasFiltradas = compras.filter((c) => {
    const prov = (c.proveedor_nombre || '').toLowerCase();
    const ref = (c.codigo_referencia || '').toLowerCase();
    const query = busquedaCompra.toLowerCase();
    return prov.includes(query) || ref.includes(query);
  });

  const indexInicioHistorial = (paginaHistorial - 1) * itemsPorPaginaHistorial;
  const comprasPaginadas = comprasFiltradas.slice(indexInicioHistorial, indexInicioHistorial + itemsPorPaginaHistorial);

  // Validación de costo excedente en el modal de reabastecimiento
  const costoExcedePrecioVenta =
    productoReabastecer &&
    reabastecerCosto &&
    parseFloat(reabastecerCosto) > parseFloat(productoReabastecer.precio_venta);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '12px' },
        }}
      />

      {/* ── CABECERA ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Productos e Inventario</h3>
            <p className="page-subtitle">
              {tabActiva === 'catalogo'
                ? 'Gestión de catálogo, precios, stock actual y reabastecimiento'
                : 'Historial de compras de reabastecimiento de inventario'}
            </p>
          </div>
        </div>
        {tabActiva === 'catalogo' && (
          <button onClick={abrirCrear} className="btn-primary">
            <Plus size={15} />
            Registrar Producto
          </button>
        )}
      </div>

      {/* ── SECTOR DE PESTAÑAS ── */}
      <div className="flex bg-slate-900/10 p-1 rounded-xl border border-slate-200/50 self-start shadow-sm gap-1">
        <button
          onClick={() => setTabActiva('catalogo')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
            tabActiva === 'catalogo'
              ? 'bg-purple-900/10 text-purple-800 border border-purple-200 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Catálogo de Productos
        </button>
        <button
          onClick={() => { setTabActiva('historial'); setPaginaHistorial(1); }}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
            tabActiva === 'historial'
              ? 'bg-purple-900/10 text-purple-800 border border-purple-200 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Historial de Reabastecimientos
        </button>
      </div>

      {/* ── MINI-DASHBOARD DE INVENTARIO ── */}
      {tabActiva === 'catalogo' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '5px'
        }}>
          {/* Tarjeta 1: Stock Bajo */}
          <div style={{
            background: 'white',
            border: '1px solid #fee2e2',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              background: '#fef2f2',
              color: '#ef4444',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Stock Bajo</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', fontFamily: 'Inter, sans-serif' }}>{stockBajoCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>prods</span></span>
            </div>
          </div>

          {/* Tarjeta 2: Valor Total */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              background: '#f0fdf4',
              color: '#22c55e',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif'
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Bs</span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Valor Inventario</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>Bs. {valorTotalInventario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Tarjeta 3: Margen Promedio */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              background: '#f0f9ff',
              color: '#0284c7',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif'
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>%</span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Margen Ganancia</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{margenPromedio.toFixed(1)}%</span>
            </div>
          </div>

          {/* Tarjeta 4: Variedad Catálogo */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px',
              background: '#faf5ff',
              color: '#9333ea',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Variedad Catálogo</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{variedadCatalogoCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>ítems</span></span>
            </div>
          </div>
        </div>
      )}

      {/* ── PESTAÑA: CATÁLOGO DE PRODUCTOS ── */}
      {tabActiva === 'catalogo' && (
        <>
          <PanelFiltroBusqueda
            buscarTexto={buscarTexto}
            alCambiarBuscarTexto={setBuscarTexto}
            categoriaSeleccionada={categoriaSel}
            alCambiarCategoria={setCategoriaSel}
            categorias={categorias}
            placeholder="Buscar por nombre de producto o código de barras..."
            etiquetaCategoria="Filtrar por Categoría"
          />
          <div className="table-wrapper">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Código Barras</th>
                  <th>Nombre del Producto</th>
                  <th style={{ textAlign: 'right' }}>Precio Venta</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>

              {cargando ? (
                <tbody>
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontWeight: 500 }}>
                      Cargando catálogo de productos...
                    </td>
                  </tr>
                </tbody>
              ) : productos.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                      No se registran productos en el catálogo.
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {productosPaginados.map((prod) => (
                    <tr key={prod.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
                        {prod.codigo_barras || '—'}
                      </td>
                      <td className="bold">{prod.nombre}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e1b4b' }}>
                        Bs. {prod.precio_venta.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: prod.stock_actual <= prod.stock_minimo ? '#dc2626' : '#374151' }}>
                        {prod.stock_actual} uds
                      </td>
                      <td>
                        <span className={`badge ${prod.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                          {prod.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {prod.estado === 'Activo' && (
                            <button
                              onClick={() => abrirReabastecer(prod)}
                              className="btn-icon"
                              style={{ color: '#059669' }}
                              title="Reabastecer stock"
                            >
                              <Plus size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => abrirEditar(prod)}
                            className="btn-icon"
                            title="Editar producto"
                          >
                            <Edit3 size={15} />
                          </button>
                          {prod.estado === 'Activo' && (
                            <button
                              onClick={() => abrirDesactivar(prod.id)}
                              className="btn-icon danger"
                              title="Desactivar producto"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>

          <PaginadorTablas
            totalItems={productosFiltrados.length}
            itemsPorPagina={itemsPorPagina}
            paginaActual={pagina}
            alCambiarPagina={setPagina}
          />
        </div>
        </>
      )}

      {/* ── PESTAÑA: HISTORIAL DE REABASTECIMIENTOS ── */}
      {tabActiva === 'historial' && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={busquedaCompra}
                onChange={(e) => { setBusquedaCompra(e.target.value); setPaginaHistorial(1); }}
                placeholder="Buscar por proveedor o referencia..."
                className="form-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.8rem' }}
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex gap-2">
              <button
                onClick={() => { setFiltroEstadoCompra(''); setPaginaHistorial(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstadoCompra === ''
                    ? 'bg-purple-950/10 text-purple-800 border-purple-200'
                    : 'bg-transparent text-gray-400 border-slate-200 hover:text-gray-800 hover:bg-slate-50'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => { setFiltroEstadoCompra('Completada'); setPaginaHistorial(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstadoCompra === 'Completada'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-transparent text-gray-400 border-slate-200 hover:text-gray-800 hover:bg-slate-50'
                }`}
              >
                Completadas
              </button>
              <button
                onClick={() => { setFiltroEstadoCompra('Cancelada'); setPaginaHistorial(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  filtroEstadoCompra === 'Cancelada'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-transparent text-gray-400 border-slate-200 hover:text-gray-800 hover:bg-slate-50'
                }`}
              >
                Canceladas
              </button>
            </div>
          </div>

          {/* Tabla / Tarjetas de Compras */}
          {cargandoCompras ? (
            <div className="text-center py-16 text-gray-400 font-medium">
              Cargando historial de compras...
            </div>
          ) : comprasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-2xl text-gray-400">
              No se encontraron registros de reabastecimiento.
            </div>
          ) : (
            <>
              {/* Tabla de Escritorio */}
              <div className="hidden md:block overflow-hidden bg-white border border-slate-200 rounded-xl">
                <table className="min-w-full text-sm text-left text-gray-700">
                  <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Proveedor</th>
                      <th className="px-6 py-4">Código Referencia</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comprasPaginadas.map((compra) => (
                      <tr key={compra.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          {new Date(compra.fecha_compra).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {compra.proveedor_nombre || 'Proveedor Genérico'}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-400 text-xs">
                          {compra.codigo_referencia || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          Bs. {parseFloat(compra.total).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                            compra.estado_compra === 'Completada'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {compra.estado_compra}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleVerDetalles(compra.id)}
                              className="p-1.5 hover:bg-slate-100 text-purple-600 hover:text-purple-700 rounded-lg transition-colors border border-transparent"
                              title="Ver Detalles"
                            >
                              <Eye size={16} />
                            </button>
                            {compra.estado_compra === 'Completada' && esAdmin && (
                              <button
                                onClick={() => handleAbrirAnular(compra.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-750 rounded-lg transition-colors border border-transparent"
                                title="Anular Compra"
                              >
                                <RotateCcw size={16} />
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
                    className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">
                          {compra.proveedor_nombre || 'Proveedor Genérico'}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Ref: {compra.codigo_referencia || '—'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        compra.estado_compra === 'Completada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {compra.estado_compra}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2.5">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Fecha:</span>
                        <p className="text-gray-700 font-medium mt-0.5">
                          {new Date(compra.fecha_compra).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Total:</span>
                        <p className="text-gray-900 font-bold text-xs mt-0.5">
                          Bs. {parseFloat(compra.total).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleVerDetalles(compra.id)}
                        className="flex-1 flex justify-center items-center gap-1.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 text-purple-650 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Eye size={13} />
                        <span>Ver Detalle</span>
                      </button>
                      {compra.estado_compra === 'Completada' && esAdmin && (
                        <button
                          onClick={() => handleAbrirAnular(compra.id)}
                          className="flex-1 flex justify-center items-center gap-1.5 py-1.5 text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <RotateCcw size={13} />
                          <span>Anular</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginador */}
              <PaginadorTablas
                totalItems={comprasFiltradas.length}
                itemsPorPagina={itemsPorPaginaHistorial}
                paginaActual={paginaHistorial}
                alCambiarPagina={setPaginaHistorial}
              />
            </>
          )}
        </div>
      )}

      {/* ── MODAL FORMULARIO PRODUCTO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '520px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)' }} />

            <div className="modal-header">
              <span className="modal-title">
                {productoEdit ? '✏️ Editar Producto' : '📦 Registrar Nuevo Producto'}
              </span>
              <button
                onClick={() => setMostrarForm(false)}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleGuardar}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Nombre Producto *</label>
                    <input
                      type="text" required value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Fanta Naranja 3L"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Categoría *</label>
                    <select
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className="form-input"
                    >
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Código Barras (Opcional)</label>
                    <input
                      type="text" value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="Autogenerado si vacío"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Descripción</label>
                    <input
                      type="text" value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Ej: Botella de 3 litros no retornable"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Precio Compra Base *</label>
                    <input
                      type="number" step="0.01" required value={precioCompra}
                      onChange={(e) => setPrecioCompra(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Precio Venta POS *</label>
                    <input
                      type="number" step="0.01" required value={precioVenta}
                      onChange={(e) => setPrecioVenta(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Stock Inicial *</label>
                    <input
                      type="number" required value={stockActual}
                      onChange={(e) => setStockActual(e.target.value)}
                      disabled={productoEdit !== null}
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Stock Mínimo Alerta *</label>
                    <input
                      type="number" required value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={procesandoForm} className="btn-primary">
                  {procesandoForm ? 'Guardando...' : productoEdit ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL REABASTECIMIENTO DE STOCK ── */}
      {mostrarReabastecer && productoReabastecer && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '420px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #059669, #10b981)' }} />

            <div className="modal-header">
              <span className="modal-title">📈 Reabastecer Stock de Producto</span>
              <button
                onClick={() => setMostrarReabastecer(false)}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleReabastecer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                  borderRadius: '12px',
                  border: '1px solid #a7f3d0',
                  boxShadow: 'inset 0 1px 2px rgba(4,120,87,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <p style={{ fontSize: '0.62rem', color: '#047857', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Producto a Reabastecer
                  </p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#064e3b', margin: 0, lineHeight: 1.25 }}>
                    {productoReabastecer.nombre}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', fontSize: '0.72rem', color: '#065f46' }}>
                    <span>Stock actual: <strong style={{ color: '#047857' }}>{productoReabastecer.stock_actual} uds</strong></span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span>Precio Venta: <strong style={{ color: '#047857' }}>Bs. {productoReabastecer.precio_venta.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Nombre del Proveedor *</label>
                  <input
                    type="text"
                    required
                    value={reabastecerProveedor}
                    onChange={(e) => setReabastecerProveedor(e.target.value)}
                    placeholder="Ej: Distribuidora Arcor"
                    className="form-input"
                    style={{ fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Cantidad a Ingresar *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        required
                        min="1"
                        value={reabastecerCantidad}
                        onChange={(e) => setReabastecerCantidad(e.target.value)}
                        placeholder="Ej: 50"
                        className="form-input"
                        style={{ fontSize: '0.8rem', paddingRight: '45px' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', pointerEvents: 'none' }}>
                        uds
                      </span>
                    </div>
                  </div>

                  <div style={fieldStyle}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Costo Compra Unit. *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={reabastecerCosto}
                        onChange={(e) => setReabastecerCosto(e.target.value)}
                        placeholder="0.00"
                        className="form-input"
                        style={{ fontSize: '0.8rem', paddingRight: '35px' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', pointerEvents: 'none' }}>
                        Bs.
                      </span>
                    </div>
                  </div>
                </div>

                {costoExcedePrecioVenta && (
                  <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-3 text-amber-200 text-xs flex gap-2">
                    <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">¡Advertencia de Costo!</p>
                      <p className="mt-0.5">El costo de compra (Bs. {parseFloat(reabastecerCosto).toFixed(2)}) supera el precio de venta (Bs. {parseFloat(productoReabastecer.precio_venta).toFixed(2)}). El backend rechazará la transacción.</p>
                    </div>
                  </div>
                )}

                <div style={fieldStyle}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Código de Referencia / Nota (Opcional)</label>
                  <input
                    type="text"
                    value={reabastecerReferencia}
                    onChange={(e) => setReabastecerReferencia(e.target.value)}
                    placeholder="Ej: Factura 4567, Nota de entrega..."
                    className="form-input"
                    style={{ fontSize: '0.8rem' }}
                  />
                </div>

                {reabastecerCantidad && reabastecerCosto && (
                  <div style={{
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem'
                  }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Total Inversión Estimada:</span>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Bs. {(parseInt(reabastecerCantidad) * parseFloat(reabastecerCosto) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '10px' }}>
                <button type="button" onClick={() => setMostrarReabastecer(false)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoReabastecer}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    borderColor: '#059669',
                    fontSize: '0.78rem',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.2)'
                  }}
                >
                  {procesandoReabastecer ? 'Registrando...' : 'Confirmar Reabastecimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMACIÓN ELIMINAR ── */}
      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Inactivar Producto"
        mensaje="¿Está seguro de desactivar este producto? Dejará de aparecer en la rejilla de ventas del POS de forma inmediata."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />

      {/* ── MODAL: VER DETALLES DE COMPRA ── */}
      {mostrarModalDetalle && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '640px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)' }} />
            
            <div className="modal-header">
              <span className="modal-title">📄 Detalle de Reabastecimiento</span>
              <button
                onClick={() => { setMostrarModalDetalle(false); setCompraSeleccionada(null); }}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                  transition: 'all 0.15s',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {cargandoDetalle || !compraSeleccionada ? (
              <div className="modal-body text-center py-8 text-gray-400">
                Cargando desglose de la compra...
              </div>
            ) : (
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Proveedor</span>
                    <p className="text-gray-900 font-semibold mt-0.5">
                      {compraSeleccionada.proveedor_nombre || 'Proveedor Genérico'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Referencia</span>
                    <p className="text-gray-800 font-mono text-xs mt-0.5">
                      {compraSeleccionada.codigo_referencia || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Estado</span>
                    <div className="mt-0.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        compraSeleccionada.estado_compra === 'Completada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {compraSeleccionada.estado_compra}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Fecha</span>
                    <p className="text-gray-700 mt-0.5">
                      {new Date(compraSeleccionada.fecha_compra).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Usuario ID</span>
                    <p className="text-gray-700 mt-0.5 truncate" title={compraSeleccionada.usuario_id}>
                      {compraSeleccionada.usuario_id}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Importe Total</span>
                    <p className="text-purple-700 font-black text-sm mt-0.5">
                      Bs. {parseFloat(compraSeleccionada.total).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Productos Adquiridos
                  </h4>
                  <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                    <table className="min-w-full text-xs text-left text-gray-700">
                      <thead className="bg-slate-50 text-gray-500 uppercase text-[9px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Producto</th>
                          <th className="px-4 py-2.5 text-center">Cantidad</th>
                          <th className="px-4 py-2.5 text-right">Costo Unit.</th>
                          <th className="px-4 py-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {compraSeleccionada.detalles?.map((det) => (
                          <tr key={det.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {det.producto_nombre || 'Producto No Identificado'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">{det.cantidad} uds</td>
                            <td className="px-4 py-3 text-right text-gray-600">Bs. {parseFloat(det.costo_unitario).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
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

            <div className="modal-footer">
              {compraSeleccionada?.estado_compra === 'Completada' && esAdmin && (
                <button
                  onClick={() => {
                    setMostrarModalDetalle(false);
                    handleAbrirAnular(compraSeleccionada.id);
                  }}
                  className="btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Anular Compra
                </button>
              )}
              <button
                onClick={() => { setMostrarModalDetalle(false); setCompraSeleccionada(null); }}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMACIÓN ANULACIÓN DE COMPRA ── */}
      {mostrarModalAnular && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '420px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #f87171)' }} />
            
            <div className="modal-header">
              <span className="modal-title" style={{ color: '#991b1b' }}>⚠ Anular Reabastecimiento</span>
              <button
                onClick={() => { setMostrarModalAnular(false); setCompraAnularId(null); }}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="modal-body text-sm space-y-3 text-gray-700">
              <p>¿Está seguro de que desea anular esta compra de inventario? Esta acción es <strong>irreversible</strong>.</p>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <p className="font-bold">Efectos en Inventario:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>El estado de la compra cambiará a 'Cancelada'.</li>
                  <li>Se restarán del stock de catálogo las cantidades compradas.</li>
                  <li>Si el stock actual es menor a las unidades a restar, la operación fallará para evitar stock negativo.</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => { setMostrarModalAnular(false); setCompraAnularId(null); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAnular}
                disabled={procesandoAnular}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #f87171)',
                  borderColor: '#dc2626',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.2)'
                }}
              >
                {procesandoAnular ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionProductos;
