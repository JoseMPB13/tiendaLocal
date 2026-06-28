/**
 * Vista: GestionCategorias.jsx
 * Módulo de gestión de categorías del inventario de Tienda Margarita.
 * Diseño premium con tabla, formulario modal y confirmación de baja lógica.
 */

import { useState, useEffect } from 'react';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Tag, DollarSign, BarChart2 } from 'lucide-react';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [metricas, setMetricas] = useState(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(true);

  // Estados de paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Estados del modal de formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [categoriaEdit, setCategoriaEdit] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Estados del modal de baja lógica
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [categoriaEliminarId, setCategoriaEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarCategorias = async (mostrarLoading = false) => {
    try {
      if (mostrarLoading) setCargando(true);
      const res = await categoriaService.obtenerTodas(true);
      if (res.ok) {
        setCategorias(res.data);
      }
    } catch (ex) {
      console.error(ex);
      toast.error('Error al cargar las categorías.');
    } finally {
      setCargando(false);
    }
  };

  const cargarMetricas = async (mostrarLoading = false) => {
    try {
      if (mostrarLoading) setCargandoMetricas(true);
      const res = await categoriaService.obtenerMetricas();
      if (res.ok) {
        setMetricas(res.data);
      }
    } catch (ex) {
      console.error('Error al cargar métricas de categorías:', ex);
    } finally {
      setCargandoMetricas(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
    cargarMetricas();
  }, []);

  const abrirCrear = () => {
    setCategoriaEdit(null);
    setNombre('');
    setDescripcion('');
    setMostrarForm(true);
  };

  const abrirEditar = (cat) => {
    setCategoriaEdit(cat);
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || '');
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setProcesandoForm(true);
    try {
      if (categoriaEdit) {
        const res = await categoriaService.actualizar(categoriaEdit.id, { nombre, descripcion });
        if (res.ok) {
          toast.success('Categoría actualizada correctamente.');
          setMostrarForm(false);
          cargarCategorias();
          cargarMetricas();
        }
      } else {
        const res = await categoriaService.crear({ nombre, descripcion });
        if (res.ok) {
          toast.success('Categoría creada con éxito.');
          setMostrarForm(false);
          cargarCategorias();
          cargarMetricas();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al procesar el formulario.';
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setCategoriaEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      const res = await categoriaService.eliminar(categoriaEliminarId);
      if (res.ok) {
        toast.success('Categoría desactivada (baja lógica).');
        setMostrarEliminar(false);
        cargarCategorias();
        cargarMetricas();
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo desactivar la categoría.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const categoriasPaginadas = categorias.slice(indexInicio, indexInicio + itemsPorPagina);

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
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Categorías del Inventario</h3>
            <p className="page-subtitle">Clasificación de productos y control de stock</p>
          </div>
        </div>
        <button onClick={abrirCrear} className="btn-primary">
          <Plus size={15} />
          Nueva Categoría
        </button>
      </div>

      {/* ── CARD METRICAS EJECUTIVAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
        {/* Tarjeta 1: Categorías Activas */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Tag size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categorías Activas</p>
            <h4 className="text-2xl font-black text-zinc-950 mt-1">
              {cargandoMetricas ? '...' : metricas?.total_categorias_activas || 0}
            </h4>
          </div>
        </div>

        {/* Tarjeta 2: Categoría Dominante */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <BarChart2 size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoría Dominante</p>
            <h4 className="text-sm font-black text-zinc-950 truncate mt-1">
              {cargandoMetricas ? '...' : metricas?.categoria_dominante?.nombre || 'Ninguna'}
            </h4>
            <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
              {cargandoMetricas ? '...' : `${metricas?.categoria_dominante?.total_stock || 0} uds acumuladas`}
            </p>
          </div>
        </div>

        {/* Tarjeta 3: Valorización Económica */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valorización de Inventario</p>
            <h4 className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              Bs. {cargandoMetricas ? '...' : parseFloat(metricas?.valorizacion_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>
      <div className="table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontWeight: 500 }}>
                    Cargando categorías de inventario...
                  </td>
                </tr>
              </tbody>
            ) : categorias.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No se registran categorías de productos.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {categoriasPaginadas.map((cat) => (
                  <tr key={cat.id}>
                    <td className="bold">{cat.nombre}</td>
                    <td style={{ color: '#6b7280' }}>{cat.descripcion || '—'}</td>
                    <td>
                      <span className={`badge ${cat.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                        {cat.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button onClick={() => abrirEditar(cat)} className="btn-icon" title="Editar categoría">
                          <Edit3 size={15} />
                        </button>
                        {cat.estado === 'Activo' && (
                          <button onClick={() => abrirDesactivar(cat.id)} className="btn-icon danger" title="Desactivar categoría">
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
          totalItems={categorias.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* ── MODAL FORMULARIO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '440px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />

            <div className="modal-header">
              <span className="modal-title">
                {categoriaEdit ? '✏️ Editar Categoría' : '🏷️ Nueva Categoría'}
              </span>
              <button
                onClick={() => setMostrarForm(false)}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleGuardar}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={fieldStyle}>
                  <label className="form-label">Nombre Categoría *</label>
                  <input
                    type="text" required value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Gaseosas"
                    className="form-input"
                  />
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Descripción (Opcional)</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Detalles opcionales sobre esta categoría..."
                    rows="3"
                    className="form-input"
                    style={{ resize: 'vertical', lineHeight: '1.5' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={procesandoForm} className="btn-primary">
                  {procesandoForm ? 'Guardando...' : categoriaEdit ? 'Actualizar Categoría' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Inactivar Categoría"
        mensaje="¿Está seguro de desactivar esta categoría? Todos los productos asociados seguirán existiendo, pero no podrá crear nuevos productos en ella hasta reactivarla."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionCategorias;
