import React, { useState, useEffect } from 'react';
import deliveryService from '../services/deliveryService';
import DeslizadorInteractivo from '../components/DeslizadorInteractivo';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ChevronDown, ChevronUp, MapPin, Navigation, Phone, 
  Clock, Package, FileText, CheckCircle2, XCircle 
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
      toast.error("Error al obtener la lista de despachos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarEnvios();
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
    <div className="max-w-md mx-auto space-y-4">
      <Toaster position="top-center" />
      
      <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h3 className="font-bold text-gray-800 text-sm flex items-center">
          <Clock className="text-premium-primary mr-2" size={18} />
          Hoja de Ruta del Día
        </h3>
        <button 
          onClick={cargarEnvios}
          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-semibold text-gray-600 border"
        >
          Actualizar
        </button>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-500 font-semibold bg-white rounded-lg border border-gray-200 shadow-sm">
          Cargando despachos de la ruta...
        </div>
      ) : envios.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200 shadow-sm">
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
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* CABECERA ACORDEÓN */}
                <div 
                  onClick={() => toggleAcordeon(env.id)}
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <div className="flex items-center space-x-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      env.estado_envio === 'Pendiente' ? 'bg-orange-500' :
                      env.estado_envio === 'En Camino' ? 'bg-blue-500' :
                      env.estado_envio === 'Entregado' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="font-bold text-xs text-gray-700">Factura: {env.venta_id.substring(0, 8)}...</span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      env.estado_envio === 'Pendiente' ? 'bg-orange-100 text-orange-700' :
                      env.estado_envio === 'En Camino' ? 'bg-blue-100 text-blue-700' :
                      env.estado_envio === 'Entregado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {env.estado_envio}
                    </span>
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* CONTENIDO ACORDEÓN */}
                {abierto && (
                  <div className="p-4 space-y-4 bg-gray-50">
                    {/* Detalles del despacho */}
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-start">
                        <MapPin className="text-gray-400 mr-2 flex-shrink-0" size={16} />
                        <p className="font-medium text-gray-800">{env.direccion_despacho}</p>
                      </div>
                      <div className="flex items-center">
                        <FileText className="text-gray-400 mr-2" size={16} />
                        <p>Recargo Delivery: <span className="font-bold text-gray-800">${env.costo_envio.toFixed(2)}</span></p>
                      </div>
                    </div>

                    {/* Botones de Navegación / Contacto */}
                    {!finalizado && (
                      <div className="flex gap-2">
                        {/* Botón de mapas dinámico */}
                        <a 
                          href={geoUrl}
                          onClick={(e) => {
                            // Si falla redirección geo, usar fallback web
                            setTimeout(() => { window.location.href = mapsFallback; }, 300);
                          }}
                          className="flex-1 flex items-center justify-center py-2 px-3 bg-premium-primary text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <Navigation size={14} className="mr-1.5" />
                          Ver Mapa
                        </a>

                        {/* Botón de llamada telefónica */}
                        <a 
                          href="tel:987654321" 
                          className="flex-1 flex items-center justify-center py-2 px-3 bg-white text-gray-700 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                          <Phone size={14} className="mr-1.5" />
                          Llamar Cliente
                        </a>
                      </div>
                    )}

                    {/* INTERACCIÓN POR DESLIZAMIENTO */}
                    <div className="pt-2 border-t border-gray-200">
                      {env.estado_envio === 'Pendiente' && (
                        <DeslizadorInteractivo 
                          alDeslizar={() => handleIniciarRuta(env.id)}
                          etiqueta="Deslizar para Iniciar Ruta"
                          colorFondo="bg-premium-primary"
                        />
                      )}

                      {env.estado_envio === 'En Camino' && (
                        <div className="space-y-3">
                          <DeslizadorInteractivo 
                            alDeslizar={() => handleConfirmarEntrega(env.id)}
                            etiqueta="Deslizar para Confirmar Entrega"
                            colorFondo="bg-premium-success"
                          />
                          <button
                            onClick={() => handleAnularEntrega(env.id)}
                            className="w-full flex items-center justify-center py-2 px-3 border border-red-300 text-red-600 rounded text-xs font-semibold hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={14} className="mr-1.5" />
                            Anular o Cancelar Entrega
                          </button>
                        </div>
                      )}

                      {finalizado && (
                        <div className="bg-white rounded p-3 border border-gray-200 flex items-center justify-center text-xs text-gray-500 font-semibold uppercase">
                          <CheckCircle2 size={16} className="text-green-500 mr-1.5" />
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
