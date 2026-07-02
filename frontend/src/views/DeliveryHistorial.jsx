// =============================================================================
// VISTA: DeliveryHistorial.jsx
// Propósito: Historial de despachos completados y cancelados del repartidor.
//            Visualización limpia de tipo lista, de solo lectura, sin CRUD.
// Acceso: Repartidor
// Idioma: Español
// =============================================================================

import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import deliveryService from '../services/deliveryService';
import toast, { Toaster } from 'react-hot-toast';
import { ClipboardList, MapPin, FileText, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { formatearFechaHoraBolivia } from '../utils/fechaBolivia';

export const DeliveryHistorial = () => {
  const { usuario } = useAuthStore();
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarHistorial = async () => {
    try {
      setCargando(true);
      // 1. Obtener todos los envíos
      const resEnvios = await deliveryService.obtenerEnvios();
      // 2. Obtener lista de repartidores para mapear
      const resRep = await deliveryService.obtenerRepartidores();
      
      if (resEnvios.ok && resRep.ok) {
        // Encontrar perfil de repartidor del usuario autenticado
        const miRep = resRep.data.find(r => r.usuario_id === usuario.id);
        
        if (miRep) {
          // Filtrar por entregados o cancelados asociados a mi repartidor_id
          const misEntregas = resEnvios.data.filter(env => {
            const finalizado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
            return finalizado && env.repartidor_id === miRep.id;
          });
          
          // Ordenar por fecha de actualización (más recientes primero)
          misEntregas.sort((a, b) => new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion));
          setHistorial(misEntregas);
        } else {
          setHistorial([]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar el historial de entregas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (usuario) {
      cargarHistorial();
    }
  }, [usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-md mx-auto space-y-4 pb-12">
      <Toaster position="top-center" />

      {/* CABECERA */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-zinc-100 rounded-xl p-2 text-zinc-900">
            <ClipboardList size={18} />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Historial de Repartos</h3>
            <p className="text-[10px] text-zinc-500 font-medium">Pedidos entregados y cancelados</p>
          </div>
        </div>
        <button
          onClick={cargarHistorial}
          className="p-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl border border-zinc-200 transition-all cursor-pointer flex items-center justify-center"
          title="Recargar historial"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* LISTADO DE PEDIDOS */}
      {cargando ? (
        <div className="text-center py-12 text-zinc-500 font-medium bg-white rounded-2xl border border-zinc-200 shadow-sm">
          Cargando historial de entregas...
        </div>
      ) : historial.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 bg-white rounded-2xl border border-zinc-200 shadow-sm px-4">
          No tienes entregas registradas en tu historial.
        </div>
      ) : (
        <div className="space-y-3">
          {historial.map((env) => (
            <div
              key={env.id}
              className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 space-y-3 transition-all"
            >
              {/* Encabezado de la tarjeta */}
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                <div className="flex flex-col">
                  <span className="font-extrabold text-xs text-zinc-900">
                    Venta: #{env.venta_id.substring(0, 8)}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-bold mt-0.5">
                    {formatearFechaHoraBolivia(env.fecha_actualizacion, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${
                  env.estado_envio === 'Entregado'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                }`}>
                  {env.estado_envio === 'Entregado' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                  {env.estado_envio}
                </span>
              </div>

              {/* Detalles */}
              <div className="text-xs text-zinc-600 space-y-2 font-medium">
                {env.cliente?.nombre_completo && (
                  <p className="flex items-center gap-2">
                    <span className="font-bold text-zinc-800 shrink-0">Cliente:</span>
                    <span className="truncate text-zinc-700">{env.cliente.nombre_completo}</span>
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <MapPin size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                  <span className="text-zinc-700">{env.direccion_despacho}</span>
                </p>
                <p className="flex items-center gap-2">
                  <FileText size={14} className="text-zinc-400 shrink-0" />
                  <span className="text-zinc-700">
                    Recargo Delivery:{' '}
                    <span className="font-black text-zinc-900">Bs. {env.costo_envio.toFixed(2)}</span>
                  </span>
                </p>

                {/* Motivo de cancelación si aplica */}
                {env.estado_envio === 'Cancelado' && env.motivo_cancelacion && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 text-[10px] text-rose-800 mt-2 font-semibold">
                    <span className="font-bold">Motivo de Cancelación:</span> {env.motivo_cancelacion}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryHistorial;
