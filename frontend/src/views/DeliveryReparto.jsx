import { useState, useEffect } from 'react';
import deliveryService from '../services/deliveryService';
import DeslizadorInteractivo from '../components/DeslizadorInteractivo';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ChevronDown, ChevronUp, MapPin, Navigation, Phone, 
  Clock, FileText, CheckCircle2, XCircle 
} from 'lucide-react';

export const DeliveryReparto = () => {
  const [envios, setEnvios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({});

  // Carga de envíos simulando filtrado por el repartidor logueado
  const cargarEnvios = async () => {
    try {
      setCargando(true);
      const res = await deliveryService.obtenerEnvios();
      if (res.ok) {
        setEnvios(res.data);
        
        // Auto-expandir los envíos que tengan estado 'En Camino' prioritariamente
        const estadoAcordeonInicial = {};
        res.data.forEach(env => {
          estadoAcordeonInicial[env.id] = env.estado_envio === 'En Camino';
        });
        setAcordeonesAbiertos(estadoAcordeonInicial);
      }
    } catch (ex) {
      console.error(ex);
      toast.error("Error al obtener la lista de despachos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarEnvios();
    };
    inicializar();
  }, []);

  const toggleAcordeon = (id) => {
    setAcordeonesAbiertos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  /**
   * INICIAR RUTA: Transición de Pendiente -> En Camino
   */
  const handleIniciarRuta = async (envioId) => {
    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioId, {
        estado_envio: "En Camino"
      });
      if (res.ok) {
        toast.success("Ruta iniciada. Pedido en tránsito.");
        cargarEnvios();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo actualizar el envío.";
      toast.error(`Error: ${detail}`);
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
        toast.success("¡Pedido entregado con éxito!");
        cargarEnvios();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo marcar como entregado.";
      toast.error(`Error: ${detail}`);
    }
  };

  /**
   * CANCELAR: Transición a Cancelado
   */
  const handleAnularEntrega = async (envioId) => {
    const motivo = prompt("Ingrese el motivo de la cancelación de la entrega:");
    if (!motivo) return;

    try {
      const res = await deliveryService.actualizarEstadoEnvio(envioId, {
        estado_envio: "Cancelado"
      });
      if (res.ok) {
        toast.error(`Pedido cancelado: ${motivo}`);
        cargarEnvios();
      }
    } catch (ex) {
      const detail = ex.response?.data?.detail || "No se pudo cancelar el despacho.";
      toast.error(`Error: ${detail}`);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 px-2 sm:px-0">
      <Toaster position="top-center" />
      
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm">
        <h3 className="font-bold text-zinc-900 text-sm flex items-center">
          <Clock className="text-zinc-900 mr-2" size={18} />
          Hoja de Ruta del Día
        </h3>
        <button 
          onClick={cargarEnvios}
          className="text-xs bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2 rounded-xl font-medium text-zinc-700 border border-zinc-200 transition-all"
        >
          Actualizar
        </button>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-zinc-500 font-medium bg-white rounded-2xl border border-zinc-200 shadow-sm">
          Cargando despachos de la ruta...
        </div>
      ) : envios.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 bg-white rounded-2xl border border-zinc-200 shadow-sm">
          No tienes despachos asignados para hoy.
        </div>
      ) : (
        <div className="space-y-3">
          {envios.map((env) => {
            const abierto = acordeonesAbiertos[env.id];
            const finalizado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
            
            // Enlace dinámico de mapas con fallback a Google Maps web
            const geoUrl = `geo:0,0?q=${encodeURIComponent(env.direccion_despacho)}`;
            const mapsFallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(env.direccion_despacho)}`;

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
                      Factura: {env.venta_id.substring(0, 8)}
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
                      <div className="flex items-start">
                        <MapPin className="text-zinc-400 mr-2.5 mt-0.5 flex-shrink-0" size={16} />
                        <p className="font-medium text-zinc-900 leading-relaxed">{env.direccion_despacho}</p>
                      </div>
                      <div className="flex items-center">
                        <FileText className="text-zinc-400 mr-2.5" size={16} />
                        <p className="font-medium">
                          Recargo Delivery: <span className="font-bold text-zinc-900">Bs. {env.costo_envio.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Botones de Navegación / Contacto */}
                    {!finalizado && (
                      <div className="flex gap-2.5 pt-1">
                        {/* Botón de mapas dinámico */}
                        <a 
                          href={geoUrl}
                          onClick={() => {
                            // Si falla redirección geo, usar fallback web
                            setTimeout(() => { window.location.href = mapsFallback; }, 300);
                          }}
                          className="flex-1 flex items-center justify-center py-2 px-3.5 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
                        >
                          <Navigation size={14} className="mr-1.5" />
                          Ver Mapa
                        </a>

                        {/* Botón de llamada telefónica */}
                        <a 
                          href="tel:987654321" 
                          className="flex-1 flex items-center justify-center py-2 px-3.5 bg-white text-zinc-700 rounded-xl text-xs font-semibold border border-zinc-200 hover:bg-zinc-50 transition-colors shadow-sm"
                        >
                          <Phone size={14} className="mr-1.5" />
                          Llamar Cliente
                        </a>
                      </div>
                    )}

                    {/* INTERACCIÓN POR DESLIZAMIENTO */}
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
                          <CheckCircle2 size={16} className="text-emerald-500 mr-2" />
                          Servicio Finalizado
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
    </div>
  );
};

export default DeliveryReparto;
