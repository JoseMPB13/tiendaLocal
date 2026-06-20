import React, { useState, useEffect } from 'react';
import productoService from '../services/productoService';
import categoriaService from '../services/categoriaService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X } from 'lucide-react';

export const GestionProductos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [productoEdit, setProductoEdit] = useState(null);
  
  // Campos Formulario
  const [categoriaId, setCategoriaId] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación (Baja lógica)
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [productoEliminarId, setProductoEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resProds, resCats] = await Promise.all([
        productoService.obtenerTodos(true),
        categoriaService.obtenerTodas(false) // Traer solo activas para select
      ]);
      if (resProds.ok) setProductos(resProds.data);
      if (resCats.ok) setCategorias(resCats.data);
    } catch (ex) {
      toast.error("Error al cargar los productos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
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
          toast.success("Producto actualizado correctamente.");
          setMostrarForm(false);
          cargarDatos();
        }
      } else {
        const res = await productoService.crear(payload);
        if (res.ok) {
          toast.success("Producto registrado exitosamente.");
          setMostrarForm(false);
          cargarDatos();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al guardar el producto.";
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
        toast.success("Producto inactivado correctamente (baja lógica).");
        setMostrarEliminar(false);
        cargarDatos();
      }
    } catch (ex) {
      toast.error("No se pudo inactivar el producto.");
    } finally {
      setProcesandoEliminar(false);
    }
  };

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const productosPaginados = productos.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CABECERA ACCIÓN */}
      <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Catálogo de Productos</h3>
          <p className="text-xs text-gray-500 mt-0.5">Gestión de stock, código de barras y precios de venta.</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center py-2 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
        >
          <Plus size={14} className="mr-1" />
          Registrar Producto
        </button>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-premium-dark text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Código Barras</th>
                <th className="py-3.5 px-4">Nombre</th>
                <th className="py-3.5 px-4 text-right">Precio Venta</th>
                <th className="py-3.5 px-4 text-right">Stock</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500 font-semibold">
                    Cargando catálogo de productos...
                  </td>
                </tr>
              </tbody>
            ) : productos.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    No se registran productos en el catálogo.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {productosPaginados.map((prod) => (
                  <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono">{prod.codigo_barras || 'Sin código'}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{prod.nombre}</td>
                    <td className="py-3 px-4 text-right font-semibold">${prod.precio_venta.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold">{prod.stock_actual} uds</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                        prod.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {prod.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center flex items-center justify-center space-x-2">
                      <button
                        onClick={() => abrirEditar(prod)}
                        className="p-1 hover:bg-gray-100 rounded text-premium-primary"
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      {prod.estado === 'Activo' && (
                        <button
                          onClick={() => abrirDesactivar(prod.id)}
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
          totalItems={productos.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* MODAL FORMULARIO DE PRODUCTOS */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">
                {productoEdit ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="my-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Producto</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Fanta Naranja 3L"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full border border-gray-300 rounded text-sm py-2 px-2 bg-white"
                  >
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código Barras (Opcional)</label>
                  <input
                    type="text"
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    placeholder="Dejar vacío para autogenerar"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Detalles opcionales..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Precio Compra ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={precioCompra}
                    onChange={(e) => setPrecioCompra(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Precio Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    required
                    value={stockActual}
                    onChange={(e) => setStockActual(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Mínimo Alerta</label>
                  <input
                    type="number"
                    required
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
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
                  {procesandoForm ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
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
