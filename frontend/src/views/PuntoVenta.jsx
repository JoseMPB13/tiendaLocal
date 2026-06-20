import React, { useState, useEffect, useRef } from 'react';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import ventaService from '../services/ventaService';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Search, Trash2, ShoppingCart, UserPlus, CreditCard, 
  DollarSign, Landmark, CheckCircle, Info, AlertTriangle, X 
} from 'lucide-react';

export const PuntoVenta = () => {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState(["Todas"]);
  
  const [buscar, setBuscar] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('Todas');
  const [mostrarCarritoMovil, setMostrarCarritoMovil] = useState(false);
  const [cargando, setCargando] = useState(true);
  
  // Estado para el modal de confirmación de cobro
  const [mostrarModal, setMostrarModal] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  const inputBuscarRef = useRef(null);

  // Zustand POS Cart Store
  const { 
    carrito, clienteSeleccionado, metodoPago, codigoFactura,
    agregarProducto, actualizarCantidad, removerProducto, vaciarCarrito,
    setCliente, setMetodoPago, setCodigoFactura, obtenerTotal 
  } = useCartStore();

  const { usuario } = useAuthStore();
  const total = obtenerTotal();

  // 1. CARGA DINÁMICA DESDE LA API DE FASTAPI
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [resProds, resClis, resCats] = await Promise.all([
          ventaService.obtenerProductos(),
          ventaService.obtenerClientes(),
          ventaService.obtenerCategorias()
        ]);

        if (resProds.ok) setProductos(resProds.data);
        if (resClis.ok) {
          setClientes(resClis.data);
          // Cliente General por defecto
          const cliGeneral = resClis.data.find(c => c.dni_ruc === '00000000') || resClis.data[0];
          setCliente(cliGeneral);
        }
        if (resCats.ok) {
          const listado = ["Todas", ...resCats.data.map(c => c.nombre)];
          setCategorias(listado);
        }
      } catch (ex) {
        toast.error("Error al conectar con la API de FastAPI. Cargando simulación.");
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [setCliente]);

  /**
   * EMULACIÓN DE LECTOR DE BARRAS:
   * Si la cadena coincide exactamente con un producto del catálogo API, se añade y limpia.
   */
  const handleBuscarChange = (e) => {
    const valor = e.target.value;
    setBuscar(valor);

    const coincidencia = productos.find(p => p.codigo_barras === valor.trim() && p.estado === 'Activo');
    if (coincidencia) {
      agregarProducto(coincidencia);
      setBuscar(''); // Limpiar de inmediato
      toast.success(`${coincidencia.nombre} agregado`);
      if (inputBuscarRef.current) {
        inputBuscarRef.current.focus();
      }
    }
  };

  const handleSeleccionarProductoClick = (producto) => {
    agregarProducto(producto);
    toast.success(`${producto.nombre} agregado`);
  };

  const handleAbrirConfirmacion = () => {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío.");
      return;
    }
    if (!codigoFactura.trim()) {
      toast.error("Ingrese el código del comprobante de venta.");
      return;
    }

    // Regla de Negocio: Validar límite de crédito antes de abrir
    if (metodoPago === "Credito" && clienteSeleccionado) {
      const nuevoSaldo = clienteSeleccionado.saldo_deudor + total;
      if (nuevoSaldo > clienteSeleccionado.limite_credito) {
        toast.error(`Rechazado: El cliente supera su límite de crédito disponible.`);
        return;
      }
    }

    // Inicializar inputs del modal
    setEfectivoRecibido('');
    setMostrarModal(true);
  };

  const handleConfirmarCobroTransaccional = async () => {
    setProcesandoPago(true);
    try {
      // Formatear payload de venta para el endpoint del backend
      const payload = {
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        codigo_factura: codigoFactura,
        tipo_pago: metodoPago,
        detalles: carrito.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_venta
        }))
      };

      const respuesta = await ventaService.registrarVenta(payload);

      if (respuesta.ok) {
        toast.success(`Venta ${codigoFactura} registrada con éxito. Transacción consolidada.`);
        vaciarCarrito();
        setMostrarModal(false);
      }
    } catch (ex) {
      const errorDetail = ex.response?.data?.detail || "Error desconocido al procesar transacción.";
      toast.error(`Error transaccional: ${errorDetail}`);
    } finally {
      setProcesandoPago(false);
    }
  };

  // Filtrado de productos en la rejilla
  const productosFiltrados = productos.filter(p => {
    const coincideBuscar = p.nombre.toLowerCase().includes(buscar.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(buscar));
    const coincideCategoria = categoriaSel === "Todas"; // Simplificado para simulación/categoría
    return coincideBuscar && coincideCategoria && p.estado === 'Activo';
  });

  const vuelto = parseFloat(efectivoRecibido) ? parseFloat(efectivoRecibido) - total : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      <Toaster position="top-right" />
      
      {/* SECCIÓN IZQUIERDA: BUSCADOR Y REJILLA */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        
        {/* Controles de Búsqueda y Filtro */}
        <div className="bg-white rounded-lg p-4 shadow border border-gray-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              ref={inputBuscarRef}
              value={buscar}
              onChange={handleBuscarChange}
              placeholder="Buscador por código de barras o nombre..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none transition-all text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                  categoriaSel === cat 
                    ? 'bg-premium-primary text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Carga o Rejilla */}
        {cargando ? (
          <div className="text-center py-12 text-gray-500 font-semibold bg-white rounded-lg shadow border border-gray-200">
            Cargando catálogo de productos desde FastAPI...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productosFiltrados.map(prod => {
              const agotado = prod.stock_actual <= 0;
              return (
                <div 
                  key={prod.id}
                  onClick={() => !agotado && handleSeleccionarProductoClick(prod)}
                  className={`bg-white rounded-lg p-4 shadow border transition-all flex flex-col justify-between ${
                    agotado 
                      ? 'opacity-50 border-gray-200 cursor-not-allowed' 
                      : 'border-gray-200 hover:border-premium-primary hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm line-clamp-2">{prod.nombre}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">Cód: {prod.codigo_barras}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-premium-primary font-bold text-base">${prod.precio_venta.toFixed(2)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      prod.stock_actual <= prod.stock_minimo ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      Stock: {prod.stock_actual}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN DERECHA: PANEL CARRITO */}
      <button
        onClick={() => setMostrarCarritoMovil(!mostrarCarritoMovil)}
        className="lg:hidden fixed bottom-6 right-6 p-4 bg-premium-primary text-white rounded-full shadow-2xl z-50 flex items-center justify-center"
      >
        <ShoppingCart size={24} />
      </button>

      <div 
        className={`lg:block bg-white rounded-lg border border-gray-200 shadow p-6 flex flex-col justify-between h-[calc(100vh-140px)] min-h-[480px] ${
          mostrarCarritoMovil ? 'fixed inset-0 z-40 p-6 lg:static bg-white' : 'hidden'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 text-base flex items-center">
              <ShoppingCart className="mr-2 text-premium-primary" size={20} />
              Caja POS
            </h3>
            {mostrarCarritoMovil && (
              <button onClick={() => setMostrarCarritoMovil(false)} className="text-xs text-premium-primary font-bold">
                Volver
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto my-4 space-y-3">
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingCart className="mx-auto mb-2 text-gray-300" size={32} />
                <p className="text-xs font-semibold">El carrito está vacío</p>
              </div>
            ) : (
              carrito.map(item => (
                <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex-1 pr-2">
                    <h5 className="text-xs font-semibold text-gray-800 truncate w-32">{item.nombre}</h5>
                    <p className="text-[10px] text-gray-400">${item.precio_venta.toFixed(2)} x {item.cantidad}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.id, parseInt(e.target.value) || 0, item.stock_actual)}
                      className="w-12 text-center border border-gray-300 rounded text-xs py-0.5 outline-none"
                    />
                    <button onClick={() => { removerProducto(item.id); toast.success("Eliminado"); }} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Código Factura</label>
            <input
              type="text"
              value={codigoFactura}
              onChange={(e) => setCodigoFactura(e.target.value)}
              placeholder="Ej: F001-000025"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Cliente</label>
            <select
              value={clienteSeleccionado?.id || ''}
              onChange={(e) => setCliente(clientes.find(c => c.id === e.target.value))}
              className="w-full border border-gray-300 rounded text-xs py-1.5 px-2 bg-white"
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.saldo_deudor > 0 ? `(Deuda: $${c.saldo_deudor})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "Efectivo", etiqueta: "Efectivo", icono: <DollarSign size={14} /> },
                { id: "Tarjeta", etiqueta: "Tarjeta", icono: <CreditCard size={14} /> },
                { id: "Credito", etiqueta: "Crédito (Fiado)", icono: <UserPlus size={14} /> }
              ].map(metodo => (
                <button
                  key={metodo.id}
                  type="button"
                  onClick={() => setMetodoPago(metodo.id)}
                  className={`flex items-center justify-center py-2 px-1 rounded text-xs border transition-colors ${
                    metodoPago === metodo.id 
                      ? 'bg-premium-primary border-premium-primary text-white font-semibold' 
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {metodo.icono}
                  <span className="ml-1 text-[10px]">{metodo.etiqueta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-600">Total a Pagar:</span>
            <span className="text-xl font-extrabold text-premium-dark">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleAbrirConfirmacion}
            className="w-full py-3 bg-premium-success hover:bg-green-700 text-white rounded font-bold text-sm transition-colors flex items-center justify-center"
          >
            Confirmar y Cobrar
          </button>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-base">Detalle de Cobro ({metodoPago})</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="my-6 space-y-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Neto:</span>
                <span className="font-bold text-premium-dark">${total.toFixed(2)}</span>
              </div>

              {/* Lógica para Pago en Efectivo: Calcular vuelto */}
              {metodoPago === "Efectivo" && (
                <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Monto Recibido ($)</label>
                    <input
                      type="number"
                      required
                      value={efectivoRecibido}
                      onChange={(e) => setEfectivoRecibido(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none"
                    />
                  </div>
                  {parseFloat(efectivoRecibido) >= total && (
                    <div className="flex justify-between text-sm text-green-700 font-bold">
                      <span>Vuelto a entregar:</span>
                      <span>${vuelto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Lógica para Crédito: Verificación de límite */}
              {metodoPago === "Credito" && clienteSeleccionado && (
                <div className="space-y-2 bg-blue-50 p-3 rounded border border-blue-200 text-xs text-blue-800">
                  <div className="flex justify-between">
                    <span>Saldo Deudor Actual:</span>
                    <span className="font-semibold">${clienteSeleccionado.saldo_deudor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Venta Proyectada:</span>
                    <span className="font-semibold">+ ${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-1 font-bold">
                    <span>Nuevo Saldo Estimado:</span>
                    <span>${(clienteSeleccionado.saldo_deudor + total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-blue-600 mt-2">
                    <span>Límite de Crédito del Cliente:</span>
                    <span>${clienteSeleccionado.limite_credito.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setMostrarModal(false)}
                className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarCobroTransaccional}
                disabled={procesandoPago || (metodoPago === "Efectivo" && (!efectivoRecibido || parseFloat(efectivoRecibido) < total))}
                className="py-2 px-4 bg-premium-success hover:bg-green-700 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                {procesandoPago ? 'Procesando en DB...' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PuntoVenta;
