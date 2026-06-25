/**
 * Vista: GestionClientes.jsx
 * Módulo de gestión de clientes con control de crédito y saldo deudor.
 * Diseño premium con tabla, badges de estado y formulario modal.
 */

import { useState, useEffect } from 'react';
import clienteService from '../services/clienteService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Users, MapPin } from 'lucide-react';
import MapaInteractivo from '../components/MapaInteractivo';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

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

export const GestionClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);

  // Campos del Formulario
  const [dniRuc, setDniRuc] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [enlaceUbicacion, setEnlaceUbicacion] = useState('');
  const [latitud, setLatitud] = useState(null);
  const [longitud, setLongitud] = useState(null);
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
    setLatitud(null);
    setLongitud(null);
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
    setLatitud(cli.latitud !== undefined && cli.latitud !== null ? cli.latitud : null);
    setLongitud(cli.longitud !== undefined && cli.longitud !== null ? cli.longitud : null);
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

  const handleEnlaceBlur = () => {
    if (!enlaceUbicacion) return;
    const coords = extraerCoordenadas(enlaceUbicacion);
    if (coords) {
      toast.success('Coordenadas extraídas del enlace en caliente.');
      handleUbicacionCambiada(coords.lat, coords.lng, false);
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

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const clientesPaginados = clientes.slice(indexInicio, indexInicio + itemsPorPagina);

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
          totalItems={clientes.length}
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
                    onChange={(e) => setEnlaceUbicacion(e.target.value)}
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
