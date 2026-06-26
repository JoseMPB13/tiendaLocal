/**
 * Vista: PuntoVenta.jsx
 * Módulo POS (Punto de Venta) y CRUD/Historial de Ventas de Tienda Margarita.
 *
 * Funcionalidades:
 *  - Interfaz de pestañas: "Nueva Venta" / "Historial de Ventas"
 *  - Búsqueda de productos por nombre o código de barras
 *  - Filtro por categoría
 *  - Consulta en tiempo real del próximo número de factura correlativo desde la DB (sincronizarProximoCodigoFactura)
 *  - Selector de cliente con buscador autocomplete y registro rápido
 *  - Métodos de pago: Efectivo (con vuelto), Tarjeta, QR, Crédito (con límite de deuda)
 *  - Carrito con control de stock y confirmación transaccional
 *  - Historial de ventas paginado con filtros por estado (Completada, Cancelada, Pendiente)
 *  - Vista detallada de venta (cabecera + productos asociados) en modal responsivo
 *  - Anulación/cancelación lógica de ventas con reversión automática de stock y deudas en la DB
 *  - Adaptación 100% responsiva (vista de tarjetas en móvil, tabla en desktop) usando Tailwind CSS
 *  - Integración de MapaInteractivo para despacho de delivery con geocodificación de Nominatim en caliente
 */

import { useState, useEffect, useRef } from 'react';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import ventaService from '../services/ventaService';
import clienteService from '../services/clienteService';
import toast, { Toaster } from 'react-hot-toast';
import {
  Search, Trash2, ShoppingCart, CreditCard,
  DollarSign, X, ChevronDown, UserPlus, Plus,
  RefreshCw, Package, ArrowRight, Loader2, QrCode,
  Eye, Ban, ChevronLeft, ChevronRight, Calendar,
  User, FileText, CheckCircle2, Edit2, Printer
} from 'lucide-react';
import MapaInteractivo from '../components/MapaInteractivo';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Extrae coordenadas geográficas (latitud, longitud) desde una URL de mapa
 * de forma universal (independiente del dominio, ej: googleusercontent.com o google.com)
 * o de coordenadas en bruto. Valida geográficamente que estén dentro de los límites reales.
 * Idioma: Español
 */
