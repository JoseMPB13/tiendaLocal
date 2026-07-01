/**
 * Vista: GestionCategorias.jsx
 * Módulo de gestión de categorías del inventario de Tienda Margarita.
 * Diseño premium con tabla, formulario modal y confirmación de baja lógica.
 */

import { useState, useEffect } from 'react';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Plus, Edit3, Trash2, X, Tag, DollarSign, BarChart2,
  Wine, Cookie, Sparkles, Apple, Folder, Wrench, Smartphone, Gamepad, Shirt, Heart
} from 'lucide-react';

/* ── Mapeo de Iconos según Nombre de Categoría ───────────────────────────── */
const MAPEO_PALABRAS_CLAVE = [
  {
    palabras: ['bebida', 'jugo', 'gaseosa', 'liquido', 'agua', 'refresco', 'soda', 'coca', 'fanta', 'sprite', 'alcohol', 'cerveza', 'vino', 'trago', 'leche', 'lacteo', 'yogurt'],
    icono: Wine,
    color: 'text-blue-600 bg-blue-50 border-blue-150'
  },
  {
    palabras: ['snack', 'papas', 'galleta', 'pipoca', 'dulce', 'chocolate', 'caramelo', 'piqueo', 'chicle', 'gominola', 'confite', 'helado', 'postre', 'dona'],
    icono: Cookie,
    color: 'text-amber-600 bg-amber-50 border-amber-150'
  },
  {
    palabras: ['limpieza', 'aseo', 'detergente', 'jabon', 'desinfectante', 'hogar', 'cepillo', 'higien', 'shampoo', 'champu', 'crema', 'desodorante', 'dental', 'baño', 'lavado'],
    icono: Sparkles,
    color: 'text-teal-600 bg-teal-50 border-teal-150'
  },
  {
    palabras: ['abarrotes', 'arroz', 'fideos', 'harina', 'comida', 'aceite', 'granos', 'pasta', 'alimento', 'pan', 'panaderia', 'pasteleria', 'torta', 'pastel', 'queque'],
    icono: Apple,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-150'
  },
  {
    palabras: ['fruta', 'verdura', 'vegetal', 'manzana', 'platano', 'banana', 'tomate', 'papa', 'cebolla', 'lechuga', 'zanahoria', 'planta', 'semilla', 'fresa', 'uva', 'naranja'],
    icono: Apple,
    color: 'text-green-600 bg-green-50 border-green-150'
  },
  {
    palabras: ['ferreteria', 'herramienta', 'tornillo', 'clavo', 'pintura', 'cable', 'foco', 'construccion', 'martillo', 'tuber', 'llave', 'alambre'],
    icono: Wrench,
    color: 'text-orange-600 bg-orange-50 border-orange-150'
  },
  {
    palabras: ['tecnologia', 'electronica', 'celular', 'telefono', 'cargador', 'computadora', 'mouse', 'teclado', 'pantalla', 'audifonos', 'parlante', 'tablet'],
    icono: Smartphone,
    color: 'text-purple-600 bg-purple-50 border-purple-150'
  },
  {
    palabras: ['juguete', 'niño', 'muñeca', 'pelota', 'deporte', 'juego', 'gamer', 'consola', 'recreo', 'peluche', 'lego'],
    icono: Gamepad,
    color: 'text-rose-600 bg-rose-50 border-rose-150'
  },
  {
    palabras: ['ropa', 'vestimenta', 'textil', 'polera', 'pantalon', 'camisa', 'zapato', 'calzado', 'abrigo', 'prenda', 'media', 'gorra'],
    icono: Shirt,
    color: 'text-sky-600 bg-sky-50 border-sky-150'
  },
  {
    palabras: ['medicamento', 'pastilla', 'jarabe', 'salud', 'farmacia', 'remedio', 'botiquin', 'medicina', 'dolor', 'venda', 'gasa', 'vitamina'],
    icono: Heart,
    color: 'text-red-600 bg-red-50 border-red-150'
  }
];

