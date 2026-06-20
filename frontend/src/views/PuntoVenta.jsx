import React, { useState, useEffect, useRef } from 'react';
import useCartStore from '../store/cartStore';
import { 
  Search, Trash2, ShoppingCart, UserPlus, CreditCard, 
  DollarSign, Smartphone, Landmark, CheckCircle, Info 
} from 'lucide-react';

// LISTA DE DATOS ESTATICA SIMULADA (Productos y Clientes)
// En una integracion real se cargaran vía fetch() desde el backend FastAPI
const PRODUCTOS_SIMULADOS = [
  { id: "111", nombre: "Coca Cola 3L", codigo_barras: "7501055303724", precio_venta: 3.50, stock_actual: 15, categoria: "Bebidas" },
  { id: "222", nombre: "Papas Fritas Lays", codigo_barras: "7501011115859", precio_venta: 1.80, stock_actual: 20, categoria: "Snacks" },
  { id: "333", nombre: "Galletas Oreo 6 unidades", codigo_barras: "7622300746684", precio_venta: 1.20, stock_actual: 5, categoria: "Dulces" },
  { id: "444", nombre: "Chocolate Sublime", codigo_barras: "7750103126487", precio_venta: 1.00, stock_actual: 30, categoria: "Dulces" },
  { id: "555", nombre: "Agua Mineral Sin Gas 1L", codigo_barras: "7751025001258", precio_venta: 1.50, stock_actual: 8, categoria: "Bebidas" }
];

const CLIENTES_SIMULADOS = [
  { id: "c1", nombre: "Público General", dni_ruc: "00000000", saldo_deudor: 0, limite_credito: 0 },
  { id: "c2", nombre: "Carlos Mendoza (Fiado)", dni_ruc: "10457859654", saldo_deudor: 120.00, limite_credito: 500.00 },
  { id: "c3", nombre: "Distribuidora HS", dni_ruc: "20658749586", saldo_deudor: 0.00, limite_credito: 1500.00 }
];

