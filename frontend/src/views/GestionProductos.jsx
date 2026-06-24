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
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Package } from 'lucide-react';

/* ── Estilos de modal compartidos ── */
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionProductos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

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
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [productoEliminarId, setProductoEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  // Modal de Reabastecimiento
  const [mostrarReabastecer, setMostrarReabastecer] = useState(false);
  const [productoReabastecer, setProductoReabastecer] = useState(null);
  const [reabastecerCantidad, setReabastecerCantidad] = useState('');
  const [reabastecerCosto, setReabastecerCosto] = useState('');
  const [reabastecerReferencia, setReabastecerReferencia] = useState('');
  const [procesandoReabastecer, setProcesandoReabastecer] = useState(false);

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
    setReabastecerCantidad('');
    setReabastecerCosto(prod.precio_compra);
    setReabastecerReferencia('');
    setMostrarReabastecer(true);
  };

  const handleReabastecer = async (e) => {
    e.preventDefault();
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
      toast.error('El costo de compra no puede ser mayor al precio de venta actual. Ajuste el precio de venta primero.');
      return;
    }

    setProcesandoReabastecer(true);
    try {
      const payload = {
        producto_id: productoReabastecer.id,
        cantidad: cant,
        costo_compra: costo,
        codigo_referencia: reabastecerReferencia || null
      };
      const res = await productoService.reabastecer(payload);
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

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const productosPaginados = productos.slice(indexInicio, indexInicio + itemsPorPagina);

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
            <h3 className="page-title">Catálogo de Productos</h3>
            <p className="page-subtitle">Gestión de stock, código de barras y precios de venta</p>
          </div>
        </div>
        <button onClick={abrirCrear} className="btn-primary">
          <Plus size={15} />
          Registrar Producto
        </button>
      </div>

      {/* ── TABLA ── */}
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
          totalItems={productos.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* ── MODAL FORMULARIO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '520px' }}>
            {/* Franja superior */}
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
                {/* Nombre + Categoría */}
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
                      style={{ cursor: 'pointer' }}
                    >
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Código Barras + Descripción */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Código Barras (Opcional)</label>
                    <input
                      type="text" value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="Dejar vacío para autogenerar"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Descripción</label>
                    <input
                      type="text" value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Detalles opcionales..."
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Precios */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Precio Compra (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={precioCompra}
                      onChange={(e) => setPrecioCompra(e.target.value)}
                      placeholder="0.00"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Precio Venta (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={precioVenta}
                      onChange={(e) => setPrecioVenta(e.target.value)}
                      placeholder="0.00"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Stock */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Stock Inicial *</label>
                    <input
                      type="number" required value={stockActual}
                      onChange={(e) => setStockActual(e.target.value)}
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
                {/* Info del producto */}
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

                {/* Fila Cantidad + Costo */}
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

                {/* Código de Referencia */}
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

                {/* Resumen de Inversión Dinámica */}
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
    </div>
  );
};

export default GestionProductos;