const obtenerIconoCategoria = (nombre) => {
  if (!nombre) return { Component: Folder, colorClasses: 'text-zinc-500 bg-zinc-50 border-zinc-150' };
  
  const nombreNormalizado = nombre.toLowerCase().trim();
  
  // Buscar coincidencia de palabra clave
  for (const item of MAPEO_PALABRAS_CLAVE) {
    if (item.palabras.some(palabra => nombreNormalizado.includes(palabra))) {
      return { Component: item.icono, colorClasses: item.color };
    }
  }
  
  // Icono por defecto elegante
  return { Component: Tag, colorClasses: 'text-indigo-600 bg-indigo-50 border-indigo-150' };
};

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [metricas, setMetricas] = useState(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(true);

  // Estados de paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Filtros de búsqueda y estado
  const [buscarTexto, setBuscarTexto] = useState('');
  const [estadoSel, setEstadoSel] = useState('');

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
    (async () => {
      await Promise.all([cargarCategorias(), cargarMetricas()]);
    })();
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

  const categoriasFiltradas = categorias.filter((cat) => {
    const coincideTexto =
      cat.nombre.toLowerCase().includes(buscarTexto.toLowerCase()) ||
      (cat.descripcion && cat.descripcion.toLowerCase().includes(buscarTexto.toLowerCase()));

    const coincideEstado =
      !estadoSel || cat.estado === estadoSel;

    return coincideTexto && coincideEstado;
  });

  const totalPaginas = Math.ceil(categoriasFiltradas.length / itemsPorPagina) || 1;
  const paginaEfectiva = Math.min(pagina, totalPaginas);
  const indexInicio = (paginaEfectiva - 1) * itemsPorPagina;
  const categoriasPaginadas = categoriasFiltradas.slice(indexInicio, indexInicio + itemsPorPagina);

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
      {/* ── PANEL DE BÚSQUEDA Y FILTRADO ── */}
      <PanelFiltroBusqueda
        buscarTexto={buscarTexto}
        alCambiarBuscarTexto={setBuscarTexto}
        estadoSeleccionado={estadoSel}
        alCambiarEstado={setEstadoSel}
        placeholder="Buscar categorías por nombre o descripción..."
      />

      <div className="table-wrapper">
        {/* Vista para Escritorio */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
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
                {categoriasPaginadas.map((cat) => {
                  const { Component: IconoComp, colorClasses } = obtenerIconoCategoria(cat.nombre);
                  return (
                    <tr key={cat.id}>
                      <td className="bold">
                        <div className="flex items-center">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg border mr-2.5 shrink-0 ${colorClasses}`}>
                            <IconoComp size={15} />
                          </div>
                          <span>{cat.nombre}</span>
                        </div>
                      </td>
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
                  ); })}
              </tbody>
            )}
          </table>
        </div>

        {/* Vista para Móviles (Cards responsivos Mobile-First) */}
        {!cargando && categorias.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {categoriasPaginadas.map((cat) => {
              const { Component: IconoComp, colorClasses } = obtenerIconoCategoria(cat.nombre);
              return (
                <div key={cat.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs hover:border-amber-250 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 ${colorClasses}`}>
                        <IconoComp size={15} />
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{cat.nombre}</h4>
                    </div>
                    <span className={`badge ${cat.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                      {cat.estado}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">
                    {cat.descripcion || 'Sin descripción'}
                  </p>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => abrirEditar(cat)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-gray-700 rounded-xl transition-colors"
                      title="Editar categoría"
                    >
                      <Edit3 size={14} />
                      <span>Editar</span>
                    </button>
                    {cat.estado === 'Activo' && (
                      <button
                        onClick={() => abrirDesactivar(cat.id)}
                        className="flex justify-center items-center p-2 text-rose-650 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition-colors"
                        title="Desactivar categoría"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginadorTablas
          totalItems={categoriasFiltradas.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={paginaEfectiva}
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0">Nombre Categoría *</label>
                    {nombre.trim() && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-semibold select-none bg-slate-50 border-slate-150">
                        <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Ícono asignado:</span>
                        {(() => {
                          const { Component, colorClasses } = obtenerIconoCategoria(nombre);
                          return (
                            <div className={`flex items-center gap-1 p-0.5 px-1.5 rounded-md border text-[10px] font-bold ${colorClasses}`}>
                              <Component size={12} className="mr-0.5" />
                              <span>{nombre}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
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
