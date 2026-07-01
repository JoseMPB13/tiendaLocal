/**
 * Vista: GestionUsuarios.jsx
 * Módulo de gestión del personal y cuentas de acceso al sistema.
 * Solo accesible para el rol Administrador. Diseño premium coherente.
 */

import { useState, useEffect } from 'react';
import usuarioService from '../services/usuarioService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import PanelFiltroBusqueda from '../components/PanelFiltroBusqueda';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Plus, Edit3, Trash2, X, Eye, EyeOff, UserCog, 
  TrendingUp, Award 
} from 'lucide-react';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados de filtros y búsqueda
  const [buscarTexto, setBuscarTexto] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState('');
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('');

  // Estados de rendimiento analítico de personal
  const [rendimiento, setRendimiento] = useState({ cajeros: [], repartidores: [] });
  const [cargandoRendimiento, setCargandoRendimiento] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Estados del modal de formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [usuarioEdit, setUsuarioEdit] = useState(null);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('Cajero');
  const [verPassword, setVerPassword] = useState(false);
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Estados del modal de baja lógica
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [usuarioEliminarId, setUsuarioEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const res = await usuarioService.obtenerTodos();
      // El backend retorna un array directamente en respuesta.data
      if (Array.isArray(res)) {
        setUsuarios(res);
      } else if (res && Array.isArray(res.data)) {
        setUsuarios(res.data);
      }
    } catch (ex) {
      console.error(ex);
      toast.error('Error al cargar los usuarios del sistema.');
    } finally {
      setCargando(false);
    }
  };

  const cargarRendimiento = async () => {
    try {
      setCargandoRendimiento(true);
      const res = await usuarioService.obtenerRendimiento();
      if (res.ok) {
        setRendimiento(res.data || { cajeros: [], repartidores: [] });
      }
    } catch (ex) {
      console.error("Error al cargar rendimiento de personal:", ex);
    } finally {
      setCargandoRendimiento(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarUsuarios();
      cargarRendimiento();
    };
    inicializar();
  }, []);

  const abrirCrear = () => {
    setUsuarioEdit(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setRol('Cajero');
    setVerPassword(false);
    setMostrarForm(true);
  };

  const abrirEditar = (usr) => {
    setUsuarioEdit(usr);
    setNombre(usr.nombre_completo);
    setUsername(usr.email);
    setPassword(''); // Opcional, vacío por defecto
    setRol(usr.rol);
    setVerPassword(false);
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();

    if (!nombre.trim() || !username.trim()) {
      toast.error('Todos los campos obligatorios deben completarse.');
      return;
    }

    if (!usuarioEdit && password.length < 6) {
      toast.error('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    if (usuarioEdit && password.trim() && password.length < 6) {
      toast.error('La nueva contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    setProcesandoForm(true);
    try {
      const payload = {
        nombre_completo: nombre,
        email: username,
        rol,
      };

      if (!usuarioEdit) {
        payload.password = password;
        payload.estado = 'Activo';
        await usuarioService.crear(payload);
        toast.success('Usuario creado correctamente.');
        setMostrarForm(false);
        cargarUsuarios();
        cargarRendimiento();
      } else {
        if (password.trim()) {
          payload.password = password;
        }
        // Conservar el estado actual al editar en este modal
        payload.estado = usuarioEdit.estado;
        await usuarioService.actualizar(usuarioEdit.id, payload);
        toast.success('Usuario actualizado correctamente.');
        setMostrarForm(false);
        cargarUsuarios();
        cargarRendimiento();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al procesar el formulario de usuario.';
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setUsuarioEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      // Para la baja lógica, mandamos un PUT con estado 'Inactivo'
      const usr = usuarios.find(u => u.id === usuarioEliminarId);
      if (usr) {
        const payload = {
          nombre_completo: usr.nombre_completo,
          email: usr.email,
          rol: usr.rol,
          estado: 'Inactivo'
        };
        await usuarioService.actualizar(usr.id, payload);
        toast.success('Usuario desactivado (baja lógica).');
        setMostrarEliminar(false);
        cargarUsuarios();
        cargarRendimiento();
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo desactivar el usuario.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Filtrado de usuarios en tiempo real (Nombre, Correo o Rol)
  const usuariosFiltrados = usuarios.filter((usr) => {
    const matchTexto = buscarTexto.trim() === '' ||
      (usr.nombre_completo || '').toLowerCase().includes(buscarTexto.toLowerCase()) ||
      (usr.email || '').toLowerCase().includes(buscarTexto.toLowerCase()) ||
      (usr.rol || '').toLowerCase().includes(buscarTexto.toLowerCase());
    const matchRol = rolSeleccionado === '' || usr.rol === rolSeleccionado;
    const matchEstado = estadoSeleccionado === '' || usr.estado === estadoSeleccionado;
    return matchTexto && matchRol && matchEstado;
  });

  // Lógica de paginación sobre el listado filtrado
  const totalPaginas = Math.ceil(usuariosFiltrados.length / itemsPorPagina) || 1;
  const paginaEfectiva = Math.min(pagina, totalPaginas);
  const indicePrimerItem = (paginaEfectiva - 1) * itemsPorPagina;
  const usuariosPaginados = usuariosFiltrados.slice(indicePrimerItem, indicePrimerItem + itemsPorPagina);

  // Ordenamiento de rankings de rendimiento (Top 3)
  const cajerosOrdenados = [...(rendimiento.cajeros || [])].sort((a, b) => b.monto_total - a.monto_total);
  const repartidoresOrdenados = [...(rendimiento.repartidores || [])].sort((a, b) => b.efectividad_entrega - a.efectividad_entrega);

  /* Colores de badge según rol */
  const rolBadge = (rolStr) => {
    switch (rolStr) {
      case 'Administrador': return 'badge-purple';
      case 'Cajero':        return 'badge-info';
      case 'Repartidor':    return 'badge-warning';
      default:              return 'badge-gray';
    }
  };

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
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserCog size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Gestión de Personal</h3>
            <p className="page-subtitle">Administra los accesos, roles y permisos de los operadores</p>
          </div>
        </div>
        <button onClick={abrirCrear} className="btn-primary">
          <Plus size={15} />
          Nuevo Usuario
        </button>
      </div>

      {/* ── SECCIÓN DE INDICADORES DE RENDIMIENTO ── */}
      {!cargandoRendimiento && (cajerosOrdenados.length > 0 || repartidoresOrdenados.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-2">
          {/* Panel Cajeros */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <Award className="text-purple-600" size={18} />
              <h4 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">Rendimiento de Facturación (Cajeros)</h4>
            </div>
            <div className="space-y-3">
              {cajerosOrdenados.slice(0, 3).map((cajero, idx) => (
                <div key={cajero.usuario_id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:bg-zinc-100/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-400 font-mono">#{idx + 1}</span>
                    <div>
                      <p className="font-bold text-zinc-950 text-xs">{cajero.nombre_completo}</p>
                      <p className="text-[10px] text-zinc-400 font-semibold">{cajero.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900 text-xs">Bs. {Number(cajero.monto_total).toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">{cajero.total_ventas} ventas</p>
                  </div>
                </div>
              ))}
              {cajerosOrdenados.length === 0 && (
                <p className="text-xs text-zinc-400 italic text-center py-4">No hay datos de rendimiento para cajeros.</p>
              )}
            </div>
          </div>

          {/* Panel Repartidores */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-emerald-600" size={18} />
              <h4 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">Efectividad de Entrega (Repartidores)</h4>
            </div>
            <div className="space-y-3">
              {repartidoresOrdenados.slice(0, 3).map((rep, idx) => (
                <div key={rep.usuario_id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:bg-zinc-100/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-400 font-mono">#{idx + 1}</span>
                    <div>
                      <p className="font-bold text-zinc-950 text-xs">{rep.nombre_completo}</p>
                      <p className="text-[10px] text-zinc-400 font-semibold">{rep.vehiculo} • Placa {rep.placa}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-xs">{rep.efectividad_entrega}% Efec.</p>
                    <p className="text-[10px] text-zinc-500 font-medium">✔️ {rep.envios_entregados} / ❌ {rep.envios_cancelados}</p>
                  </div>
                </div>
              ))}
              {repartidoresOrdenados.length === 0 && (
                <p className="text-xs text-zinc-400 italic text-center py-4">No hay datos de rendimiento para repartidores.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL DE BÚSQUEDA Y FILTRADO ── */}
      <PanelFiltroBusqueda
        buscarTexto={buscarTexto}
        alCambiarBuscarTexto={(val) => { setBuscarTexto(val); setPagina(1); }}
        categoriaSeleccionada={rolSeleccionado}
        alCambiarCategoria={(val) => { setRolSeleccionado(val); setPagina(1); }}
        categorias={[
          { id: 'Administrador', nombre: 'Administrador' },
          { id: 'Cajero', nombre: 'Cajero' },
          { id: 'Repartidor', nombre: 'Repartidor' }
        ]}
        etiquetaCategoria="Rol"
        placeholder="Buscar por nombre o correo electrónico..."
        estadoSeleccionado={estadoSeleccionado}
        alCambiarEstado={(val) => { setEstadoSeleccionado(val); setPagina(1); }}
      />

      {/* ── TABLA ── */}
      <div className="table-wrapper">
        {/* Vista para Escritorio */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '640px' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4 text-left">Nombre Completo</th>
                <th className="py-3 px-4 text-left">Correo Electrónico</th>
                <th className="py-3 px-4 text-center">Rol de Acceso</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontWeight: 500 }}>
                    Cargando usuarios del sistema...
                  </td>
                </tr>
              </tbody>
            ) : usuariosPaginados.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No se registran usuarios en el sistema.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {usuariosPaginados.map((usr) => (
                  <tr key={usr.id}>
                    <td className="bold py-3 px-4 text-left">{usr.nombre_completo}</td>
                    <td className="py-3 px-4 text-left" style={{ color: '#6b7280' }}>{usr.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${rolBadge(usr.rol)}`}>
                        {usr.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${usr.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                        {usr.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => abrirEditar(usr)}
                          className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                          title="Editar usuario"
                        >
                          <Edit3 size={14} />
                        </button>
                        {usr.estado === 'Activo' && usr.email !== 'admin@tiendalocal.com' && (
                          <button
                            onClick={() => abrirDesactivar(usr.id)}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition duration-150 cursor-pointer"
                            title="Desactivar usuario"
                          >
                            <Trash2 size={14} />
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

        {/* Vista para Móviles (Cards responsivos Mobile-First) */}
        {!cargando && usuarios.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {usuariosPaginados.map((usr) => (
              <div key={usr.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs hover:border-purple-250 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{usr.nombre_completo}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{usr.email}</p>
                  </div>
                  <span className={`badge ${usr.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                    {usr.estado}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Rol de Acceso</span>
                    <div className="mt-0.5">
                      <span className={`badge ${rolBadge(usr.rol)}`}>
                        {usr.rol}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirEditar(usr)}
                      className="flex justify-center items-center p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-gray-700 rounded-xl transition-colors"
                      title="Editar usuario"
                    >
                      <Edit3 size={14} />
                    </button>
                    {usr.estado === 'Activo' && usr.email !== 'admin@tiendalocal.com' && (
                      <button
                        onClick={() => abrirDesactivar(usr.id)}
                        className="flex justify-center items-center p-2 text-rose-650 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition-colors"
                        title="Desactivar usuario"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginadorTablas
          totalItems={usuariosFiltrados.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={paginaEfectiva}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* ── MODAL FORMULARIO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '460px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #7c3aed, #6d28d9)' }} />

            <div className="modal-header">
              <span className="modal-title">
                {usuarioEdit ? '✏️ Editar Usuario' : '👤 Nuevo Usuario del Sistema'}
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
                  <label className="form-label">Nombre Completo *</label>
                  <input
                    type="text" required value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="form-input"
                  />
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Correo Electrónico (Email) *</label>
                  <input
                    type="email" required value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. jperez@tiendamargarita.com"
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Rol de Acceso *</label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="form-input"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Repartidor">Repartidor</option>
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">
                    {usuarioEdit ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={verPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={usuarioEdit ? 'Dejar en blanco para no modificar' : 'Mínimo 6 caracteres'}
                      className="form-input"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword(!verPassword)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9ca3af', display: 'flex', alignItems: 'center',
                      }}
                    >
                      {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setMostrarForm(false)} disabled={procesandoForm} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={procesandoForm} className="btn-primary">
                  {procesandoForm ? 'Guardando...' : usuarioEdit ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMACIÓN BAJA ── */}
      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Confirmar Desactivación de Usuario"
        mensaje="Al desactivar este usuario, no podrá iniciar sesión ni realizar operaciones en el sistema. Sus registros históricos se conservarán intactos."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionUsuarios;
