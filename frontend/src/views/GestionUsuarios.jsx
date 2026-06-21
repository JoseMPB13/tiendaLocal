/**
 * Vista: GestionUsuarios.jsx
 * Módulo de gestión del personal y cuentas de acceso al sistema.
 * Solo accesible para el rol Administrador. Diseño premium coherente.
 */

import { useState, useEffect } from 'react';
import usuarioService from '../services/usuarioService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Eye, EyeOff, UserCog } from 'lucide-react';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

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

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarUsuarios();
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
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo desactivar el usuario.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Lógica de paginación
  const totalItems = usuarios.length;
  const indiceUltimoItem = pagina * itemsPorPagina;
  const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
  const usuariosPaginados = usuarios.slice(indicePrimerItem, indiceUltimoItem);

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

      {/* ── TABLA ── */}
      <div className="table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Correo Electrónico</th>
                <th>Rol de Acceso</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
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
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {usuariosPaginados.map((usr) => (
                  <tr key={usr.id}>
                    <td className="bold">{usr.nombre_completo}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>
                      {usr.email}
                    </td>
                    <td>
                      <span className={`badge ${rolBadge(usr.rol)}`}>{usr.rol}</span>
                    </td>
                    <td>
                      <span className={`badge ${usr.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                        {usr.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => abrirEditar(usr)} className="btn-icon" title="Editar usuario">
                          <Edit3 size={15} />
                        </button>
                        {usr.estado === 'Activo' && (
                          <button onClick={() => abrirDesactivar(usr.id)} className="btn-icon danger" title="Dar de baja">
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

        <PaginadorTablas
          totalItems={totalItems}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
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
