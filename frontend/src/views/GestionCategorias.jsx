import React, { useState, useEffect } from 'react';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, AlertCircle } from 'lucide-react';

export const GestionCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados de paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

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

  const cargarCategorias = async () => {
    try {
      setCargando(true);
      const res = await categoriaService.obtenerTodas(true); // Incluir inactivas
      if (res.ok) {
        setCategorias(res.data);
      }
    } catch (ex) {
      toast.error("Error al cargar las categorías.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
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
        // Actualizar
        const res = await categoriaService.actualizar(categoriaEdit.id, { nombre, descripcion });
        if (res.ok) {
          toast.success("Categoría actualizada correctamente.");
          setMostrarForm(false);
          cargarCategorias();
        }
      } else {
        // Crear
        const res = await categoriaService.crear({ nombre, descripcion });
        if (res.ok) {
          toast.success("Categoría creada con éxito.");
          setMostrarForm(false);
          cargarCategorias();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al procesar el formulario.";
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
        toast.success("Categoría desactivada (baja lógica).");
        setMostrarEliminar(false);
        cargarCategorias();
      }
    } catch (ex) {
      toast.error("No se pudo desactivar la categoría.");
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Paginación local de datos
  const indexInicio = (pagina - 1) * itemsPorPagina;
  const categoriasPaginadas = categorias.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CABECERA ACCIÓN */}
      <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Categorías del Inventario</h3>
          <p className="text-xs text-gray-500 mt-0.5">Clasificación de productos y control de stock.</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center py-2 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
        >
          <Plus size={14} className="mr-1" />
          Nueva Categoría
        </button>
      </div>

      {/* TABLA DE CATEGORÍAS */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-premium-dark text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Nombre</th>
                <th className="py-3.5 px-4">Descripción</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500 font-semibold">
                    Cargando catálogo de categorías...
                  </td>
                </tr>
              </tbody>
            ) : categorias.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-400">
                    No se registran categorías de productos.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {categoriasPaginadas.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{cat.nombre}</td>
                    <td className="py-3 px-4 text-gray-500">{cat.descripcion || 'Sin descripción'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                        cat.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {cat.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center flex items-center justify-center space-x-2">
                      <button
                        onClick={() => abrirEditar(cat)}
                        className="p-1 hover:bg-gray-100 rounded text-premium-primary"
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      {cat.estado === 'Activo' && (
                        <button
                          onClick={() => abrirDesactivar(cat.id)}
                          className="p-1 hover:bg-gray-100 rounded text-premium-danger"
                          title="Desactivar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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

      {/* MODAL FORMULARIO DE CATEGORÍAS */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">
                {categoriaEdit ? 'Editar Categoría' : 'Registrar Nueva Categoría'}
              </h3>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="my-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Categoría</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Gaseosas"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalles opcionales..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="py-1.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoForm}
                  className="py-1.5 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {procesandoForm ? 'Guardando...' : 'Guardar Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Inactivar Categoría"
        mensaje="¿Está seguro de desactivar esta categoría? Todos los productos asociados a ella seguirán existiendo, pero no podrá crear nuevos productos en esta categoría hasta reactivarla."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionCategorias;
