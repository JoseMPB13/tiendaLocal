import { useState, useEffect, useRef } from 'react';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import ventaService from '../services/ventaService';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Search, Trash2, ShoppingCart, UserPlus, CreditCard, 
  DollarSign, X 
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
        console.error(ex);
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
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e4e4e7] flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              ref={inputBuscarRef}
              value={buscar}
              onChange={handleBuscarChange}
              placeholder="Buscador por código de barras o nombre..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#e4e4e7] rounded-lg focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-xs placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  categoriaSel === cat 
                    ? 'bg-[#09090b] text-white' 
                    : 'bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#18181b]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Carga o Rejilla */}
        {cargando ? (
          <div className="text-center py-12 text-gray-400 font-semibold bg-white rounded-xl shadow-sm border border-[#e4e4e7] text-xs">
            Cargando catálogo de productos desde FastAPI...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productosFiltrados.map(prod => {
              const agotado = prod.stock_actual <= 0;
              const bajoStock = prod.stock_actual <= prod.stock_minimo;
              return (
                <div 
                  key={prod.id}
                  onClick={() => !agotado && handleSeleccionarProductoClick(prod)}
                  className={`bg-white rounded-xl p-4 shadow-sm border transition-all duration-200 flex flex-col justify-between ${
                    agotado 
                      ? 'opacity-40 border-[#e4e4e7] cursor-not-allowed' 
                      : 'border-[#e4e4e7] hover:border-gray-400 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-[#09090b] text-xs line-clamp-2 font-display">{prod.nombre}</h4>
                    <p className="text-[9px] text-gray-400 font-mono mt-0.5">Cód: {prod.codigo_barras}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[#09090b] font-bold text-sm">Bs. {prod.precio_venta.toFixed(2)}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                      agotado ? 'bg-red-50 text-red-600 border-red-100' :
                      bajoStock ? 'bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]' : 'bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]'
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
        className="lg:hidden fixed bottom-6 right-6 p-4 bg-[#09090b] text-white rounded-full shadow-2xl z-50 flex items-center justify-center cursor-pointer"
      >
        <ShoppingCart size={20} />
      </button>

      <div 
        className={`lg:block bg-white rounded-xl border border-[#e4e4e7] shadow-sm p-6 flex flex-col justify-between h-[calc(100vh-140px)] min-h-[480px] ${
          mostrarCarritoMovil ? 'fixed inset-0 z-40 p-6 lg:static bg-white' : 'hidden'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-[#e4e4e7]">
            <h3 className="font-bold text-[#09090b] text-sm flex items-center font-display">
              <ShoppingCart className="mr-2 text-black font-semibold" size={16} />
              Caja POS
            </h3>
            {mostrarCarritoMovil && (
              <button onClick={() => setMostrarCarritoMovil(false)} className="text-xs text-black font-bold">
                Volver
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto my-4 space-y-3">
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingCart className="mx-auto mb-2 text-gray-300" size={24} />
                <p className="text-[11px] font-medium">El carrito está vacío</p>
              </div>
            ) : (
              carrito.map(item => (
                <div key={item.id} className="flex items-center justify-between border-b border-[#f4f4f5] pb-2">
                  <div className="flex-1 pr-2">
                    <h5 className="text-xs font-semibold text-[#09090b] truncate w-32 font-display">{item.nombre}</h5>
                    <p className="text-[10px] text-gray-400">Bs. {item.precio_venta.toFixed(2)} x {item.cantidad}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.id, parseInt(e.target.value) || 0, item.stock_actual)}
                      className="w-12 text-center border border-[#e4e4e7] rounded py-0.5 text-xs outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <button onClick={() => { removerProducto(item.id); toast.success("Eliminado"); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#e4e4e7]">
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Código Factura</label>
            <input
              type="text"
              value={codigoFactura}
              onChange={(e) => setCodigoFactura(e.target.value)}
              placeholder="Ej: F001-000025"
              className="w-full px-2.5 py-1.5 border border-[#e4e4e7] rounded-lg text-xs focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
            <select
              value={clienteSeleccionado?.id || ''}
              onChange={(e) => setCliente(clientes.find(c => c.id === e.target.value))}
              className="w-full border border-[#e4e4e7] rounded-lg text-xs py-1.5 px-2 bg-white outline-none focus:border-black focus:ring-1 focus:ring-black"
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.saldo_deudor > 0 ? `(Deuda: Bs. ${c.saldo_deudor})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "Efectivo", etiqueta: "Efectivo", icono: <DollarSign size={12} /> },
                { id: "Tarjeta", etiqueta: "Tarjeta", icono: <CreditCard size={12} /> },
                { id: "Credito", etiqueta: "Crédito (Fiado)", icono: <UserPlus size={12} /> }
              ].map(metodo => (
                <button
                  key={metodo.id}
                  type="button"
                  onClick={() => setMetodoPago(metodo.id)}
                  className={`flex items-center justify-center py-2 px-1 rounded-lg text-xs border transition-colors cursor-pointer ${
                    metodoPago === metodo.id 
                      ? 'bg-[#09090b] border-[#09090b] text-white font-medium shadow-sm' 
                      : 'bg-white border-[#e4e4e7] text-gray-600 hover:bg-[#f4f4f5] hover:text-black'
                  }`}
                >
                  {metodo.icono}
                  <span className="ml-1 text-[9px]">{metodo.etiqueta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-b border-[#f4f4f5]">
            <span className="text-xs font-semibold text-gray-500">Total a Pagar:</span>
            <span className="text-lg font-bold text-[#09090b] font-display">Bs. {total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleAbrirConfirmacion}
            className="w-full py-2.5 bg-[#09090b] hover:bg-[#18181b] text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center cursor-pointer shadow-sm"
          >
            Confirmar y Cobrar
          </button>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-[#e4e4e7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#f4f4f5]">
              <h3 className="font-bold text-[#09090b] text-sm font-display">Detalle de Cobro ({metodoPago})</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="my-5 space-y-4">
              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>Total Neto:</span>
                <span className="font-bold text-[#09090b] text-sm font-display">Bs. {total.toFixed(2)}</span>
              </div>

              {/* Lógica para Pago en Efectivo: Calcular vuelto */}
              {metodoPago === "Efectivo" && (
                <div className="space-y-3 bg-[#fafafa] p-3 rounded-lg border border-[#e4e4e7]">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#71717a] mb-1">Monto Recibido (Bs.)</label>
                    <input
                      type="number"
                      required
                      value={efectivoRecibido}
                      onChange={(e) => setEfectivoRecibido(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 border border-[#e4e4e7] rounded-lg text-xs focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                    />
                  </div>
                  {parseFloat(efectivoRecibido) >= total && (
                    <div className="flex justify-between text-xs text-green-700 font-bold">
                      <span>Vuelto a entregar:</span>
                      <span>Bs. {vuelto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Lógica para Crédito: Verificación de límite */}
              {metodoPago === "Credito" && clienteSeleccionado && (
                <div className="space-y-2 bg-[#f4f4f5] p-3 rounded-lg border border-[#e4e4e7] text-[11px] text-[#71717a]">
                  <div className="flex justify-between">
                    <span>Saldo Deudor Actual:</span>
                    <span className="font-semibold text-black">Bs. {clienteSeleccionado.saldo_deudor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Venta Proyectada:</span>
                    <span className="font-semibold text-black">+ Bs. {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#e4e4e7] pt-1 font-bold">
                    <span>Nuevo Saldo Estimado:</span>
                    <span className="text-[#09090b]">Bs. {(clienteSeleccionado.saldo_deudor + total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2 border-t border-[#e4e4e7]/60 pt-1.5">
                    <span>Límite de Crédito Autorizado:</span>
                    <span className="font-bold text-gray-500">Bs. {clienteSeleccionado.limite_credito.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[#f4f4f5]">
              <button 
                onClick={() => setMostrarModal(false)}
                className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarCobroTransaccional}
                disabled={procesandoPago || (metodoPago === "Efectivo" && (!efectivoRecibido || parseFloat(efectivoRecibido) < total))}
                className="py-1.5 px-3 bg-[#09090b] hover:bg-[#18181b] text-white rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors"
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
