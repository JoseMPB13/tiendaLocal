// =============================================================================
// COMPONENTE: GestionEnvios.jsx
// Propósito: Vista administrativa para el control logístico de despachos y repartos.
//            Permite asociar órdenes a ventas, cambiar repartidores y monitorear
//            rutas en tiempo real.
// Integración Leaflet: Hace uso del componente de mapas interactivos del proyecto
//                      para geolocalizar de forma visual e inmediata la dirección
//                      de entrega de los clientes registrados.
// Idioma: Español
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import deliveryService from '../services/deliveryService';
import usuarioService from '../services/usuarioService';
import PaginadorTablas from '../components/PaginadorTablas';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Truck, Plus, MapPin, 
  CheckCircle2, Clock, X, Ban, Eye, Edit3, Play, Check,
  ShoppingCart, FileText
} from 'lucide-react';
import MapaInteractivo from '../components/MapaInteractivo';
import { MapaSeguimiento } from '../components/MapaSeguimiento';

import ventaService from '../services/ventaService';
import clienteService from '../services/clienteService';
import reportesService from '../services/reportesService';
import { obtenerFechaBoliviaHoy, formatearFechaHoraBolivia } from '../utils/fechaBolivia';


export const GestionEnvios = () => {
  const navigate = useNavigate();
  const [envios, setEnvios] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Coordenadas fijas del origen (Kiosco) cargadas desde el sistema
  const [kiosco, setKiosco] = useState({ lat: -17.7833, lng: -63.1667 });

  // Ubicación del repartidor asignado en tiempo real (para tracking en el modal de detalle)
  const [posicionRepartidor, setPosicionRepartidor] = useState({ lat: null, lng: null });

  // 1. Cargar ubicación del Kiosco desde la base de datos al montar el componente
  useEffect(() => {
    const cargarUbicacionKiosco = async () => {
      try {
        const [resLat, resLng] = await Promise.all([
          deliveryService.obtenerConfiguracion('kiosco_latitud'),
          deliveryService.obtenerConfiguracion('kiosco_longitud')
        ]);
        if (resLat.ok && resLng.ok) {
          setKiosco({
            lat: parseFloat(resLat.data.valor),
            lng: parseFloat(resLng.data.valor)
          });
        }
      } catch {
        console.info('Usando coordenadas por defecto del kiosco.');
      }
    };
    cargarUbicacionKiosco();
  }, []);


  const handleRedirigirEditarVenta = (ventaId) => {
    localStorage.setItem('editar_venta_id', ventaId);
    navigate('/punto-venta');
  };

  const handleDescargarReporteEnvios = async () => {
    try {
      const loadToast = toast.loading('Generando reporte PDF de envíos...');
      const blob = await reportesService.descargarPdfEnvios();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_envios_${obtenerFechaBoliviaHoy()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Reporte de envíos descargado con éxito.', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el reporte de envíos.');
    }
  };


  // Filtros y Búsqueda
  const [buscarVenta, setBuscarVenta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

  // Extractor universal de coordenadas dual con búsqueda profunda en jerarquía de objetos
  const resolverCoordenadas = (obj) => {
    if (!obj) return [-17.7833, -63.1667];

    // Intentar encontrar latitud y longitud numéricas válidas en cualquier parte del objeto
    const buscarCoords = (o) => {
      if (!o || typeof o !== 'object') return null;
      
      let lat = o.latitud;
      let lng = o.longitud;
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        const pLat = parseFloat(lat);
        const pLng = parseFloat(lng);
        if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
          return [pLat, pLng];
        }
      }

      // Buscar recursivamente en objetos hijos comunes
      for (const key of ['cliente', 'clientes', 'venta', 'ventas']) {
        if (o[key]) {
          const res = buscarCoords(o[key]);
          if (res) return res;
        }
      }
      return null;
    };

    const coordsValidas = buscarCoords(obj);
    if (coordsValidas) return coordsValidas;

    // Fallback de Enlace: Buscar enlace_mapa o enlace_ubicacion en cualquier parte del objeto
    const buscarEnlace = (o) => {
      if (!o || typeof o !== 'object') return null;
      let enlace = o.enlace_mapa || o.enlace_ubicacion;
      if (enlace && typeof enlace === 'string') return enlace;

      for (const key of ['cliente', 'clientes', 'venta', 'ventas']) {
        if (o[key]) {
          const res = buscarEnlace(o[key]);
          if (res) return res;
        }
      }
      return null;
    };

    const enlaceUrl = buscarEnlace(obj);
    if (enlaceUrl) {
      const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)|(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
      const match = enlaceUrl.match(regex);
      if (match) {
        const latStr = match[1] || match[3] || match[5];
        const lngStr = match[2] || match[4] || match[6];
        if (latStr && lngStr) {
          const pLat = parseFloat(latStr);
          const pLng = parseFloat(lngStr);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            return [pLat, pLng];
          }
        }
      }
    }

    // Coordenadas por defecto (Santa Cruz de la Sierra)
    return [-17.7833, -63.1667];
  };

  // Modal para registrar envío manual
  const [mostrarForm, setMostrarForm] = useState(false);
  const [envioSeleccionadoId, setEnvioSeleccionadoId] = useState('');
  const [repartidorId, setRepartidorId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('0.00');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal para cancelación del envío con motivo obligatorio
  const [mostrarModalCancelarAdmin, setMostrarModalCancelarAdmin] = useState(false);
  const [envioCancelarId, setEnvioCancelarId] = useState(null);
  const [motivoCancelarAdmin, setMotivoCancelarAdmin] = useState('');
  const [procesandoCancelarAdmin, setProcesandoCancelarAdmin] = useState(false);

  // Modal para ver detalles logísticos con mapa
  const [mostrarModalDetalle, setMostrarModalDetalle] = useState(false);
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null);

  // Efecto: consulta periódica de la posición GPS del repartidor cuando el modal de detalle está abierto
  // y el envío está en estado 'En Camino'. Polling cada 6 segundos para no saturar el servidor.
  useEffect(() => {
    if (!mostrarModalDetalle || envioSeleccionado?.estado_envio !== 'En Camino' || !envioSeleccionado?.repartidor_id) {
      return;
    }

    let intervalId = null;

    const actualizarUbicacion = async () => {
      try {
        const res = await deliveryService.obtenerUbicacionRepartidor(envioSeleccionado.repartidor_id);
        if (res.ok && res.data) {
          setPosicionRepartidor({
            lat: res.data.latitud_actual ? parseFloat(res.data.latitud_actual) : null,
            lng: res.data.longitud_actual ? parseFloat(res.data.longitud_actual) : null
          });
        }
      } catch (err) {
        console.error('Error al obtener ubicación del repartidor:', err);
      }
    };

    actualizarUbicacion(); // Consulta inmediata inicial
    intervalId = setInterval(actualizarUbicacion, 6000); // Polling cada 6 segundos

    return () => {
      if (intervalId) clearInterval(intervalId);
      setPosicionRepartidor({ lat: null, lng: null });
    };
  }, [mostrarModalDetalle, envioSeleccionado]);


  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Modal para la edición de envío
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [envioEditar, setEnvioEditar] = useState(null);
  const [editDireccion, setEditDireccion] = useState('');
  const [editCostoEnvio, setEditCostoEnvio] = useState('0.00');
  const [editRepartidorId, setEditRepartidorId] = useState('');
  const [procesandoEdit, setProcesandoEdit] = useState(false);

  // Coordenadas geográficas locales para el mapa en los formularios de creación/edición
  const [formLat, setFormLat] = useState(-17.7833);
  const [formLng, setFormLng] = useState(-63.1667);

  const abrirDetalleEnvio = (env) => {
    setEnvioSeleccionado(env);
    setMostrarModalDetalle(true);
  };

  // Cargar ventas y clientes al abrir el modal de nuevo despacho
  const abrirNuevoDespacho = async () => {
    try {
      const [resVentas, resClientes] = await Promise.all([
        ventaService.obtenerVentas({ limit: 200 }),
        clienteService.obtenerTodos(true)
      ]);
      if (resVentas.ok) setVentas(resVentas.data || []);
      if (resClientes.ok) setClientes(resClientes.data || []);
      setEnvioSeleccionadoId('');
      setRepartidorId('');
      setDireccion('');
      setCostoEnvio('0.00');
      setFormLat(-17.7833);
      setFormLng(-63.1667);
      setMostrarForm(true);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar ventas o clientes.");
    }
  };

  const handleEnvioChange = (envId) => {
    setEnvioSeleccionadoId(envId);
    if (!envId) {
      setDireccion('');
      setFormLat(-17.7833);
      setFormLng(-63.1667);
      setCostoEnvio('0.00');
      return;
    }
    const selectedEnvio = envios.find(e => e.id === envId);
    if (selectedEnvio) {
      setDireccion(selectedEnvio.direccion_despacho);
      setCostoEnvio(selectedEnvio.costo_envio.toString());
      setFormLat(selectedEnvio.latitud || -17.7833);
      setFormLng(selectedEnvio.longitud || -63.1667);
    }
  };

  // Edición de envíos
  const abrirEditarEnvio = async (env) => {
    setEnvioEditar(env);
    setEditDireccion(env.direccion_despacho);
    setEditCostoEnvio(env.costo_envio.toString());
    setEditRepartidorId(env.repartidor_id || '');
    const [resolvedLat, resolvedLng] = resolverCoordenadas(env);
    setFormLat(resolvedLat);
    setFormLng(resolvedLng);
    setMostrarModalEditar(true);
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!editDireccion.trim()) {
      toast.error("La dirección de despacho es requerida.");
      return;
    }

    setProcesandoEdit(true);
    const payload = {
      direccion_despacho: editDireccion.trim(),
      costo_envio: parseFloat(editCostoEnvio) || 0.00,
      repartidor_id: editRepartidorId || null,
      latitud: formLat || null,
      longitud: formLng || null
    };

    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioEditar.id, payload);
      if (res.ok) {
        toast.success("Envío actualizado correctamente.");
        setMostrarModalEditar(false);
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al actualizar el envío.";
      toast.error(errorMsg);
    } finally {
      setProcesandoEdit(false);
    }
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resEnvios, resRepartidores, resUsuarios] = await Promise.all([
        deliveryService.obtenerEnvios(),
        deliveryService.obtenerRepartidores(),
        usuarioService.obtenerTodos()
      ]);

      if (resEnvios.ok) setEnvios(resEnvios.data);
      if (resRepartidores.ok) setRepartidores(resRepartidores.data);
      if (resUsuarios.ok) setUsuarios(resUsuarios.data);
    } catch (ex) {
      console.error(ex);
      toast.error("Error al cargar los datos de delivery y personal.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarDatos();
    };
    inicializar();
  }, []);

  // Obtener nombre de usuario del repartidor
  const obtenerNombreRepartidor = (repId) => {
    if (!repId) return 'Sin asignar';
    const rep = repartidores.find(r => r.id === repId);
    if (!rep) return 'Desconocido';
    const usr = usuarios.find(u => u.id === rep.usuario_id);
    return usr ? usr.nombre_completo : 'Repartidor sin nombre';
  };

  // Asignar Repartidor a un Envío
  const handleAsignarRepartidor = async (envioId, repId) => {
    try {
      const payload = {
        repartidor_id: repId || null
      };
      const res = await deliveryService.actualizarEstadoEnvio(envioId, payload);
      if (res.ok) {
        toast.success("Repartidor asignado correctamente.");
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "No se pudo asignar el repartidor.";
      toast.error(errorMsg);
    }
  };

  // Actualizar Estado de un Envío
  const handleActualizarEstado = async (envioId, nuevoEstado) => {
    try {
      const payload = {
        estado_envio: nuevoEstado
      };
      const res = await deliveryService.actualizarEstadoEnvio(envioId, payload);
      if (res.ok) {
        toast.success(`Estado del envío actualizado a '${nuevoEstado}'.`);
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "No se pudo actualizar el estado.";
      toast.error(errorMsg);
    }
  };

  // Abrir modal de cancelación con motivo obligatorio
  const handleAbrirModalCancelar = (envioId) => {
    setEnvioCancelarId(envioId);
    setMotivoCancelarAdmin('');
    setMostrarModalCancelarAdmin(true);
  };

  // Confirmar cancelación con motivo obligatorio
  const handleCancelarEnvioAdmin = async () => {
    if (!motivoCancelarAdmin.trim() || !envioCancelarId) return;
    try {
      setProcesandoCancelarAdmin(true);
      const res = await deliveryService.cancelarEnvio(envioCancelarId, motivoCancelarAdmin.trim());
      if (res.ok) {
        toast.success('Envío cancelado correctamente.');
        setMostrarModalCancelarAdmin(false);
        setEnvioCancelarId(null);
        setMotivoCancelarAdmin('');
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'No se pudo cancelar el envío.';
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setProcesandoCancelarAdmin(false);
    }
  };

  // Guardar Envío Creado Manuelmente
  const handleGuardarEnvio = async (e) => {
    e.preventDefault();
    if (!envioSeleccionadoId) {
      toast.error("Debe seleccionar una orden en espera.");
      return;
    }
    if (!direccion.trim()) {
      toast.error("La dirección de despacho es requerida.");
      return;
    }

    setProcesandoForm(true);
    const payload = {
      estado_envio: 'Pendiente',
      repartidor_id: repartidorId || null,
      direccion_despacho: direccion,
      costo_envio: parseFloat(costoEnvio) || 0.00,
      latitud: formLat || null,
      longitud: formLng || null
    };

    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioSeleccionadoId, payload);
      if (res.ok) {
        toast.success("Despacho iniciado y asignado.");
        setMostrarForm(false);
        setEnvioSeleccionadoId('');
        setRepartidorId('');
        setDireccion('');
        setCostoEnvio('0.00');
        cargarDatos();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al registrar la orden de delivery.";
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  // Filtrado y Ordenación descendente por fecha de creación (los más recientes primero)
  const enviosFiltrados = envios
    .filter(env => {
      if (env.estado_envio === 'Por Despachar') return false;
      const coincideBuscar =
        env.venta_id.toLowerCase().includes(buscarVenta.toLowerCase()) ||
        (env.direccion_despacho || '').toLowerCase().includes(buscarVenta.toLowerCase()) ||
        (env.cliente && (env.cliente.nombre_completo || '').toLowerCase().includes(buscarVenta.toLowerCase())) ||
        (obtenerNombreRepartidor(env.repartidor_id) || '').toLowerCase().includes(buscarVenta.toLowerCase());
      const coincideEstado = filtroEstado === 'Todos' || env.estado_envio === filtroEstado;
      return coincideBuscar && coincideEstado;
    })
    .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

  // Métricas del Delivery
  const totalPendientes = envios.filter(e => e.estado_envio === 'Pendiente').length;
  const totalEnCamino = envios.filter(e => e.estado_envio === 'En Camino').length;
  const totalEntregados = envios.filter(e => e.estado_envio === 'Entregado').length;
  const totalCancelados = envios.filter(e => e.estado_envio === 'Cancelado').length;

  // Paginación local
  const totalPaginas = Math.ceil(enviosFiltrados.length / itemsPorPagina) || 1;
  const paginaEfectiva = Math.min(pagina, totalPaginas);
  const indexInicio = (paginaEfectiva - 1) * itemsPorPagina;
  const enviosPaginados = enviosFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* ── 1. CABECERA DE PÁGINA ── */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Truck size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Monitoreo de Envíos & Delivery</h3>
            <p className="page-subtitle">
              Asignación de repartidores, visualización de mapas y control de estados de ruta en tiempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleDescargarReporteEnvios}
            className="btn-primary"
          >
            <FileText size={15} />
            Reporte Envíos PDF
          </button>
          <button
            onClick={abrirNuevoDespacho}
            className="btn-primary"
          >
            <Plus size={15} />
            Nuevo Despacho
          </button>
        </div>
      </div>

      {/* ── 2. MINI-DASHBOARD METRICAS (Estilo unificado) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '5px'
      }}>
        {/* Tarjeta 1: Pendientes */}
        <div style={{
          background: 'white',
          border: '1px solid #fef3c7',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#fffbeb',
            color: '#d97706',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Pendientes</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', fontFamily: 'Inter, sans-serif' }}>{totalPendientes} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>envíos</span></span>
          </div>
        </div>

        {/* Tarjeta 2: En Camino */}
        <div style={{
          background: 'white',
          border: '1px solid #e0f2fe',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#f0f9ff',
            color: '#0284c7',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Truck size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>En Camino</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7', fontFamily: 'Inter, sans-serif' }}>{totalEnCamino} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>rutas</span></span>
          </div>
        </div>

        {/* Tarjeta 3: Entregados */}
        <div style={{
          background: 'white',
          border: '1px solid #dcfce7',
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
            color: '#16a34a',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Entregados</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', fontFamily: 'Inter, sans-serif' }}>{totalEntregados} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>éxitos</span></span>
          </div>
        </div>

        {/* Tarjeta 4: Cancelados */}
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
            color: '#e11d48',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ban size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', fontFamily: 'Inter, sans-serif' }}>Cancelados</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e11d48', fontFamily: 'Inter, sans-serif' }}>{totalCancelados} <span style={{ fontSize: '0.8rem', fontfontFamily: 'Inter, sans-serif' }}>bajas</span></span>
          </div>
        </div>
      </div>

      {/* ── 3. PANEL DE FILTROS ── */}
      <PanelFiltroBusqueda
        buscarTexto={buscarVenta}
        alCambiarBuscarTexto={(val) => { setBuscarVenta(val); setPagina(1); }}
        estadoSeleccionado={filtroEstado}
        alCambiarEstado={(val) => { setFiltroEstado(val || 'Todos'); setPagina(1); }}
        opcionesEstado={[
          { value: 'Todos', label: 'Todos los estados' },
          { value: 'Pendiente', label: 'Pendientes' },
          { value: 'En Camino', label: 'En Camino' },
          { value: 'Entregado', label: 'Entregados' },
          { value: 'Cancelado', label: 'Cancelados' }
        ]}
        placeholder="Buscar envíos por ID de Venta, dirección, cliente o repartidor..."
      />

      {/* Vista para pantallas grandes (Tabla estructurada y alineada) */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-medium text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6 text-left">ID Venta</th>
                <th className="py-3.5 px-6 text-left">Dirección Despacho</th>
                <th className="py-3.5 px-6 text-right">Recargo</th>
                <th className="py-3.5 px-6 text-center">Repartidor Asignado</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-center">Gestión Directa</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 font-medium">
                    Cargando órdenes de envío...
                  </td>
                </tr>
              </tbody>
            ) : enviosFiltrados.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    No se encontraron despachos registrados en el sistema.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-slate-100 bg-white">
                {enviosPaginados.map((env) => {
                  const completado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
                  return (
                    <tr key={env.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 text-left font-mono font-medium" title={env.venta_id}>
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-xs">
                          {env.venta_id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-left">
                        <div className="flex items-start">
                          <MapPin size={15} className="text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1 text-slate-600 font-medium">{env.direccion_despacho}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-slate-900">Bs. {env.costo_envio.toFixed(2)}</td>
                      <td className="py-4 px-6 text-center">
                        {completado ? (
                          <span className="font-medium text-slate-500">
                            {obtenerNombreRepartidor(env.repartidor_id)}
                          </span>
                        ) : (
                          <select
                            value={env.repartidor_id || ''}
                            onChange={(e) => handleAsignarRepartidor(env.id, e.target.value)}
                            className="border border-slate-200 rounded-xl text-xs py-1.5 px-3 bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-bold text-slate-600"
                          >
                            <option value="">Seleccionar Repartidor</option>
                            {repartidores
                              .filter(r => r.estado_repartidor === 'Disponible' || r.id === env.repartidor_id)
                              .map(rep => {
                                const usr = usuarios.find(u => u.id === rep.usuario_id);
                                return (
                                  <option key={rep.id} value={rep.id}>
                                    {usr ? usr.nombre_completo : 'Repartidor'} ({rep.placa})
                                  </option>
                                );
                              })}
                          </select>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                          env.estado_envio === 'Pendiente' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                          env.estado_envio === 'En Camino' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                          env.estado_envio === 'Entregado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                          'bg-rose-50 text-rose-700 border border-rose-200/50'
                        }`}>
                          {env.estado_envio}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => abrirDetalleEnvio(env)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                            title="Ver mapa e información del envío"
                          >
                            <Eye size={13} />
                          </button>
                          
                          {!completado && (
                            <>
                              <button
                                onClick={() => abrirEditarEnvio(env)}
                                className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                                title="Editar datos del envío"
                              >
                                <Edit3 size={13} />
                              </button>
                              {['Por Despachar', 'Pendiente'].includes(env.estado_envio) && (
                                <button
                                  onClick={() => handleRedirigirEditarVenta(env.venta_id)}
                                  className="text-orange-600 hover:text-orange-950 bg-orange-50 hover:bg-orange-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                                  title="Editar venta original en POS"
                                >
                                  <ShoppingCart size={13} />
                                </button>
                              )}
                              {env.estado_envio === 'Pendiente' && (
                                <>
                                  <button
                                    onClick={() => handleActualizarEstado(env.id, 'En Camino')}
                                    disabled={!env.repartidor_id}
                                    className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-45 select-none cursor-pointer"
                                  >
                                    <Play size={12} />
                                    Iniciar Ruta
                                  </button>
                                  <button
                                    onClick={() => handleAbrirModalCancelar(env.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 select-none cursor-pointer"
                                    title="Cancelar envío administrativamente"
                                  >
                                    <Ban size={12} />
                                    Cancelar
                                  </button>
                                </>
                              )}
                              {env.estado_envio === 'En Camino' && (
                                <>
                                  <button
                                    onClick={() => handleActualizarEstado(env.id, 'Entregado')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1.5 select-none cursor-pointer"
                                  >
                                    <Check size={12} />
                                    Entregado
                                  </button>
                                  <button
                                    onClick={() => handleAbrirModalCancelar(env.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 select-none cursor-pointer"
                                  >
                                    <Ban size={12} />
                                    Cancelar
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {completado && (
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Finalizado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* Vista para pantallas móviles (Tarjetas independientes responsivas Mobile-First) */}
      <div className="block lg:hidden space-y-3">
        {cargando ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium">
            Cargando órdenes de envío...
          </div>
        ) : enviosFiltrados.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium">
            No se encontraron despachos registrados en el sistema.
          </div>
        ) : (
          enviosPaginados.map((env) => {
            const completado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
            return (
              <div key={env.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold">
                      Venta: {env.venta_id.substring(0, 8)}
                    </span>
                    {env.fecha_creacion && (
                      <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                        {formatearFechaHoraBolivia(env.fecha_creacion)}
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                    env.estado_envio === 'Pendiente' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                    env.estado_envio === 'En Camino' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                    env.estado_envio === 'Entregado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                    'bg-rose-50 text-rose-700 border border-rose-200/50'
                  }`}>
                    {env.estado_envio}
                  </span>
                </div>

                <div className="flex items-start text-xs text-slate-600 gap-1.5 py-0.5">
                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>{env.direccion_despacho}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2 font-medium text-slate-600">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase block font-bold">Costo Envío</span>
                    <span className="font-extrabold text-slate-900">Bs. {env.costo_envio.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-slate-400 uppercase block font-bold">Repartidor</span>
                    <span className="font-bold text-slate-700 truncate max-w-[120px] inline-block">
                      {obtenerNombreRepartidor(env.repartidor_id)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-50 pt-2 gap-2 flex-wrap">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => abrirDetalleEnvio(env)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} /> Detalle
                    </button>
                    {!completado && (
                      <>
                        <button
                          onClick={() => abrirEditarEnvio(env)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                        {['Por Despachar', 'Pendiente'].includes(env.estado_envio) && (
                          <button
                            onClick={() => handleRedirigirEditarVenta(env.venta_id)}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                            title="Editar venta original en POS"
                          >
                            <ShoppingCart size={12} /> Venta
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    {!completado && (
                      <>
                        {/* Selector de asignación rápida para repartidor */}
                        <select
                          value={env.repartidor_id || ''}
                          onChange={(e) => handleAsignarRepartidor(env.id, e.target.value)}
                          className="border border-slate-200 rounded-lg text-[10px] py-1 px-2 bg-white outline-none cursor-pointer font-bold text-slate-600"
                        >
                          <option value="">Asignar Repartidor</option>
                          {repartidores
                            .filter(r => r.estado_repartidor === 'Disponible' || r.id === env.repartidor_id)
                            .map(rep => {
                              const usr = usuarios.find(u => u.id === rep.usuario_id);
                              return (
                                <option key={rep.id} value={rep.id}>
                                  {usr ? usr.nombre_completo : 'Repartidor'} ({rep.placa})
                                </option>
                              );
                            })}
                        </select>

                        {env.estado_envio === 'Pendiente' && (
                          <>
                            <button
                              onClick={() => handleActualizarEstado(env.id, 'En Camino')}
                              disabled={!env.repartidor_id}
                              className="bg-zinc-950 hover:bg-zinc-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition disabled:opacity-40 flex items-center gap-1 select-none cursor-pointer"
                            >
                              <Play size={10} /> Iniciar Ruta
                            </button>
                            <button
                              onClick={() => handleAbrirModalCancelar(env.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5 select-none cursor-pointer"
                            >
                              <Ban size={10} /> Cancelar
                            </button>
                          </>
                        )}

                        {env.estado_envio === 'En Camino' && (
                          <>
                            <button
                              onClick={() => handleActualizarEstado(env.id, 'Entregado')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 select-none cursor-pointer"
                            >
                              <Check size={10} /> Entregado
                            </button>
                            <button
                              onClick={() => handleAbrirModalCancelar(env.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5 select-none cursor-pointer"
                            >
                              <Ban size={10} /> Cancelar
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginador global para ambas pantallas (Escritorio y Móvil) */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
        <PaginadorTablas
          totalItems={enviosFiltrados.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={paginaEfectiva}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* MODAL REGISTRAR ENVIO MANUAL */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-zinc-200 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-base flex items-center">
                <Truck className="text-zinc-900 mr-2" size={20} />
                Registrar Orden de Delivery
              </h3>
              <button 
                onClick={() => setMostrarForm(false)} 
                className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarEnvio} className="my-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Seleccionar Orden en Espera <span className="text-red-500">*</span></label>
                <select
                  required
                  value={envioSeleccionadoId}
                  onChange={(e) => handleEnvioChange(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl text-sm py-2 px-3 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all cursor-pointer font-medium text-zinc-700"
                >
                  <option value="">-- Seleccione una Orden --</option>
                  {envios
                    .filter(e => e.estado_envio === 'Por Despachar')
                    .map(env => {
                      const v = ventas.find(vent => vent.id === env.venta_id);
                      const cli = clientes.find(c => c.id === v?.cliente_id);
                      const clienteNombre = cli ? cli.nombre : 'Cliente Desconocido';
                      const totalStr = v ? v.total.toFixed(2) : '0.00';
                      const facturaStr = v ? v.codigo_factura : 'Sin Código';
                      return (
                        <option key={env.id} value={env.id}>
                          [{facturaStr}] - {clienteNombre} - Bs. {totalStr}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Repartidor Inicial (Opcional)</label>
                <select
                  value={repartidorId}
                  onChange={(e) => setRepartidorId(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl text-sm py-2 px-3 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all cursor-pointer font-medium text-zinc-700"
                >
                  <option value="">Sin asignar inicialmente</option>
                  {repartidores
                    .filter(r => r.estado_repartidor === 'Disponible')
                    .map(rep => {
                      const usr = usuarios.find(u => u.id === rep.usuario_id);
                      return (
                        <option key={rep.id} value={rep.id}>
                          {usr ? usr.nombre_completo : 'Repartidor'} ({rep.placa})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Dirección de Despacho</label>
                <textarea
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Av. Brasil 4510, Dpto 402, Jesús María"
                  rows="3"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none resize-none font-medium text-zinc-800"
                />
              </div>

              {/* Ubicación de Destino en Mapa (Verificación Visual) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Ubicación de Destino (Verificación Visual)</label>
                <div className="w-full h-40 rounded-xl overflow-hidden border border-zinc-200 bg-slate-100 relative z-10">
                  <MapaInteractivo
                    key={`new-${envioSeleccionadoId}`}
                    lat={formLat}
                    lng={formLng}
                    soloLectura={false}
                    onChange={(lat, lng) => {
                      setFormLat(lat);
                      setFormLng(lng);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Costo de Envío / Recargo (Bs.)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 text-sm">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costoEnvio}
                    onChange={(e) => setCostoEnvio(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-semibold text-zinc-800"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoForm}
                  className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  {procesandoForm ? 'Registrando...' : 'Registrar Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELACIÓN CON MOTIVO OBLIGATORIO */}
      {mostrarModalCancelarAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-zinc-200 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-base flex items-center">
                <Ban className="text-rose-600 mr-2" size={20} />
                Cancelar Orden de Envío
              </h3>
              <button
                onClick={() => setMostrarModalCancelarAdmin(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 space-y-4">
              <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                El envío se marcará en estado <span className="font-bold text-rose-600">Cancelado</span>. Esta operación requiere especificar un motivo justificativo para su registro.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Motivo de Cancelación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={motivoCancelarAdmin}
                  onChange={(e) => setMotivoCancelarAdmin(e.target.value)}
                  placeholder="Escriba la justificación detallada de la cancelación..."
                  rows="3"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none transition-all placeholder:text-zinc-400 font-medium text-zinc-800"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelarAdmin(false)}
                  disabled={procesandoCancelarAdmin}
                  className="flex-1 py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-medium transition-all cursor-pointer"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  onClick={handleCancelarEnvioAdmin}
                  disabled={procesandoCancelarAdmin || !motivoCancelarAdmin.trim()}
                  className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Ban size={15} />
                  {procesandoCancelarAdmin ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE DEL ENVÍO CON MAPA INTERACTIVO ── */}
      {mostrarModalDetalle && envioSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-zinc-200 animate-fade-in-up">
            <div className="h-1 bg-gradient-to-r from-indigo-600 to-sky-500" />
            
            <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-950 text-base flex items-center gap-1.5 font-display">
                <Truck size={18} className="text-indigo-600" />
                Detalles Logísticos del Envío
              </h3>
              <button 
                onClick={() => setMostrarModalDetalle(false)} 
                className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-zinc-600">
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1">Cliente Destinatario</span>
                  <p className="font-bold text-zinc-900 text-sm">{envioSeleccionado.cliente?.nombre_completo || 'No registrado'}</p>
                  <p className="text-zinc-500 mt-1">📞 Teléfono: {envioSeleccionado.cliente?.telefono || 'N/A'}</p>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1">Información de Ruta</span>
                  <p className="mt-0.5">
                    <span className="font-semibold text-zinc-500">Costo:</span> Bs. {envioSeleccionado.costo_envio.toFixed(2)}
                  </p>
                  <p className="mt-0.5">
                    <span className="font-semibold text-zinc-500">Estado:</span> <span className="font-bold text-indigo-600">{envioSeleccionado.estado_envio}</span>
                  </p>
                  <p className="mt-0.5">
                    <span className="font-semibold text-zinc-500">Repartidor:</span> {obtenerNombreRepartidor(envioSeleccionado.repartidor_id)}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1.5">Dirección de Despacho</span>
                <p className="text-xs bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-zinc-700 font-medium leading-relaxed flex gap-2">
                  <MapPin size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  {envioSeleccionado.direccion_despacho}
                </p>
              </div>

              {/* Geolocalización / Mapa */}
              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-bold block mb-1.5">Geolocalización de Entrega</span>
                
                {/* Dirección real de entrega para guía del operador */}
                <div className="mb-2 bg-zinc-950 text-white rounded-xl p-3.5 text-xs font-semibold leading-relaxed flex items-start gap-2 shadow-sm border border-zinc-900">
                  <MapPin size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[8px] text-zinc-400 uppercase font-extrabold block mb-0.5">Destino de Ruta (Guía del Operador)</span>
                    <span>{envioSeleccionado.direccion_despacho}</span>
                  </div>
                </div>

                <div className="w-full rounded-xl overflow-hidden border border-zinc-200 bg-slate-100 shadow-inner relative z-10">
                  {envioSeleccionado.estado_envio === 'En Camino' && envioSeleccionado.repartidor_id ? (
                    <MapaSeguimiento
                      latKiosco={kiosco.lat}
                      lngKiosco={kiosco.lng}
                      latRepartidor={posicionRepartidor.lat}
                      lngRepartidor={posicionRepartidor.lng}
                      latDestino={resolverCoordenadas(envioSeleccionado)[0]}
                      lngDestino={resolverCoordenadas(envioSeleccionado)[1]}
                      nombreDestino={envioSeleccionado.cliente?.nombre_completo || 'Destino'}
                      estadoEnvio={envioSeleccionado.estado_envio}
                    />
                  ) : (
                    <div className="w-full h-64">
                      <MapaInteractivo
                        key={`detail-${envioSeleccionado?.id}`}
                        lat={resolverCoordenadas(envioSeleccionado)[0]}
                        lng={resolverCoordenadas(envioSeleccionado)[1]}
                        soloLectura={true}
                      />
                    </div>
                  )}
                </div>
                {(envioSeleccionado.cliente?.enlace_ubicacion || envioSeleccionado.cliente?.enlace_mapa) && (
                  <a
                    href={envioSeleccionado.cliente.enlace_ubicacion || envioSeleccionado.cliente.enlace_mapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-600 font-bold hover:underline mt-2 flex items-center gap-1 inline-block"
                  >
                    🔗 Abrir ubicación externa en mapas
                  </a>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center">
              {['Por Despachar', 'Pendiente'].includes(envioSeleccionado.estado_envio) ? (
                <button
                  onClick={() => handleRedirigirEditarVenta(envioSeleccionado.venta_id)}
                  className="py-2 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 size={14} /> Editar Venta en POS
                </button>
              ) : <div />}
              <button
                onClick={() => setMostrarModalDetalle(false)}
                className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR ENVÍO ── */}
      {mostrarModalEditar && envioEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-zinc-200 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-base flex items-center">
                <Edit3 className="text-indigo-600 mr-2" size={20} />
                Editar Datos de Delivery
              </h3>
              <button 
                onClick={() => setMostrarModalEditar(false)} 
                className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="my-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Repartidor Asignado</label>
                <select
                  value={editRepartidorId}
                  onChange={(e) => setEditRepartidorId(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl text-sm py-2 px-3 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all cursor-pointer font-medium text-zinc-700"
                >
                  <option value="">Sin asignar repartidor</option>
                  {repartidores
                    .filter(r => r.estado_repartidor === 'Disponible' || r.id === envioEditar.repartidor_id)
                    .map(rep => {
                      const usr = usuarios.find(u => u.id === rep.usuario_id);
                      return (
                        <option key={rep.id} value={rep.id}>
                          {usr ? usr.nombre_completo : 'Repartidor'} ({rep.placa})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Dirección de Despacho</label>
                <textarea
                  required
                  value={editDireccion}
                  onChange={(e) => setEditDireccion(e.target.value)}
                  placeholder="Ej: Av. Brasil 4510, Dpto 402, Jesús María"
                  rows="3"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none resize-none font-medium text-zinc-800"
                />
              </div>

              {/* Ubicación de Destino en Mapa (Verificación Visual) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Ubicación de Destino (Verificación Visual)</label>
                <div className="w-full h-40 rounded-xl overflow-hidden border border-zinc-200 bg-slate-100 relative z-10">
                  <MapaInteractivo
                    key={`edit-${envioEditar?.id}`}
                    lat={formLat}
                    lng={formLng}
                    soloLectura={false}
                    onChange={(lat, lng) => {
                      setFormLat(lat);
                      setFormLng(lng);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Costo de Envío / Recargo (Bs.)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 text-sm">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCostoEnvio}
                    onChange={(e) => setEditCostoEnvio(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-semibold text-zinc-800"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setMostrarModalEditar(false)}
                  className="py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoEdit}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {procesandoEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionEnvios;
