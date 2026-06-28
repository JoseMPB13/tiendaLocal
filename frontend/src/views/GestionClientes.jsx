/**
 * Vista: GestionClientes.jsx
 * Módulo de gestión de clientes con control de crédito y saldo deudor.
 * Diseño premium con tabla, badges de estado y formulario modal.
 * Integra geolocalización bidireccional mediante MapaInteractivo con Leaflet,
 * soporte de extracción de coordenadas a través de enlaces en el evento onBlur,
 * y auto-rellenado de dirección en tiempo real vía geocodificación de Nominatim.
 */

import { useState, useEffect } from 'react';
import clienteService from '../services/clienteService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Users, MapPin, DollarSign, AlertCircle, TrendingUp, UserCheck } from 'lucide-react';
import MapaInteractivo from '../components/MapaInteractivo';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

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

export const GestionClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda y estado/deuda
  const [buscarTexto, setBuscarTexto] = useState('');
  const [estadoSel, setEstadoSel] = useState('');
  const [deudaSel, setDeudaSel] = useState('');

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setPagina(1);
  }, [buscarTexto, estadoSel, deudaSel]);

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);

  // Campos del Formulario
  const [dniRuc, setDniRuc] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [enlaceUbicacion, setEnlaceUbicacion] = useState('');
  const [latitud, setLatitud] = useState(-17.7833);
  const [longitud, setLongitud] = useState(-63.1667);
  const [saldoDeudor, setSaldoDeudor] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal de Ver Mapa (Vista Rápida)
  const [mostrarVerMapa, setMostrarVerMapa] = useState(false);
  const [clienteMapa, setClienteMapa] = useState(null);

  // Modal Desactivación
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [clienteEliminarId, setClienteEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const res = await clienteService.obtenerTodos(true);
      if (res.ok) {
        setClientes(res.data);
      }
    } catch (ex) {
      console.error(ex);
      toast.error('Error al cargar los clientes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarClientes();
    };
    inicializar();
  }, []);

  const abrirCrear = () => {
    setClienteEdit(null);
    setDniRuc('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setEnlaceUbicacion('');
    setLatitud(-17.7833);
    setLongitud(-63.1667);
    setSaldoDeudor(0.00);
    setLimiteCredito(0.00);
    setMostrarForm(true);
  };

  const abrirEditar = (cli) => {
    setClienteEdit(cli);
    setDniRuc(cli.dni_ruc || '');
    setNombre(cli.nombre);
    setTelefono(cli.telefono || '');
    setDireccion(cli.direccion || '');
    setEnlaceUbicacion(cli.enlace_mapa || cli.enlace_ubicacion || '');
    setLatitud(cli.latitud !== undefined && cli.latitud !== null ? cli.latitud : -17.7833);
    setLongitud(cli.longitud !== undefined && cli.longitud !== null ? cli.longitud : -63.1667);
    setSaldoDeudor(cli.saldo_deudor);
    setLimiteCredito(cli.limite_credito);
    setMostrarForm(true);
  };

  const abrirVerMapa = (cli) => {
    setClienteMapa(cli);
    setMostrarVerMapa(true);
  };

  const obtenerDireccionDesdeCoordenadas = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
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
          
          return direccionFormateada;
        }
      }
    } catch (error) {
      console.error('Error al realizar geocodificación inversa:', error);
    }
    return '';
  };

  const handleUbicacionCambiada = async (newLat, newLng, skipGeocoding = false) => {
    setLatitud(newLat);
    setLongitud(newLng);
    
    if (!skipGeocoding && newLat && newLng) {
      const loadToast = toast.loading('Obteniendo dirección por geocodificación inversa...');
      const dir = await obtenerDireccionDesdeCoordenadas(newLat, newLng);
      toast.dismiss(loadToast);
      if (dir) {
        setDireccion(dir);
        toast.success(`Dirección sugerida: ${dir}`);
      }
    }
  };

  const resolverEnlaceBackend = async (url) => {
    if (!url || !url.startsWith('http')) return;
    const loadToast = toast.loading('Resolviendo coordenadas del enlace en el servidor...');
    try {
      const res = await clienteService.resolverEnlaceMapa(url);
      toast.dismiss(loadToast);
      if (res.ok && res.data) {
        toast.success('Coordenadas resueltas en el servidor.');
        handleUbicacionCambiada(res.data.latitud, res.data.longitud, false);
      }
    } catch (ex) {
      toast.dismiss(loadToast);
      console.error(ex);
      toast.error(ex.response?.data?.detail || 'No se pudieron resolver las coordenadas del enlace.');
    }
  };

  const handleEnlaceBlur = () => {
    if (!enlaceUbicacion) return;
    const coords = extraerCoordenadas(enlaceUbicacion);
    if (coords) {
      toast.success('Coordenadas extraídas del enlace en caliente.');
      handleUbicacionCambiada(coords.lat, coords.lng, false);
    } else if (enlaceUbicacion.startsWith('http')) {
      resolverEnlaceBackend(enlaceUbicacion);
    }
  };

  const handleEnlaceChange = (val) => {
    setEnlaceUbicacion(val);
    if (!val) return;
    const coords = extraerCoordenadas(val);
    if (coords) {
      toast.success('Coordenadas extraídas del enlace automáticamente.');
      handleUbicacionCambiada(coords.lat, coords.lng, false);
    }
  };

  const handleEnlacePaste = (e) => {
    const val = e.clipboardData.getData('text');
    if (!val) return;
    setEnlaceUbicacion(val); // Sincronizar estado en el paste
    const coords = extraerCoordenadas(val);
    if (coords) {
      toast.success('Coordenadas extraídas desde el portapapeles.');
      handleUbicacionCambiada(coords.lat, coords.lng, false);
    } else if (val.startsWith('http')) {
      resolverEnlaceBackend(val);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setProcesandoForm(true);

    const payload = {
      dni_ruc: dniRuc || null,
      nombre,
      telefono: telefono || null,
      direccion: direccion || null,
      enlace_ubicacion: enlaceUbicacion || null,
      enlace_mapa: enlaceUbicacion || null,
      latitud: latitud !== null && latitud !== undefined ? parseFloat(latitud) : null,
      longitud: longitud !== null && longitud !== undefined ? parseFloat(longitud) : null,
      saldo_deudor: parseFloat(saldoDeudor),
      limite_credito: parseFloat(limiteCredito)
    };

    try {
      if (clienteEdit) {
        const res = await clienteService.actualizar(clienteEdit.id, payload);
        if (res.ok) {
          toast.success('Cliente actualizado correctamente.');
          setMostrarForm(false);
          cargarClientes();
        }
      } else {
        const res = await clienteService.crear(payload);
        if (res.ok) {
          toast.success('Cliente registrado con éxito.');
          setMostrarForm(false);
          cargarClientes();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al procesar el cliente.';
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setClienteEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      const res = await clienteService.eliminar(clienteEliminarId);
      if (res.ok) {
        toast.success('Cliente desactivado (baja lógica).');
        setMostrarEliminar(false);
        cargarClientes();
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo desactivar el cliente.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Lógica de filtrado de clientes (búsqueda en tiempo real por Nombre, DNI/RUC o Teléfono,
  // y filtros por Estado y condición de Deuda)
  const clientesFiltrados = clientes.filter((cli) => {
    const coincideTexto =
      cli.nombre.toLowerCase().includes(buscarTexto.toLowerCase()) ||
      (cli.dni_ruc && cli.dni_ruc.toLowerCase().includes(buscarTexto.toLowerCase())) ||
      (cli.telefono && cli.telefono.toLowerCase().includes(buscarTexto.toLowerCase()));

    const coincideEstado =
      !estadoSel || cli.estado === estadoSel;

    let coincideDeuda = true;
    if (deudaSel === 'con_deuda') {
      coincideDeuda = cli.saldo_deudor > 0;
    } else if (deudaSel === 'sin_deuda') {
      coincideDeuda = cli.saldo_deudor === 0;
    }

    return coincideTexto && coincideEstado && coincideDeuda;
  });

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const clientesPaginados = clientesFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  // Cálculos dinámicos de métricas del Mini-Dashboard
  // Tarjeta 1: Total Clientes Activos (Recuento de registros con estado 'Activo')
  const totalActivosCount = clientes.filter(c => c.estado === 'Activo').length;

  // Tarjeta 2: Clientes con Deuda (Cantidad de clientes cuyo 'saldo_deudor > 0')
  const clientesConDeudaCount = clientes.filter(c => c.saldo_deudor > 0).length;

  // Tarjeta 3: Cartera Total en la Calle (Suma acumulada de todos los 'saldo_deudor')
  const carteraCalleTotal = clientes.reduce((acc, c) => acc + (parseFloat(c.saldo_deudor) || 0), 0);

  // Tarjeta 4: Promedio de Límite de Crédito (Media del 'limite_credito' asignado)
  const promedioLimiteCredito = clientes.length > 0
    ? clientes.reduce((acc, c) => acc + (parseFloat(c.limite_credito) || 0), 0) / clientes.length
    : 0;

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
            background: 'linear-gradient(135deg, #ec4899, #db2777)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Gestión de Clientes</h3>
            <p className="page-subtitle">Control de cuentas de crédito y saldos deudores</p>
          </div>
        </div>
        <button onClick={abrirCrear} className="btn-primary">
          <Plus size={15} />
          Registrar Cliente
        </button>
      </div>

      {/* ── MINI-DASHBOARD DE CLIENTES ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '5px'
      }}>
        {/* Tarjeta 1: Total Clientes Activos */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#fdf2f8',
            color: '#db2777',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <UserCheck size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Clientes Activos</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>{totalActivosCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>regs</span></span>
          </div>
        </div>

        {/* Tarjeta 2: Clientes con Deuda */}
        <div style={{
          background: 'white',
          border: '1px solid #fee2e2',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#fef2f2',
            color: '#ef4444',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Con Deuda</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', fontFamily: 'Inter, sans-serif' }}>{clientesConDeudaCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>deudores</span></span>
          </div>
        </div>

        {/* Tarjeta 3: Cartera Total */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#f0fdf4',
            color: '#22c55e',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Cartera en la Calle</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>Bs. {carteraCalleTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Tarjeta 4: Promedio Límite de Crédito */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#faf5ff',
            color: '#9333ea',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Promedio Límite</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>Bs. {promedioLimiteCredito.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* ── PANEL DE BÚSQUEDA Y FILTRADO ── */}
      <PanelFiltroBusqueda
        buscarTexto={buscarTexto}
        alCambiarBuscarTexto={setBuscarTexto}
        estadoSeleccionado={estadoSel}
        alCambiarEstado={setEstadoSel}
        deudaSeleccionada={deudaSel}
        alCambiarDeuda={setDeudaSel}
        placeholder="Buscar clientes por nombre, DNI/RUC o teléfono..."
      />

      {/* ── TABLA / CARDS RESPONSIVAS ── */}
      <div className="table-wrapper">
        {/* Vista para Escritorio */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '750px' }}>
            <thead>
              <tr>
                <th>DNI / RUC</th>
                <th>Nombre / Razón Social</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Saldo Deudor</th>
                <th style={{ textAlign: 'right' }}>Límite Crédito</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontWeight: 500 }}>
                    Cargando catálogo de clientes...
                  </td>
                </tr>
              </tbody>
            ) : clientes.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No se registran clientes en el sistema.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {clientesPaginados.map((cli) => (
                  <tr key={cli.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
                      {cli.dni_ruc || '—'}
                    </td>
                    <td className="bold">{cli.nombre}</td>
                    <td style={{ color: '#6b7280' }}>{cli.telefono || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: cli.saldo_deudor > 0 ? '#dc2626' : '#374151' }}>
                      Bs. {cli.saldo_deudor.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>
                      Bs. {cli.limite_credito.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge ${cli.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                        {cli.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {cli.latitud !== null && cli.latitud !== undefined && cli.longitud !== null && cli.longitud !== undefined && (
                          <button
                            onClick={() => abrirVerMapa(cli)}
                            className="btn-icon"
                            style={{ color: '#db2777' }}
                            title="Ver ubicación en mapa"
                          >
                            <MapPin size={15} />
                          </button>
                        )}
                        <button onClick={() => abrirEditar(cli)} className="btn-icon" title="Editar cliente">
                          <Edit3 size={15} />
                        </button>
                        {cli.estado === 'Activo' && cli.dni_ruc !== '00000000' && (
                          <button onClick={() => abrirDesactivar(cli.id)} className="btn-icon danger" title="Desactivar cliente">
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

        {/* Vista para Móviles */}
        {!cargando && clientes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {clientesPaginados.map((cli) => (
              <div key={cli.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm hover:border-pink-200/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{cli.nombre}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">DNI/RUC: {cli.dni_ruc || '—'}</p>
                  </div>
                  <span className={`badge ${cli.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                    {cli.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Teléfono</span>
                    <p className="text-gray-700 font-medium mt-0.5">{cli.telefono || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Dirección</span>
                    <p className="text-gray-700 font-medium mt-0.5 truncate max-w-[140px]" title={cli.direccion}>{cli.direccion || '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Saldo Deudor</span>
                    <p className={`font-bold mt-0.5 ${cli.saldo_deudor > 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                      Bs. {cli.saldo_deudor.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Límite Crédito</span>
                    <p className="text-purple-700 font-bold mt-0.5">Bs. {cli.limite_credito.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  {cli.latitud !== null && cli.latitud !== undefined && cli.longitud !== null && cli.longitud !== undefined && (
                    <button
                      onClick={() => abrirVerMapa(cli)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold bg-pink-50 hover:bg-pink-100 border border-pink-100 text-pink-600 rounded-xl transition-colors"
                      title="Ver ubicación en mapa"
                    >
                      <MapPin size={14} />
                      <span>Ver Mapa</span>
                    </button>
                  )}
                  <button
                    onClick={() => abrirEditar(cli)}
                    className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-gray-700 rounded-xl transition-colors"
                    title="Editar cliente"
                  >
                    <Edit3 size={14} />
                    <span>Editar</span>
                  </button>
                  {cli.estado === 'Activo' && cli.dni_ruc !== '00000000' && (
                    <button
                      onClick={() => abrirDesactivar(cli.id)}
                      className="flex justify-center items-center p-2 text-rose-650 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition-colors"
                      title="Desactivar cliente"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginadorTablas
          totalItems={clientesFiltrados.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* ── MODAL FORMULARIO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '480px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ec4899, #db2777)' }} />

            <div className="modal-header">
              <span className="modal-title">
                {clienteEdit ? '✏️ Editar Cliente' : '👤 Registrar Nuevo Cliente'}
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
                  <label className="form-label">Nombre Completo / Razón Social *</label>
                  <input
                    type="text" required value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Carlos Mendoza"
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">DNI / RUC (Opcional)</label>
                    <input
                      type="text" value={dniRuc}
                      onChange={(e) => setDniRuc(e.target.value)}
                      placeholder="Documento único"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Teléfono (Opcional)</label>
                    <input
                      type="text" value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="999-999-999"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Dirección (Opcional)</label>
                  <input
                    type="text" value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Av. Los Tulipanes 789"
                    className="form-input"
                  />
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Enlace de Ubicación GPS (Google Maps / OSM - Opcional)</label>
                  <input
                    type="text"
                    value={enlaceUbicacion}
                    onChange={(e) => handleEnlaceChange(e.target.value)}
                    onPaste={handleEnlacePaste}
                    onBlur={handleEnlaceBlur}
                    placeholder="https://maps.google.com/?q=..."
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Latitud (Opcional)</label>
                    <input
                      type="number"
                      step="any"
                      value={latitud !== null && latitud !== undefined ? latitud : ''}
                      onChange={(e) => setLatitud(e.target.value === '' ? null : parseFloat(e.target.value))}
                      placeholder="Ej: -16.5000"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Longitud (Opcional)</label>
                    <input
                      type="number"
                      step="any"
                      value={longitud !== null && longitud !== undefined ? longitud : ''}
                      onChange={(e) => setLongitud(e.target.value === '' ? null : parseFloat(e.target.value))}
                      placeholder="Ej: -68.1500"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Ubicación Geográfica en Mapa</label>
                  <div style={{ width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden' }}>
                    <MapaInteractivo
                      lat={latitud}
                      lng={longitud}
                      onChange={(newLat, newLng) => {
                        handleUbicacionCambiada(newLat, newLng);
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '-4px' }}>
                    * Arrastre el marcador o haga clic en el mapa para capturar las coordenadas de entrega.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Saldo Deudor Inicial (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={saldoDeudor}
                      onChange={(e) => setSaldoDeudor(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Límite de Crédito (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={limiteCredito}
                      onChange={(e) => setLimiteCredito(e.target.value)}
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
                  {procesandoForm ? 'Guardando...' : clienteEdit ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL MAPA VISTA RÁPIDA ── */}
      {mostrarVerMapa && clienteMapa && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '500px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ec4899, #db2777)' }} />

            <div className="modal-header">
              <span className="modal-title">📍 Ubicación de {clienteMapa.nombre}</span>
              <button
                onClick={() => { setMostrarVerMapa(false); setClienteMapa(null); }}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div style={{ height: '260px' }}>
                <MapaInteractivo 
                  lat={clienteMapa.latitud} 
                  lng={clienteMapa.longitud} 
                  soloLectura={true} 
                />
              </div>
              <div className="text-xs space-y-1.5 text-gray-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p><strong>Dirección:</strong> {clienteMapa.direccion || 'No especificada'}</p>
                <p><strong>Coordenadas:</strong> {clienteMapa.latitud?.toFixed(6)}, {clienteMapa.longitud?.toFixed(6)}</p>
                {clienteMapa.enlace_mapa && (
                  <p>
                    <strong>Enlace:</strong>{' '}
                    <a 
                      href={clienteMapa.enlace_mapa} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-pink-600 hover:text-pink-700 underline"
                    >
                      Ver en Google Maps
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => { setMostrarVerMapa(false); setClienteMapa(null); }} 
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)', borderColor: '#db2777' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Inactivar Cliente"
        mensaje="¿Está seguro de desactivar este cliente? Dejará de aparecer en los selectores de facturación y crédito de caja POS."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionClientes;
