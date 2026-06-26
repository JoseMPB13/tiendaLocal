import { useState, useEffect } from 'react';
import deliveryService from '../services/deliveryService';
import DeslizadorInteractivo from '../components/DeslizadorInteractivo';
import { MapaInteractivo } from '../components/MapaInteractivo';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ChevronDown, ChevronUp, MapPin, Navigation, Phone, 
  Clock, FileText, CheckCircle2, XCircle, Map
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export const DeliveryReparto = () => {
  const { usuario } = useAuthStore();
  const [tabActiva, setTabActiva] = useState('disponibles');
  const [envios, setEnvios] = useState([]);
  const [misEnviosActivos, setMisEnviosActivos] = useState([]);
  const [repartidorId, setRepartidorId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({});

  // Estados del modal de cancelación
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [envioACancelar, setEnvioACancelar] = useState(null);
  const [motivoCancelacionText, setMotivoCancelacionText] = useState("");
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(false);

  // Control de expansión del mapa interactivo por envío (id → boolean)
  const [mapasExpandidos, setMapasExpandidos] = useState({});

  // Carga de datos unificada
  const cargarDatos = async () => {
    try {
      setCargando(true);
      
      // 1. Obtener ID de repartidor del usuario autenticado
      let repId = repartidorId;
      if (!repId && usuario) {
        const resRep = await deliveryService.obtenerRepartidores();
        if (resRep.ok) {
          const miRep = resRep.data.find(r => r.usuario_id === usuario.id);
          if (miRep) {
            repId = miRep.id;
            setRepartidorId(miRep.id);
          }
        }
      }

      // 2. Obtener envíos del sistema
      const resEnvios = await deliveryService.obtenerEnvios();
      let envs = [];
      if (resEnvios.ok) {
        envs = resEnvios.data;
        setEnvios(envs);
      }

      // 3. Obtener envíos activos asignados al repartidor
      let misActivos = [];
      if (usuario && usuario.rol === 'Repartidor') {
        const resMisActivos = await deliveryService.obtenerMisEnviosActivos();
        if (resMisActivos.ok) {
          misActivos = resMisActivos.data;
          setMisEnviosActivos(misActivos);
        }
      } else {
        // Fallback defensivo para administradores/cajeros: mostrar todos los En Camino
        misActivos = envs.filter(e => e.estado_envio === 'En Camino');
        setMisEnviosActivos(misActivos);
      }

      // Inicializar acordeones abiertos por defecto para los que están pendientes o en camino
      const estadoAcordeon = {};
      envs.forEach(env => {
        estadoAcordeon[env.id] = env.estado_envio === 'Pendiente' || env.estado_envio === 'En Camino';
      });
      misActivos.forEach(env => {
        estadoAcordeon[env.id] = true;
      });
      setAcordeonesAbiertos(estadoAcordeon);

    } catch (ex) {
      console.error(ex);
      toast.error("Error al sincronizar datos de logística.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      await Promise.resolve();
      cargarDatos();
    };
    inicializar();
  }, [usuario]);

  const toggleAcordeon = (id) => {
    setAcordeonesAbiertos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Alterna la visibilidad del mapa interactivo de un envío específico
  const toggleMapa = (id) => {
    setMapasExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  /**
   * INICIAR RUTA: Transición de Pendiente -> En Camino (Autoasignación)
   */
  const handleIniciarRuta = async (envioId) => {
    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioId, {
        estado_envio: "En Camino"
      });
      if (res.ok) {
        toast.success("Pedido asignado e iniciado con éxito.");
        await cargarDatos();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo iniciar la ruta.";
      toast.error(`Error: ${detail}`);
      // Recargar datos para sincronizar estado si falló por colisión
      cargarDatos();
    }
  };

  /**
   * ENTREGAR: Transición de En Camino -> Entregado
   */
  const handleConfirmarEntrega = async (envioId) => {
    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioId, {
        estado_envio: "Entregado"
      });
      if (res.ok) {
        toast.success("¡Pedido marcado como Entregado!");
        await cargarDatos();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo confirmar la entrega.";
      toast.error(`Error: ${detail}`);
    }
  };

  /**
   * CANCELAR: Abre modal personalizado para anulación
   */
  const handleAnularEntrega = (envioId) => {
    setEnvioACancelar(envioId);
    setMotivoCancelacionText("");
    setMostrarModalCancelacion(true);
  };

  /**
   * SUBMIT CANCELACIÓN: PUT para pasar a Cancelado con motivo
   */
  const submitCancelacion = async () => {
    if (!motivoCancelacionText.trim() || !envioACancelar) return;
    try {
      setProcesandoCancelacion(true);
      const res = await deliveryService.actualizarEstadoEnvio(envioACancelar, {
        estado_envio: "Cancelado",
        motivo_cancelacion: motivoCancelacionText.trim()
      });
      if (res.ok) {
        toast.success("Envío anulado / cancelado.");
        setMostrarModalCancelacion(false);
        setEnvioACancelar(null);
        setMotivoCancelacionText("");
        await cargarDatos();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo registrar la cancelación.";
      toast.error(`Error: ${detail}`);
    } finally {
      setProcesandoCancelacion(false);
    }
  };

  // Helper para verificar URL de ubicación
  const esUrlValida = (str) => {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
  };

  // Filtrado de items a mostrar según la pestaña activa
  const obtenerItemsFiltrados = () => {
    if (tabActiva === 'disponibles') {
      return envios.filter(env => env.estado_envio === 'Pendiente');
    }
    if (tabActiva === 'mi_ruta') {
      return misEnviosActivos;
    }
    if (tabActiva === 'historial') {
      const hoy = new Date();
      const hoyDia = hoy.getDate();
      const hoyMes = hoy.getMonth();
      const hoyAnio = hoy.getFullYear();

      return envios.filter(env => {
        const finalizado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
        if (!finalizado) return false;

        // Si es repartidor, solo ve su historial
        if (usuario?.rol === 'Repartidor' && repartidorId && env.repartidor_id !== repartidorId) {
          return false;
        }

        const fActualizacion = new Date(env.fecha_actualizacion);
        return fActualizacion.getDate() === hoyDia &&
               fActualizacion.getMonth() === hoyMes &&
               fActualizacion.getFullYear() === hoyAnio;
      });
    }
    return [];
  };

  const itemsAMostrar = obtenerItemsFiltrados();

  // Textos para estado vacío
  const obtenerMensajeVacio = () => {
    if (tabActiva === 'disponibles') return "No hay envíos pendientes disponibles para autoasignación.";
    if (tabActiva === 'mi_ruta') return "No tienes envíos activos en tu ruta de entrega.";
    return "No registras envíos entregados o cancelados durante el día de hoy.";
  };

  return (
    <div className="max-w-md mx-auto space-y-4 px-2 sm:px-0 pb-12">
      <Toaster position="top-center" />
      
      {/* CABECERA */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm">
        <h3 className="font-bold text-zinc-900 text-sm flex items-center">
          <Clock className="text-zinc-900 mr-2" size={18} />
          Logística de Reparto
        </h3>
        <button 
          onClick={cargarDatos}
          className="text-xs bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2 rounded-xl font-medium text-zinc-700 border border-zinc-200 transition-all"
        >
          Actualizar
        </button>
      </div>

      {/* PESTAÑAS (TABS) */}
      <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
        <button
          onClick={() => setTabActiva('disponibles')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            tabActiva === 'disponibles' 
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50' 
              : 'text-zinc-500 hover:text-zinc-950'
          }`}
        >
          Disponibles
        </button>
        <button
          onClick={() => setTabActiva('mi_ruta')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            tabActiva === 'mi_ruta' 
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50' 
              : 'text-zinc-500 hover:text-zinc-950'
          }`}
        >
          Mi Ruta
        </button>
        <button
          onClick={() => setTabActiva('historial')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            tabActiva === 'historial' 
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50' 
              : 'text-zinc-500 hover:text-zinc-950'
          }`}
        >
          Historial de Hoy
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {cargando ? (
        <div className="text-center py-12 text-zinc-500 font-medium bg-white rounded-2xl border border-zinc-200 shadow-sm">
          Sincronizando despachos y ruta...
        </div>
      ) : itemsAMostrar.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 bg-white rounded-2xl border border-zinc-200 shadow-sm px-4">
          {obtenerMensajeVacio()}
        </div>
      ) : (
        <div className="space-y-3">
          {itemsAMostrar.map((env) => {
            const abierto = acordeonesAbiertos[env.id];
            const finalizado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
            
            return (
              <div 
                key={env.id} 
                className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden transition-all duration-300"
              >
                {/* CABECERA ACORDEÓN */}
                <div 
                  onClick={() => toggleAcordeon(env.id)}
                  className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/50 transition-all border-b border-zinc-100"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className={`h-2 w-2 rounded-full ${
                      env.estado_envio === 'Pendiente' ? 'bg-amber-500' :
                      env.estado_envio === 'En Camino' ? 'bg-sky-500' :
                      env.estado_envio === 'Entregado' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                    <span className="font-semibold text-xs text-zinc-900">
                      Venta: {env.venta_id.substring(0, 8)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      env.estado_envio === 'Pendiente' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                      env.estado_envio === 'En Camino' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                      env.estado_envio === 'Entregado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                      'bg-rose-50 text-rose-700 border border-rose-200/50'
                    }`}>
                      {env.estado_envio}
                    </span>
                    {abierto ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                  </div>
                </div>

                {/* CONTENIDO ACORDEÓN */}
                {abierto && (
                  <div className="p-5 space-y-4 bg-zinc-50/30 border-t border-zinc-100/50">
                    {/* Detalles del despacho */}
                    <div className="space-y-3 text-sm text-zinc-600">
                      {env.cliente?.nombre_completo && (
                        <div className="flex items-center">
                          <span className="font-semibold text-zinc-900 mr-2">Cliente:</span>
                          <span className="font-medium text-zinc-700">{env.cliente.nombre_completo}</span>
                        </div>
                      )}
                      
                      <div className="flex items-start">
                        <MapPin className="text-zinc-400 mr-2.5 mt-0.5 flex-shrink-0" size={16} />
                        <div>
                          <p className="font-medium text-zinc-900 leading-relaxed">{env.direccion_despacho}</p>
                          {env.cliente?.direccion && env.cliente.direccion !== env.direccion_despacho && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">Dirección cliente: {env.cliente.direccion}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <FileText className="text-zinc-400 mr-2.5" size={16} />
                        <p className="font-medium">
                          Recargo Delivery: <span className="font-bold text-zinc-900">Bs. {env.costo_envio.toFixed(2)}</span>
                        </p>
                      </div>

                      {/* Motivo de cancelación */}
                      {env.estado_envio === 'Cancelado' && env.motivo_cancelacion && (
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800">
                          <span className="font-bold">Motivo de Cancelación:</span> {env.motivo_cancelacion}
                        </div>
                      )}
                    </div>

                    {/* Botones de Navegación / Contacto (Solo si no está finalizado) */}
                    {!finalizado && (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex gap-2.5">
                          {/* Botón de mapas dinámico (GPS inteligente) */}
                          {esUrlValida(env.cliente?.enlace_ubicacion) ? (
                            <button 
                              onClick={() => window.open(env.cliente.enlace_ubicacion, '_blank')}
                              className="flex-1 flex items-center justify-center py-2 px-3.5 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
                            >
                              <Navigation size={14} className="mr-1.5" />
                              Abrir GPS
                            </button>
                          ) : (
                            <button 
                              disabled
                              className="flex-1 flex items-center justify-center py-2 px-3.5 bg-zinc-100 text-zinc-400 rounded-xl text-xs font-semibold border border-zinc-200 cursor-not-allowed"
                              title="Sin enlace de ubicación válido"
                            >
                              <Navigation size={14} className="mr-1.5" />
                              GPS Deshabilitado
                            </button>
                          )}

                          {/* Botón de llamada telefónica */}
                          {env.cliente?.telefono ? (
                            <a 
                              href={`tel:${env.cliente.telefono}`} 
                              className="flex-1 flex items-center justify-center py-2 px-3.5 bg-white text-zinc-700 rounded-xl text-xs font-semibold border border-zinc-200 hover:bg-zinc-50 transition-colors shadow-sm"
                            >
                              <Phone size={14} className="mr-1.5" />
                              Llamar Cliente
                            </a>
                          ) : (
                            <button
                              disabled
                              className="flex-1 flex items-center justify-center py-2 px-3.5 bg-zinc-50 text-zinc-400 rounded-xl text-xs font-semibold border border-zinc-200 cursor-not-allowed"
                            >
                              <Phone size={14} className="mr-1.5" />
                              Sin Teléfono
                            </button>
                          )}
                        </div>

                        {/* Referencia de ubicación si no es URL */}
                        {env.cliente?.enlace_ubicacion && !esUrlValida(env.cliente?.enlace_ubicacion) && (
                          <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 text-xs text-amber-800">
                            <span className="font-bold">Referencia de Ubicación:</span> {env.cliente.enlace_ubicacion}
                          </div>
                        )}

                        {/* MAPA INTERACTIVO DE DESTINO: visible solo en Mi Ruta si hay coordenadas */}
                        {tabActiva === 'mi_ruta' && env.cliente?.latitud && env.cliente?.longitud && (
                          <div>
                            <button
                              onClick={() => toggleMapa(env.id)}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold transition-colors"
                            >
                              <Map size={14} />
                              {mapasExpandidos[env.id] ? 'Ocultar Mapa de Destino' : 'Ver Mapa de Destino'}
                            </button>
                            {mapasExpandidos[env.id] && (
                              <div className="mt-2 rounded-xl overflow-hidden border border-sky-200" style={{ height: '220px' }}>
                                <MapaInteractivo
                                  lat={parseFloat(env.cliente.latitud)}
                                  lng={parseFloat(env.cliente.longitud)}
                                  soloLectura={true}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ACCIONES Y SLIDERS */}
                    <div className="pt-3 border-t border-zinc-100">
                      {env.estado_envio === 'Pendiente' && (
                        <DeslizadorInteractivo 
                          alDeslizar={() => handleIniciarRuta(env.id)}
                          etiqueta="Deslizar para Iniciar Ruta"
                          colorFondo="bg-zinc-950"
                        />
                      )}

                      {env.estado_envio === 'En Camino' && (
                        <div className="space-y-3">
                          <DeslizadorInteractivo 
                            alDeslizar={() => handleConfirmarEntrega(env.id)}
                            etiqueta="Deslizar para Confirmar Entrega"
                            colorFondo="bg-emerald-600"
                          />
                          <button
                            onClick={() => handleAnularEntrega(env.id)}
                            className="w-full flex items-center justify-center py-2.5 px-3.5 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50/50 transition-colors"
                          >
                            <XCircle size={14} className="mr-1.5" />
                            Anular o Cancelar Entrega
                          </button>
                        </div>
                      )}

                      {finalizado && (
                        <div className="bg-white rounded-xl p-3 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                          <CheckCircle2 size={16} className={`mr-2 ${env.estado_envio === 'Entregado' ? 'text-emerald-500' : 'text-rose-500'}`} />
                          {env.estado_envio === 'Entregado' ? 'Entregado' : 'Cancelado'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CANCELACIÓN PERSONALIZADO */}
      {mostrarModalCancelacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-zinc-200 shadow-xl space-y-4 transform scale-100 transition-all">
            <div className="space-y-1.5">
              <h4 className="font-bold text-zinc-900 text-base">Cancelar Entrega</h4>
              <p className="text-xs text-zinc-500">Por favor, especifica el motivo por el cual no se pudo completar la entrega del pedido.</p>
            </div>
            
            <textarea
              value={motivoCancelacionText}
              onChange={(e) => setMotivoCancelacionText(e.target.value)}
              placeholder="Ej: Cliente ausente, dirección incorrecta, pago rechazado..."
              className="w-full min-h-[100px] p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-transparent transition-all placeholder:text-zinc-400"
              required
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalCancelacion(false);
                  setEnvioACancelar(null);
                  setMotivoCancelacionText("");
                }}
                disabled={procesandoCancelacion}
                className="flex-1 py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold border border-zinc-200 transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={submitCancelacion}
                disabled={procesandoCancelacion || !motivoCancelacionText.trim()}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:hover:bg-rose-600"
              >
                {procesandoCancelacion ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryReparto;
