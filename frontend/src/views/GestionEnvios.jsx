import { useState, useEffect } from 'react';
import deliveryService from '../services/deliveryService';
import usuarioService from '../services/usuarioService';
import PaginadorTablas from '../components/PaginadorTablas';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Truck, Plus, Search, Filter, MapPin, 
  CheckCircle2, Clock, X, ShieldAlert, Ban
} from 'lucide-react';

export const GestionEnvios = () => {
  const [envios, setEnvios] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros y Búsqueda
  const [buscarVenta, setBuscarVenta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

  // Modal para registrar envío manual
  const [mostrarForm, setMostrarForm] = useState(false);
  const [ventaId, setVentaId] = useState('');
  const [repartidorId, setRepartidorId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('0.00');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal para cancelación administrativa de un envío (baja lógica)
  const [mostrarModalCancelarAdmin, setMostrarModalCancelarAdmin] = useState(false);
  const [envioCancelarId, setEnvioCancelarId] = useState(null);
  const [motivoCancelarAdmin, setMotivoCancelarAdmin] = useState('');
  const [procesandoCancelarAdmin, setProcesandoCancelarAdmin] = useState(false);

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

  // Abrir modal de cancelación administrativa (baja lógica)
  const abrirModalCancelarAdmin = (envioId) => {
    setEnvioCancelarId(envioId);
    setMotivoCancelarAdmin('');
    setMostrarModalCancelarAdmin(true);
  };

  // Confirmar cancelación administrativa con motivo obligatorio
  const handleCancelarEnvioAdmin = async () => {
    if (!motivoCancelarAdmin.trim() || !envioCancelarId) return;
    try {
      setProcesandoCancelarAdmin(true);
      const res = await deliveryService.cancelarEnvio(envioCancelarId, motivoCancelarAdmin.trim());
      if (res.ok) {
        toast.success('Envío cancelado administrativamente. El registro se conserva en el historial.');
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
    if (!ventaId.trim()) {
      toast.error("El UUID de la venta es requerido.");
      return;
    }
    if (!direccion.trim()) {
      toast.error("La dirección de despacho es requerida.");
      return;
    }

    setProcesandoForm(true);
    const payload = {
      venta_id: ventaId.trim(),
      repartidor_id: repartidorId || null,
      direccion_despacho: direccion,
      costo_envio: parseFloat(costoEnvio) || 0.00
    };

    try {
      const res = await deliveryService.crearEnvio(payload);
      if (res.ok) {
        toast.success("Orden de delivery registrada.");
        setMostrarForm(false);
        setVentaId('');
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

  // Filtrado
  const enviosFiltrados = envios.filter(env => {
    const coincideBuscar = env.venta_id.toLowerCase().includes(buscarVenta.toLowerCase());
    const coincideEstado = filtroEstado === 'Todos' || env.estado_envio === filtroEstado;
    return coincideBuscar && coincideEstado;
  });

  // Métricas del Delivery
  const totalPendientes = envios.filter(e => e.estado_envio === 'Pendiente').length;
  const totalEnCamino = envios.filter(e => e.estado_envio === 'En Camino').length;
  const totalEntregados = envios.filter(e => e.estado_envio === 'Entregado').length;
  const totalCancelados = envios.filter(e => e.estado_envio === 'Cancelado').length;

  // Paginación local
  const indexInicio = (pagina - 1) * itemsPorPagina;
  const enviosPaginados = enviosFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* METRICAS RAPIDAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Pendientes</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalPendientes}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
            <Truck size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">En Camino</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalEnCamino}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Entregados</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalEntregados}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert size={20} />
          </div>
          <div className="ml-4">
            <p className="text-xs font-medium text-zinc-500">Cancelados</p>
            <h4 className="text-2xl font-bold text-zinc-950 mt-0.5">{totalCancelados}</h4>
          </div>
        </div>
      </div>

      {/* CABECERA Y FILTROS */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="w-full lg:w-auto">
          <h3 className="font-bold text-zinc-900 text-lg">Monitoreo de Envíos & Delivery</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Asignación de repartidores y control de estados de ruta.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={buscarVenta}
              onChange={(e) => setBuscarVenta(e.target.value)}
              placeholder="Buscar por ID de Venta..."
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
              <Filter size={16} />
            </span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full pl-9 pr-8 border border-zinc-200 rounded-xl text-sm py-2 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente">Pendientes</option>
              <option value="En Camino">En Camino</option>
              <option value="Entregado">Entregados</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>

          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center justify-center py-2 px-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo Despacho
          </button>
        </div>
      </div>

      {/* TABLA DE ENVÍOS */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                <th className="py-3.5 px-6 font-semibold">ID Venta</th>
                <th className="py-3.5 px-6 font-semibold">Dirección Despacho</th>
                <th className="py-3.5 px-6 font-semibold text-right">Recargo</th>
                <th className="py-3.5 px-6 font-semibold">Repartidor Asignado</th>
                <th className="py-3.5 px-6 font-semibold">Estado</th>
                <th className="py-3.5 px-6 font-semibold text-center">Gestión Directa</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-12 text-zinc-500 font-medium">
                    Cargando órdenes de envío...
                  </td>
                </tr>
              </tbody>
            ) : enviosFiltrados.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="6" className="text-center py-12 text-zinc-400">
                    No se encontraron despachos registrados en el sistema.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {enviosPaginados.map((env) => {
                  const completado = env.estado_envio === 'Entregado' || env.estado_envio === 'Cancelado';
                  return (
                    <tr key={env.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium" title={env.venta_id}>
                        <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200 text-xs">
                          {env.venta_id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-start">
                          <MapPin size={16} className="text-zinc-400 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1 text-zinc-600 font-medium">{env.direccion_despacho}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-zinc-900">Bs. {env.costo_envio.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        {completado ? (
                          <span className="font-medium text-zinc-500">
                            {obtenerNombreRepartidor(env.repartidor_id)}
                          </span>
                        ) : (
                          <select
                            value={env.repartidor_id || ''}
                            onChange={(e) => handleAsignarRepartidor(env.id, e.target.value)}
                            className="border border-zinc-200 rounded-xl text-xs py-1.5 px-3 bg-white focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition-all cursor-pointer font-medium text-zinc-700"
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
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full font-medium text-xs ${
                          env.estado_envio === 'Pendiente' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                          env.estado_envio === 'En Camino' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                          env.estado_envio === 'Entregado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                          'bg-rose-50 text-rose-700 border border-rose-200/50'
                        }`}>
                          {env.estado_envio}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {completado ? (
                          <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Finalizado</span>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            {env.estado_envio === 'Pendiente' && (
                              <>
                                <button
                                  onClick={() => handleActualizarEstado(env.id, 'En Camino')}
                                  disabled={!env.repartidor_id}
                                  className="py-1.5 px-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 shadow-sm"
                                >
                                  Iniciar Ruta
                                </button>
                                {/* Botón de cancelación administrativa (baja lógica) */}
                                <button
                                  onClick={() => abrirModalCancelarAdmin(env.id)}
                                  className="py-1.5 px-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                                  title="Cancelar envío administrativamente"
                                >
                                  <Ban size={13} />
                                  Cancelar
                                </button>
                              </>
                            )}
                            {env.estado_envio === 'En Camino' && (
                              <>
                                <button
                                  onClick={() => handleActualizarEstado(env.id, 'Entregado')}
                                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                >
                                  Entregado
                                </button>
                                <button
                                  onClick={() => handleActualizarEstado(env.id, 'Cancelado')}
                                  className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        <PaginadorTablas
          totalItems={enviosFiltrados.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
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
                <label className="block text-xs font-semibold text-zinc-700 mb-1">ID de Venta (UUID)</label>
                <input
                  type="text"
                  required
                  value={ventaId}
                  onChange={(e) => setVentaId(e.target.value)}
                  placeholder="Ingrese el UUID de la venta"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none font-mono"
                />
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
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 outline-none resize-none"
                />
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

      {/* MODAL: CANCELACIÓN ADMINISTRATIVA DE ENVÍO (BAJA LÓGICA) */}
      {mostrarModalCancelarAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-zinc-200 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-base flex items-center">
                <Ban className="text-rose-600 mr-2" size={20} />
                Cancelar Envío (Baja Lógica)
              </h3>
              <button
                onClick={() => setMostrarModalCancelarAdmin(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 space-y-4">
              <p className="text-sm text-zinc-600">
                El envío se marcará como <span className="font-semibold text-rose-600">Cancelado</span> y se conservará
                en el historial del sistema. Esta acción no elimina el registro.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Motivo de Cancelación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={motivoCancelarAdmin}
                  onChange={(e) => setMotivoCancelarAdmin(e.target.value)}
                  placeholder="Ej: Error en la dirección, cliente no disponible, pedido duplicado..."
                  rows="3"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none transition-all placeholder:text-zinc-400"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelarAdmin(false)}
                  disabled={procesandoCancelarAdmin}
                  className="flex-1 py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-medium transition-all"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleCancelarEnvioAdmin}
                  disabled={procesandoCancelarAdmin || !motivoCancelarAdmin.trim()}
                  className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                  <Ban size={15} />
                  {procesandoCancelarAdmin ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionEnvios;