const extraerCoordenadas = (url) => {
  if (!url) return null;
  const texto = url.trim();

  // 1. Verificar si son coordenadas puras separadas por coma, ej: "-17.7833, -63.1667"
  const rawRegex = /^\s*(-?\d+\.\d+)\s*(?:,|\/)\s*(-?\d+\.\d+)\s*$/;
  const rawMatch = texto.match(rawRegex);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. Parámetros mlat y mlon (común en OSM/enlaces genéricos, en cualquier orden)
  const mlatMatch = texto.match(/[?&]mlat=(-?\d+\.\d+)/);
  const mlonMatch = texto.match(/[?&]mlon=(-?\d+\.\d+)/);
  if (mlatMatch && mlonMatch) {
    const lat = parseFloat(mlatMatch[1]);
    const lng = parseFloat(mlonMatch[1]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 3. Patrón de hash de mapa (#map=zoom/lat/lng o similar)
  const osmRegex = /map=\d+(?:\.\d+)?\/(-?\d+\.\d+)\/(-?\d+\.\d+)/;
  const osmMatch = texto.match(osmRegex);
  if (osmMatch) {
    const lat = parseFloat(osmMatch[1]);
    const lng = parseFloat(osmMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 4. Parámetros de consulta estándar como q=lat,lng, query=lat,lng, ll=lat,lng
  const qRegex = /[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:\s*,\s*|%2C|\s*\/|%2F)\s*(-?\d+\.\d+)/i;
  const qMatch = texto.match(qRegex);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 5. Patrón path común: /place/lat,lng o /@lat,lng o /place/lat/lng o /@lat/lng
  const placeRegex = /(?:place|@)(-?\d+\.\d+)(?:\s*,\s*|%2C|\s*\/|%2F)\s*(-?\d+\.\d+)/i;
  const placeMatch = texto.match(placeRegex);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 6. Búsqueda agresiva/universal de cualquier par de floats consecutivos separados por coma o barra
  const fallbackRegex = /(-?\d+\.\d+)(?:\s*,\s*|%2C|\s*\/|%2F)\s*(-?\d+\.\d+)/g;
  let fallbackMatch;
  while ((fallbackMatch = fallbackRegex.exec(texto)) !== null) {
    const lat = parseFloat(fallbackMatch[1]);
    const lng = parseFloat(fallbackMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
};

/* ── Componente principal ────────────────────────────────────────────────── */
export const PuntoVenta = () => {
  // Pestaña activa ('pos' o 'historial')
  const [activeTab, setActiveTab] = useState('pos');

  // Catálogo de Productos y Clientes
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState(['Todas']);
  const [cargando, setCargando] = useState(true);

  // Búsqueda y filtros del catálogo
  const [buscarInput, setBuscarInput] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('Todas');

  // Código de factura en edición (si aplica)
  const [codigoFacturaEdicion, setCodigoFacturaEdicion] = useState('');

  // Últimas facturas emitidas en la sesión actual
  const [ultimasFacturas, setUltimasFacturas] = useState([]);

  // Autocomplete de clientes
  const [buscarCliente, setBuscarCliente] = useState('');
  const [dropdownClienteVisible, setDropdownClienteVisible] = useState(false);
  const clienteInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Modal de cobro
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // Opciones de delivery
  const [requiereDelivery, setRequiereDelivery] = useState(false);
  const [direccionDespacho, setDireccionDespacho] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('0.00');
  const [deliveryLat, setDeliveryLat] = useState(-17.7833);
  const [deliveryLng, setDeliveryLng] = useState(-63.1667);

  // Mini-modal de registro rápido de cliente
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [nuevoCliNombre, setNuevoCliNombre] = useState('');
  const [nuevoCliTelefono, setNuevoCliTelefono] = useState('');
  const [nuevoCliDni, setNuevoCliDni] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Estados para el historial de ventas
  const [ventas, setVentas] = useState([]);
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todas');
  const [pagina, setPagina] = useState(1);
  const [totalVentas, setTotalVentas] = useState(0);
  const limitVentas = 10;

  // Detalle de venta seleccionada
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [mostrarModalDetalle, setMostrarModalDetalle] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(false);

  // Estados para el modo de edición de comprobante y reajustes
  const [editandoVentaId, setEditandoVentaId] = useState(null);
  const [itemsEditadosOriginales, setItemsEditadosOriginales] = useState([]);
  const [origenRecibo, setOrigenRecibo] = useState('historial');

  const inputBuscarRef = useRef(null);

  // Zustand stores
  const {
    carrito, clienteSeleccionado, metodoPago,
    agregarProducto, actualizarCantidad, removerProducto, vaciarCarrito,
    setCliente, setMetodoPago, obtenerTotal, cargarCarrito
  } = useCartStore();

  const { usuario } = useAuthStore();
  const total = obtenerTotal();

  // Debounce para la búsqueda de productos
  useEffect(() => {
    const handler = setTimeout(() => {
      setBuscarDebounced(buscarInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [buscarInput]);



  /** Carga inicial del POS */
  const inicializarPOS = async () => {
    try {
      setCargando(true);
      
      const [resProds, resClis, resCats] = await Promise.all([
        ventaService.obtenerProductos(),
        ventaService.obtenerClientes(),
        ventaService.obtenerCategorias()
      ]);

      if (resProds.ok && resCats.ok) {
        const mapaCategorias = {};
        resCats.data.forEach(c => { mapaCategorias[c.id] = c.nombre; });

        const productosEnriquecidos = resProds.data.map(p => ({
          ...p,
          categoria_nombre: p.categoria_nombre || mapaCategorias[p.categoria_id] || null,
        }));
        setProductos(productosEnriquecidos);
        setCategorias(['Todas', ...resCats.data.map(c => c.nombre)]);
      } else if (resProds.ok) {
        setProductos(resProds.data);
      }

      if (resClis.ok) {
        setClientes(resClis.data);
        // Preseleccionar "Cliente General" (DNI 00000000) si existe
        const cliGeneral = resClis.data.find(c => c.dni_ruc === '00000000') || resClis.data[0];
        if (cliGeneral) {
          setCliente(cliGeneral);
          setBuscarCliente(cliGeneral.nombre);
        }
      }
    } catch (ex) {
      console.error(ex);
      toast.error('Error al conectar con el servidor. Revisa la conexión.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    inicializarPOS();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Consulta el historial de ventas paginado con filtros */
  const obtenerHistorialVentas = async () => {
    setCargandoVentas(true);
    try {
      const skip = (pagina - 1) * limitVentas;
      const params = {
        skip,
        limit: limitVentas + 1 // Pedimos uno más para determinar si hay página siguiente
      };
      if (filtroEstado !== 'Todas') {
        params.estado_venta = filtroEstado;
      }
      
      const res = await ventaService.obtenerVentas(params);
      if (res.ok && res.data) {
        setVentas(res.data.slice(0, limitVentas));
        setTotalVentas(res.data.length); // Usado para determinar paginación simple
      }
    } catch (err) {
      console.error("Error al obtener historial:", err);
      toast.error("No se pudo cargar el historial de ventas.");
    } finally {
      setCargandoVentas(false);
    }
  };

  // Cargar historial de ventas cuando cambia el filtro, pestaña o la página
  useEffect(() => {
    if (activeTab === 'historial') {
      obtenerHistorialVentas();
    }
  }, [activeTab, filtroEstado, pagina]);

  /* ── Cerrar dropdown de clientes al hacer clic fuera ───────────────────── */
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        clienteInputRef.current && !clienteInputRef.current.contains(e.target)
      ) {
        setDropdownClienteVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  /* ── Búsqueda de productos con lector de barras ─────────────────────────── */
  const handleBuscarChange = (e) => {
    const valor = e.target.value;
    setBuscarInput(valor);
    const coincidencia = productos.find(
      p => p.codigo_barras === valor.trim() && p.estado === 'Activo'
    );
    if (coincidencia) {
      handleAgregarProductoPOS(coincidencia);
      setBuscarInput('');
      setBuscarDebounced('');
    }
  };

  const handleBuscarKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valor = buscarInput.trim();
      if (!valor) return;

      const coincidencia = productos.find(
        p => (p.codigo_barras === valor || p.nombre.toLowerCase() === valor.toLowerCase()) && p.estado === 'Activo'
      );

      if (coincidencia) {
        handleAgregarProductoPOS(coincidencia);
        setBuscarInput('');
        setBuscarDebounced('');
      } else {
        toast.error(`Producto con código/nombre "${valor}" no encontrado.`);
      }
      inputBuscarRef.current?.focus();
    }
  };

  // Mantiene el cursor en el input de búsqueda si está en el POS
  useEffect(() => {
    if (activeTab === 'pos' && !cargando && !mostrarModalCobro && !mostrarModalCliente) {
      inputBuscarRef.current?.focus();
    }
  }, [activeTab, cargando, mostrarModalCobro, mostrarModalCliente]);

  /* ── Autocomplete de clientes ───────────────────────────────────────────── */
  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(buscarCliente.toLowerCase()) ||
    (c.dni_ruc && c.dni_ruc.includes(buscarCliente)) ||
    (c.telefono && c.telefono.includes(buscarCliente))
  );

  const handleSeleccionarCliente = (cli) => {
    setCliente(cli);
    setBuscarCliente(cli.nombre);
    setDropdownClienteVisible(false);
  };

  const handleClienteInputChange = (e) => {
    setBuscarCliente(e.target.value);
    setDropdownClienteVisible(true);
    if (!e.target.value) setCliente(null);
  };

  /* ── Registro rápido de cliente ─────────────────────────────────────────── */
  const abrirModalCliente = () => {
    setNuevoCliNombre(buscarCliente);
    setNuevoCliTelefono('');
    setNuevoCliDni('');
    setMostrarModalCliente(true);
    setDropdownClienteVisible(false);
  };

  const handleGuardarClienteRapido = async (e) => {
    e.preventDefault();
    if (!nuevoCliNombre.trim()) {
      toast.error('El nombre del cliente es obligatorio.');
      return;
    }
    setGuardandoCliente(true);
    try {
      const res = await clienteService.crear({
        nombre: nuevoCliNombre,
        telefono: nuevoCliTelefono || null,
        dni_ruc: nuevoCliDni || null,
        saldo_deudor: 0.00,
        limite_credito: 0.00,
      });
      if (res.ok) {
        const resClis = await ventaService.obtenerClientes();
        if (resClis.ok) {
          setClientes(resClis.data);
          const nuevo = resClis.data.find(c => c.id === res.data.id);
          if (nuevo) {
            handleSeleccionarCliente(nuevo);
          }
        }
        toast.success(`✓ Cliente "${nuevoCliNombre}" registrado.`);
        setMostrarModalCliente(false);
      }
    } catch (ex) {
      const msg = ex.response?.data?.detail || 'Error al registrar el cliente.';
      toast.error(msg);
    } finally {
      setGuardandoCliente(false);
    }
  };

  /* ── Confirmar y cobrar ─────────────────────────────────────────────────── */
  const handleAbrirConfirmacion = () => {
    if (carrito.length === 0) {
      toast.error('El carrito está vacío. Agrega productos primero.');
      return;
    }
    if (!clienteSeleccionado) {
      toast.error('Selecciona un cliente antes de proceder.');
      return;
    }
    if (metodoPago === 'Credito' && clienteSeleccionado) {
      const nuevoSaldo = clienteSeleccionado.saldo_deudor + total;
      if (nuevoSaldo > clienteSeleccionado.limite_credito) {
        toast.error('Rechazado: el cliente supera su límite de crédito disponible.');
        return;
      }
    }
    if (metodoPago === 'QR') {
      setEfectivoRecibido(total.toString());
    } else {
      setEfectivoRecibido('');
    }
    setRequiereDelivery(false);
    setDireccionDespacho(clienteSeleccionado?.direccion || '');
    setCostoEnvio('0.00');

    // Inicializar coordenadas del delivery en base a los datos maestros del cliente seleccionado
    const initLat = clienteSeleccionado?.latitud !== undefined && clienteSeleccionado?.latitud !== null
      ? parseFloat(clienteSeleccionado.latitud)
      : -17.7833;
    const initLng = clienteSeleccionado?.longitud !== undefined && clienteSeleccionado?.longitud !== null
      ? parseFloat(clienteSeleccionado.longitud)
      : -63.1667;
    setDeliveryLat(initLat);
    setDeliveryLng(initLng);

    setMostrarModalCobro(true);
  };

  /**
   * Actualiza el estado local de coordenadas de delivery y realiza geocodificación inversa
   * para rellenar de forma exclusiva el input de dirección de despacho, sin alterar
   * los datos maestros del cliente.
   * Idioma: Español
   */
  const handleDeliveryMapChange = async (newLat, newLng) => {
    setDeliveryLat(newLat);
    setDeliveryLng(newLng);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`,
        {
          headers: {
            'Accept-Language': 'es',
            'User-Agent': 'TiendaMargarita/1.0 (josem@tienda.local)'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const addr = data.address;
          const calle = addr.road || addr.pedestrian || addr.construction || '';
          const barrio = addr.suburb || addr.neighbourhood || addr.city_district || '';
          const ciudad = addr.city || addr.town || addr.village || '';
          
          let direccionFormateada = '';
          if (calle) {
            direccionFormateada += calle;
          }
          if (barrio) {
            direccionFormateada += (direccionFormateada ? ', ' : '') + barrio;
          }
          if (ciudad && !barrio) {
            direccionFormateada += (direccionFormateada ? ', ' : '') + ciudad;
          }
          
          if (!direccionFormateada && data.display_name) {
            direccionFormateada = data.display_name.split(',').slice(0, 3).join(',').trim();
          }

          if (direccionFormateada) {
            setDireccionDespacho(direccionFormateada);
          }
        }
      }
    } catch (error) {
      console.error('Error al realizar geocodificación inversa para delivery:', error);
    }
  };

  /** Obtiene el stock disponible real de un producto (reajustando con la cantidad original si se está en modo edición) */
  const obtenerStockDisponible = (producto) => {
    if (!editandoVentaId) return producto.stock_actual;
    const itemOriginal = itemsEditadosOriginales.find(item => item.producto_id === producto.id);
    const cantOriginal = itemOriginal ? itemOriginal.cantidad : 0;
    return producto.stock_actual + cantOriginal;
  };

  /** Compara el carrito actual con los ítems originales de la venta en edición para alertar si hay cambios en stock */
  const hanCambiadoItems = () => {
    if (!editandoVentaId) return false;
    if (carrito.length !== itemsEditadosOriginales.length) return true;
    for (const item of carrito) {
      const orig = itemsEditadosOriginales.find(o => o.producto_id === item.id);
      if (!orig) return true;
      if (orig.cantidad !== item.cantidad) return true;
    }
    return false;
  };

  /** Agrega productos al carrito validando el stock disponible real (ajustado por modo edición) */
  const handleAgregarProductoPOS = (prod) => {
    const stockDisp = obtenerStockDisponible(prod);
    const existe = carrito.find(item => item.id === prod.id);
    const cantEnCarrito = existe ? existe.cantidad : 0;
    if (cantEnCarrito + 1 > stockDisp) {
      toast.error(`No hay stock suficiente. Stock disponible: ${stockDisp}`);
      return;
    }
    const prodAjustado = {
      ...prod,
      stock_actual: stockDisp
    };
    agregarProducto(prodAjustado);
    toast.success(`✓ ${prod.nombre} agregado al carrito`);
  };

  /** Confirma y registra una venta nueva (flujo tradicional POST) */
  const handleConfirmarVenta = async () => {
    setProcesandoPago(true);
    try {
      const payload = {
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        tipo_pago: metodoPago,
        detalles: carrito.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_venta
        })),
        para_delivery: requiereDelivery,
        direccion_despacho: requiereDelivery ? direccionDespacho : null,
        costo_envio: requiereDelivery ? parseFloat(costoEnvio) || 0.00 : 0.00
      };

      const respuesta = await ventaService.registrarVenta(payload);
      if (respuesta.ok) {
        const codigoFacturaGenerado = respuesta.data.codigo_factura;
        toast.success(`✓ Venta ${codigoFacturaGenerado} registrada exitosamente.`);
        
        const ventaId = respuesta.data.id;

        // Registrar factura en el historial rápido de la sesión actual (máximo 3)
        const nuevaFactura = {
          id: ventaId,
          codigo_factura: codigoFacturaGenerado,
          total: total,
          cliente: clienteSeleccionado?.nombre || 'Cliente General',
          fecha: new Date()
        };
        setUltimasFacturas(prev => [nuevaFactura, ...prev].slice(0, 3));

        // Limpiar el carrito y reiniciar formulario
        vaciarCarrito();
        setRequiereDelivery(false);
        setDireccionDespacho('');
        setCostoEnvio('0.00');
        setMostrarModalCobro(false);

        // Abrir automáticamente el modal de la factura en origen POS
        setOrigenRecibo('pos');
        await handleVerDetalle(ventaId);
        
        // Recargar catálogos
        await Promise.all([
          ventaService.obtenerProductos().then(res => { if (res.ok) setProductos(res.data); }),
          ventaService.obtenerClientes().then(res => { if (res.ok) setClientes(res.data); })
        ]);

        const cliGeneral = clientes.find(c => c.dni_ruc === '00000000') || clientes[0];
        if (cliGeneral) { 
          setCliente(cliGeneral); 
          setBuscarCliente(cliGeneral.nombre); 
        }
      }
    } catch (ex) {
      const errorDetail = ex.response?.data?.detail || 'Error desconocido al procesar la transacción.';
      toast.error(`Error: ${errorDetail}`);
      ventaService.obtenerProductos().then(res => { if (res.ok) setProductos(res.data); });
    } finally {
      setProcesandoPago(false);
    }
  };

  /** Confirma y actualiza una venta en edición (flujo PUT) */
  const handleActualizarVenta = async () => {
    setProcesandoPago(true);
    try {
      const payload = {
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        tipo_pago: metodoPago,
        detalles: carrito.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_venta
        })),
        para_delivery: requiereDelivery,
        direccion_despacho: requiereDelivery ? direccionDespacho : null,
        costo_envio: requiereDelivery ? parseFloat(costoEnvio) || 0.00 : 0.00
      };

      const respuesta = await ventaService.actualizarVenta(editandoVentaId, payload);
      if (respuesta.ok) {
        toast.success(`✓ Venta ${respuesta.data.codigo_factura} actualizada exitosamente.`);
        
        const ventaId = editandoVentaId;

        // Salir del modo edición y vaciar carrito
        setEditandoVentaId(null);
        setItemsEditadosOriginales([]);
        vaciarCarrito();
        setRequiereDelivery(false);
        setDireccionDespacho('');
        setCostoEnvio('0.00');
        setMostrarModalCobro(false);

        // Abrir automáticamente el modal del recibo en modo POS
        setOrigenRecibo('pos');
        await handleVerDetalle(ventaId);
        
        // Recargar catálogos
        await Promise.all([
          ventaService.obtenerProductos().then(res => { if (res.ok) setProductos(res.data); }),
          ventaService.obtenerClientes().then(res => { if (res.ok) setClientes(res.data); })
        ]);
      }
    } catch (ex) {
      const errorDetail = ex.response?.data?.detail || 'Error al actualizar la venta.';
      toast.error(`Error: ${errorDetail}`);
      ventaService.obtenerProductos().then(res => { if (res.ok) setProductos(res.data); });
    } finally {
      setProcesandoPago(false);
    }
  };

  /** Carga los datos de una venta existente en el carrito del POS para editarla */
  const handleCargarEdicion = async (ventaId) => {
    try {
      toast.loading("Cargando datos para edición...", { id: "carga-edicion" });
      const res = await ventaService.obtenerVentaDetalle(ventaId);
      if (res.ok) {
        toast.dismiss("carga-edicion");
        
        // Establecer el cliente original de la venta
        const cli = clientes.find(c => c.id === res.data.cliente_id);
        if (cli) {
          setCliente(cli);
          setBuscarCliente(cli.nombre);
        } else {
          setCliente(null);
          setBuscarCliente('');
        }
        
        setMetodoPago(res.data.tipo_pago);
        
        // Cargar los productos a la interfaz del carrito
        const itemsParaCarrito = res.data.detalles.map(d => {
          const prod = productos.find(p => p.id === d.producto_id);
          return {
            id: d.producto_id,
            nombre: prod ? prod.nombre : 'Producto desconocido',
            codigo_barras: prod ? prod.codigo_barras : '',
            precio_venta: d.precio_unitario,
            cantidad: d.cantidad,
            stock_actual: prod ? prod.stock_actual : 999,
            stock_minimo: prod ? prod.stock_minimo : 0,
            categoria_id: prod ? prod.categoria_id : null
          };
        });
        
        cargarCarrito(itemsParaCarrito);
        setItemsEditadosOriginales(res.data.detalles);
        setEditandoVentaId(ventaId);
        setCodigoFacturaEdicion(res.data.codigo_factura);
        
        setActiveTab('pos');
        toast.success("Venta cargada en el Punto de Venta.");
      }
    } catch (err) {
      console.error(err);
      toast.dismiss("carga-edicion");
      toast.error("Error al cargar la venta para edición.");
    }
  };

  /** Cancela el proceso de edición activo limpiando el POS */
  const handleCancelarEdicion = () => {
    setEditandoVentaId(null);
    setItemsEditadosOriginales([]);
    vaciarCarrito();
    setCodigoFacturaEdicion('');
    toast.success("Edición cancelada. Volviendo a modo Nueva Venta.");
  };

  /** Visualizar detalle de venta en modal */
  const handleVerDetalle = async (ventaId) => {
    setVentaSeleccionada(null);
    setMostrarModalDetalle(true);
    setCargandoDetalle(true);
    try {
      const res = await ventaService.obtenerVentaDetalle(ventaId);
      if (res.ok) {
        const detallesEnriquecidos = res.data.detalles.map(d => {
          const prod = productos.find(p => p.id === d.producto_id);
          return {
            ...d,
            nombre_producto: prod ? prod.nombre : 'Producto desconocido',
            codigo_barras: prod ? prod.codigo_barras : ''
          };
        });
        
        const clienteInfo = clientes.find(c => c.id === res.data.cliente_id);
        
        setVentaSeleccionada({
          ...res.data,
          detalles: detallesEnriquecidos,
          cliente_nombre: clienteInfo ? clienteInfo.nombre : 'Cliente Desconocido',
          cliente_dni: clienteInfo ? clienteInfo.dni_ruc : ''
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("No se pudo obtener el detalle de la venta.");
      setMostrarModalDetalle(false);
    } finally {
      setCargandoDetalle(false);
    }
  };

  /** Cancelación lógica / Anulación de venta */
  const handleAnularVenta = async (ventaId) => {
    if (!window.confirm("¿Está completamente seguro de que desea cancelar y anular esta venta? Esta operación revertirá el stock y deudas en la base de datos de manera definitiva.")) {
      return;
    }
    setProcesandoCancelacion(true);
    try {
      const res = await ventaService.cancelarVenta(ventaId);
      if (res.ok) {
        toast.success("✓ Venta cancelada y anulada con éxito.");
        
        setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, estado_venta: 'Cancelada' } : v));
        if (ventaSeleccionada && ventaSeleccionada.id === ventaId) {
          setVentaSeleccionada(prev => ({ ...prev, estado_venta: 'Cancelada' }));
        }

        const [resProds, resClis] = await Promise.all([
          ventaService.obtenerProductos().then(res => { if (res.ok) setProductos(res.data); }),
          ventaService.obtenerClientes().then(res => { if (res.ok) setClientes(res.data); })
        ]);
        if (resProds.ok) setProductos(resProds.data);
        if (resClis.ok) setClientes(resClis.data);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Ocurrió un error al intentar anular la venta.";
      toast.error(errMsg);
    } finally {
      setProcesandoCancelacion(false);
    }
  };

  /* ── Filtrado de productos ──────────────────────────────────────────────── */
  const productosFiltrados = productos.filter(p => {
    const textoBuscar = buscarDebounced.toLowerCase();
    const coincideTexto =
      p.nombre.toLowerCase().includes(textoBuscar) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(textoBuscar));
    const coincideCategoria =
      categoriaSel === 'Todas' || p.categoria_nombre === categoriaSel;
    return coincideTexto && coincideCategoria && p.estado === 'Activo';
  });

  const efectivoCentavos = Math.round((parseFloat(efectivoRecibido) || 0) * 100);
  const totalCentavos = Math.round(total * 100);
  const vuelto = (efectivoCentavos - totalCentavos) / 100;

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-slate-800 antialiased p-2 lg:p-4">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 500, borderRadius: '12px' },
          success: { iconTheme: { primary: '#059669', secondary: 'white' } },
          error: { iconTheme: { primary: '#dc2626', secondary: 'white' } },
        }}
      />

      {/* ── Tabs de Navegación ── */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'pos'
              ? 'bg-indigo-900 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart size={15} /> Nueva Venta
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'historial'
              ? 'bg-indigo-900 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <FileText size={15} /> Historial de Ventas (CRUD)
        </button>
      </div>

      {/* ════════════════════════ MÓDULO NUEVA VENTA (POS) ════════════════════════ */}
      {activeTab === 'pos' && (
        <div className="w-full flex flex-col gap-4">
          {editandoVentaId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex justify-between items-center shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950">MODO EDICIÓN ACTIVO</h4>
                  <p className="text-[10px] text-amber-700">
                    Editando venta: <span className="font-mono font-bold text-amber-900">{codigoFacturaEdicion}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelarEdicion}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
              >
                Cancelar Edición
              </button>
            </div>
          )}
          
          <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          
          {/* ─ CATÁLOGO DE PRODUCTOS (LADO IZQUIERDO) ─ */}
          <div className="flex-1 w-full flex flex-col gap-4">
            
            {/* Filtros y Buscador */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputBuscarRef}
                  type="text"
                  value={buscarInput}
                  onChange={handleBuscarChange}
                  onKeyDown={handleBuscarKeyDown}
                  placeholder="Buscar por nombre o escanear código de barras..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-xl py-2 pl-10 pr-4 text-xs font-medium placeholder-slate-400 transition-all duration-150"
                />
              </div>

              {/* Categorías */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categorias.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaSel(cat)}
                    className={`py-1.5 px-4 rounded-full text-[11px] font-bold border transition-all shrink-0 duration-150 ${
                      categoriaSel === cat
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Rejilla de Productos */}
            <div className="w-full">
              {cargando ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium shadow-sm">
                  <Loader2 size={32} className="mx-auto mb-3 animate-spin text-indigo-600" />
                  <p className="text-xs">Cargando catálogo de productos...</p>
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium shadow-sm">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-xs">No se encontraron productos disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {productosFiltrados.map(prod => {
                    const stockDisp = obtenerStockDisponible(prod);
                    const agotado = stockDisp <= 0;
                    const bajoStock = !agotado && stockDisp <= prod.stock_minimo;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => !agotado && handleAgregarProductoPOS(prod)}
                        className={`bg-white rounded-xl p-3 border shadow-sm flex flex-col justify-between h-[170px] transition-all duration-200 ${
                          agotado
                            ? 'border-red-100 opacity-60 cursor-not-allowed'
                            : 'border-slate-200 cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-indigo-500'
                        }`}
                      >
                        <div>
                          {prod.categoria_nombre && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mb-1.5 inline-block">
                              {prod.categoria_nombre}
                            </span>
                          )}
                          <h4 className="font-bold text-xs text-slate-800 line-clamp-1 leading-tight">
                            {prod.nombre}
                          </h4>
                          {prod.descripcion && (
                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-tight font-medium" title={prod.descripcion}>
                              {prod.descripcion}
                            </p>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono block mt-1">
                            {prod.codigo_barras}
                          </span>
                        </div>
                        <div className="flex items-end justify-between mt-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            Bs. {prod.precio_venta.toFixed(2)}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            agotado
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : bajoStock
                                ? 'bg-orange-50 text-orange-600 border-orange-200'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            {agotado ? 'Sin Stock' : `${stockDisp} uds`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─ PANEL DEL POS / CHECKOUT (LADO DERECHO) ─ */}
          <div className="w-full lg:w-[360px] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="bg-gradient-to-r from-indigo-950 to-indigo-900 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart size={16} className="text-indigo-300" />
                <span className="font-bold text-xs">Caja POS</span>
                {carrito.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {carrito.length}
                  </span>
                )}
              </div>
              {carrito.length > 0 && (
                <button
                  onClick={vaciarCarrito}
                  className="bg-white/10 hover:bg-white/20 border border-white/15 text-red-300 text-[10px] font-bold px-2.5 py-1 rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={12} /> Vaciar
                </button>
              )}
            </div>

            {/* Panel de Estadísticas Rápidas en Tiempo Real */}
            <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex flex-col gap-2 text-[11px]">
              {/* Fila 1: Resumen de Carrito y Cliente */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col justify-between shadow-xs">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resumen Carrito</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-extrabold text-indigo-950 text-xs">Bs. {total.toFixed(2)}</span>
                    <span className="text-slate-500 font-bold">({carrito.reduce((acc, item) => acc + item.cantidad, 0)} uds)</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col justify-between shadow-xs">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cliente Activo</span>
                  <div className="mt-1">
                    {clienteSeleccionado ? (
                      <div className="leading-tight">
                        <p className="font-bold text-slate-700 truncate max-w-[130px]">{clienteSeleccionado.nombre}</p>
                        {clienteSeleccionado.saldo_deudor > 0 ? (
                          <span className="text-[9px] font-bold text-red-500 block mt-0.5">Deuda: Bs. {clienteSeleccionado.saldo_deudor.toFixed(2)}</span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">Sin Deuda</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No seleccionado</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Fila 2: Alertas de Stock */}
              {(() => {
                const alertas = carrito.filter(item => {
                  const generalCritico = item.stock_actual <= item.stock_minimo;
                  const solicitadoLimite = item.cantidad >= item.stock_actual;
                  return generalCritico || solicitadoLimite;
                });
                if (alertas.length === 0) return null;
                return (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-2 flex flex-col gap-1 shadow-xs">
                    <div className="flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider text-red-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                      Alertas de Stock ({alertas.length})
                    </div>
                    <div className="max-h-[60px] overflow-y-auto divide-y divide-red-100 scrollbar-thin pr-1">
                      {alertas.map(item => (
                        <div key={item.id} className="py-0.5 text-[9px] leading-tight flex justify-between gap-2">
                          <span className="truncate max-w-[160px] font-semibold text-slate-700">{item.nombre}</span>
                          <span className="font-bold shrink-0 text-red-600">
                            {item.cantidad >= item.stock_actual 
                              ? 'Límite stock' 
                              : `Crítico (${item.stock_actual} uds)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Fila 3: Últimas 3 Facturas en Sesión */}
              <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Últimas Facturas (Sesión)</span>
                {ultimasFacturas.length === 0 ? (
                  <p className="text-slate-400 italic text-[9px] mt-1">Ninguna factura emitida en esta sesión</p>
                ) : (
                  <div className="mt-1 flex flex-col gap-1">
                    {ultimasFacturas.map(fac => (
                      <div key={fac.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-lg px-2 py-1 transition-colors">
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono font-bold text-slate-700 text-[10px] leading-none">{fac.codigo_factura}</span>
                          <span className="text-[8px] text-slate-400 truncate max-w-[110px] mt-0.5">{fac.cliente}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-extrabold text-slate-900">Bs. {fac.total.toFixed(2)}</span>
                          <button
                            onClick={() => { setOrigenRecibo('pos'); handleVerDetalle(fac.id); }}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1 rounded-md transition cursor-pointer"
                            title="Ver Comprobante"
                          >
                            <Eye size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Listado del Carrito */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[220px] max-h-[350px] divide-y divide-slate-100">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-12 text-center h-full">
                  <ShoppingCart size={32} className="opacity-20 mb-2" />
                  <p className="text-xs font-bold">Carrito vacío</p>
                  <p className="text-[10px] opacity-75 mt-0.5">Haz clic en un producto para agregarlo</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.nombre}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Bs. {item.precio_venta.toFixed(2)} × {item.cantidad} = <span className="font-bold text-indigo-600">Bs. {((Math.round(item.precio_venta * 100) * item.cantidad) / 100).toFixed(2)}</span>
                      </p>
                    </div>
                    <input
                      type="number"
                      value={item.cantidad || ''}
                      min={1}
                      onChange={e => actualizarCantidad(item.id, parseInt(e.target.value) || 0, obtenerStockDisponible(item))}
                      className="w-12 text-center border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-800 focus:outline-indigo-500 focus:ring-0"
                    />
                    <button
                      onClick={() => removerProducto(item.id)}
                      className="text-red-300 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition duration-150"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Resumen de Facturación y Cobro */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
              {hanCambiadoItems() && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 text-[10px] p-2.5 rounded-xl flex gap-1.5 items-start animate-fade-in shadow-sm leading-normal">
                  <span className="text-xs">⚠</span>
                  <div>
                    <p className="font-bold">Reajuste de Stock</p>
                    <p>Ha modificado los artículos o cantidades originales de la venta. Al guardar se realizará un reajuste de stock en el inventario.</p>
                  </div>
                </div>
              )}

              {/* Código de Factura */}
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                  Código de Factura
                </span>
                <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-semibold text-slate-500 text-center">
                  El código se generará automáticamente al cobrar
                </div>
              </div>

              {/* Selector de Cliente */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                    Cliente
                  </span>
                  <button
                    onClick={abrirModalCliente}
                    className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={10} /> Nuevo Cliente
                  </button>
                </div>
                <div className="relative">
                  <input
                    ref={clienteInputRef}
                    type="text"
                    value={buscarCliente}
                    onChange={handleClienteInputChange}
                    onFocus={() => setDropdownClienteVisible(true)}
                    placeholder="Buscar cliente por nombre o DNI..."
                    className="w-full bg-white border border-slate-200 outline-none rounded-xl py-1.5 pl-3 pr-8 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {clienteSeleccionado && clienteSeleccionado.saldo_deudor > 0 && (
                  <span className="text-[10px] text-red-500 font-bold block mt-1">
                    ⚠ Deuda actual: Bs. {clienteSeleccionado.saldo_deudor.toFixed(2)} / Límite: Bs. {clienteSeleccionado.limite_credito.toFixed(2)}
                  </span>
                )}

                {/* Dropdown Autocomplete */}
                {dropdownClienteVisible && buscarCliente && (
                  <div ref={dropdownRef} className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[160px] overflow-y-auto">
                    {clientesFiltrados.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-[11px] text-slate-400 mb-2">No se encontró "{buscarCliente}"</p>
                        <button
                          onClick={abrirModalCliente}
                          type="button"
                          className="w-full bg-emerald-50 border border-dashed border-emerald-300 rounded-lg text-emerald-700 font-bold text-xs py-1.5 hover:bg-emerald-100 transition duration-150 cursor-pointer"
                        >
                          <Plus size={12} className="inline mr-1" /> Registrar cliente
                        </button>
                      </div>
                    ) : (
                      clientesFiltrados.slice(0, 5).map(cli => (
                        <button
                          key={cli.id}
                          onClick={() => handleSeleccionarCliente(cli)}
                          className="w-full text-left px-3 py-2 border-b border-slate-50 hover:bg-indigo-50/50 block transition duration-150"
                        >
                          <p className="text-xs font-bold text-slate-800 leading-tight">{cli.nombre}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">DNI: {cli.dni_ruc || 'N/A'} {cli.saldo_deudor > 0 ? `· Deuda: Bs.${cli.saldo_deudor.toFixed(2)}` : ''}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Método de Pago */}
              <div>
                <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">
                  Método de Pago
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'Efectivo', label: 'Efectivo', icon: <DollarSign size={13} /> },
                    { id: 'Tarjeta',  label: 'Tarjeta',  icon: <CreditCard size={13} /> },
                    { id: 'QR',       label: 'QR',      icon: <QrCode size={13} /> },
                    { id: 'Credito',  label: 'Crédito',  icon: <UserPlus size={13} /> },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMetodoPago(m.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl border text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                        metodoPago === m.id
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botón Cobrar */}
              <div className="flex items-center justify-between bg-indigo-950 text-white rounded-xl p-3 mt-1 shadow-inner">
                <div>
                  <span className="text-[9px] text-indigo-300 font-bold block uppercase tracking-wider">Total</span>
                  <span className="text-base font-extrabold">Bs. {total.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleAbrirConfirmacion}
                  className="bg-indigo-600 hover:bg-indigo-500 border border-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  Cobrar <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ════════════════════════ MÓDULO HISTORIAL DE VENTAS (CRUD) ════════════════════════ */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full flex flex-col gap-4 animate-fade-in">
          
          {/* Barra de Filtros del Historial */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <FileText size={16} className="text-indigo-600" /> Registro Diario de Ventas
            </h3>
            
            <div className="flex gap-1.5 flex-wrap">
              {['Todas', 'Completada', 'Cancelada', 'Pendiente'].map(estado => (
                <button
                  key={estado}
                  onClick={() => { setFiltroEstado(estado); setPagina(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition duration-150 cursor-pointer ${
                    filtroEstado === estado
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {estado}
                </button>
              ))}
            </div>
          </div>

          {/* Listado de Ventas (Mobile Cards y Desktop Table) */}
          {cargandoVentas ? (
            <div className="text-center py-16 text-slate-400 font-medium">
              <Loader2 size={32} className="mx-auto mb-3 animate-spin text-indigo-600" />
              <p className="text-xs">Cargando historial de ventas...</p>
            </div>
          ) : ventas.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-xs">No se encontraron registros de venta</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Vista Desktop (Table) */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-[11px] font-medium text-slate-600">
                  <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Fecha y Hora</th>
                      <th className="px-4 py-3">Código Factura</th>
                      <th className="px-4 py-3">Método Pago</th>
                      <th className="px-4 py-3 text-right">Total Cobrado</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ventas.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {new Date(v.fecha_venta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-700">
                          {v.codigo_factura}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">{v.tipo_pago}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                          Bs. {v.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            v.estado_venta === 'Completada'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.estado_venta === 'Cancelada'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {v.estado_venta}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setOrigenRecibo('historial'); handleVerDetalle(v.id); }}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                              title="Ver detalles"
                            >
                              <Eye size={13} />
                            </button>
                            {v.estado_venta !== 'Cancelada' && (
                              <>
                                <button
                                  onClick={() => handleCargarEdicion(v.id)}
                                  className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                                  title="Editar venta"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleAnularVenta(v.id)}
                                  className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                                  title="Anular venta"
                                >
                                  <Ban size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista Móvil (Cards) */}
              <div className="block lg:hidden space-y-3">
                {ventas.map(v => (
                  <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {new Date(v.fecha_venta).toLocaleString()}
                        </span>
                        <h4 className="font-bold text-xs text-slate-800 font-mono mt-0.5">
                          {v.codigo_factura}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        v.estado_venta === 'Completada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : v.estado_venta === 'Cancelada'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {v.estado_venta}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-50 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Pago: {v.tipo_pago}</span>
                        <span className="font-extrabold text-slate-900">Bs. {v.total.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setOrigenRecibo('historial'); handleVerDetalle(v.id); }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> Detalles
                        </button>
                        {v.estado_venta !== 'Cancelada' && (
                          <>
                            <button
                              onClick={() => handleCargarEdicion(v.id)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              onClick={() => handleAnularVenta(v.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <Ban size={12} /> Anular
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controles de Paginación */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
                <span className="text-xs text-slate-400">Página {pagina}</span>
                
                <div className="flex gap-2">
                  <button
                    disabled={pagina === 1}
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    className="border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={totalVentas <= limitVentas} // Si trajo menos del límite (o exactamente el límite sin más data posterior)
                    onClick={() => setPagina(p => p + 1)}
                    className="border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ MODAL DE COBRO / CONFIRMACIÓN DE PAGO ══════════════════ */}
      {mostrarModalCobro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 animate-scale-up">
            <div className="h-1 bg-gradient-to-r from-indigo-600 to-emerald-500" />
            
            <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <CreditCard size={15} className="text-indigo-600" /> Confirmar Pago — {metodoPago}
              </span>
              <button
                onClick={() => setMostrarModalCobro(false)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3.5">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center shadow-inner">
                <div>
                  <span className="text-[9px] text-indigo-500 font-extrabold uppercase">Total Neto</span>
                  <p className="font-extrabold text-base text-slate-900 mt-0.5">Bs. {total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase">Factura</span>
                  <span className="font-mono font-bold text-[10px] text-slate-600 block mt-0.5">
                    {editandoVentaId ? `#${codigoFacturaEdicion}` : 'Autogenerado'}
                  </span>
                </div>
              </div>

              {clienteSeleccionado && (
                <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-50 pb-2">
                  <span>Cliente:</span>
                  <span className="font-bold text-slate-700">{clienteSeleccionado.nombre}</span>
                </div>
              )}

              {/* Configuración de Envío / Delivery */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={requiereDelivery}
                    onChange={(e) => {
                      setRequiereDelivery(e.target.checked);
                      if (e.target.checked && !direccionDespacho) {
                        setDireccionDespacho(clienteSeleccionado?.direccion || '');
                      }
                    }}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  ¿Registrar envío para Delivery?
                </label>

                {requiereDelivery && (
                  <div className="flex flex-col gap-2.5 border-t border-slate-200 pt-2.5 animate-fade-in">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Dirección de Despacho *
                      </label>
                      <textarea
                        value={direccionDespacho}
                        onChange={(e) => setDireccionDespacho(e.target.value)}
                        placeholder="Ingrese la ubicación de entrega..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 outline-none rounded-lg p-2 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500">Mapa Georreferencial de Delivery</span>
                      <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                        <MapaInteractivo
                          lat={deliveryLat}
                          lng={deliveryLng}
                          onChange={handleDeliveryMapChange}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">
                        * Arrastre el marcador o haga clic en el mapa para ajustar la dirección de despacho de este pedido.
                      </span>
                      {clienteSeleccionado?.enlace_ubicacion && (
                        <a
                          href={clienteSeleccionado.enlace_ubicacion}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-600 font-bold hover:underline mt-0.5 flex items-center gap-0.5"
                        >
                          📍 Abrir enlace de navegación externo
                        </a>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Costo de Envío (Bs.)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={costoEnvio}
                        onChange={(e) => setCostoEnvio(e.target.value)}
                        className="w-full bg-white border border-slate-200 outline-none rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Entrada de Efectivo */}
              {metodoPago === 'Efectivo' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 block">
                    Monto Recibido (Bs.) *
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={efectivoRecibido}
                    onChange={e => setEfectivoRecibido(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-200 outline-none rounded-lg px-3 py-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  {parseFloat(efectivoRecibido) >= total && (
                    <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mt-1">
                      <span className="text-[10px] text-emerald-700 font-bold">Cambio a devolver:</span>
                      <span className="text-xs font-extrabold text-emerald-800">
                        Bs. {vuelto.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Entrada QR */}
              {metodoPago === 'QR' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center">
                  <QrCode size={48} className="text-indigo-600 animate-pulse" />
                  <span className="text-[10px] font-bold text-indigo-700">Muestre el QR al cliente para cobro rápido</span>
                  <span className="text-[11px] text-slate-500 font-medium leading-snug">Se espera transferencia de Bs. {total.toFixed(2)}</span>
                </div>
              )}

              {/* Detalles de Crédito */}
              {metodoPago === 'Credito' && clienteSeleccionado && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 font-medium flex flex-col gap-1.5">
                  <div className="flex justify-between border-b border-amber-200 pb-1">
                    <span>Saldo Deudor Actual:</span>
                    <span className="font-bold">Bs. {clienteSeleccionado.saldo_deudor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-amber-200 pb-1">
                    <span>Esta venta:</span>
                    <span className="font-bold">+ Bs. {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-amber-200 pb-1">
                    <span>Nuevo saldo estimado:</span>
                    <span className="font-extrabold text-amber-900">Bs. {((Math.round(clienteSeleccionado.saldo_deudor * 100) + Math.round(total * 100)) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Límite autorizado:</span>
                    <span className="font-bold">Bs. {clienteSeleccionado.limite_credito.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3.5 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setMostrarModalCobro(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={editandoVentaId ? handleActualizarVenta : handleConfirmarVenta}
                disabled={
                  procesandoPago ||
                  (metodoPago === 'Efectivo' && (!efectivoRecibido || parseFloat(efectivoRecibido) < total)) ||
                  (requiereDelivery && !direccionDespacho.trim())
                }
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {procesandoPago ? (
                  <><Loader2 size={12} className="animate-spin" /> {editandoVentaId ? 'Guardando...' : 'Procesando...'}</>
                ) : (
                  <><CheckCircle2 size={12} /> {editandoVentaId ? 'Guardar Cambios' : 'Confirmar Venta'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL DE DETALLE DE VENTA / TICKET DE FACTURA ══════════════════ */}
      {mostrarModalDetalle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in modal-backdrop receipt-backdrop">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-scale-up">
            
            {/* Cabecera del Modal (No se imprime) */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50 no-print receipt-actions">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5 font-display">
                <FileText size={15} className="text-indigo-600" />
                {origenRecibo === 'pos' ? 'Comprobante de Venta Emitido' : 'Consulta de Comprobante / Factura'}
              </span>
              <button
                onClick={() => setMostrarModalDetalle(false)}
                className="bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg p-1 border border-slate-200 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Contenedor Scrollable del Recibo */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100/50 flex justify-center items-start">
              
              {/* DISEÑO DEL TICKET TÉRMICO (80mm Simulado y Real en Impresión) */}
              {cargandoDetalle ? (
                <div className="text-center py-12 text-slate-400 font-medium w-full">
                  <Loader2 size={28} className="mx-auto mb-2 animate-spin text-indigo-600" />
                  <p className="text-xs">Obteniendo datos de facturación...</p>
                </div>
              ) : ventaSeleccionada ? (
                <div className="printable-receipt w-[80mm] max-w-full bg-white p-4 shadow-md rounded-lg border border-slate-200 font-mono text-[11px] text-black leading-snug">
                  
                  {/* Encabezado Corporativo */}
                  <div className="text-center flex flex-col items-center mb-3">
                    <span className="font-sans font-black text-sm tracking-wider uppercase">TIENDA MARGARITA</span>
                    <span className="text-[10px]">NIT: 1020304050</span>
                    <span className="text-[9px] text-center mt-1">Calle Bolívar #123, Zona Central</span>
                    <span className="text-[9px]">Santa Cruz - Bolivia</span>
                    <span className="text-[9px]">Telf: +591 70012345</span>
                  </div>

                  {/* Línea Divisoria */}
                  <div className="border-t border-dashed border-black my-2.5" />

                  {/* Detalles del Comprobante */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-bold">FACTURA Nº:</span>
                      <span className="font-bold">{ventaSeleccionada.codigo_factura}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FECHA/HORA:</span>
                      <span>{new Date(ventaSeleccionada.fecha_venta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CLIENTE:</span>
                      <span className="text-right truncate max-w-[180px]">{ventaSeleccionada.cliente_nombre}</span>
                    </div>
                    {ventaSeleccionada.cliente_dni && (
                      <div className="flex justify-between">
                        <span>NIT/CI:</span>
                        <span>{ventaSeleccionada.cliente_dni}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>METODO PAGO:</span>
                      <span className="font-bold uppercase">{ventaSeleccionada.tipo_pago}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ESTADO:</span>
                      <span className="font-bold uppercase">{ventaSeleccionada.estado_venta}</span>
                    </div>
                  </div>

                  {/* Línea Divisoria */}
                  <div className="border-t border-dashed border-black my-2.5" />

                  {/* Tabla de Artículos */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 font-bold text-[10px] border-b border-black pb-1">
                      <span className="col-span-6">CONCEPTO</span>
                      <span className="col-span-2 text-center">CANT</span>
                      <span className="col-span-2 text-right">P.U.</span>
                      <span className="col-span-2 text-right">SUB</span>
                    </div>

                    {ventaSeleccionada.detalles.map((d, index) => (
                      <div key={index} className="grid grid-cols-12 text-[10px] items-start">
                        <div className="col-span-6 flex flex-col">
                          <span className="font-sans font-bold leading-tight">{d.nombre_producto}</span>
                          {d.codigo_barras && <span className="text-[8px] opacity-75">{d.codigo_barras}</span>}
                        </div>
                        <span className="col-span-2 text-center font-bold">{d.cantidad}</span>
                        <span className="col-span-2 text-right">{d.precio_unitario.toFixed(2)}</span>
                        <span className="col-span-2 text-right font-bold">{d.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Línea Divisoria */}
                  <div className="border-t border-dashed border-black my-2.5" />

                  {/* Resumen de Importes */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between text-xs font-extrabold border-b border-black pb-1">
                      <span>TOTAL NETO:</span>
                      <span>Bs. {ventaSeleccionada.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Si es delivery, mostrar datos de despacho */}
                  {ventaSeleccionada.para_delivery && (
                    <>
                      <div className="border-t border-dashed border-black my-2.5" />
                      <div className="space-y-1 text-[9px]">
                        <span className="font-bold block text-[10px] mb-0.5">DATOS DE DESPACHO (DELIVERY)</span>
                        <p className="leading-tight"><span className="font-bold">Dirección:</span> {ventaSeleccionada.direccion_despacho || 'No especificada'}</p>
                        {ventaSeleccionada.costo_envio > 0 && (
                          <div className="flex justify-between">
                            <span>COSTO ENVÍO:</span>
                            <span className="font-bold">Bs. {parseFloat(ventaSeleccionada.costo_envio).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Pie de Recibo */}
                  <div className="text-center flex flex-col items-center mt-5 gap-1">
                    <span className="font-bold text-[10px]">¡GRACIAS POR SU COMPRA!</span>
                    <span className="text-[9px]">Conserve su recibo para cualquier reclamo</span>
                    <span className="text-[8px] opacity-75 mt-1 font-sans">Desarrollado por Tienda Margarita POS</span>
                  </div>

                </div>
              ) : null}
            </div>

            {/* Acciones del Recibo (No se imprimen) */}
            <div className="px-4 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-between gap-2 no-print receipt-actions">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer size={14} /> Imprimir Comprobante
              </button>

              <div className="flex gap-2">
                {origenRecibo === 'pos' ? (
                  <button
                    onClick={() => {
                      setMostrarModalDetalle(false);
                      inputBuscarRef.current?.focus();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Nueva Venta
                  </button>
                ) : (
                  <>
                    {ventaSeleccionada && ventaSeleccionada.estado_venta !== 'Cancelada' && (
                      <button
                        disabled={procesandoCancelacion}
                        onClick={() => handleAnularVenta(ventaSeleccionada.id)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {procesandoCancelacion ? (
                          <><Loader2 size={12} className="animate-spin" /> Anulando...</>
                        ) : (
                          <><Ban size={12} /> Anular Venta</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setMostrarModalDetalle(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════ MINI-MODAL CLIENTE RÁPIDO ══════════════════ */}
      {mostrarModalCliente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 animate-scale-up">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />

            <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <User size={15} className="text-emerald-600" /> Registro Rápido de Cliente
              </span>
              <button
                onClick={() => setMostrarModalCliente(false)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleGuardarClienteRapido}>
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={nuevoCliNombre}
                    onChange={e => setNuevoCliNombre(e.target.value)}
                    placeholder="Ej: María García"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none rounded-xl py-1.5 px-3 text-xs font-medium transition"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={nuevoCliTelefono}
                      onChange={e => setNuevoCliTelefono(e.target.value)}
                      placeholder="70012345"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none rounded-xl py-1.5 px-3 text-xs font-medium transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">DNI / CI</label>
                    <input
                      type="text"
                      value={nuevoCliDni}
                      onChange={e => setNuevoCliDni(e.target.value)}
                      placeholder="12345678"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none rounded-xl py-1.5 px-3 text-xs font-medium transition"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-1 leading-normal">
                  💡 El crédito y dirección física del cliente se pueden configurar posteriormente desde el módulo de Clientes.
                </p>
              </div>
              
              <div className="px-4 py-3.5 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarModalCliente(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCliente}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {guardandoCliente ? (
                    <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                  ) : (
                    <><UserPlus size={12} /> Crear y Seleccionar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PuntoVenta;
