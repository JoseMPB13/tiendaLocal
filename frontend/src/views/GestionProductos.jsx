/**
 * Vista: GestionProductos.jsx
 * Módulo de gestión completa del catálogo de productos de Tienda Margarita.
 * Incluye tabla paginada, formulario modal premium y baja lógica con confirmación.
 */

import { useState, useEffect } from 'react';
import productoService from '../services/productoService';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import useAuthStore from '../store/authStore';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Package, AlertTriangle, Layers, FileText } from 'lucide-react';
import clienteApi from '../services/api';
import reportesService from '../services/reportesService';
import { obtenerFechaBoliviaHoy } from '../utils/fechaBolivia';


/* ── Funciones de ayuda ── */
const obtenerUrlImagenCompleta = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseURL = clienteApi.defaults.baseURL || 'http://localhost:8000';
  return `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
};

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
  const [imagenUrl, setImagenUrl] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [productoEliminarId, setProductoEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  // Modal de Ajuste de Stock
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [productoAjuste, setProductoAjuste] = useState(null);
  const [ajusteCantidad, setAjusteCantidad] = useState('');
  const [ajusteJustificacion, setAjusteJustificacion] = useState('');
  const [procesandoAjuste, setProcesandoAjuste] = useState(false);

  // Rol de usuario
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'Administrador'; // eslint-disable-line no-unused-vars
  const tabActiva = 'catalogo';

  const handleDescargarReporteProductos = async () => {
    try {
      const loadToast = toast.loading('Generando reporte PDF de inventario...');
      const blob = await reportesService.descargarPdfProductos();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_inventario_${obtenerFechaBoliviaHoy()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Reporte de inventario descargado con éxito.', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el reporte de inventario.');
    }
  };


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
    setImagenUrl('');
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
    setImagenUrl(prod.imagen_url || '');
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
      stock_minimo: parseInt(stockMinimo),
      imagen_url: imagenUrl || null
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

  const abrirAjustarStock = (prod) => {
    setProductoAjuste(prod);
    setAjusteCantidad('');
    setAjusteJustificacion('');
    setMostrarAjuste(true);
  };

  const handleAjustarStock = async (e) => {
    e.preventDefault();
    const cant = parseInt(ajusteCantidad);
    if (isNaN(cant) || cant === 0) {
      toast.error('La cantidad del ajuste no puede ser cero ni vacía.');
      return;
    }
    if (!ajusteJustificacion.trim()) {
      toast.error('Debe ingresar o seleccionar una justificación para el ajuste.');
      return;
    }
    if (productoAjuste.stock_actual + cant < 0) {
      toast.error('No se puede realizar el ajuste. El stock resultante no puede ser menor a cero.');
      return;
    }

    setProcesandoAjuste(true);
    try {
      const res = await productoService.ajustarStock(productoAjuste.id, {
        cantidad: cant,
        justificacion: ajusteJustificacion.trim()
      });
      if (res.ok) {
        toast.success('✓ Ajuste de stock registrado exitosamente.');
        setMostrarAjuste(false);
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al ajustar el stock del producto.';
      toast.error(errorMsg);
    } finally {
      setProcesandoAjuste(false);
    }
  };

  const handleSubirArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const loadingToast = toast.loading('Subiendo imagen...');
    try {
      const res = await productoService.subirImagen(formData);
      if (res.ok && res.imagen_url) {
        setImagenUrl(res.imagen_url);
        toast.success('¡Imagen subida con éxito!', { id: loadingToast });
      } else {
        toast.error('Error al subir la imagen.', { id: loadingToast });
      }
    } catch (ex) {
      console.error(ex);
      const errMsg = ex.response?.data?.detail || 'Error al conectar con el servidor.';
      toast.error(errMsg, { id: loadingToast });
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

  // Pagina efectiva: se clampea al rango válido cuando los filtros reducen los resultados
  const totalPaginasProductos = Math.ceil(productosFiltrados.length / itemsPorPagina) || 1;
  const paginaEfectiva = Math.min(pagina, totalPaginasProductos);
  const indexInicio = (paginaEfectiva - 1) * itemsPorPagina;
  const productosPaginados = productosFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  // Cálculos del Mini-Dashboard de Inventario en tiempo real (en español)
  const stockBajoCount = productos.filter(p => p.estado === 'Activo' && p.stock_actual <= p.stock_minimo).length;
  
  const valorTotalInventario = productos
    .filter(p => p.estado === 'Activo')
    .reduce((acc, p) => acc + (p.stock_actual * p.precio_compra), 0);

  // Conteo total absoluto de productos activos
  const productosTotalesCount = productos.filter(p => p.estado === 'Activo').length;

  // Variedad de categorías distintas con productos activos
  const variedadCategoriasCount = new Set(productos.filter(p => p.estado === 'Activo' && p.categoria_id).map(p => p.categoria_id)).size;

  // Validación de costo no requerida para Ajustes de Inventario

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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleDescargarReporteProductos}
              className="btn-primary"
            >
              <FileText size={15} />
              Reporte Inventario PDF
            </button>
            <button onClick={abrirCrear} className="btn-primary">
              <Plus size={15} />
              Registrar Producto
            </button>
          </div>
        )}
      </div>

      {/* ── SECTOR DE PESTAÑAS (Removido por desmantelamiento de compras) ── */}

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

          {/* Tarjeta 3: Productos Totales */}
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
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Productos Totales</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{productosTotalesCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>prods</span></span>
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
              <Layers size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Variedad Catálogo</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{variedadCategoriasCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>cats</span></span>
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
          {/* Vista para pantallas grandes (Tabla estructurada y alineada) */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs font-medium text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Miniatura</th>
                  <th className="text-left px-4 py-3">Código Barras</th>
                  <th className="text-left px-4 py-3">Nombre del Producto</th>
                  <th className="text-right px-4 py-3">Precio Venta</th>
                  <th className="text-right px-4 py-3">Stock</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3">Acciones</th>
                </tr>
              </thead>

              {cargando ? (
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-slate-400 font-medium">
                      Cargando catálogo de productos...
                    </td>
                  </tr>
                </tbody>
              ) : productosPaginados.length === 0 ? (
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-slate-400 font-medium">
                      No se registran productos en el catálogo.
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100 bg-white">
                  {productosPaginados.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="text-left px-4 py-3 whitespace-nowrap">
                        {prod.imagen_url ? (
                          <div className="relative w-8 h-8 group overflow-visible">
                            <img
                              src={obtenerUrlImagenCompleta(prod.imagen_url)}
                              alt={prod.nombre}
                              className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-xs cursor-zoom-in"
                            />
                            {/* Card flotante de alta resolución con posición fixed para escapar de overflow-hidden */}
                            <div className="fixed ml-10 -mt-16 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50 pointer-events-none transition-all duration-200">
                              <img
                                src={obtenerUrlImagenCompleta(prod.imagen_url)}
                                alt={prod.nombre}
                                className="w-full h-32 object-cover rounded-lg border border-slate-100"
                              />
                              <div className="mt-1.5 px-0.5">
                                <p className="font-bold text-[11px] text-slate-800 leading-tight truncate">{prod.nombre}</p>
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{prod.codigo_barras || 'Sin código'}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400" title="Sin imagen">
                            <Package size={14} />
                          </div>
                        )}
                      </td>
                      <td className="text-left px-4 py-3 font-mono text-xs text-slate-500">
                        {prod.codigo_barras || '—'}
                      </td>
                      <td className="text-left px-4 py-3 font-bold text-slate-800">
                        {prod.nombre}
                      </td>
                      <td className="text-right px-4 py-3 font-extrabold text-slate-900">
                        Bs. {prod.precio_venta.toFixed(2)}
                      </td>
                      <td className={`text-right px-4 py-3 font-semibold ${prod.stock_actual <= prod.stock_minimo ? 'text-red-600' : 'text-slate-700'}`}>
                        {prod.stock_actual} uds
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className={`badge ${prod.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                          {prod.estado}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {prod.estado === 'Activo' && (
                            <button
                              onClick={() => abrirAjustarStock(prod)}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                              title="Ajustar stock manual"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => abrirEditar(prod)}
                            className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                            title="Editar producto"
                          >
                            <Edit3 size={14} />
                          </button>
                          {prod.estado === 'Activo' && (
                            <button
                              onClick={() => abrirDesactivar(prod.id)}
                              className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                              title="Desactivar producto"
                            >
                              <Trash2 size={14} />
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

          {/* Vista para pantallas móviles (Tarjetas independientes responsivas) */}
          <div className="block lg:hidden space-y-3">
            {cargando ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium">
                Cargando catálogo de productos...
              </div>
            ) : productosPaginados.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium">
                No se registran productos en el catálogo.
              </div>
            ) : (
              productosPaginados.map((prod) => (
                <div key={prod.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 leading-tight">
                        {prod.nombre}
                      </h4>
                      {prod.descripcion && (
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${prod.estado === 'Activo' ? 'badge-success' : 'badge-danger'} shrink-0`}>
                      {prod.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2 font-medium text-slate-600">
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase block font-bold">Código Barras</span>
                      <span className="font-mono text-slate-700">{prod.codigo_barras || '—'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 uppercase block font-bold">Precio Venta</span>
                      <span className="font-extrabold text-slate-900">Bs. {prod.precio_venta.toFixed(2)}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-[8px] text-slate-400 uppercase block font-bold">Stock Mínimo</span>
                      <span className="text-slate-700">{prod.stock_minimo} uds</span>
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-[8px] text-slate-400 uppercase block font-bold">Stock Disponible</span>
                      <span className={`font-bold ${prod.stock_actual <= prod.stock_minimo ? 'text-red-600' : 'text-emerald-600'}`}>
                        {prod.stock_actual} uds
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 border-t border-slate-50 pt-2">
                    {prod.estado === 'Activo' && (
                      <button
                        onClick={() => abrirAjustarStock(prod)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Stock
                      </button>
                    )}
                    <button
                      onClick={() => abrirEditar(prod)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} /> Editar
                    </button>
                    {prod.estado === 'Activo' && (
                      <button
                        onClick={() => abrirDesactivar(prod.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Desactivar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <PaginadorTablas
            totalItems={productosFiltrados.length}
            itemsPorPagina={itemsPorPagina}
            paginaActual={paginaEfectiva}
            alCambiarPagina={setPagina}
          />
        </>
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

                {/* Campo para la imagen del producto (Subir archivo o pegar enlace) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Imagen del Producto (Archivo u URL)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={imagenUrl}
                        onChange={(e) => setImagenUrl(e.target.value)}
                        placeholder="Ingresa enlace URL o sube un archivo..."
                        className="form-input flex-1"
                      />
                      <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg font-bold text-xs cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5 transition-all duration-150 shadow-xs">
                        <Plus size={14} />
                        Sube Archivo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSubirArchivo}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {imagenUrl && (
                      <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                        <img
                          src={obtenerUrlImagenCompleta(imagenUrl)}
                          alt="Vista previa"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-350"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] text-slate-400 block uppercase font-bold font-mono">Vista Previa</span>
                          <span className="text-[11px] text-slate-600 truncate block font-medium font-mono">{imagenUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setImagenUrl('')}
                          className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition duration-150 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
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


      {/* ── MODAL AJUSTAR STOCK MANUAL ── */}
      {mostrarAjuste && productoAjuste && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '420px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #6366f1, #4f46e5)' }} />

            <div className="modal-header">
              <span className="modal-title">🔧 Ajustar Stock Manual</span>
              <button
                onClick={() => setMostrarAjuste(false)}
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

            <form onSubmit={handleAjustarStock}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #e0e7ff, #eef2ff)',
                  borderRadius: '12px',
                  border: '1px solid #c7d2fe',
                  boxShadow: 'inset 0 1px 2px rgba(79,70,229,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <p style={{ fontSize: '0.62rem', color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Producto a Ajustar
                  </p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#312e81', margin: 0, lineHeight: 1.25 }}>
                    {productoAjuste.nombre}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', fontSize: '0.72rem', color: '#3730a3' }}>
                    <span>Stock actual: <strong style={{ color: '#4f46e5' }}>{productoAjuste.stock_actual} uds</strong></span>
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Cantidad del Ajuste *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      required
                      value={ajusteCantidad}
                      onChange={(e) => setAjusteCantidad(e.target.value)}
                      placeholder="Ej: 10 (ingreso) o -5 (merma)"
                      className="form-input"
                      style={{ fontSize: '0.8rem', paddingRight: '45px' }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', pointerEvents: 'none' }}>
                      uds
                    </span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                    Ingresa un número positivo para añadir stock, o negativo para restar stock (mermas/roturas).
                  </p>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.72rem', color: '#4b5563' }}>Justificación / Motivo del Ajuste *</label>
                  <select
                    value={ajusteJustificacion}
                    onChange={(e) => setAjusteJustificacion(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', height: '38px' }}
                  >
                    <option value="">-- Selecciona una justificación --</option>
                    <option value="Ingreso directo por inventario inicial">Ingreso directo por inventario inicial</option>
                    <option value="Merma por fecha de vencimiento">Merma por fecha de vencimiento</option>
                    <option value="Rotura / daño de empaque">Rotura / daño de empaque</option>
                    <option value="Corrección de conteo físico">Corrección de conteo físico</option>
                    <option value="Pérdida / robo detectado">Pérdida / robo detectado</option>
                    <option value="Otro motivo (especificar abajo)">Otro motivo (especificar abajo)</option>
                  </select>
                  
                  {ajusteJustificacion.startsWith('Otro motivo') && (
                    <input
                      type="text"
                      required
                      onChange={(e) => setAjusteJustificacion('Otro motivo: ' + e.target.value)}
                      placeholder="Escribe el motivo detallado..."
                      className="form-input mt-2"
                      style={{ fontSize: '0.8rem' }}
                    />
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '10px' }}>
                <button type="button" onClick={() => setMostrarAjuste(false)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAjuste}
                  className="btn-primary"
                  style={{ fontSize: '0.78rem', background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                >
                  {procesandoAjuste ? 'Procesando...' : 'Aplicar Ajuste'}
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

    </div>
  );
};

export default GestionProductos;
