/**
 * Vista: GestionProductos.jsx
 * Módulo de gestión completa del catálogo de productos de Tienda Margarita.
 * Incluye tabla paginada, formulario modal premium y baja lógica con confirmación.
 */

import { useState, useEffect, useRef } from 'react';
import productoService from '../services/productoService';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import useAuthStore from '../store/authStore';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Package, AlertTriangle } from 'lucide-react';

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

  // Patrón correcto para reset de página sin useEffect:
  // Comparamos el filtroKey anterior en tiempo de render con useRef.
  const filtroKey = buscarTexto + '|' + categoriaSel;
  const filtroKeyRef = useRef(filtroKey);
  if (filtroKeyRef.current !== filtroKey) {
    filtroKeyRef.current = filtroKey;
    if (pagina !== 1) setPagina(1);
  }

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
          <button onClick={abrirCrear} className="btn-primary">
            <Plus size={15} />
            Registrar Producto
          </button>
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
                              onClick={() => abrirAjustarStock(prod)}
                              className="btn-icon"
                              style={{ color: '#6366f1' }}
                              title="Ajustar stock manual"
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
