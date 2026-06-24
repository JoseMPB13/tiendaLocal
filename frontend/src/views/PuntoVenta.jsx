/**
 * Vista: PuntoVenta.jsx
 * Módulo POS (Punto de Venta) de Tienda Margarita.
 *
 * Funcionalidades:
 *  - Búsqueda de productos por nombre o código de barras
 *  - Filtro por categoría (funcional)
 *  - Código de factura autogenerado (editable)
 *  - Selector de cliente con buscador autocomplete en tiempo real
 *  - Mini-modal de registro rápido de cliente desde el POS
 *  - Métodos de pago: Efectivo (con vuelto), Tarjeta, Crédito (con límite)
 *  - Carrito con control de stock y confirmación transaccional
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
  RefreshCw, Package, ArrowRight, Loader2, QrCode
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Extrae latitud y longitud desde enlaces de Google Maps o Waze */
const extraerCoordenadas = (url) => {
  if (!url) return null;
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)|place\/(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = url.match(regex);
  if (match) {
    const lat = match[1] || match[3] || match[5];
    const lng = match[2] || match[4] || match[6];
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  return null;
};

/** Genera un código de factura único con formato F-YYYYMMDD-XXXXX */
const generarCodigoFactura = () => {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `F-${yyyy}${mm}${dd}-${rand}`;
};

/* ── Componente principal ────────────────────────────────────────────────── */
export const PuntoVenta = () => {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState(['Todas']);
  const [cargando, setCargando] = useState(true);

  // Búsqueda y filtros de la rejilla con Debounce inteligente
  const [buscarInput, setBuscarInput] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('Todas');

  useEffect(() => {
    const handler = setTimeout(() => {
      setBuscarDebounced(buscarInput);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [buscarInput]);

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

  // Mini-modal de registro rápido de cliente
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [nuevoCliNombre, setNuevoCliNombre] = useState('');
  const [nuevoCliTelefono, setNuevoCliTelefono] = useState('');
  const [nuevoCliDni, setNuevoCliDni] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  const inputBuscarRef = useRef(null);

  // Zustand stores
  const {
    carrito, clienteSeleccionado, metodoPago, codigoFactura,
    agregarProducto, actualizarCantidad, removerProducto, vaciarCarrito,
    setCliente, setMetodoPago, setCodigoFactura, obtenerTotal
  } = useCartStore();

  const { usuario } = useAuthStore();
  const total = obtenerTotal();

  /* ── Carga inicial ─────────────────────────────────────────────────────────
   * La función async se define DENTRO del efecto para evitar el anti-patrón
   * de llamar setState en cascada desde una función externa al efecto.
   * Se ejecuta una sola vez al montar el componente (deps vacías).
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // El código de factura se autogenera en la base de datos
    setCodigoFactura('Autogenerado');

    const controller = new AbortController();
    const signal = controller.signal;
    let cancelado = false; // Flag para evitar actualizar estado si el componente se desmontó

    const inicializarPOS = async () => {
      try {
        setCargando(true);
        const [resProds, resClis, resCats] = await Promise.all([
          ventaService.obtenerProductos({ signal }),
          ventaService.obtenerClientes({ signal }),
          ventaService.obtenerCategorias({ signal })
        ]);

        if (cancelado) return;

        if (resProds.ok && resCats.ok) {
          // Construir mapa id → nombre de categorías para enriquecer productos localmente.
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
        } else if (resCats.ok) {
          setCategorias(['Todas', ...resCats.data.map(c => c.nombre)]);
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
        if (!cancelado && ex.name !== 'CanceledError' && ex.code !== 'ERR_CANCELED') {
          console.error(ex);
          toast.error('Error al conectar con el servidor. Revisa la conexión.');
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    inicializarPOS();

    // Cleanup: si el componente se desmonta antes de que la promesa resuelva, abortar y cancelar
    return () => {
      cancelado = true;
      controller.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Búsqueda de productos (con detección de lector de barras) ──────────── */
  const handleBuscarChange = (e) => {
    const valor = e.target.value;
    setBuscarInput(valor);
    // Coincidencia exacta instantánea al escribir (escáner sin ENTER)
    const coincidencia = productos.find(
      p => p.codigo_barras === valor.trim() && p.estado === 'Activo'
    );
    if (coincidencia) {
      agregarProducto(coincidencia);
      setBuscarInput('');
      setBuscarDebounced('');
      toast.success(`✓ ${coincidencia.nombre} agregado al carrito`);
    }
  };

  // Soporte directo para pistolas lectoras que envían ENTER tras leer
  const handleBuscarKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valor = buscarInput.trim();
      if (!valor) return;

      const coincidencia = productos.find(
        p => (p.codigo_barras === valor || p.nombre.toLowerCase() === valor.toLowerCase()) && p.estado === 'Activo'
      );

      if (coincidencia) {
        agregarProducto(coincidencia);
        setBuscarInput('');
        setBuscarDebounced('');
        toast.success(`✓ ${coincidencia.nombre} agregado al carrito`);
      } else {
        toast.error(`Producto con código/nombre "${valor}" no encontrado.`);
      }
      inputBuscarRef.current?.focus();
    }
  };

  // Mantiene el cursor en el input de búsqueda si no hay modales abiertos
  useEffect(() => {
    if (!cargando && !mostrarModalCobro && !mostrarModalCliente) {
      inputBuscarRef.current?.focus();
    }
  }, [cargando, mostrarModalCobro, mostrarModalCliente]);

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
    // Si borra todo, limpiar el cliente seleccionado
    if (!e.target.value) setCliente(null);
  };

  /* ── Registro rápido de cliente ─────────────────────────────────────────── */
  const abrirModalCliente = () => {
    setNuevoCliNombre(buscarCliente); // Pre-llenar con lo que escribió
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
        // Recargar lista y seleccionar el nuevo cliente
        const resClis = await ventaService.obtenerClientes();
        if (resClis.ok) {
          setClientes(resClis.data);
          const nuevo = resClis.data.find(c => c.id === res.data.id);
          if (nuevo) {
            handleSeleccionarCliente(nuevo);
          }
        }
        toast.success(`✓ Cliente "${nuevoCliNombre}" registrado y seleccionado.`);
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
    if (!codigoFactura.trim()) {
      toast.error('El código de factura no puede estar vacío.');
      return;
    }
    // Validar límite de crédito antes de abrir modal
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
    setMostrarModalCobro(true);
  };

  const handleConfirmarVenta = async () => {
    setProcesandoPago(true);
    try {
      const payload = {
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        codigo_factura: codigoFactura,
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
        toast.success(`✓ Venta ${codigoFactura} registrada exitosamente.`);
        // Vaciar carrito y generar nuevo código para la siguiente venta
        vaciarCarrito();
        setCodigoFactura(generarCodigoFactura());
        const cliGeneral = clientes.find(c => c.dni_ruc === '00000000') || clientes[0];
        if (cliGeneral) { setCliente(cliGeneral); setBuscarCliente(cliGeneral.nombre); }
        setRequiereDelivery(false);
        setDireccionDespacho('');
        setCostoEnvio('0.00');
        setMostrarModalCobro(false);
        // Recargar productos para reflejar el nuevo stock
        const resProds = await ventaService.obtenerProductos();
        if (resProds.ok) setProductos(resProds.data);
      }
    } catch (ex) {
      const errorDetail = ex.response?.data?.detail || 'Error desconocido al procesar la transacción.';
      toast.error(`Error: ${errorDetail}`);
      // Recargar productos para actualizar stocks obsoletos en pantalla tras el fallo
      const resProds = await ventaService.obtenerProductos();
      if (resProds.ok) setProductos(resProds.data);
    } finally {
      setProcesandoPago(false);
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

  // Aritmética exacta en centavos para el cálculo de vuelto
  const efectivoCentavos = Math.round((parseFloat(efectivoRecibido) || 0) * 100);
  const totalCentavos = Math.round(total * 100);
  const vuelto = (efectivoCentavos - totalCentavos) / 100;

  /* ─────────────────────────────── RENDER ───────────────────────────────── */
  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 108px)', minHeight: '600px' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 500, borderRadius: '12px' },
          success: { iconTheme: { primary: '#059669', secondary: 'white' } },
          error: { iconTheme: { primary: '#dc2626', secondary: 'white' } },
        }}
      />

      {/* ══════════════════ PANEL IZQUIERDO: CATÁLOGO ══════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>

        {/* ─ Barra de búsqueda + filtros ─ */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '14px 16px',
          border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Buscador */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={15} style={{
              position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', pointerEvents: 'none',
            }} />
            <input
              ref={inputBuscarRef}
              type="text"
              value={buscarInput || ''}
              onChange={handleBuscarChange}
              onKeyDown={handleBuscarKeyDown}
              placeholder="Buscar por nombre o escanear código de barras..."
              className="form-input"
              style={{ paddingLeft: '34px', fontSize: '0.8125rem' }}
            />
          </div>

          {/* Filtros de categoría */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  background: categoriaSel === cat ? 'var(--color-primary)' : 'white',
                  color: categoriaSel === cat ? 'white' : '#6b7280',
                  borderColor: categoriaSel === cat ? 'var(--color-primary)' : 'var(--color-border-strong)',
                  boxShadow: categoriaSel === cat ? '0 2px 8px rgba(109,40,217,.3)' : 'none',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ─ Rejilla de productos ─ */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cargando ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: 'white', borderRadius: '14px',
              border: '1px solid var(--color-border)',
              color: '#9ca3af', fontWeight: 500,
            }}>
              <Package size={32} style={{ margin: '0 auto 12px', opacity: .3 }} />
              <p style={{ fontSize: '0.85rem' }}>Cargando catálogo de productos...</p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: 'white', borderRadius: '14px',
              border: '1px solid var(--color-border)',
              color: '#9ca3af',
            }}>
              <Search size={28} style={{ margin: '0 auto 12px', opacity: .3 }} />
              <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>Sin resultados para "{buscarInput || categoriaSel}"</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: '12px',
            }}>
              {productosFiltrados.map(prod => {
                const agotado = prod.stock_actual <= 0;
                const bajoStock = !agotado && prod.stock_actual <= prod.stock_minimo;
                return (
                  <div
                    key={prod.id}
                    onClick={() => !agotado && agregarProducto(prod)}
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '14px',
                      border: agotado ? '1px solid #fee2e2' : '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: agotado ? 'not-allowed' : 'pointer',
                      opacity: agotado ? 0.55 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    }}
                    onMouseEnter={e => {
                      if (!agotado) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.borderColor = agotado ? '#fee2e2' : 'var(--color-border)';
                    }}
                  >
                    <div>
                      {/* Badge de categoría */}
                      {prod.categoria_nombre && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: '#8b5cf6', background: '#f5f3ff',
                          padding: '2px 6px', borderRadius: '4px',
                          display: 'inline-block', marginBottom: '6px',
                        }}>
                          {prod.categoria_nombre}
                        </span>
                      )}
                      <h4 style={{
                        fontFamily: 'Outfit, sans-serif', fontWeight: 700,
                        fontSize: '0.8rem', color: '#1e1b4b',
                        lineHeight: 1.3, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {prod.nombre}
                      </h4>
                      <p style={{ fontSize: '0.6rem', color: '#d1d5db', fontFamily: 'monospace', marginTop: '3px' }}>
                        {prod.codigo_barras}
                      </p>
                    </div>
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1e1b4b' }}>
                        Bs. {prod.precio_venta.toFixed(2)}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700,
                        padding: '3px 7px', borderRadius: '9999px',
                        background: agotado ? '#fee2e2' : bajoStock ? '#fff7ed' : '#f0fdf4',
                        color: agotado ? '#dc2626' : bajoStock ? '#c2410c' : '#15803d',
                        border: `1px solid ${agotado ? '#fecaca' : bajoStock ? '#fed7aa' : '#dcfce7'}`,
                      }}>
                        {agotado ? 'Sin Stock' : `${prod.stock_actual} uds`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ PANEL DERECHO: CARRITO / POS ══════════════════ */}
      <div style={{
        width: '300px', flexShrink: 0,
        background: 'white', borderRadius: '14px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Cabecera del carrito */}
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={16} style={{ color: '#c4b5fd' }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'white' }}>
              Caja POS
            </span>
            {carrito.length > 0 && (
              <span style={{
                background: '#6d28d9', color: 'white', fontSize: '0.6rem',
                fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
              }}>
                {carrito.length}
              </span>
            )}
          </div>
          {carrito.length > 0 && (
            <button
              onClick={() => { vaciarCarrito(); setCodigoFactura(generarCodigoFactura()); const cg = clientes.find(c => c.dni_ruc === '00000000'); if (cg) { setCliente(cg); setBuscarCliente(cg.nombre); } }}
              title="Vaciar carrito"
              style={{
                background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)',
                borderRadius: '7px', padding: '4px 8px',
                color: '#fca5a5', fontSize: '0.6rem', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Trash2 size={11} /> Vaciar
            </button>
          )}
        </div>

        {/* Lista del carrito */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {carrito.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#d1d5db' }}>
              <ShoppingCart size={28} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af' }}>
                El carrito está vacío
              </p>
              <p style={{ fontSize: '0.7rem', color: '#d1d5db', marginTop: '4px' }}>
                Haz clic en un producto o escanea su código
              </p>
            </div>
          ) : (
            carrito.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{
                    fontSize: '0.75rem', fontWeight: 700, color: '#1e1b4b',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
                  }}>
                    {item.nombre}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '2px 0 0' }}>
                    Bs. {item.precio_venta.toFixed(2)} × {item.cantidad} = <strong style={{ color: '#6d28d9' }}>Bs. {((Math.round(item.precio_venta * 100) * item.cantidad) / 100).toFixed(2)}</strong>
                  </p>
                </div>
                <input
                  type="number"
                  value={item.cantidad || ''}
                  min={1}
                  onChange={e => actualizarCantidad(item.id, parseInt(e.target.value) || 0, item.stock_actual)}
                  style={{
                    width: '44px', textAlign: 'center', padding: '3px 4px',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '7px', fontSize: '0.75rem', fontWeight: 700,
                    color: '#1e1b4b', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { removerProducto(item.id); toast.success('Producto eliminado'); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#fca5a5', padding: '4px', borderRadius: '6px',
                    display: 'flex', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#fca5a5'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ─ Sección inferior: Config de venta ─ */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Código de Factura */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>
                Código de Factura
              </label>
              <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>
                ⚡ Automático
              </span>
            </div>
            <input
              type="text"
              value="Autogenerado por el Sistema"
              disabled
              className="form-input"
              style={{ fontSize: '0.75rem', fontFamily: 'monospace', letterSpacing: '0.02em', background: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}
            />
          </div>

          {/* Selector de cliente con Autocomplete */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>
                Cliente
              </label>
              <button
                onClick={abrirModalCliente}
                title="Registrar nuevo cliente"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#059669', display: 'flex', alignItems: 'center',
                  gap: '3px', fontSize: '0.6rem', fontWeight: 600,
                  padding: '2px 4px', borderRadius: '4px', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Plus size={10} /> Nuevo Cliente
              </button>
            </div>

            {/* Input de búsqueda */}
            <div style={{ position: 'relative' }}>
              <input
                ref={clienteInputRef}
                type="text"
                value={buscarCliente || ''}
                onChange={handleClienteInputChange}
                onFocus={() => setDropdownClienteVisible(true)}
                placeholder="Buscar cliente por nombre o DNI..."
                className="form-input"
                style={{ fontSize: '0.75rem', paddingRight: '28px' }}
              />
              <ChevronDown size={13} style={{
                position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
            </div>

            {/* Mostrar cliente seleccionado */}
            {clienteSeleccionado && clienteSeleccionado.saldo_deudor > 0 && (
              <p style={{ fontSize: '0.62rem', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
                ⚠ Deuda activa: Bs. {clienteSeleccionado.saldo_deudor.toFixed(2)}
              </p>
            )}

            {/* Dropdown autocomplete */}
            {dropdownClienteVisible && buscarCliente && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0, right: 0, zIndex: 200,
                  background: 'white',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {clientesFiltrados.length === 0 ? (
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 8px' }}>
                      Sin resultados para "{buscarCliente}"
                    </p>
                    <button
                      onClick={abrirModalCliente}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 10px',
                        background: '#f0fdf4', border: '1px dashed #86efac',
                        borderRadius: '8px', cursor: 'pointer',
                        color: '#059669', fontSize: '0.72rem', fontWeight: 700,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Plus size={13} /> Registrar "{buscarCliente}" como nuevo cliente
                    </button>
                  </div>
                ) : (
                  <>
                    {clientesFiltrados.slice(0, 8).map(cli => (
                      <button
                        key={cli.id}
                        onClick={() => handleSeleccionarCliente(cli)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: '1px solid #f9fafb',
                          transition: 'background 0.1s',
                          display: 'block',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <p style={{ fontSize: '0.77rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
                          {cli.nombre}
                        </p>
                        <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '1px 0 0' }}>
                          {cli.dni_ruc ? `DNI: ${cli.dni_ruc}` : ''}
                          {cli.saldo_deudor > 0 ? ` · Deuda: Bs. ${cli.saldo_deudor.toFixed(2)}` : ''}
                        </p>
                      </button>
                    ))}
                    {/* Botón de crear cliente al final */}
                    <button
                      onClick={abrirModalCliente}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 12px', background: '#fafafa',
                        border: 'none', borderTop: '1px solid var(--color-border)',
                        cursor: 'pointer', color: '#059669', fontSize: '0.72rem', fontWeight: 700,
                      }}
                    >
                      <UserPlus size={12} /> Registrar nuevo cliente...
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
              Método de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { id: 'Efectivo', label: 'Efectivo', icon: <DollarSign size={12} /> },
                { id: 'Tarjeta',  label: 'Tarjeta',  icon: <CreditCard size={12} /> },
                { id: 'QR',       label: 'Pago QR',  icon: <QrCode size={12} /> },
                { id: 'Credito',  label: 'Crédito',  icon: <UserPlus size={12} /> },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetodoPago(m.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '3px', padding: '7px 4px',
                    borderRadius: '8px', border: '1px solid',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontSize: '0.6rem', fontWeight: 700,
                    background: metodoPago === m.id ? 'var(--color-primary)' : 'white',
                    color: metodoPago === m.id ? 'white' : '#6b7280',
                    borderColor: metodoPago === m.id ? 'var(--color-primary)' : 'var(--color-border-strong)',
                    boxShadow: metodoPago === m.id ? '0 2px 8px rgba(109,40,217,.35)' : 'none',
                  }}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Total + Botón cobrar */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            borderRadius: '10px', padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: '0.6rem', color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Total a Cobrar
              </p>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: '2px 0 0' }}>
                Bs. {total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={handleAbrirConfirmacion}
              style={{
                background: '#7c3aed',
                border: '2px solid rgba(255,255,255,.2)',
                borderRadius: '10px',
                color: 'white',
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '0.75rem', fontWeight: 700,
                transition: 'all 0.15s',
                boxShadow: '0 4px 12px rgba(124,58,237,.5)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Cobrar <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════ MODAL DE COBRO ══════════════════ */}
      {mostrarModalCobro && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '380px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #6d28d9, #059669)' }} />

            <div className="modal-header">
              <span className="modal-title">💳 Confirmación de Cobro — {metodoPago}</span>
              <button onClick={() => setMostrarModalCobro(false)} style={{
                background: '#f3f4f6', border: 'none', borderRadius: '8px',
                width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
              }}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Resumen */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f5f3ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Total Neto</p>
                  <p style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: '1.4rem', color: '#1e1b4b', margin: '2px 0 0' }}>
                    Bs. {total.toFixed(2)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: 0 }}>Factura</p>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', fontFamily: 'monospace', margin: '2px 0 0' }}>{codigoFactura}</p>
                </div>
              </div>

              {/* Cliente */}
              {clienteSeleccionado && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span>Cliente:</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>{clienteSeleccionado.nombre}</span>
                </div>
              )}

              {/* Delivery / Envío */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={requiereDelivery}
                    onChange={(e) => {
                      setRequiereDelivery(e.target.checked);
                      if (e.target.checked && !direccionDespacho) {
                        setDireccionDespacho(clienteSeleccionado?.direccion || '');
                      }
                    }}
                    style={{
                      width: '15px',
                      height: '15px',
                      accentColor: '#6d28d9',
                      cursor: 'pointer'
                    }}
                  />
                  ¿Registrar envío para Delivery?
                </label>

                {requiereDelivery && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Dirección de Despacho *
                      </label>
                      <textarea
                        value={direccionDespacho || ''}
                        onChange={(e) => setDireccionDespacho(e.target.value)}
                        placeholder="Ingrese la ubicación real de entrega..."
                        required={true}
                        rows={2}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '6px 10px', resize: 'none' }}
                      />
                    </div>
                    
                    {/* Visualizador de Mapa Embebido */}
                    {clienteSeleccionado?.enlace_ubicacion && (() => {
                      const coords = extraerCoordenadas(clienteSeleccionado.enlace_ubicacion);
                      if (coords) {
                        const bboxMinLng = coords.lng - 0.003;
                        const bboxMinLat = coords.lat - 0.003;
                        const bboxMaxLng = coords.lng + 0.003;
                        const bboxMaxLat = coords.lat + 0.003;
                        return (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                              Mapa de Ubicación (OpenStreetMap)
                            </label>
                            <div style={{ width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                              <iframe
                                title="Mapa del Cliente"
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                marginHeight="0"
                                marginWidth="0"
                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bboxMinLng}%2C${bboxMinLat}%2C${bboxMaxLng}%2C${bboxMaxLat}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                                style={{ border: 0 }}
                              />
                            </div>
                            <a
                              href={clienteSeleccionado.enlace_ubicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.65rem', color: '#6d28d9', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                            >
                              📍 Abrir en mapa externo
                            </a>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ marginTop: '4px', padding: '8px 10px', background: '#f5f3ff', borderRadius: '8px', border: '1px dashed #c4b5fd', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ fontSize: '0.68rem', color: '#6d28d9', fontWeight: 700, margin: 0 }}>
                              📍 Ubicación de Referencia:
                            </p>
                            <a
                              href={clienteSeleccionado.enlace_ubicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.68rem', color: '#7c3aed', wordBreak: 'break-all', textDecoration: 'underline', fontWeight: 500 }}
                            >
                              {clienteSeleccionado.enlace_ubicacion}
                            </a>
                          </div>
                        );
                      }
                    })()}

                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Costo de Envío (Bs.)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={costoEnvio}
                        onChange={(e) => setCostoEnvio(e.target.value)}
                        placeholder="0.00"
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Panel efectivo o QR */}
              {(metodoPago === 'Efectivo' || metodoPago === 'QR') && (
                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                  <label className="form-label">
                    {metodoPago === 'QR' ? 'Monto a transferir por QR (Bs.)' : 'Monto Recibido (Bs.) *'}
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={efectivoRecibido || ''}
                    onChange={e => setEfectivoRecibido(e.target.value)}
                    placeholder="0.00"
                    className="form-input"
                    disabled={metodoPago === 'QR'}
                    autoFocus={metodoPago !== 'QR'}
                  />
                  {metodoPago === 'Efectivo' && parseFloat(efectivoRecibido) >= total && (
                    <div style={{
                      marginTop: '10px', display: 'flex', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#d1fae5', borderRadius: '8px',
                      border: '1px solid #a7f3d0',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>Vuelto a entregar:</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#047857', fontFamily: 'Outfit' }}>
                        Bs. {vuelto.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {metodoPago === 'QR' && (
                    <div style={{
                      marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      padding: '12px', background: '#f5f3ff', borderRadius: '8px',
                      border: '1px dashed #c4b5fd',
                    }}>
                      <QrCode size={40} style={{ color: '#6d28d9' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6d28d9', textAlign: 'center' }}>
                        Muestre el código QR al cliente para recibir el pago inmediato
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Panel crédito */}
              {metodoPago === 'Credito' && clienteSeleccionado && (
                <div style={{ background: '#fef9f0', padding: '12px', borderRadius: '10px', border: '1px solid #fed7aa', fontSize: '0.75rem' }}>
                  {[
                    ['Saldo deudor actual', `Bs. ${clienteSeleccionado.saldo_deudor.toFixed(2)}`],
                    ['Esta venta', `+ Bs. ${total.toFixed(2)}`],
                    ['Nuevo saldo estimado', `Bs. ${((Math.round(clienteSeleccionado.saldo_deudor * 100) + Math.round(total * 100)) / 100).toFixed(2)}`],
                    ['Límite de crédito', `Bs. ${clienteSeleccionado.limite_credito.toFixed(2)}`],
                  ].map(([label, value], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < 3 ? '1px solid #fde68a' : 'none' }}>
                      <span style={{ color: '#92400e' }}>{label}:</span>
                      <span style={{ fontWeight: 700, color: '#78350f' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setMostrarModalCobro(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleConfirmarVenta}
                disabled={
                  procesandoPago ||
                  (metodoPago === 'Efectivo' && (!efectivoRecibido || parseFloat(efectivoRecibido) < total)) ||
                  (requiereDelivery && !direccionDespacho.trim())
                }
                className="btn-primary"
                style={{ minWidth: '130px', justifyContent: 'center' }}
              >
                {procesandoPago
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
                  : <><ArrowRight size={14} /> Confirmar Venta</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MINI-MODAL CLIENTE RÁPIDO ══════════════════ */}
      {mostrarModalCliente && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '380px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #059669, #10b981)' }} />

            <div className="modal-header">
              <span className="modal-title">👤 Registro Rápido de Cliente</span>
              <button onClick={() => setMostrarModalCliente(false)} style={{
                background: '#f3f4f6', border: 'none', borderRadius: '8px',
                width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
              }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleGuardarClienteRapido}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Nombre Completo *</label>
                  <input
                    type="text" required
                    value={nuevoCliNombre || ''}
                    onChange={e => setNuevoCliNombre(e.target.value)}
                    placeholder="Ej: María García"
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Teléfono (Opcional)</label>
                    <input
                      type="text"
                      value={nuevoCliTelefono || ''}
                      onChange={e => setNuevoCliTelefono(e.target.value)}
                      placeholder="70012345"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">DNI / CI (Opcional)</label>
                    <input
                      type="text"
                      value={nuevoCliDni || ''}
                      onChange={e => setNuevoCliDni(e.target.value)}
                      placeholder="12345678"
                      className="form-input"
                    />
                  </div>
                </div>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', background: '#f9fafb', padding: '8px 10px', borderRadius: '8px', margin: 0 }}>
                  💡 El crédito y dirección se pueden configurar después desde la sección de Clientes.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setMostrarModalCliente(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoCliente} className="btn-primary" style={{ background: '#059669', minWidth: '130px', justifyContent: 'center' }}>
                  {guardandoCliente
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                    : <><UserPlus size={14} /> Crear y Seleccionar</>}
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