export const PuntoVenta = () => {
  const [buscar, setBuscar] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('Todas');
  const [mostrarCarritoMovil, setMostrarCarritoMovil] = useState(false);
  const inputBuscarRef = useRef(null);

  // Zustand POS Cart Store
  const { 
    carrito, clienteSeleccionado, metodoPago, codigoFactura,
    agregarProducto, actualizarCantidad, removerProducto, vaciarCarrito,
    setCliente, setMetodoPago, setCodigoFactura, obtenerTotal 
  } = useCartStore();

  const total = obtenerTotal();
  const categorias = ["Todas", "Bebidas", "Snacks", "Dulces"];

  // Inicializar cliente por defecto
  useEffect(() => {
    if (!clienteSeleccionado) {
      setCliente(CLIENTES_SIMULADOS[0]);
    }
  }, [clienteSeleccionado, setCliente]);

  /**
   * EMULACIÓN DE LECTOR DE BARRAS:
   * Captura el cambio en el input. Si el string ingresado coincide exactamente con
   * el codigo_barras de un producto, lo añade automáticamente al carrito y limpia el input.
   */
  const handleBuscarChange = (e) => {
    const valor = e.target.value;
    setBuscar(valor);

    const coincidencia = PRODUCTOS_SIMULADOS.find(p => p.codigo_barras === valor.trim());
    if (coincidencia) {
      agregarProducto(coincidencia);
      setBuscar(''); // Limpia el buscador de inmediato
      // Mantener foco en el buscador para continuas lecturas
      if (inputBuscarRef.current) {
        inputBuscarRef.current.focus();
      }
    }
  };

  const handleSeleccionarProductoClick = (producto) => {
    agregarProducto(producto);
  };

  const handleProcesarCobro = () => {
    if (carrito.length === 0) {
      alert("El carrito se encuentra vacío.");
      return;
    }
    if (!codigoFactura.trim()) {
      alert("Ingrese un código de comprobante/factura para continuar.");
      return;
    }

    // Regla de Negocio: Validar límite de crédito si el tipo de pago es Crédito
    if (metodoPago === "Credito" && clienteSeleccionado) {
      const nuevoSaldoEstimado = clienteSeleccionado.saldo_deudor + total;
      if (nuevoSaldoEstimado > clienteSeleccionado.limite_credito) {
        alert(
          `¡Venta rechazada! El cliente ${clienteSeleccionado.nombre} excede su límite de crédito. \n` +
          `Saldo deudor actual: $${clienteSeleccionado.saldo_deudor.toFixed(2)} \n` +
          `Monto solicitado: $${total.toFixed(2)} \n` +
          `Límite de crédito máximo: $${clienteSeleccionado.limite_credito.toFixed(2)}`
        );
        return;
      }
    }

    // Registro exitoso simulado
    alert(
      `¡Venta procesada con éxito!\n` +
      `Código de Factura: ${codigoFactura}\n` +
      `Cliente: ${clienteSeleccionado?.nombre}\n` +
      `Método de Pago: ${metodoPago}\n` +
      `Total Cobrado: $${total.toFixed(2)}`
    );

    vaciarCarrito();
  };

  // Filtrado de productos en la rejilla
  const productosFiltrados = PRODUCTOS_SIMULADOS.filter(p => {
    const coincideBuscar = p.nombre.toLowerCase().includes(buscar.toLowerCase()) || p.codigo_barras.includes(buscar);
    const coincideCategoria = categoriaSel === "Todas" || p.categoria === categoriaSel;
    return coincideBuscar && coincideCategoria;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* SECCIÓN IZQUIERDA: BUSCADOR Y REJILLA DE PRODUCTOS (Ocupa 2 columnas en pantallas grandes) */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        
        {/* Controles de Búsqueda y Filtro */}
        <div className="bg-white rounded-lg p-4 shadow border border-gray-200 flex flex-col md:flex-row gap-4">
          {/* Campo buscador */}
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

          {/* Filtros de Categorías */}
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

        {/* Rejilla / Grid de Tarjetas de Productos */}
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
                  <span className="text-[10px] uppercase font-bold text-gray-400">{prod.categoria}</span>
                  <h4 className="font-semibold text-gray-800 text-sm mt-1 line-clamp-2">{prod.nombre}</h4>
                  <p className="text-[10px] text-gray-400 font-mono mt-1">Cód: {prod.codigo_barras}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-premium-primary font-bold text-base">${prod.precio_venta.toFixed(2)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    prod.stock_actual <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    Stock: {prod.stock_actual}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN DERECHA: CARRITO Y ACCIONES DE COBRO (Ocupa 1 columna) */}
      {/* Botón flotante móvil para desplegar el carrito */}
      <button
        onClick={() => setMostrarCarritoMovil(!mostrarCarritoMovil)}
        className="lg:hidden fixed bottom-6 right-6 p-4 bg-premium-primary text-white rounded-full shadow-2xl z-50 flex items-center justify-center"
      >
        <ShoppingCart size={24} />
        {carrito.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold">
            {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
          </span>
        )}
      </button>

      {/* Panel del Carrito de Compras */}
      <div 
        className={`lg:block bg-white rounded-lg border border-gray-200 shadow p-6 flex flex-col justify-between h-[calc(100vh-140px)] min-h-[480px] ${
          mostrarCarritoMovil ? 'fixed inset-0 z-45 p-6 lg:static bg-white' : 'hidden'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 text-base flex items-center">
              <ShoppingCart className="mr-2 text-premium-primary" size={20} />
              Caja POS
            </h3>
            {mostrarCarritoMovil && (
              <button 
                onClick={() => setMostrarCarritoMovil(false)} 
                className="text-xs text-premium-primary font-bold"
              >
                Volver a Productos
              </button>
            )}
          </div>

          {/* Listado de ítems en el carrito */}
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
                  
                  {/* Controles de cantidad */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.id, parseInt(e.target.value) || 0, item.stock_actual)}
                      className="w-12 text-center border border-gray-300 rounded text-xs py-0.5 outline-none"
                    />
                    <button 
                      onClick={() => removerProducto(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Formulario y Botones de Pago en la base */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          
          {/* Entrada de Comprobante / Correlativo */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Código de Comprobante</label>
            <input
              type="text"
              value={codigoFactura}
              onChange={(e) => setCodigoFactura(e.target.value)}
              placeholder="Ej: F001-000025"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-premium-primary focus:border-premium-primary outline-none"
            />
          </div>

          {/* Selector de Cliente */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Cliente / Fiador</label>
            <select
              value={clienteSeleccionado?.id || ''}
              onChange={(e) => setCliente(CLIENTES_SIMULADOS.find(c => c.id === e.target.value))}
              className="w-full border border-gray-300 rounded text-xs py-1.5 px-2 bg-white"
            >
              {CLIENTES_SIMULADOS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.saldo_deudor > 0 ? `(Deuda: $${c.saldo_deudor})` : ''}
                </option>
              ))}
            </select>
            {clienteSeleccionado && clienteSeleccionado.limite_credito > 0 && (
              <p className="text-[10px] text-gray-500 mt-1 flex items-center">
                <Info size={12} className="mr-1 text-premium-primary" />
                Límite de crédito disponible: ${clienteSeleccionado.limite_credito - clienteSeleccionado.saldo_deudor}
              </p>
            )}
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "Efectivo", etiqueta: "Efectivo", icono: <DollarSign size={14} /> },
                { id: "Tarjeta", etiqueta: "Tarjeta", icono: <CreditCard size={14} /> },
                { id: "Credito", etiqueta: "Crédito (Fiado)", icono: <UserPlus size={14} /> },
                { id: "Transferencia", etiqueta: "Transfer", icono: <Landmark size={14} /> }
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

          {/* Totalizador */}
          <div className="flex items-center justify-between py-2 border-t border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-600">Total a Pagar:</span>
            <span className="text-xl font-extrabold text-premium-dark">${total.toFixed(2)}</span>
          </div>

          {/* Botón de Pago */}
          <button
            onClick={handleProcesarCobro}
            className="w-full py-3 bg-premium-success hover:bg-green-700 text-white rounded font-bold text-sm transition-colors flex items-center justify-center"
          >
            <CheckCircle className="mr-2" size={18} />
            Confirmar y Cobrar
          </button>
        </div>
      </div>

    </div>
  );
};

export default PuntoVenta;
